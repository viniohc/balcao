<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PaymentMethod } from '@/types/models'
import { formatCurrency, parseCurrencyInput } from '@/services/currency'

const props = defineProps<{
  total: number
}>()

const paymentMethod = defineModel<PaymentMethod>('paymentMethod', { required: true })
const amountReceived = defineModel<number | undefined>('amountReceived')
const amountInput = ref('')

const quickValues = [10, 20, 50, 100, 200]
const change = computed(() => (amountReceived.value ?? 0) - props.total)
const cashIsInvalid = computed(() => paymentMethod.value === 'cash' && change.value < 0)

watch(amountInput, (value) => {
  amountReceived.value = parseCurrencyInput(value)
})

watch(paymentMethod, (value) => {
  if (value !== 'cash') {
    amountInput.value = ''
    amountReceived.value = undefined
  }
})

const setQuickValue = (value: number) => {
  amountInput.value = value.toFixed(2).replace('.', ',')
}
</script>

<template>
  <section class="space-y-4">
    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="method in [
          { value: 'cash', label: 'Dinheiro' },
          { value: 'pix', label: 'Pix' },
          { value: 'card', label: 'Cartão' },
        ]"
        :key="method.value"
        type="button"
        class="rounded-lg border px-3 py-4 text-sm font-black transition"
        :class="paymentMethod === method.value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'"
        @click="paymentMethod = method.value as PaymentMethod"
      >
        {{ method.label }}
      </button>
    </div>

    <div v-if="paymentMethod === 'cash'" class="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <label class="block">
        <span class="text-sm font-bold text-slate-600">Valor recebido</span>
        <input
          v-model="amountInput"
          inputmode="decimal"
          class="mt-1 h-14 w-full rounded-lg border border-slate-300 px-4 text-2xl font-black outline-none focus:border-slate-950"
          placeholder="0,00"
        >
      </label>

      <div class="grid grid-cols-5 gap-2">
        <button
          v-for="value in quickValues"
          :key="value"
          type="button"
          class="rounded-lg bg-slate-100 py-3 text-sm font-black text-slate-800"
          @click="setQuickValue(value)"
        >
          {{ formatCurrency(value).replace(',00', '') }}
        </button>
      </div>

      <div class="rounded-lg p-4" :class="cashIsInvalid ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'">
        <p class="text-sm font-bold">{{ cashIsInvalid ? 'Falta receber' : 'Troco' }}</p>
        <p class="text-3xl font-black">{{ formatCurrency(Math.abs(change)) }}</p>
      </div>
    </div>
  </section>
</template>
