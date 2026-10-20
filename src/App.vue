<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { seedDatabase } from '@/services/db'
import { useAuthStore } from '@/stores/auth'
import { useFairsStore } from '@/stores/fairs'
import { useProductsStore } from '@/stores/products'
import { useSalesStore } from '@/stores/sales'
import { useSettingsStore } from '@/stores/settings'
import { createReconnectSyncController } from '@/services/reconnectSync'

const productsStore = useProductsStore()
const salesStore = useSalesStore()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const fairsStore = useFairsStore()
const reconnectSync = createReconnectSyncController({
  shouldRun: () => Boolean(navigator.onLine && authStore.user && fairsStore.selectedFairId),
  sync: () => fairsStore.syncSelectedFairToCloud(),
  onFailure: () => {
    fairsStore.setSyncError('Falha na reconexão. As alterações continuam pendentes para nova tentativa.')
  },
})
const syncPendingAfterReconnect = () => reconnectSync.run()

onMounted(async () => {
  window.addEventListener('online', syncPendingAfterReconnect)
  await authStore.initAuth()
  if (!authStore.user) return

  await fairsStore.loadFairs()
  if (!fairsStore.selectedFairId) return

  await seedDatabase(fairsStore.selectedFairId)
  await Promise.all([
    productsStore.loadProducts(),
    salesStore.loadSales(),
    settingsStore.loadSettings(),
  ])
  await Promise.all([
    productsStore.startRealtime(),
    salesStore.startRealtime(),
  ])

  if (navigator.onLine) {
    await syncPendingAfterReconnect()
  }
})

onUnmounted(() => {
  window.removeEventListener('online', syncPendingAfterReconnect)
  productsStore.stopRealtime()
  salesStore.stopRealtime()
})
</script>

<template>
  <div>
    <p
      v-if="fairsStore.syncError"
      class="fixed inset-x-3 top-3 z-50 mx-auto max-w-xl rounded-lg bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-800 shadow-lg"
      role="status"
      aria-live="polite"
    >
      {{ fairsStore.syncError }}
    </p>
    <AppLayout />
  </div>
</template>
