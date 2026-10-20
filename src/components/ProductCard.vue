<script setup lang="ts">
import type { Product } from '@/types/models'
import { formatCurrency } from '@/services/currency'

defineProps<{
  product: Product
  quantity: number
}>()

defineEmits<{
  add: [product: Product]
}>()
</script>

<template>
  <button
    type="button"
    class="relative flex min-h-28 flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.98]"
    @click="$emit('add', product)"
  >
    <span
      v-if="quantity"
      class="absolute right-3 top-3 grid h-8 min-w-8 place-items-center rounded-full bg-slate-950 px-2 text-sm font-black text-white"
    >
      {{ quantity }}
    </span>
    <span class="max-w-[8.5rem] text-lg font-black leading-tight text-slate-950">
      {{ product.name }}
    </span>
    <span class="text-xl font-black text-emerald-700">
      {{ formatCurrency(product.price) }}
    </span>
  </button>
</template>
