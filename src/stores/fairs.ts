import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db, seedDatabase } from '@/services/db'
import { listCloudFairs, saveCloudFair } from '@/services/firestore/fairs'
import { listCloudProducts } from '@/services/firestore/products'
import { listCloudSales } from '@/services/firestore/sales'
import { getCloudSettings } from '@/services/firestore/settings'
import {
  associateLegacyRecord,
  getSyncStatus,
  listLegacyRecords,
  mergeRemoteRecords,
  resolveSyncConflict,
  syncFairRecords,
  syncLocalRecord,
  type ConflictResolution,
  type LegacyRecordIdentity,
  type LegacyRecordReference,
  type SyncConflictSummary,
} from '@/services/sync'
import { useAuthStore } from '@/stores/auth'
import type { Fair } from '@/types/models'

import { APP_STORAGE_KEYS } from '@/services/storage'
import {
  getFairMetadataStatus,
  mergeRemoteFair,
  resolveFairMetadataConflict as resolveMetadataConflict,
  saveLocalFairMetadata,
  setFairActiveRemotely,
  syncFairMetadata,
  updateFairMemberAccess as updateRemoteFairMemberAccess,
  type FairMetadataConflictSummary,
  type FairMetadataStatus,
} from '@/services/fairMetadataSync'

export const useFairsStore = defineStore('fairs', () => {
  const fairs = ref<Fair[]>([])
  const selectedFairId = ref(localStorage.getItem(APP_STORAGE_KEYS.selectedFairId) ?? '')
  const loading = ref(false)
  const syncMessage = ref('')
  const syncError = ref('')
  const syncConflicts = ref<SyncConflictSummary[]>([])
  const fairMetadataConflicts = ref<FairMetadataConflictSummary[]>([])
  const legacyRecords = ref<LegacyRecordReference[]>([])
  let syncInFlight: Promise<void> | undefined

  const selectedFair = computed(() => fairs.value.find((fair) => fair.id === selectedFairId.value))
  const hasSelectedFair = computed(() => Boolean(selectedFairId.value))

  const assertFairOwner = async (fairId: string) => {
    const authStore = useAuthStore()
    const fair = await db.fairs.get(fairId)
    if (!authStore.user || !fair || fair.ownerId !== authStore.user.uid) {
      throw new Error('Somente o proprietario pode administrar esta feira.')
    }
  }

  const refreshSyncStatus = async (fairId = selectedFairId.value) => {
    const [status, orphans, metadataStatus] = await Promise.all([
      fairId ? getSyncStatus(fairId) : Promise.resolve({ pending: 0, conflicts: [] }),
      listLegacyRecords(),
      fairId ? getFairMetadataStatus(fairId) : Promise.resolve({ pending: false } as FairMetadataStatus),
    ])

    syncConflicts.value = status.conflicts
    fairMetadataConflicts.value = metadataStatus.conflict ? [metadataStatus.conflict] : []
    legacyRecords.value = orphans

    if (metadataStatus.conflict) {
      syncMessage.value = 'Metadados da feira mudaram em outro dispositivo; escolha uma versão em Feiras.'
    } else if (metadataStatus.pending) {
      syncMessage.value = 'Alterações locais nos metadados da feira aguardam sincronização.'
    } else if (status.conflicts.length > 0) {
      syncMessage.value = status.conflicts.length + ' conflito(s) de sincronização precisam de revisão em Feiras.'
    } else if (status.pending > 0) {
      syncMessage.value = status.pending + ' alteração(ões) local(is) aguardam sincronização.'
    } else if (orphans.length > 0) {
      syncMessage.value = orphans.length + ' registro(s) sem feira foram preservados; revise a associação em Feiras.'
    } else {
      syncMessage.value = 'Dados atualizados'
    }
  }

  const loadFairs = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    loading.value = true
    try {
      const cloudFairs = await listCloudFairs(authStore.user.uid)
      const mergedFairs = await Promise.all(cloudFairs.map((fair) => mergeRemoteFair(fair)))
      fairs.value = mergedFairs.filter((fair): fair is Fair => Boolean(fair))
    } catch {
      const localFairs = await db.fairs.where('ownerId').equals(authStore.user.uid).toArray()
      fairs.value = localFairs.filter((fair) => fair.active)
    } finally {
      loading.value = false
    }
  }

  const selectFair = async (fairId: string) => {
    selectedFairId.value = fairId
    localStorage.setItem(APP_STORAGE_KEYS.selectedFairId, fairId)
    await refreshSyncStatus(fairId)
  }

  const createFair = async (name: string) => {
    const authStore = useAuthStore()
    if (!authStore.user) {
      throw new Error('FaÃ§a login para criar uma feira.')
    }

    const timestamp = new Date().toISOString()
    const fair: Fair = {
      id: crypto.randomUUID(),
      name: name.trim(),
      ownerId: authStore.user.uid,
      members: {
        [authStore.user.uid]: true,
      },
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    await db.fairs.put(fair)
    fairs.value = [fair, ...fairs.value.filter((item) => item.id !== fair.id)]
    await saveCloudFair(fair)
    await selectFair(fair.id)
    await seedDatabase(fair.id)
    return fair
  }

  const renameFair = async (fairId: string, name: string) => {
    const cleanName = name.trim()
    if (!cleanName) {
      throw new Error('Informe um nome para a feira.')
    }

    await assertFairOwner(fairId)

    const authStore = useAuthStore()
    const updatedFair = await saveLocalFairMetadata(fairId, { name: cleanName })
    if (!updatedFair) throw new Error('A feira não está disponível localmente.')
    fairs.value = fairs.value.map((fair) => (fair.id === fairId ? updatedFair : fair))
    if (authStore.user) await syncFairMetadata(fairId, authStore.user.uid)
    await refreshSyncStatus(fairId)
  }

  const deleteFair = async (fairId: string) => {
    await assertFairOwner(fairId)
    const authStore = useAuthStore()
    const fair = await db.fairs.get(fairId)
    if (!fair || !authStore.user) throw new Error('A feira não está disponível para o proprietário atual.')
    const result = await setFairActiveRemotely(fairId, authStore.user.uid, fair.active, false)
    if (result.status === 'conflict') {
      await mergeRemoteFair(result.fair)
      fairs.value = fairs.value.map((item) => item.id === fairId ? result.fair : item)
      await refreshSyncStatus(fairId)
      return { status: 'conflict' as const }
    }

    await mergeRemoteFair(result.fair)
    fairs.value = fairs.value.filter((item) => item.id !== fairId)

    if (selectedFairId.value === fairId) {
      clearSelection()
    }
    return { status: 'deleted' as const }
  }

  const updateFairMember = async (fairId: string, memberId: string, included: boolean) => {
    await assertFairOwner(fairId)
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Faça login para administrar os membros.')
    const updatedFair = await updateRemoteFairMemberAccess(fairId, authStore.user.uid, memberId, included)
    await mergeRemoteFair(updatedFair)
    fairs.value = fairs.value.map((fair) => fair.id === fairId ? updatedFair : fair)
    return updatedFair
  }

  const syncFairFromCloud = async (fairId: string) => {
    syncMessage.value = 'Baixando dados...'
    const [cloudProducts, cloudSales, cloudSettings] = await Promise.all([
      listCloudProducts(fairId, { includeDeleted: true }),
      listCloudSales(fairId),
      getCloudSettings(fairId),
    ])

    await Promise.all([
      mergeRemoteRecords('products', fairId, cloudProducts),
      mergeRemoteRecords('sales', fairId, cloudSales),
      cloudSettings
        ? mergeRemoteRecords('settings', fairId, [cloudSettings])
        : Promise.resolve(),
    ])

    await refreshSyncStatus(fairId)
  }

  const syncSelectedFairFromCloud = async () => {
    const fairId = selectedFairId.value
    if (!fairId) {
      throw new Error('Selecione uma feira para sincronizar.')
    }

    await syncFairFromCloud(fairId)
  }

  const performSyncSelectedFairToCloud = async () => {
    const fairId = selectedFairId.value
    if (!fairId) {
      throw new Error('Selecione uma feira para sincronizar.')
    }

    syncError.value = ''
    syncMessage.value = 'Enviando alterações pendentes...'
    const authStore = useAuthStore()
    const fair = await db.fairs.get(fairId)
    if (fair && fair.ownerId === authStore.user?.uid) {
      const metadataResult = await syncFairMetadata(fairId, authStore.user!.uid)
      if (metadataResult.status === 'pending') {
        syncError.value = 'Falha ao sincronizar os dados da feira. As alterações continuam pendentes.'
      } else if (metadataResult.status === 'conflict') {
        syncError.value = 'Os metadados da feira mudaram em outro dispositivo. Resolva o conflito em Feiras.'
      }
    }

    const recordsStatus = await syncFairRecords(fairId)
    try {
      await syncFairFromCloud(fairId)
    } catch {
      syncError.value = 'Falha ao baixar alterações remotas. Os dados locais foram preservados.'
      // O outbox local preserva pendências quando o Firestore está indisponível.
    }
    await refreshSyncStatus(fairId)
    if (recordsStatus.pending > 0 && !syncError.value) {
      syncError.value = 'Há alterações locais que não foram confirmadas; elas continuam pendentes.'
    }
  }

  const syncSelectedFairToCloud = async () => {
    if (syncInFlight) return syncInFlight
    const operation = performSyncSelectedFairToCloud()
    syncInFlight = operation
    try {
      await operation
    } finally {
      if (syncInFlight === operation) syncInFlight = undefined
    }
  }

  const refreshSyncIssues = async () => refreshSyncStatus(selectedFairId.value)

  const associateLegacyData = async (reference: LegacyRecordIdentity, fairId: string) => {
    await associateLegacyRecord(reference, fairId)
    await refreshSyncStatus(fairId)
  }

  const resolveConflict = async (
    conflict: SyncConflictSummary,
    resolution: ConflictResolution,
  ) => {
    await resolveSyncConflict(conflict.entity, conflict.fairId, conflict.recordId, resolution)
    if (resolution === 'local') {
      await syncLocalRecord(conflict.entity, conflict.fairId, conflict.recordId)
    }
    await refreshSyncStatus(conflict.fairId)
  }

  const resolveFairConflict = async (
    conflict: FairMetadataConflictSummary,
    resolution: 'local' | 'remote',
  ) => {
    await assertFairOwner(conflict.fairId)
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Faça login para resolver os metadados da feira.')
    await resolveMetadataConflict(conflict.fairId, resolution)
    if (resolution === 'local') {
      await syncFairMetadata(conflict.fairId, authStore.user.uid)
    }
    await loadFairs()
    await refreshSyncStatus(conflict.fairId)
  }

  const setSyncError = (message: string) => {
    syncError.value = message
  }

  const clearSelection = () => {
    selectedFairId.value = ''
    localStorage.removeItem(APP_STORAGE_KEYS.selectedFairId)
    syncMessage.value = ''
    syncConflicts.value = []
    fairMetadataConflicts.value = []
    syncError.value = ''
  }

  return {
    fairs,
    selectedFairId,
    selectedFair,
    hasSelectedFair,
    loading,
    syncMessage,
    syncError,
    syncConflicts,
    fairMetadataConflicts,
    legacyRecords,
    loadFairs,
    selectFair,
    createFair,
    renameFair,
    deleteFair,
    updateFairMember,
    syncSelectedFairFromCloud,
    syncSelectedFairToCloud,
    refreshSyncIssues,
    associateLegacyData,
    resolveConflict,
    resolveFairConflict,
    refreshSyncStatus,
    setSyncError,
    clearSelection,
  }
})
