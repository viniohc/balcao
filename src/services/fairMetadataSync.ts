import { doc, runTransaction, type DocumentData, type Firestore } from 'firebase/firestore'
import { ensureFirebaseSignedIn, getFirebaseDb } from '@/lib/firebase'
import {
  db as defaultDb,
  type FairMetadataField,
  type FairMetadataValues,
  type FairSyncState,
  type FeiraDatabase,
} from '@/services/db'
import type { Fair } from '@/types/models'

export type FairMetadataPatch = Partial<FairMetadataValues>
export type FairMetadataResolution = 'local' | 'remote'

export interface FairMetadataConflictSummary {
  fairId: string
  fields: FairMetadataField[]
  localData: FairMetadataValues
  remoteData: Fair | null
  detectedAt: string
}

export interface FairMetadataStatus {
  pending: boolean
  conflict?: FairMetadataConflictSummary
}

export interface FairMetadataRemote {
  transact<T>(
    fairId: string,
    operation: (current: Fair | null, write: (patch: Partial<Fair>) => void) => T,
  ): Promise<T>
}

export const createFirestoreFairMetadataRemote = (firestore: Firestore): FairMetadataRemote => ({
  transact: (fairId, operation) => runTransaction(firestore, async (transaction) => {
    const reference = doc(firestore, 'fairs', fairId)
    const snapshot = await transaction.get(reference)
    const current = snapshot.exists()
      ? { ...snapshot.data(), id: fairId } as Fair
      : null
    let patch: Partial<Fair> | undefined
    const result = operation(current, (nextPatch) => {
      patch = nextPatch
    })
    if (patch && current) {
      transaction.update(reference, patch as DocumentData)
    }
    return result
  }),
})

const metadataFields: FairMetadataField[] = ['name', 'active']

const pickMetadata = (fair: Fair): FairMetadataValues => ({
  name: fair.name,
  active: fair.active,
})

const getPendingFields = (patch: FairMetadataPatch) =>
  metadataFields.filter((field) => field in patch)

const makeConflictSummary = (state: FairSyncState, fair: Fair | undefined): FairMetadataConflictSummary | undefined => {
  if (!state.conflict) return undefined
  return {
    fairId: state.fairId,
    fields: state.conflict.fields,
    localData: pickMetadata(fair ?? state.conflict.remoteData ?? {
      id: state.fairId,
      name: state.pendingData.name ?? state.baseData.name,
      active: state.pendingData.active ?? state.baseData.active,
    } as Fair),
    remoteData: state.conflict.remoteData,
    detectedAt: state.conflict.detectedAt,
  }
}

const isValidFairId = (value: string) => /^[A-Za-z0-9_-]{1,128}$/.test(value)
const now = () => new Date().toISOString()

