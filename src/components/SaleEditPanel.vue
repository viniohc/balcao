<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PaymentPanel from '@/components/PaymentPanel.vue'
import { formatCurrency } from '@/services/currency'
import type { CartItem, PaymentMethod, Product, Sale } from '@/types/models'

const props = defineProps<{
  sale: Sale
  products: Product[]
}>()

const emit = defineEmits<{
  save: [payload: {
    saleId: string
    items: CartItem[]
    paymentMethod: PaymentMethod
    amountReceived?: number
    commandNumber?: string
    observation?: string
  }]
  cancel: []
}>()

const items = ref<CartItem[]>([])
const paymentMethod = ref<PaymentMethod>('pix')
const amountReceived = ref<number | undefined>()
const commandNumber = ref('')
const observation = ref('')
const total = computed(() => items.value.reduce((sum, item) => sum + item.total, 0))
const canSave = computed(() => {
  if (items.value.length === 0) return false
  if (paymentMethod.value !== 'cash') return true
  return (amountReceived.value ?? 0) >= total.value
})

watch(
  () => props.sale,
  (sale) => {
    items.value = sale.items.map((item) => ({ ...item }))
    paymentMethod.value = sale.paymentMethod
    amountReceived.value = sale.amountReceived
    commandNumber.value = sale.commandNumber ?? ''
    observation.value = sale.observation ?? ''
  },
  { immediate: true },
)

const setQuantity = (productId: string, quantity: number) => {
  const current = items.value.find((item) => item.productId === productId)
  if (!current) return

  if (quantity <= 0) {
    items.value = items.value.filter((item) => item.productId !== productId)
    return
  }

  current.quantity = quantity
  current.total = current.unitPrice * quantity
}

const addProduct = (product: Product) => {
  const current = items.value.find((item) => item.productId === product.id)
  if (current) {
    setQuantity(current.productId, current.quantity + 1)
    return
  }

  items.value.push({
    lineId: crypto.randomUUID(),
    productId: product.id,
    productName: product.name,
    unitPrice: product.price,
    quantity: 1,
    total: product.price,
  })
}

const save = () => {
  emit('save', {
    saleId: props.sale.id,
    items: items.value.map((item) => ({ ...item })),
    paymentMethod: paymentMethod.value,
    amountReceived: amountReceived.value,
    commandNumber: commandNumber.value,
    observation: observation.value,
  })
}
</script>

<template>
  <section class="fixed inset-0 z-50 bg-slate-950/50">
    <div class="mx-auto flex h-dvh w-full max-w-2xl flex-col bg-white shadow-2xl">
      <header class="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-black">Editar pedido</h2>
            <p class="text-sm font-semibold text-slate-500">A venda será atualizada no histórico.</p>
          </div>
          <button type="button" class="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black" @click="$emit('cancel')">
            Fechar
          </button>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto px-4 py-4 pb-28">
        <div class="space-y-3">
          <article v-for="item in items" :key="item.productId" class="rounded-lg border border-slate-200 p-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-black text-slate-950">{{ item.productName }}</p>
                <p class="text-sm font-semibold text-slate-500">{{ formatCurrency(item.unitPrice) }} cada</p>
              </div>
              <p class="font-black text-emerald-700">{{ formatCurrency(item.total) }}</p>
            </div>
            <div class="mt-3 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <button type="button" class="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-xl font-black" @click="setQuantity(item.productId, item.quantity - 1)">-</button>
                <span class="w-10 text-center font-black">{{ item.quantity }}</span>
                <button type="button" class="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-xl font-black text-white" @click="setQuantity(item.productId, item.quantity + 1)">+</button>
              </div>
              <button type="button" class="rounded-lg px-3 py-2 text-sm font-bold text-red-600" @click="setQuantity(item.productId, 0)">
                Remover
              </button>
            </div>
          </article>
        </div>

        <div class="mt-4">
          <p class="mb-2 text-sm font-black text-slate-600">Adicionar produto</p>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              v-for="product in products"
              :key="product.id"
              type="button"
              class="rounded-lg border border-slate-200 px-3 py-3 text-left text-sm font-black"
              @click="addProduct(product)"
            >
              {{ product.name }}
              <span class="block text-emerald-700">{{ formatCurrency(product.price) }}</span>
            </button>
          </div>
        </div>

        <div class="mt-4 rounded-lg bg-slate-50 p-4">
          <div class="mb-4 grid gap-3 sm:grid-cols-[10rem_1fr]">
            <label class="block">
              <span class="text-sm font-bold text-slate-600">Comanda</span>
              <input
                v-model.trim="commandNumber"
                inputmode="numeric"
                class="mt-1 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none focus:border-slate-950"
                placeholder="000"
              >
            </label>
            <label class="block">
              <span class="text-sm font-bold text-slate-600">Observação</span>
              <input
                v-model.trim="observation"
                class="mt-1 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base font-semibold text-slate-950 outline-none focus:border-slate-950"
                maxlength="300"
                placeholder="Ex: sem cebola"
              >
            </label>
          </div>

          <div class="mb-4 flex items-center justify-between">
            <span class="text-sm font-bold uppercase text-slate-500">Novo total</span>
            <span class="text-3xl font-black text-slate-950">{{ formatCurrency(total) }}</span>
          </div>
          <PaymentPanel v-model:payment-method="paymentMethod" v-model:amount-received="amountReceived" :total="total" />
        </div>
      </div>

      <footer class="sticky bottom-0 border-t border-slate-200 bg-white p-4">
        <button
          type="button"
          class="w-full rounded-lg bg-emerald-600 py-4 text-lg font-black text-white shadow-lg shadow-emerald-200 disabled:bg-slate-300 disabled:shadow-none"
          :disabled="!canSave"
          @click="save"
        >
          Salvar alterações
        </button>
      </footer>
    </div>
  </section>
</template>
