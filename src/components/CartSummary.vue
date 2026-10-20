<script setup lang="ts">
import { formatCurrency } from '@/services/currency'

defineProps<{
  total: number
  itemCount: number
  disabled: boolean
  hasObservation: boolean
}>()

const commandNumber = defineModel<string>('commandNumber', { required: true })

defineEmits<{
  open: []
  observation: []
  checkout: []
}>()
</script>

<template>
  <footer class="fixed inset-x-0 bottom-[4.5rem] z-30 mx-auto max-w-2xl px-3 md:bottom-4">
    <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500">{{ itemCount }} itens</p>
          <p class="text-3xl font-black leading-none text-slate-950">{{ formatCurrency(total) }}</p>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <label class="flex h-12 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-600">
            <input
              v-model.trim="commandNumber"
              inputmode="numeric"
              class="h-9 w-16 rounded-md border border-slate-300 bg-white px-2 text-center text-base font-black text-slate-950 outline-none focus:border-slate-950"
              placeholder="000"
            >
          </label>
          <button
            type="button"
            class="h-12 rounded-lg border px-3 text-sm font-black"
            :class="hasObservation ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-700'"
            @click="$emit('observation')"
          >
            Obs
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-3 py-3 text-sm font-black text-slate-800 disabled:opacity-40"
            :disabled="disabled"
            @click="$emit('open')"
          >
            Ver pedido
          </button>
          <button
            type="button"
            class="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 disabled:bg-slate-300 disabled:shadow-none"
            :disabled="disabled"
            @click="$emit('checkout')"
          >
            Finalizar
          </button>
        </div>
      </div>
    </div>
  </footer>
</template>
