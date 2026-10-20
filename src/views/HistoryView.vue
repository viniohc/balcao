<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SaleEditPanel from '@/components/SaleEditPanel.vue'
import SaleHistoryItem from '@/components/SaleHistoryItem.vue'
import { getDateKey, isDateKey } from '@/services/date'
import { useProductsStore } from '@/stores/products'
import { useFairsStore } from '@/stores/fairs'
import { useSalesStore } from '@/stores/sales'
import { useSettingsStore } from '@/stores/settings'
import type { CartItem, PaymentMethod, Sale } from '@/types/models'

const salesStore = useSalesStore()
const productsStore = useProductsStore()
const fairsStore = useFairsStore()
const settingsStore = useSettingsStore()
const selectedDate = ref(getDateKey())
const historyMode = ref<'day' | 'all'>('day')
const editingSale = ref<Sale | undefined>()
const editingSession = ref(0)
const errorMessage = ref('')
const syncing = ref(false)
const sales = computed(() =>
  historyMode.value === 'day'
    ? salesStore.salesByDate(selectedDate.value)
    : [...salesStore.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

onMounted(async () => {
  await Promise.all([
    salesStore.loadSales(),
    productsStore.loadProducts(),
  ])
})

const syncNow = async () => {
  errorMessage.value = ''
  syncing.value = true

  try {
    await fairsStore.syncSelectedFairToCloud()
    await Promise.all([
      salesStore.loadSales(),
      productsStore.loadProducts(),
      settingsStore.loadSettings(),
    ])
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Não foi possível sincronizar.'
  } finally {
    syncing.value = false
  }
}

const cancelSale = async (saleId: string) => {
  if (window.confirm('Cancelar esta venda? Ela continuará no histórico.')) {
    await salesStore.cancelSale(saleId)
    if (editingSale.value?.id === saleId) {
      editingSale.value = undefined
    }
  }
}

const startEditingSale = async (sale: Sale) => {
  editingSale.value = {
    ...sale,
    items: sale.items.map((item) => ({ ...item })),
  }
  editingSession.value += 1
}

const saveEditedSale = async (payload: {
  saleId: string
  items: CartItem[]
  paymentMethod: PaymentMethod
  amountReceived?: number
  commandNumber?: string
  observation?: string
}) => {
  errorMessage.value = ''
  try {
    await salesStore.updateSale(payload)
    editingSale.value = undefined
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Não foi possível editar a venda.'
  }
}

const updateSelectedDate = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  if (isDateKey(value)) {
    selectedDate.value = value
  }
}
</script>

<template>
  <section class="mx-auto min-h-dvh max-w-3xl px-4 py-4">
    <header class="mb-4 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black">Histórico</h1>
        <p class="text-sm font-semibold text-slate-500">{{ historyMode === 'day' ? 'Vendas do dia' : 'Vendas de toda a festa' }}</p>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <div class="grid grid-cols-2 rounded-lg border border-slate-200 bg-white p-1">
          <button type="button" class="rounded-md px-3 py-2 text-sm font-black" :class="historyMode === 'day' ? 'bg-slate-950 text-white' : 'text-slate-600'" @click="historyMode = 'day'">
            Dia
          </button>
          <button type="button" class="rounded-md px-3 py-2 text-sm font-black" :class="historyMode === 'all' ? 'bg-slate-950 text-white' : 'text-slate-600'" @click="historyMode = 'all'">
            Festa
          </button>
        </div>
        <input v-if="historyMode === 'day'" :value="selectedDate" type="date" class="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold" @input="updateSelectedDate">
        <button type="button" class="h-11 rounded-lg bg-slate-950 px-3 text-sm font-black text-white disabled:bg-slate-300" :disabled="syncing" @click="syncNow">
          {{ syncing ? 'Sync...' : 'Sync' }}
        </button>
      </div>
    </header>

    <p v-if="fairsStore.syncMessage && !errorMessage" class="mb-3 rounded-lg bg-slate-900 p-3 text-center text-sm font-black text-white">{{ fairsStore.syncMessage }}</p>

    <p v-if="errorMessage" class="mb-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{{ errorMessage }}</p>

    <SaleEditPanel
      v-if="editingSale"
      :key="`${editingSale.id}-${editingSession}`"
      :sale="editingSale"
      :products="productsStore.activeProducts"
      @save="saveEditedSale"
      @cancel="editingSale = undefined"
    />

    <div class="space-y-3">
      <SaleHistoryItem
        v-for="sale in sales"
        :key="sale.id"
        :sale="sale"
        @cancel="cancelSale"
        @edit="startEditingSale"
      />
    </div>

    <p v-if="sales.length === 0" class="mt-12 text-center font-semibold text-slate-500">
      Nenhuma venda neste período.
    </p>
  </section>
</template>
