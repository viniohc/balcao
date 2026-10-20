import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db, normalizeSalesDateKeys } from '@/services/db'
import { getDateKey } from '@/services/date'
import { subscribeCloudSales } from '@/services/firestore/sales'
import { mergeRemoteRecords, saveLocalRecord, syncLocalRecord } from '@/services/sync'
import { useFairsStore } from '@/stores/fairs'
import type { CartItem, CommandQueueItem, CommandStatus, PaymentMethod, Sale, SaleItem } from '@/types/models'

interface CreateSaleInput {
  items: CartItem[]
  paymentMethod: PaymentMethod
  amountReceived?: number
  commandNumber?: string
  observation?: string
}

interface UpdateSaleInput {
  saleId: string
  items: CartItem[]
  paymentMethod: PaymentMethod
  amountReceived?: number
  commandNumber?: string
  observation?: string
}

export const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  card: 'CartÃ£o',
}

export const useSalesStore = defineStore('sales', () => {
  const sales = ref<Sale[]>([])
  const loading = ref(false)
  const realtimeError = ref('')
  let unsubscribeRealtime: (() => void) | undefined
  let realtimeGeneration = 0

  const todaySales = computed(() => {
    const today = getDateKey()
    return sales.value
      .filter((sale) => sale.dateKey === today)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })

  const commandItems = computed<CommandQueueItem[]>(() =>
    sales.value
      .filter((sale) => sale.status === 'confirmado' && sale.commandNumber)
      .map((sale) => ({
        saleId: sale.id,
        commandNumber: sale.commandNumber ?? '',
        status: sale.commandStatus ?? 'pendente',
        createdAt: sale.createdAt,
        updatedAt: sale.commandUpdatedAt,
        returnedAt: sale.commandReturnedAt,
        observation: sale.observation,
        items: sale.items,
        total: sale.total,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  )

  const pendingCommandItems = computed(() =>
    commandItems.value.filter((item) => item.status === 'pendente' || item.status === 'preparando'),
  )

  const readyCommandItems = computed(() =>
    commandItems.value.filter((item) => item.status === 'pronto' || item.status === 'chamado'),
  )

  const loadSales = async (requestedFairId?: string) => {
    const fairsStore = useFairsStore()
    const fairId = requestedFairId ?? fairsStore.selectedFairId
    if (!fairId) {
      sales.value = []
      return
    }

    loading.value = true
    try {
      const storedSales = await db.sales.where('fairId').equals(fairId).toArray()
      const normalizedSales = normalizeSalesDateKeys(storedSales)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      if (fairsStore.selectedFairId === fairId) {
        sales.value = normalizedSales
      }
    } finally {
      loading.value = false
    }
  }

  const createSale = async ({ items, paymentMethod, amountReceived, commandNumber, observation }: CreateSaleInput) => {
    const fairsStore = useFairsStore()
    const fairId = fairsStore.selectedFairId
    if (!fairId) {
      throw new Error('Selecione uma feira.')
    }

    if (items.length === 0) {
      throw new Error('Adicione pelo menos um item.')
    }

    const total = items.reduce((sum, item) => sum + item.total, 0)
    if (paymentMethod === 'cash' && (amountReceived ?? 0) < total) {
      throw new Error('Valor recebido menor que o total.')
    }

    const createdAt = new Date().toISOString()
    const normalizedItems: SaleItem[] = items.map((item) => ({
      ...item,
      lineId: item.lineId ?? crypto.randomUUID(),
    }))
    const cleanCommandNumber = commandNumber?.trim()
    const cleanObservation = observation?.trim()

    const sale: Sale = {
      id: crypto.randomUUID(),
      fairId,
      createdAt,
      dateKey: getDateKey(new Date(createdAt)),
      items: normalizedItems,
      subtotal: total,
      total,
      paymentMethod,
      amountReceived: paymentMethod === 'cash' ? amountReceived : undefined,
      change: paymentMethod === 'cash' ? (amountReceived ?? 0) - total : undefined,
      status: 'confirmado',
      observation: cleanObservation || undefined,
      commandNumber: cleanCommandNumber || undefined,
      commandStatus: cleanCommandNumber ? 'pendente' : undefined,
      commandUpdatedAt: cleanCommandNumber ? createdAt : undefined,
    }

    await saveLocalRecord('sales', sale)
    await syncLocalRecord('sales', fairId, sale.id)
    await fairsStore.refreshSyncStatus(fairId)
    await loadSales(fairId)
    return sale
  }

  const cancelSale = async (saleId: string) => {
    const fairsStore = useFairsStore()
    const fairId = fairsStore.selectedFairId
    if (!fairId) throw new Error('Selecione uma feira.')

    const sale = await db.sales.get([fairId, saleId])
    if (!sale) throw new Error('Venda nÃ£o encontrada.')

    const updated: Sale = {
      ...sale,
      status: 'cancelado',
      cancelledAt: new Date().toISOString(),
    }
    await saveLocalRecord('sales', updated)
    await syncLocalRecord('sales', fairId, saleId)
    await fairsStore.refreshSyncStatus(fairId)
    await loadSales(fairId)
  }

  const updateSale = async ({ saleId, items, paymentMethod, amountReceived, commandNumber, observation }: UpdateSaleInput) => {
    const fairsStore = useFairsStore()
    const fairId = fairsStore.selectedFairId
    if (!fairId) throw new Error('Selecione uma feira.')

    const sale = await db.sales.get([fairId, saleId])
    if (!sale) {
      throw new Error('Venda nÃ£o encontrada.')
    }

    if (sale.status === 'cancelado') {
      throw new Error('Venda cancelada nÃ£o pode ser editada.')
    }

    if (items.length === 0) {
      throw new Error('O pedido precisa ter pelo menos um item.')
    }

    const normalizedItems = items
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        ...item,
        total: item.unitPrice * item.quantity,
      }))
    const total = normalizedItems.reduce((sum, item) => sum + item.total, 0)

    if (paymentMethod === 'cash' && (amountReceived ?? 0) < total) {
      throw new Error('Valor recebido menor que o total.')
    }

    const cleanCommandNumber = commandNumber?.trim()
    const cleanObservation = observation?.trim()
    const hadCommandNumber = Boolean(sale.commandNumber)
    const hasCommandNumber = Boolean(cleanCommandNumber)

    const updatedSale: Sale = {
      ...sale,
      items: normalizedItems.map((item) => ({
        ...item,
        lineId: item.lineId ?? crypto.randomUUID(),
      })),
      subtotal: total,
      total,
      paymentMethod,
      amountReceived: paymentMethod === 'cash' ? amountReceived : undefined,
      change: paymentMethod === 'cash' ? (amountReceived ?? 0) - total : undefined,
      observation: cleanObservation || undefined,
      commandNumber: cleanCommandNumber || undefined,
      commandStatus: hasCommandNumber ? (sale.commandStatus ?? 'pendente') : undefined,
      commandUpdatedAt: hasCommandNumber
        ? (hadCommandNumber ? sale.commandUpdatedAt : new Date().toISOString())
        : undefined,
    }

    await saveLocalRecord('sales', updatedSale)
    await syncLocalRecord('sales', fairId, saleId)
    await fairsStore.refreshSyncStatus(fairId)
    await loadSales(fairId)
  }

  const updateCommandStatus = async (saleId: string, status: CommandStatus) => {
    const fairsStore = useFairsStore()
    const fairId = fairsStore.selectedFairId
    if (!fairId) throw new Error('Selecione uma feira.')

    const sale = await db.sales.get([fairId, saleId])
    if (!sale) {
      throw new Error('Venda nao encontrada.')
    }

    const updatedAt = new Date().toISOString()
    const isReturningToKitchen = status === 'preparando' && (sale.commandStatus === 'pronto' || sale.commandStatus === 'chamado')
    const updatedSale: Sale = {
      ...sale,
      commandStatus: status,
      commandUpdatedAt: updatedAt,
      commandReturnedAt: isReturningToKitchen ? updatedAt : sale.commandReturnedAt,
    }

    await saveLocalRecord('sales', updatedSale)
    await syncLocalRecord('sales', fairId, saleId)
    await fairsStore.refreshSyncStatus(fairId)
    await loadSales(fairId)
  }

  const startRealtime = async () => {
    const fairsStore = useFairsStore()
    const fairId = fairsStore.selectedFairId
    if (!fairId) {
      stopRealtime()
      return
    }

    stopRealtime()
    const generation = realtimeGeneration
    realtimeError.value = ''

    try {
      const unsubscribe = await subscribeCloudSales(
        fairId,
        async (cloudSales) => {
          if (generation !== realtimeGeneration) return
          await mergeRemoteRecords('sales', fairId, cloudSales)
          if (generation !== realtimeGeneration) return
          if (fairsStore.selectedFairId === fairId) {
            await loadSales(fairId)
            await fairsStore.refreshSyncStatus(fairId)
          }
        },
        (error) => {
          if (generation === realtimeGeneration) realtimeError.value = error.message
        },
      )

      if (generation === realtimeGeneration && fairsStore.selectedFairId === fairId) {
        unsubscribeRealtime = unsubscribe
      } else {
        unsubscribe()
      }
    } catch (error) {
      if (generation === realtimeGeneration) {
        realtimeError.value = error instanceof Error ? error.message : 'Realtime indisponivel.'
      }
    }
  }

  const stopRealtime = () => {
    realtimeGeneration += 1
    unsubscribeRealtime?.()
    unsubscribeRealtime = undefined
  }

  const salesByDate = (dateKey: string) =>
    sales.value
      .filter((sale) => sale.dateKey === dateKey)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    sales,
    todaySales,
    commandItems,
    pendingCommandItems,
    readyCommandItems,
    loading,
    realtimeError,
    loadSales,
    startRealtime,
    stopRealtime,
    createSale,
    cancelSale,
    updateSale,
    updateCommandStatus,
    salesByDate,
  }
})