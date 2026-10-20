<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import ReportCard from '@/components/ReportCard.vue'
import { buildReportCsv, downloadCsv } from '@/services/csv'
import { formatCurrency } from '@/services/currency'
import { formatDate, formatTime, getDateKey, isDateKey } from '@/services/date'
import { calculateDailyProductRace, calculateDailyReport, calculateSalesReport } from '@/services/report'
import { useFairsStore } from '@/stores/fairs'
import { useSalesStore } from '@/stores/sales'
import { useProductsStore } from '@/stores/products'
import { useSettingsStore } from '@/stores/settings'

const salesStore = useSalesStore()
const fairsStore = useFairsStore()
const productsStore = useProductsStore()
const settingsStore = useSettingsStore()
const selectedDate = ref(getDateKey())
const reportMode = ref<'day' | 'all'>('day')
const syncing = ref(false)
const syncError = ref('')
const showRace = ref(false)
const racePlaying = ref(false)
const raceStep = ref(0)
const raceSpeed = ref<0.5 | 1 | 2>(1)
let raceTimer: ReturnType<typeof window.setTimeout> | undefined

const raceColors = ['#184e2f', '#6b8e23', '#efb22d', '#d97706', '#0f766e', '#2f6f95', '#8f5d1f', '#475569']
const raceSpeedOptions: Array<0.5 | 1 | 2> = [0.5, 1, 2]
const report = computed(() =>
  reportMode.value === 'day'
    ? calculateDailyReport(salesStore.sales, selectedDate.value)
    : calculateSalesReport(salesStore.sales, 'Toda a festa'),
)
const raceFrames = computed(() => calculateDailyProductRace(salesStore.sales, selectedDate.value))
const currentRaceFrame = computed(() => raceFrames.value[raceStep.value])
const raceRows = computed(() => currentRaceFrame.value?.rows.slice(0, 8) ?? [])
const maxRaceQuantity = computed(() => Math.max(...raceRows.value.map((row) => row.quantity), 1))
const raceProgress = computed(() => (raceFrames.value.length ? ((raceStep.value + 1) / raceFrames.value.length) * 100 : 0))
const raceDelay = computed(() => 360 / raceSpeed.value)

onMounted(async () => {
  await salesStore.loadSales()
})

onUnmounted(() => {
  stopRace()
  document.body.style.overflow = ''
})

const syncNow = async () => {
  syncError.value = ''
  syncing.value = true

  try {
    await fairsStore.syncSelectedFairToCloud()
    await Promise.all([
      salesStore.loadSales(),
      productsStore.loadProducts(),
      settingsStore.loadSettings(),
    ])
  } catch (error) {
    syncError.value = error instanceof Error ? error.message : 'Não foi possível sincronizar.'
  } finally {
    syncing.value = false
  }
}

const exportReport = () => {
  const suffix = reportMode.value === 'day' ? selectedDate.value : 'toda-festa'
  downloadCsv(`relatorio-${suffix}.csv`, buildReportCsv(report.value))
}

const updateSelectedDate = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  if (isDateKey(value)) {
    selectedDate.value = value
  }
}

const stopRace = () => {
  racePlaying.value = false
  if (raceTimer) {
    window.clearTimeout(raceTimer)
    raceTimer = undefined
  }
}

const scheduleRaceTick = () => {
  raceTimer = window.setTimeout(() => {
    if (raceStep.value >= raceFrames.value.length - 1) {
      stopRace()
      return
    }

    raceStep.value += 1
    scheduleRaceTick()
  }, raceDelay.value)
}

const startRace = () => {
  if (raceFrames.value.length === 0) return

  if (raceStep.value >= raceFrames.value.length - 1) {
    raceStep.value = 0
  }

  stopRace()
  racePlaying.value = true
  scheduleRaceTick()
}

const openRace = () => {
  reportMode.value = 'day'
  showRace.value = true
  raceStep.value = 0
  startRace()
}

