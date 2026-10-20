<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatTime } from '@/services/date'
import { useSalesStore } from '@/stores/sales'

const salesStore = useSalesStore()
const returnMessage = ref('')

onMounted(async () => {
  await salesStore.loadSales()
  await salesStore.startRealtime()
})

const returnToKitchen = async (saleId: string, commandNumber: string) => {
  await salesStore.updateCommandStatus(saleId, 'preparando')
  returnMessage.value = `Comanda ${commandNumber} voltou para a cozinha.`
  window.setTimeout(() => {
    returnMessage.value = ''
  }, 2200)
}
</script>

<template>
  <section class="mx-auto min-h-dvh max-w-5xl px-4 py-4 pb-28">
    <header class="mb-4 flex items-end justify-between">
      <div>
        <h1 class="text-2xl font-black">Chamar</h1>
        <p class="text-sm font-semibold text-slate-500">Comandas prontas para avisar no painel manual.</p>
      </div>
      <span class="rounded-full bg-emerald-600 px-3 py-2 text-sm font-black text-white">
        {{ salesStore.readyCommandItems.length }} prontas
      </span>
    </header>

    <p v-if="salesStore.realtimeError" class="mb-3 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">
      Realtime indisponivel: {{ salesStore.realtimeError }}
    </p>

    <p v-if="returnMessage" class="mb-3 rounded-lg bg-slate-900 p-3 text-center text-sm font-black text-white">
      {{ returnMessage }}
    </p>

    <div v-if="salesStore.readyCommandItems.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="item in salesStore.readyCommandItems"
        :key="item.saleId"
        class="rounded-xl border-2 bg-white p-4 shadow-sm"
        :class="item.status === 'chamado' ? 'border-amber-300' : 'border-emerald-300'"
      >
        <div class="text-center">
          <p class="text-xs font-black uppercase text-slate-500">Comanda</p>
          <p class="text-7xl font-black leading-none text-slate-950">{{ item.commandNumber }}</p>
          <div class="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-left">
            <p v-for="orderItem in item.items" :key="orderItem.lineId ?? orderItem.productId" class="text-base font-black text-slate-700">
              {{ orderItem.quantity }}x {{ orderItem.productName }}
            </p>
          </div>
          <p v-if="item.observation" class="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-black text-amber-800">
            {{ item.observation }}
          </p>
          <p class="mt-1 text-sm font-bold text-slate-500">Pronto desde {{ formatTime(item.updatedAt ?? item.createdAt) }}</p>
        </div>

        <div class="mt-4 grid gap-2">
          <button
            v-if="item.status === 'pronto'"
            type="button"
            class="rounded-lg bg-amber-500 py-4 text-lg font-black text-white shadow-lg shadow-amber-100"
            @click="salesStore.updateCommandStatus(item.saleId, 'chamado')"
          >
            Ja chamei
          </button>
          <button
            v-else
            type="button"
            class="rounded-lg bg-amber-100 py-4 text-lg font-black text-amber-800"
            @click="salesStore.updateCommandStatus(item.saleId, 'chamado')"
          >
            Chamar novamente
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white py-4 text-lg font-black text-slate-800"
            @click="returnToKitchen(item.saleId, item.commandNumber)"
          >
            Voltar para cozinha
          </button>
          <button
            type="button"
            class="rounded-lg bg-emerald-600 py-4 text-lg font-black text-white shadow-lg shadow-emerald-100"
            @click="salesStore.updateCommandStatus(item.saleId, 'entregue')"
          >
            Entregue
          </button>
        </div>
      </article>
    </div>

    <p v-else class="mt-12 text-center font-semibold text-slate-500">
      Nenhuma comanda pronta para chamar.
    </p>
  </section>
</template>