export const createFairMetadataSyncEngine = (
  database: FeiraDatabase = defaultDb,
  options: { remote?: FairMetadataRemote; firestore?: Firestore } = {},
) => {
  const getRemote = async () => {
    if (options.remote) return options.remote
    if (options.firestore) return createFirestoreFairMetadataRemote(options.firestore)
    await ensureFirebaseSignedIn()
    return createFirestoreFairMetadataRemote(getFirebaseDb())
  }

  const saveLocalPatch = async (fairId: string, patch: FairMetadataPatch) => {
    if (!isValidFairId(fairId)) throw new Error('Selecione uma feira válida.')
    if ('name' in patch && (typeof patch.name !== 'string' || !patch.name.trim())) {
      throw new Error('Informe um nome para a feira.')
    }
    if ('active' in patch && typeof patch.active !== 'boolean') {
      throw new Error('O estado da feira é inválido.')
    }
    if (getPendingFields(patch).length === 0) return database.fairs.get(fairId)

    return database.transaction('rw', database.fairs, database.fairSyncStates, async () => {
      const fair = await database.fairs.get(fairId)
      if (!fair) throw new Error('A feira não está disponível localmente.')
      const previous = await database.fairSyncStates.get(fairId)
      const baseData = previous?.baseData ?? pickMetadata(fair)
      const pendingData: FairMetadataPatch = { ...previous?.pendingData, ...patch }
      for (const field of metadataFields) {
        if (field in pendingData && pendingData[field] === baseData[field]) {
          delete pendingData[field]
        }
      }

      const updated = {
        ...fair,
        ...patch,
        name: 'name' in patch ? patch.name!.trim() : fair.name,
        updatedAt: now(),
      }
      await database.fairs.put(updated)

      if (getPendingFields(pendingData).length === 0) {
        await database.fairSyncStates.delete(fairId)
      } else {
        await database.fairSyncStates.put({
          fairId,
          baseData,
          pendingData,
          revision: (previous?.revision ?? 0) + 1,
          conflict: previous?.conflict,
        })
      }
      return updated
    })
  }

  const mergeRemoteFair = async (remoteFair: Fair) => {
    if (!remoteFair || !isValidFairId(remoteFair.id)) return undefined
    return database.transaction('rw', database.fairs, database.fairSyncStates, async () => {
      const local = await database.fairs.get(remoteFair.id)
      const state = await database.fairSyncStates.get(remoteFair.id)
      if (!state || getPendingFields(state.pendingData).length === 0) {
        await database.fairs.put(remoteFair)
        if (state) await database.fairSyncStates.delete(remoteFair.id)
        return remoteFair
      }

      const pendingData: FairMetadataPatch = { ...state.pendingData }
      const conflictFields: FairMetadataField[] = []
      for (const field of metadataFields) {
        if (!(field in pendingData)) continue
        if (remoteFair[field] === pendingData[field]) {
          delete pendingData[field]
        } else if (remoteFair[field] !== state.baseData[field]) {
          conflictFields.push(field)
        }
      }

      const nextLocal: Fair = {
        ...remoteFair,
        ...pendingData,
        ...(local ? { id: local.id } : {}),
      }
      await database.fairs.put(nextLocal)

      if (getPendingFields(pendingData).length === 0) {
        await database.fairSyncStates.delete(remoteFair.id)
      } else {
        await database.fairSyncStates.put({
          ...state,
          pendingData,
          conflict: conflictFields.length > 0
            ? { remoteData: remoteFair, fields: conflictFields, detectedAt: now() }
            : undefined,
        })
      }
      return nextLocal
    })
  }

  const syncFair = async (fairId: string, ownerId: string) => {
    const [localSnapshot, stateSnapshot] = await Promise.all([
      database.fairs.get(fairId),
      database.fairSyncStates.get(fairId),
    ])
    if (!localSnapshot || !stateSnapshot || getPendingFields(stateSnapshot.pendingData).length === 0) {
      return { status: 'synced' as const }
    }
    if (stateSnapshot.conflict) return { status: 'conflict' as const }

    let remote: FairMetadataRemote
    try {
      remote = await getRemote()
    } catch (error) {
      return { status: 'pending' as const, error: error instanceof Error ? error.message : 'Firestore indisponível.' }
    }

    let outcome: {
      status: 'synced' | 'conflict' | 'blocked'
      remoteData: Fair | null
      fields?: FairMetadataField[]
      error?: string
    }
    try {
      outcome = await remote.transact(fairId, (current, write) => {
        if (!current) return { status: 'conflict', remoteData: null, fields: getPendingFields(stateSnapshot.pendingData) }
        if (current.id !== fairId || current.ownerId !== ownerId || current.members?.[ownerId] !== true) {
          return { status: 'blocked', remoteData: current, error: 'Somente o proprietário atual pode sincronizar os metadados da feira.' }
        }

        const pendingFields = getPendingFields(stateSnapshot.pendingData)
        const conflictFields = pendingFields.filter((field) =>
          current[field] !== localSnapshot[field] && current[field] !== stateSnapshot.baseData[field],
        )
        if (conflictFields.length > 0) {
          return { status: 'conflict', remoteData: current, fields: conflictFields }
        }

        const patch: Partial<Fair> = {}
        for (const field of pendingFields) {
          if (current[field] !== localSnapshot[field]) {
            Object.assign(patch, { [field]: localSnapshot[field] })
          }
        }
        if (Object.keys(patch).length > 0) {
          patch.updatedAt = now()
          write(patch)
        }
        return { status: 'synced', remoteData: { ...current, ...patch } }
      })
    } catch (error) {
      return { status: 'pending' as const, error: error instanceof Error ? error.message : 'Sincronização da feira adiada.' }
    }

    if (outcome.status === 'blocked') {
      return { status: 'pending' as const, error: outcome.error }
    }
    if (outcome.status === 'conflict') {
      await database.transaction('rw', database.fairs, database.fairSyncStates, async () => {
        const latestState = await database.fairSyncStates.get(fairId)
        const latestFair = await database.fairs.get(fairId)
        if (!latestState) return
        if (outcome.remoteData) {
          await database.fairs.put({ ...outcome.remoteData, ...latestState.pendingData })
        }
        await database.fairSyncStates.put({
          ...latestState,
          conflict: {
            remoteData: outcome.remoteData,
            fields: outcome.fields ?? getPendingFields(latestState.pendingData),
            detectedAt: now(),
          },
        })
        if (!latestFair && outcome.remoteData) await database.fairs.put(outcome.remoteData)
      })
      return { status: 'conflict' as const }
    }

    if (outcome.remoteData) {
      if (stateSnapshot.revision !== (await database.fairSyncStates.get(fairId))?.revision) {
        await database.transaction('rw', database.fairSyncStates, async () => {
          const latestState = await database.fairSyncStates.get(fairId)
          if (!latestState) return
          const rebased = { ...latestState.baseData }
          for (const field of getPendingFields(stateSnapshot.pendingData)) {
            Object.assign(rebased, { [field]: outcome.remoteData![field] })
          }
          await database.fairSyncStates.put({ ...latestState, baseData: rebased })
        })
      }
      await mergeRemoteFair(outcome.remoteData)
    }
    return { status: 'synced' as const }
  }

  const resolveConflict = async (fairId: string, resolution: FairMetadataResolution) => {
    await database.transaction('rw', database.fairs, database.fairSyncStates, async () => {
      const state = await database.fairSyncStates.get(fairId)
      if (!state?.conflict) throw new Error('Esta feira não tem conflito pendente.')
      const local = await database.fairs.get(fairId)
      if (resolution === 'remote') {
        if (!state.conflict.remoteData) throw new Error('A feira não existe mais no servidor.')
        await database.fairs.put(state.conflict.remoteData)
        await database.fairSyncStates.delete(fairId)
        return
      }
      if (!state.conflict.remoteData) throw new Error('A feira não existe mais no servidor; não é seguro reenviar os dados locais.')
      await database.fairSyncStates.put({
        ...state,
        baseData: pickMetadata(state.conflict.remoteData),
        pendingData: { ...state.pendingData },
        revision: state.revision + 1,
        conflict: undefined,
      })
      if (local) await database.fairs.put({ ...state.conflict.remoteData, ...state.pendingData })
    })
  }

  const getStatus = async (fairId: string): Promise<FairMetadataStatus> => {
    const state = await database.fairSyncStates.get(fairId)
    if (!state) return { pending: false }
    const fair = await database.fairs.get(fairId)
    return {
      pending: getPendingFields(state.pendingData).length > 0,
      conflict: makeConflictSummary(state, fair),
    }
  }

  const updateMemberAccess = async (fairId: string, actorId: string, memberId: string, included: boolean) => {
    if (!isValidFairId(fairId) || !/^[A-Za-z0-9_-]{1,128}$/.test(memberId)) {
      throw new Error('Feira ou membro inválido.')
    }
    const remote = await getRemote()
    return remote.transact(fairId, (current, write) => {
      if (!current || current.id !== fairId) throw new Error('A feira não está disponível no servidor.')
      if (current.ownerId !== actorId || current.members?.[actorId] !== true) {
        throw new Error('Somente o proprietário atual pode alterar membros.')
      }
      if (memberId === current.ownerId && !included) throw new Error('O proprietário não pode ser removido da feira.')
      const members = { ...current.members }
      if (included) members[memberId] = true
      else delete members[memberId]
      const membersChanged = Object.keys(members).length !== Object.keys(current.members).length
        || Object.entries(members).some(([id, value]) => current.members[id] !== value)
      if (membersChanged) {
        write({ members, updatedAt: now() })
      }
      return { ...current, members }
    })
  }

  const setActive = async (fairId: string, actorId: string, expectedActive: boolean, active: boolean) => {
    const remote = await getRemote()
    return remote.transact(fairId, (current, write) => {
      if (!current || current.id !== fairId) throw new Error('A feira não está disponível no servidor.')
      if (current.ownerId !== actorId || current.members?.[actorId] !== true) {
        throw new Error('Somente o proprietário atual pode alterar o estado da feira.')
      }
      if (current.active !== expectedActive) {
        return { status: 'conflict' as const, fair: current }
      }
      if (current.active === active) return { status: 'unchanged' as const, fair: current }
      const updated = { ...current, active, updatedAt: now() }
      write({ active, updatedAt: updated.updatedAt })
      return { status: 'updated' as const, fair: updated }
    })
  }

  return {
    saveLocalPatch,
    mergeRemoteFair,
    syncFair,
    resolveConflict,
    getStatus,
    updateMemberAccess,
    setActive,
  }
}

const defaultEngine = createFairMetadataSyncEngine()

export const saveLocalFairMetadata = defaultEngine.saveLocalPatch
export const mergeRemoteFair = defaultEngine.mergeRemoteFair
export const syncFairMetadata = defaultEngine.syncFair
export const resolveFairMetadataConflict = defaultEngine.resolveConflict
export const getFairMetadataStatus = defaultEngine.getStatus
export const updateFairMemberAccess = defaultEngine.updateMemberAccess
export const setFairActiveRemotely = defaultEngine.setActive
