<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PaymentPanel from '@/components/PaymentPanel.vue'
import { formatCurrency } from '@/services/currency'
import { useCartStore } from '@/stores/cart'
import { useSalesStore } from '@/stores/sales'
import { APP_STORAGE_KEYS } from '@/services/storage'
import type { PaymentMethod } from '@/types/models'

const router = useRouter()
const cartStore = useCartStore()
const salesStore = useSalesStore()
const paymentMethod = ref<PaymentMethod>('cash')
const amountReceived = ref<number | undefined>()
const errorMessage = ref('')
const saving = ref(false)

const canConfirm = computed(() => {
  if (cartStore.isEmpty) return false
  if (paymentMethod.value !== 'cash') return true
  return (amountReceived.value ?? 0) >= cartStore.total
})

const confirmSale = async () => {
  errorMessage.value = ''
  saving.value = true

  try {
    await salesStore.createSale({
      items: cartStore.items,
      paymentMethod: paymentMethod.value,
      amountReceived: amountReceived.value,
      commandNumber: cartStore.commandNumber,
      observation: cartStore.observation,
    })
    cartStore.clearCart()
    sessionStorage.setItem(APP_STORAGE_KEYS.saleSaved, '1')
    router.push('/sale')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Não foi possível salvar a venda.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="mx-auto min-h-dvh max-w-2xl px-4 py-4 pb-28">
    <header class="mb-4 flex items-center justify-between">
      <button type="button" class="rounded-lg bg-white px-3 py-2 text-sm font-black shadow-sm" @click="router.back()">
        Voltar
      </button>
      <h1 class="text-xl font-black">Finalizar</h1>
      <span class="w-16" />
    </header>

    <div v-if="cartStore.isEmpty" class="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
      <p class="font-bold text-slate-600">Pedido vazio.</p>
      <button type="button" class="mt-4 rounded-lg bg-slate-950 px-4 py-3 font-black text-white" @click="router.push('/sale')">
        Ir para venda
      </button>
    </div>

    <div v-else class="space-y-4">
      <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-lg font-black">Resumo</h2>
          <p class="text-2xl font-black text-emerald-700">{{ formatCurrency(cartStore.total) }}</p>
        </div>
        <ul class="space-y-2">
          <li v-for="item in cartStore.items" :key="item.productId" class="flex justify-between gap-3 text-sm">
            <span class="font-semibold text-slate-700">{{ item.quantity }}x {{ item.productName }}</span>
            <span class="font-bold text-slate-950">{{ formatCurrency(item.total) }}</span>
          </li>
        </ul>
        <p v-if="cartStore.commandNumber" class="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-black text-amber-800">
          Vai para a cozinha como comanda {{ cartStore.commandNumber }}.
        </p>
        <p v-if="cartStore.observation" class="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">
          Observação: {{ cartStore.observation }}
        </p>
      </section>

      <PaymentPanel v-model:payment-method="paymentMethod" v-model:amount-received="amountReceived" :total="cartStore.total" />

      <p v-if="errorMessage" class="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{{ errorMessage }}</p>

      <button
        type="button"
        class="fixed inset-x-4 bottom-[5.25rem] mx-auto max-w-2xl rounded-xl bg-emerald-600 py-4 text-lg font-black text-white shadow-xl shadow-emerald-200 disabled:bg-slate-300 disabled:shadow-none md:bottom-5"
        :disabled="!canConfirm || saving"
        @click="confirmSale"
      >
        {{ saving ? 'Salvando...' : 'Confirmar venda' }}
      </button>
    </div>
  </section>
</template>
