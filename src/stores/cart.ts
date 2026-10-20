import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { CartItem, Product } from '@/types/models'

const toCartItem = (product: Product, quantity: number): CartItem => ({
  lineId: crypto.randomUUID(),
  productId: product.id,
  productName: product.name,
  unitPrice: product.price,
  quantity,
  total: product.price * quantity,
})

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const commandNumber = ref('')
  const observation = ref('')

  const total = computed(() => items.value.reduce((sum, item) => sum + item.total, 0))
  const itemCount = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))
  const isEmpty = computed(() => items.value.length === 0)

  const getQuantity = (productId: string) =>
    items.value.find((item) => item.productId === productId)?.quantity ?? 0

  const addProduct = (product: Product) => {
    const current = items.value.find((item) => item.productId === product.id)
    if (current) {
      current.quantity += 1
      current.total = current.quantity * current.unitPrice
      return
    }

    items.value.push(toCartItem(product, 1))
  }

  const setQuantity = (productId: string, quantity: number) => {
    const safeQuantity = Math.max(0, quantity)
    const current = items.value.find((item) => item.productId === productId)
    if (!current) return

    if (safeQuantity === 0) {
      items.value = items.value.filter((item) => item.productId !== productId)
      return
    }

    current.quantity = safeQuantity
    current.total = current.quantity * current.unitPrice
  }

  const clearCart = () => {
    items.value = []
    commandNumber.value = ''
    observation.value = ''
  }

  return {
    items,
    commandNumber,
    observation,
    total,
    itemCount,
    isEmpty,
    getQuantity,
    addProduct,
    setQuantity,
    clearCart,
  }
})
