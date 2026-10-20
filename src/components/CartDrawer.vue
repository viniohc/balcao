<script setup lang="ts">
import type { CartItem } from '@/types/models'
import { formatCurrency } from '@/services/currency'

defineProps<{
  open: boolean
  items: CartItem[]
  total: number
}>()

defineEmits<{
  close: []
  increment: [productId: string, quantity: number]
  decrement: [productId: string, quantity: number]
  remove: [productId: string]
}>()
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 bg-slate-950/40" @click.self="$emit('close')">
    <section class="absolute inset-x-0 bottom-0 mx-auto max-h-[82dvh] max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-black">Pedido</h2>
        <button type="button" class="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold" @click="$emit('close')">
          Fechar
        </button>
      </div>

      <div class="space-y-3">
        <article
          v-for="item in items"
          :key="item.productId"
          class="rounded-lg border border-slate-200 p-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-black text-slate-950">{{ item.productName }}</p>
              <p class="text-sm font-semibold text-slate-500">{{ formatCurrency(item.unitPrice) }} cada</p>
            </div>
            <p class="text-lg font-black text-slate-950">{{ formatCurrency(item.total) }}</p>
          </div>
          <div class="mt-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <button type="button" class="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-2xl font-black" @click="$emit('decrement', item.productId, item.quantity - 1)">-</button>
              <span class="w-10 text-center text-lg font-black">{{ item.quantity }}</span>
              <button type="button" class="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-2xl font-black text-white" @click="$emit('increment', item.productId, item.quantity + 1)">+</button>
            </div>
            <button type="button" class="rounded-lg px-3 py-2 text-sm font-bold text-red-600" @click="$emit('remove', item.productId)">
              Remover
            </button>
          </div>
        </article>
      </div>

      <div class="sticky bottom-0 mt-4 border-t border-slate-200 bg-white pt-4">
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold uppercase text-slate-500">Total</span>
          <span class="text-3xl font-black">{{ formatCurrency(total) }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