const restartRace = () => {
  raceStep.value = 0
  startRace()
}

const closeRace = () => {
  showRace.value = false
  stopRace()
}

const setRaceSpeed = (speed: 0.5 | 1 | 2) => {
  raceSpeed.value = speed
  if (racePlaying.value) {
    stopRace()
    racePlaying.value = true
    scheduleRaceTick()
  }
}

watch([selectedDate, raceFrames], () => {
  raceStep.value = 0
  stopRace()
})

watch(showRace, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
})
</script>

<template>
  <section class="mx-auto min-h-dvh max-w-5xl px-4 py-4">
    <header class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-black">Relatório</h1>
        <p class="text-sm font-semibold text-slate-500">Totais ignoram vendas canceladas</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <div class="grid grid-cols-2 rounded-lg border border-slate-200 bg-white p-1">
          <button type="button" class="rounded-md px-3 py-2 text-sm font-black" :class="reportMode === 'day' ? 'bg-slate-950 text-white' : 'text-slate-600'" @click="reportMode = 'day'">
            Dia
          </button>
          <button type="button" class="rounded-md px-3 py-2 text-sm font-black" :class="reportMode === 'all' ? 'bg-slate-950 text-white' : 'text-slate-600'" @click="reportMode = 'all'">
            Festa
          </button>
        </div>
        <input v-if="reportMode === 'day'" :value="selectedDate" type="date" class="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold" @input="updateSelectedDate">
        <button type="button" class="rounded-lg bg-slate-950 px-3 py-2 text-sm font-black text-white" @click="exportReport">
          CSV
        </button>
        <button type="button" class="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-black text-white disabled:bg-slate-300" :disabled="raceFrames.length === 0" @click="openRace">
          Corrida
        </button>
        <button type="button" class="rounded-lg bg-slate-950 px-3 py-2 text-sm font-black text-white disabled:bg-slate-300" :disabled="syncing" @click="syncNow">
          {{ syncing ? 'Sync...' : 'Sync' }}
        </button>
      </div>
    </header>

    <p v-if="fairsStore.syncMessage || syncError" class="mb-3 rounded-lg p-3 text-center text-sm font-black" :class="syncError ? 'bg-red-50 text-red-700' : 'bg-slate-900 text-white'">
      {{ syncError || fairsStore.syncMessage }}
    </p>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <ReportCard label="Total" :value="formatCurrency(report.total)" />
      <ReportCard label="Vendas" :value="String(report.saleCount)" />
      <ReportCard label="Ticket médio" :value="formatCurrency(report.averageTicket)" />
      <ReportCard label="Dinheiro" :value="formatCurrency(report.byPayment.cash)" />
      <ReportCard label="Pix" :value="formatCurrency(report.byPayment.pix)" />
      <ReportCard label="Cartão" :value="formatCurrency(report.byPayment.card)" />
    </div>

    <section class="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 class="mb-3 text-lg font-black">Produtos vendidos</h2>
      <div class="space-y-3">
        <article v-for="(product, index) in report.products" :key="product.productId" class="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
          <div class="flex items-center gap-3">
            <span class="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-sm font-black text-slate-700">{{ index + 1 }}</span>
            <div>
              <p class="font-black text-slate-950">{{ product.productName }}</p>
              <p class="text-sm font-semibold text-slate-500">{{ product.quantity }} unidades</p>
            </div>
          </div>
          <p class="font-black text-emerald-700">{{ formatCurrency(product.total) }}</p>
        </article>
      </div>
      <p v-if="report.products.length === 0" class="py-8 text-center font-semibold text-slate-500">
        Sem vendas confirmadas neste período.
      </p>
    </section>

    <div v-if="showRace" class="fixed inset-0 z-50 flex h-dvh flex-col bg-white text-slate-950">
      <header class="shrink-0 bg-slate-900 px-3 py-3 text-white">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate text-lg font-black">Corrida de produtos</h2>
            <p class="text-xs font-bold text-slate-300">{{ formatDate(selectedDate) }}</p>
          </div>
          <button type="button" class="rounded-md bg-white/10 px-3 py-2 text-sm font-black text-white" @click="closeRace">
            Fechar
          </button>
        </div>
      </header>

      <main class="flex min-h-0 flex-1 flex-col px-3 py-3">
        <div class="mb-2 flex items-end justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase text-slate-500">Unidades acumuladas</p>
            <p class="text-sm font-bold text-slate-500">{{ currentRaceFrame ? `${currentRaceFrame.saleCount} vendas` : 'Sem vendas' }}</p>
          </div>
          <p class="text-right text-5xl font-black leading-none text-slate-900">
            {{ currentRaceFrame ? formatTime(currentRaceFrame.createdAt) : '--:--' }}
          </p>
        </div>

        <div class="mb-2 h-1.5 overflow-hidden bg-slate-200">
          <div class="h-full bg-slate-900 transition-all duration-200" :style="{ width: `${raceProgress}%` }" />
        </div>

        <div class="mb-1 grid grid-cols-[2rem_1fr_3.5rem] gap-2 text-[10px] font-black uppercase text-slate-400">
          <span>#</span>
          <div class="flex justify-between">
            <span>0</span>
            <span>{{ maxRaceQuantity }}</span>
          </div>
          <span class="text-right">Qtd</span>
        </div>

        <div v-if="raceRows.length" class="min-h-0 flex-1 overflow-hidden">
          <div class="divide-y divide-white">
            <article v-for="(row, index) in raceRows" :key="row.productId" class="grid h-12 grid-cols-[2rem_1fr_3.5rem] items-center gap-2 bg-slate-50">
              <span class="text-center text-sm font-black text-slate-500">{{ row.rank }}</span>
              <div class="min-w-0">
                <div class="h-10 bg-slate-200">
                  <div
                    class="flex h-full min-w-12 items-center overflow-hidden px-2 text-xs font-black text-white transition-all duration-200 ease-linear"
                    :style="{ width: `${Math.max((row.quantity / maxRaceQuantity) * 100, 8)}%`, backgroundColor: raceColors[index % raceColors.length] }"
                  >
                    <span class="truncate">{{ row.productName }}</span>
                  </div>
                </div>
              </div>
              <span class="text-right text-sm font-black text-slate-900">{{ row.quantity }}</span>
            </article>
          </div>
        </div>

        <p v-else class="grid flex-1 place-items-center text-center font-semibold text-slate-500">
          Sem vendas confirmadas neste dia.
        </p>
      </main>

      <footer class="shrink-0 border-t border-slate-200 bg-white px-3 py-3">
        <div class="mb-3 grid grid-cols-3 border border-slate-200 bg-slate-100 p-1">
          <button
            v-for="speed in raceSpeedOptions"
            :key="speed"
            type="button"
            class="py-2 text-sm font-black"
            :class="raceSpeed === speed ? 'bg-slate-900 text-white' : 'text-slate-600'"
            @click="setRaceSpeed(speed)"
          >
            {{ speed }}x
          </button>
        </div>

        <div class="grid grid-cols-4 gap-2">
          <button type="button" class="bg-emerald-700 px-2 py-3 text-sm font-black text-white disabled:bg-slate-300" :disabled="racePlaying || raceFrames.length === 0" @click="startRace">
            Play
          </button>
          <button type="button" class="bg-slate-900 px-2 py-3 text-sm font-black text-white disabled:bg-slate-300" :disabled="!racePlaying" @click="stopRace">
            Pausar
          </button>
          <button type="button" class="bg-slate-900 px-2 py-3 text-sm font-black text-white disabled:bg-slate-300" :disabled="raceFrames.length === 0" @click="restartRace">
            Reiniciar
          </button>
          <button type="button" class="bg-slate-200 px-2 py-3 text-sm font-black text-slate-900" @click="closeRace">
            Fechar
          </button>
        </div>
      </footer>
    </div>
  </section>
</template>
