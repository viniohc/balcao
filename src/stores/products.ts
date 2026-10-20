import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/services/db'
import { subscribeCloudProducts } from '@/services/firestore/products'
import { mergeRemoteRecords, saveLocalRecord, syncLocalRecord } from '@/services/sync'
import { useFairsStore } from '@/stores/fairs'
import type { Product, ProductCategory } from '@/types/models'

export const productCategories: ProductCategory[] = ['Comidas', 'Bebidas', 'Sobremesas', 'Outros']

const sortProducts = (products: Product[]) =>
  [...products].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

export const useProductsStore = defineStore('products', () => {
  const products = ref<Product[]>([])
  const loading = ref(false)
  const realtimeError = ref('')
  let unsubscribeRealtime: (() => void) | undefined
  let realtimeGeneration = 0

  const activeProducts = computed(() => sortProducts(products.value.filter((product) => product.active && !product.deleted)))

  const loadProducts = async (requestedFairId?: string) => {
    const fairsStore = useFairsStore()
    const fairId = requestedFairId ?? fairsStore.selectedFairId
    if (!fairId) {
      products.value = []
      return
    }

    loading.value = true
    const localProducts = await db.products.where('fairId').equals(fairId).toArray()
    if (fairsStore.selectedFairId === fairId) {
      products.value = sortProducts(localProducts.filter((product) => !product.deleted))
    }
    loading.value = false
  }

  const saveProduct = async (input: Omit<Product, 'id' | 'fairId' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const fairsStore = useFairsStore()
    const fairId = fairsStore.selectedFairId
    if (!fairId) {
      throw new Error('Selecione uma feira.')
    }

    if (input.price < 0) {
      throw new Error('PreÃ§o nÃ£o pode ser negativo.')
    }

    const timestamp = new Date().toISOString()
    const existing = input.id ? await db.products.get([fairId, input.id]) : undefined
    const product: Product = {
      id: input.id ?? crypto.randomUUID(),
      fairId,
      name: input.name.trim(),
      price: input.price,
      category: input.category,
      active: input.active,
      sortOrder: input.sortOrder,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }

    await saveLocalRecord('products', product)
    await syncLocalRecord('products', fairId, product.id)
    await fairsStore.refreshSyncStatus(fairId)
    await loadProducts(fairId)
  }

  const toggleProduct = async (product: Product) => {
    const fairsStore = useFairsStore()
    const updated: Product = {
      ...product,
      active: !product.active,
      updatedAt: new Date().toISOString(),
    }
    await saveLocalRecord('products', updated)
    await syncLocalRecord('products', updated.fairId, updated.id)
    await fairsStore.refreshSyncStatus(updated.fairId)
    await loadProducts(updated.fairId)
  }

  const deleteProduct = async (product: Product) => {
    const fairsStore = useFairsStore()
    const timestamp = new Date().toISOString()
    const updated: Product = {
      ...product,
      active: false,
      deleted: true,
      deletedAt: timestamp,
      updatedAt: timestamp,
    }

    await saveLocalRecord('products', updated)
    await syncLocalRecord('products', updated.fairId, updated.id)
    await fairsStore.refreshSyncStatus(updated.fairId)
    await loadProducts(updated.fairId)
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
      const unsubscribe = await subscribeCloudProducts(
        fairId,
        async (cloudProducts) => {
          if (generation !== realtimeGeneration) return
          await mergeRemoteRecords('products', fairId, cloudProducts)
          if (generation !== realtimeGeneration) return
          if (fairsStore.selectedFairId === fairId) {
            await loadProducts(fairId)
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

  return {
    products,
    activeProducts,
    loading,
    realtimeError,
    loadProducts,
    startRealtime,
    stopRealtime,
    saveProduct,
    toggleProduct,
    deleteProduct,
  }
})