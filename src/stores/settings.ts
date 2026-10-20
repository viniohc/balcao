import { ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/services/db'
import { useFairsStore } from '@/stores/fairs'
import type { Settings } from '@/types/models'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({
    id: 'default',
    fairId: '',
    storeName: 'Caixa da Feira',
    currency: 'BRL',
  })

  const loadSettings = async () => {
    const fairsStore = useFairsStore()
    if (!fairsStore.selectedFairId) return

    const saved = await db.settings.where('fairId').equals(fairsStore.selectedFairId).first()
    if (saved) {
      settings.value = saved
    }
  }

  return {
    settings,
    loadSettings,
  }
})
