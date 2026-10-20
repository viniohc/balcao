<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SaleEditPanel from '@/components/SaleEditPanel.vue'
import { formatTime } from '@/services/date'
import { useProductsStore } from '@/stores/products'
import { useSalesStore } from '@/stores/sales'
import type { CartItem, PaymentMethod, Sale } from '@/types/models'

const salesStore = useSalesStore()
const productsStore = useProductsStore()
const editingSale = ref<Sale | undefined>()
const editingSession = ref(0)
const errorMessage = ref('')

onMounted(async () => {
  await Promise.all([
    salesStore.loadSales(),
    productsStore.loadProducts(),
  ])
  await salesStore.startRealtime()
})

const startEditingSale = (saleId: string) => {
  const sale = salesStore.sales.find((item) => item.id === saleId)
  if (!sale) return

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
    errorMessage.value = error instanceof Error ? error.message : 'Nao foi possivel editar a comanda.'
  }
}
</script>

<template>
  <section class="mx-auto min-h-dvh max-w-5xl px-4 py-4 pb-28">
    <header class="mb-4 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black">Comandas</h1>
        <p class="text-sm font-semibold text-slate-500">Pedidos que precisam ser preparados.</p>
      </div>
      <span class="rounded-full bg-slate-950 px-3 py-2 text-sm font-black text-white">
        {{ salesStore.pendingCommandItems.length }} pendentes
      </span>
    </header>

    <p v-if="salesStore.realtimeError" class="mb-3 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">
      Realtime indisponivel: {{ salesStore.realtimeError }}
    </p>

    <p v-if="errorMessage" class="mb-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{{ errorMessage }}</p>

    <SaleEditPanel
      v-if="editingSale"
      :key="`${editingSale.id}-${editingSession}`"
      :sale="editingSale"
      :products="productsStore.activeProducts"
      @save="saveEditedSale"
      @cancel="editingSale = undefined"
    />

    <div v-if="salesStore.pendingCommandItems.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="item in salesStore.pendingCommandItems"
        :key="item.saleId"
        class="rounded-xl border-2 bg-white p-4 shadow-sm"
        :class="item.returnedAt ? 'border-red-300 shadow-red-100' : 'border-slate-200'"
      >
        <p v-if="item.returnedAt" class="-mx-1 mb-3 rounded-lg bg-red-600 px-3 py-2 text-center text-sm font-black uppercase text-white">
          Voltou para cozinha
        </p>
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase text-slate-500">Comanda</p>
            <p class="text-5xl font-black leading-none text-slate-950">{{ item.commandNumber }}</p>
          </div>
          <p
            class="rounded-full px-2 py-1 text-xs font-black"
            :class="item.returnedAt ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'"
          >
            {{ item.status === 'preparando' ? 'Preparando' : formatTime(item.createdAt) }}
          </p>
        </div>
        <p v-if="item.returnedAt" class="mt-3 rounded-lg bg-red-50 p-3 text-sm font-black text-red-700">
          Revisar esta comanda. Ela voltou as {{ formatTime(item.returnedAt) }}.
        </p>

        <div class="mt-4 space-y-2 rounded-lg bg-slate-50 p-3">
          <p v-for="orderItem in item.items" :key="orderItem.lineId ?? orderItem.productId" class="text-lg font-black text-slate-950">
            {{ orderItem.quantity }}x {{ orderItem.productName }}
          </p>
        </div>
        <p v-if="item.observation" class="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-black text-amber-800">
          {{ item.observation }}
        </p>

        <button
          type="button"
          class="mt-4 w-full rounded-lg border border-slate-200 bg-white py-3 text-sm font-black text-slate-800"
          @click="startEditingSale(item.saleId)"
        >
          Editar comanda
        </button>
        <button
          v-if="item.status === 'pendente'"
          type="button"
          class="mt-4 w-full rounded-lg bg-amber-500 py-4 text-lg font-black text-white shadow-lg shadow-amber-100"
          @click="salesStore.updateCommandStatus(item.saleId, 'preparando')"
        >
          Marcar preparando
        </button>
        <button
          type="button"
          class="mt-2 w-full rounded-lg bg-emerald-600 py-4 text-lg font-black text-white shadow-lg shadow-emerald-100"
          @click="salesStore.updateCommandStatus(item.saleId, 'pronto')"
        >
          Marcar pronto
        </button>
      </article>
    </div>

    <p v-else class="mt-12 text-center font-semibold text-slate-500">
      Nenhuma comanda para preparar agora.
    </p>
  </section>
</template>
