<script setup lang="ts">
import { ref } from 'vue'
import { formatCurrency } from '@/services/currency'
import { formatTime } from '@/services/date'
import { paymentLabels } from '@/stores/sales'
import type { Sale } from '@/types/models'

defineProps<{
  sale: Sale
}>()

defineEmits<{
  cancel: [saleId: string]
  edit: [sale: Sale]
}>()

const expanded = ref(false)
</script>

<template>
  <article class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <button type="button" class="w-full text-left" @click="expanded = !expanded">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-black text-slate-950">{{ formatTime(sale.createdAt) }}</p>
          <p class="text-sm font-semibold text-slate-500">{{ paymentLabels[sale.paymentMethod] }}</p>
          <p v-if="sale.commandNumber" class="mt-1 text-sm font-black text-amber-700">
            Comanda {{ sale.commandNumber }} · {{ sale.commandStatus ?? 'pendente' }}
          </p>
        </div>
        <div class="text-right">
          <p class="text-lg font-black" :class="sale.status === 'cancelado' ? 'text-slate-400 line-through' : 'text-slate-950'">
            {{ formatCurrency(sale.total) }}
          </p>
          <span
            class="rounded-full px-2 py-1 text-xs font-bold"
            :class="sale.status === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'"
          >
            {{ sale.status === 'cancelado' ? 'Cancelada' : 'Confirmada' }}
          </span>
        </div>
      </div>
    </button>

    <div v-if="expanded" class="mt-4 border-t border-slate-100 pt-3">
      <ul class="space-y-2">
        <li v-for="item in sale.items" :key="item.productId" class="flex justify-between gap-3 text-sm">
          <span class="font-semibold text-slate-700">{{ item.quantity }}x {{ item.productName }}</span>
          <span class="font-bold text-slate-950">{{ formatCurrency(item.total) }}</span>
        </li>
      </ul>
      <p v-if="sale.observation" class="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">
        Observação: {{ sale.observation }}
      </p>
      <div v-if="sale.status === 'confirmado'" class="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          class="rounded-lg border border-slate-200 bg-white py-3 text-sm font-black text-slate-800"
          @click="$emit('edit', sale)"
        >
          Editar pedido
        </button>
        <button
          type="button"
          class="rounded-lg border border-red-200 bg-red-50 py-3 text-sm font-black text-red-700"
          @click="$emit('cancel', sale.id)"
        >
          Cancelar venda
        </button>
      </div>
    </div>
  </article>
</template>
