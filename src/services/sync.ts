import {
  doc,
  runTransaction,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'
import { ensureFirebaseSignedIn, getFirebaseDb } from '@/lib/firebase'
import { db as defaultDb, type FeiraDatabase } from '@/services/db'
import type { Product, Sale, Settings } from '@/types/models'

export type SyncEntity = 'products' | 'sales' | 'settings'
export type SyncRecord = Product | Sale | Settings
export type ConflictResolution = 'local' | 'remote'

export interface LegacyRecordIdentity {
  entity: SyncEntity
  id: string
}

export interface LegacyRecordReference extends LegacyRecordIdentity {
  description: string
}

export interface SyncConflictSummary {
  fairId: string
  entity: SyncEntity
  recordId: string
  remoteExists: boolean
  detectedAt: string
}

export interface SyncStatus {
  pending: number
  conflicts: SyncConflictSummary[]
}

interface SyncState {
  fairId: string
  entity: SyncEntity
  recordId: string
  pending: boolean
  baseKnown: boolean
  baseData: SyncRecord | null
  revision: number
  conflict?: {
    remoteData: SyncRecord | null
    detectedAt: string
  }
}

interface RemoteResult {
  status: 'written' | 'same' | 'conflict'
  remoteData: SyncRecord | null
}

export interface SyncRemote {
  reference(fairId: string, entity: SyncEntity, recordId: string): DocumentReference<DocumentData, DocumentData>
  transact<T>(
    reference: DocumentReference<DocumentData, DocumentData>,
    operation: (current: SyncRecord | null, write: (record: SyncRecord) => void) => T,
  ): Promise<T>
}

export interface SyncEngineOptions {
  remote?: SyncRemote
  firestore?: Firestore
}

type RecordTable = ReturnType<FeiraDatabase['table']> & {
  get(key: [string, string]): Promise<SyncRecord | undefined>
  put(record: SyncRecord): Promise<[string, string]>
  add(record: SyncRecord): Promise<[string, string]>
  update(key: [string, string], changes: Partial<SyncRecord>): Promise<number>
  where(index: string): {
    equals(value: string): { toArray(): Promise<SyncRecord[]> }
  }
  toArray(): Promise<SyncRecord[]>
}

type LegacyTable = {
  get(key: string): Promise<SyncRecord | undefined>
  put(record: SyncRecord): Promise<string>
  delete(key: string): Promise<void>
  toArray(): Promise<SyncRecord[]>
}

const entities: SyncEntity[] = ['products', 'sales', 'settings']

const tableFor = (database: FeiraDatabase, entity: SyncEntity) =>
  database[entity] as unknown as RecordTable

const legacyTableFor = (database: FeiraDatabase, entity: SyncEntity): LegacyTable => {
  if (entity === 'products') return database.legacyProducts as unknown as LegacyTable
  if (entity === 'sales') return database.legacySales as unknown as LegacyTable
  return database.legacySettings as unknown as LegacyTable
}

const stateKey = (fairId: string, entity: SyncEntity, recordId: string) =>
  [fairId, entity, recordId] as [string, string, string]

const recordKey = (fairId: string, recordId: string) =>
  [fairId, recordId] as [string, string]

const withoutUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(withoutUndefined)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [key, withoutUndefined(fieldValue)]),
    )
  }

  return value
}

const canonical = (value: unknown): string => {
  const normalized = withoutUndefined(value)
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sort)
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, sort(child)]),
      )
    }
    return item
  }

  return JSON.stringify(sort(normalized))
}

const sameRecord = (left: unknown, right: unknown) =>
  canonical(left) === canonical(right)

const describeLegacyRecord = (entity: SyncEntity, record: SyncRecord) => {
  if (entity === 'products') {
    const product = record as Product
    return [
      product.name,
      product.category,
      Number.isFinite(product.price) ? `R$ ${product.price.toFixed(2)}` : undefined,
    ].filter(Boolean).join(' · ') || 'Produto sem detalhes disponíveis'
  }

  if (entity === 'sales') {
    const sale = record as Sale
    return [
      typeof sale.createdAt === 'string' ? sale.createdAt.slice(0, 10) : undefined,
      sale.commandNumber ? `Comanda ${sale.commandNumber}` : 'Venda',
      sale.status,
      Number.isFinite(sale.total) ? `Total R$ ${sale.total.toFixed(2)}` : undefined,
    ].filter(Boolean).join(' · ') || 'Venda sem detalhes disponíveis'
  }

  const settings = record as Settings
  return settings.storeName || 'Configuração sem detalhes disponíveis'
}

export const createFirestoreSyncRemote = (firestore: Firestore): SyncRemote => ({
  reference: (fairId, entity, recordId) =>
    doc(firestore, 'fairs', fairId, entity, recordId),
  transact: (reference, operation) =>
    runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(reference)
      const current = snapshot.exists() ? snapshot.data() as SyncRecord : null
      let next: SyncRecord | undefined
      const result = operation(current, (record) => {
        next = record
      })
      if (next) {
        transaction.set(reference, withoutUndefined(next) as DocumentData)
      }
      return result
    }),
})

const makePendingState = (
  fairId: string,
  entity: SyncEntity,
  recordId: string,
  baseKnown: boolean,
  baseData: SyncRecord | null,
  revision: number,
): SyncState => ({
  fairId,
  entity,
  recordId,
  pending: true,
  baseKnown,
  baseData,
  revision,
})

export const createSyncEngine = (
  database: FeiraDatabase = defaultDb,
  options: SyncEngineOptions = {},
) => {
  const recordTable = (entity: SyncEntity) => tableFor(database, entity)
  const getRemote = async (): Promise<SyncRemote> => {
    if (options.remote) return options.remote
    if (options.firestore) return createFirestoreSyncRemote(options.firestore)
    await ensureFirebaseSignedIn()
    return createFirestoreSyncRemote(getFirebaseDb())
  }

  const saveLocal = async (entity: SyncEntity, record: SyncRecord) => {
    if (!record.fairId || !record.id) {
      throw new Error('A gravação local precisa de fairId e id.')
    }

    const table = recordTable(entity)
    await database.transaction('rw', table, database.syncStates, async () => {
      const key = recordKey(record.fairId, record.id)
      const previous = await database.syncStates.get(stateKey(record.fairId, entity, record.id))
      const existing = await table.get(key)
      const nextState: SyncState = {
        fairId: record.fairId,
        entity,
        recordId: record.id,
        pending: true,
        baseKnown: previous?.baseKnown ?? !existing,
        baseData: previous?.baseData ?? null,
        revision: (previous?.revision ?? 0) + 1,
        conflict: previous?.conflict,
      }

      await table.put(record)
      await database.syncStates.put(nextState)
    })
  }

  const mergeRemote = async (entity: SyncEntity, fairId: string, records: SyncRecord[]) => {
    const table = recordTable(entity)

    for (const remoteRecord of records) {
      if (remoteRecord.fairId !== fairId || !remoteRecord.id) continue

      await database.transaction('rw', table, database.syncStates, async () => {
        const key = recordKey(fairId, remoteRecord.id)
        const keyForState = stateKey(fairId, entity, remoteRecord.id)
        const localRecord = await table.get(key)
        const state = await database.syncStates.get(keyForState)

        if (!state?.pending) {
          if (localRecord && !state && !sameRecord(localRecord, remoteRecord)) {
            const pending = makePendingState(fairId, entity, remoteRecord.id, false, null, 1)
            pending.conflict = { remoteData: remoteRecord, detectedAt: new Date().toISOString() }
            await database.syncStates.put(pending)
            return
          }

          await table.put(remoteRecord)
          await database.syncStates.put({
            fairId: fairId,
            entity,
            recordId: remoteRecord.id,
            pending: false,
            baseKnown: true,
            baseData: remoteRecord,
            revision: state?.revision ?? 0,
          })
          return
        }

        if (localRecord && sameRecord(localRecord, remoteRecord)) {
          await database.syncStates.put({
            ...state,
            pending: false,
            baseKnown: true,
            baseData: remoteRecord,
            conflict: undefined,
          })
          return
        }

        if (state.baseKnown && sameRecord(state.baseData, remoteRecord)) {
          return
        }

        await database.syncStates.put({
          ...state,
          pending: true,
          conflict: {
            remoteData: remoteRecord,
            detectedAt: new Date().toISOString(),
          },
        })
      })
    }
  }

  const ensurePendingState = async (entity: SyncEntity, fairId: string, recordId: string) => {
    const table = recordTable(entity)
    await database.transaction('rw', table, database.syncStates, async () => {
      const keyForState = stateKey(fairId, entity, recordId)
      const state = await database.syncStates.get(keyForState)
      if (state) return

      const localRecord = await table.get(recordKey(fairId, recordId))
      if (!localRecord) return
      await database.syncStates.put(makePendingState(fairId, entity, recordId, false, null, 1))
    })
  }

  const syncRecord = async (entity: SyncEntity, fairId: string, recordId: string) => {
    const table = recordTable(entity)
    await ensurePendingState(entity, fairId, recordId)

    const localSnapshot = await table.get(recordKey(fairId, recordId))
    const stateSnapshot = await database.syncStates.get(stateKey(fairId, entity, recordId))
    if (!localSnapshot || !stateSnapshot) return { status: 'missing' as const }
    if (stateSnapshot.conflict) return { status: 'conflict' as const }
    if (!stateSnapshot.pending) return { status: 'synced' as const }

    let remote: SyncRemote
    try {
      remote = await getRemote()
    } catch (error) {
      return {
        status: 'pending' as const,
        error: error instanceof Error ? error.message : 'Firestore indisponível.',
      }
    }

    const localData = withoutUndefined(localSnapshot) as SyncRecord
    const stateForAttempt = stateSnapshot
    const reference = remote.reference(fairId, entity, recordId)
    let outcome: RemoteResult

    try {
      outcome = await remote.transact(reference, (current, write) => {
        const remoteData = current ? withoutUndefined(current) as SyncRecord : null

        if (remoteData && sameRecord(remoteData, localData)) {
          return { status: 'same', remoteData }
        }

        const isFirstWrite = remoteData === null
          && (!stateForAttempt.baseKnown || stateForAttempt.baseData === null)
        const matchesKnownBase = remoteData !== null
          && stateForAttempt.baseKnown
          && sameRecord(remoteData, stateForAttempt.baseData)

        if (isFirstWrite || matchesKnownBase) {
          write(localData)
          return { status: 'written', remoteData: localData }
        }

        return { status: 'conflict', remoteData }
      })
    } catch (error) {
      return {
        status: 'pending' as const,
        error: error instanceof Error ? error.message : 'Sincronização adiada.',
      }
    }

    await database.transaction('rw', table, database.syncStates, async () => {
      const keyForState = stateKey(fairId, entity, recordId)
      const latestState = await database.syncStates.get(keyForState)
      const latestLocal = await table.get(recordKey(fairId, recordId))
      if (!latestState || !latestLocal) return

      const remoteConflict = outcome.status === 'conflict'
      const observedRemoteChangedDuringAttempt = latestState.conflict
        && !sameRecord(latestState.conflict.remoteData, outcome.remoteData)
      if (remoteConflict || observedRemoteChangedDuringAttempt) {
        await database.syncStates.put({
          ...latestState,
          pending: true,
          baseKnown: remoteConflict ? latestState.baseKnown : true,
          baseData: remoteConflict ? latestState.baseData : outcome.remoteData,
          conflict: observedRemoteChangedDuringAttempt
            ? latestState.conflict
            : {
                remoteData: outcome.remoteData,
                detectedAt: new Date().toISOString(),
              },
        })
        return
      }

      const localStillMatchesAttempt = sameRecord(latestLocal, localSnapshot)
      await database.syncStates.put({
        ...latestState,
        pending: !localStillMatchesAttempt,
        baseKnown: true,
        baseData: outcome.remoteData,
        conflict: undefined,
      })
    })

    return { status: outcome.status === 'conflict' ? 'conflict' as const : 'synced' as const }
  }

  const syncFair = async (fairId: string) => {
    for (const entity of entities) {
      const records = (await recordTable(entity).where('fairId').equals(fairId).toArray()) as SyncRecord[]
      for (const record of records) {
        await ensurePendingState(entity, fairId, record.id)
      }
    }

    const states = await database.syncStates
      .where('fairId')
      .equals(fairId)
      .toArray() as SyncState[]
    for (const state of states) {
      if (state.pending && !state.conflict) {
        await syncRecord(state.entity, fairId, state.recordId)
      }
    }

    return getStatus(fairId)
  }

  const getStatus = async (fairId: string): Promise<SyncStatus> => {
    const states = await database.syncStates
      .where('fairId')
      .equals(fairId)
      .toArray() as SyncState[]

    return {
      pending: states.filter((state) => state.pending).length,
      conflicts: states
        .filter((state) => state.conflict)
        .map((state) => ({
          fairId,
          entity: state.entity,
          recordId: state.recordId,
          remoteExists: state.conflict?.remoteData !== null,
          detectedAt: state.conflict?.detectedAt ?? '',
        })),
    }
  }

  const resolveConflict = async (
    entity: SyncEntity,
    fairId: string,
    recordId: string,
    resolution: ConflictResolution,
  ) => {
    const table = recordTable(entity)
    await database.transaction('rw', table, database.syncStates, async () => {
      const keyForState = stateKey(fairId, entity, recordId)
      const state = await database.syncStates.get(keyForState) as SyncState | undefined
      if (!state?.conflict) throw new Error('Este registro não tem conflito pendente.')

      if (resolution === 'remote') {
        if (!state.conflict.remoteData) {
          throw new Error('Não há versão remota para aplicar.')
        }

        await table.put(state.conflict.remoteData)
        await database.syncStates.put({
          ...state,
          pending: false,
          baseKnown: true,
          baseData: state.conflict.remoteData,
          revision: state.revision + 1,
          conflict: undefined,
        })
        return
      }

      await database.syncStates.put({
        ...state,
        pending: true,
        baseKnown: true,
        baseData: state.conflict.remoteData,
        revision: state.revision + 1,
        conflict: undefined,
      })
    })
  }

  const listLegacyRecords = async (): Promise<LegacyRecordReference[]> => {
    const result: LegacyRecordReference[] = []
    for (const entity of entities) {
      const records = await legacyTableFor(database, entity).toArray()
      for (const record of records) {
        if (!record.fairId || !/^[A-Za-z0-9_-]{1,128}$/.test(record.fairId)) {
          result.push({ entity, id: record.id, description: describeLegacyRecord(entity, record) })
        }
      }
    }
    return result.sort((left, right) =>
      left.entity.localeCompare(right.entity) || left.id.localeCompare(right.id),
    )
  }

  const associateLegacyRecord = async (
    reference: LegacyRecordIdentity,
    fairId: string,
  ) => {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(fairId)) {
      throw new Error('Selecione uma feira válida para associar o registro.')
    }

    const legacyTable = legacyTableFor(database, reference.entity)
    const table = recordTable(reference.entity)
    await database.transaction(
      'rw',
      legacyTable as never,
      table,
      database.fairs,
      database.syncStates,
      async () => {
        const fair = await database.fairs.get(fairId)
        if (!fair) throw new Error('A feira escolhida não está disponível localmente.')

        const legacyRecord = await legacyTable.get(reference.id)
        if (!legacyRecord) throw new Error('O registro legado não foi encontrado.')
        if (legacyRecord.fairId && /^[A-Za-z0-9_-]{1,128}$/.test(legacyRecord.fairId)) {
          throw new Error('Este registro já está associado a uma feira.')
        }

        if (await table.get(recordKey(fairId, reference.id))) {
          throw new Error('Já existe um registro com este ID nesta feira; revise antes de associar.')
        }

        const assignedRecord = { ...legacyRecord, fairId } as SyncRecord
        await table.put(assignedRecord)
        await database.syncStates.put(
          makePendingState(fairId, reference.entity, reference.id, false, null, 1),
        )
        await legacyTable.delete(reference.id)
      },
    )
  }

  return {
    saveLocal,
    mergeRemote,
    syncRecord,
    syncFair,
    getStatus,
    resolveConflict,
    listLegacyRecords,
    associateLegacyRecord,
  }
}

const defaultEngine = createSyncEngine()

export const saveLocalRecord = defaultEngine.saveLocal
export const mergeRemoteRecords = defaultEngine.mergeRemote
export const syncLocalRecord = defaultEngine.syncRecord
export const syncFairRecords = defaultEngine.syncFair
export const getSyncStatus = defaultEngine.getStatus
export const resolveSyncConflict = defaultEngine.resolveConflict
export const listLegacyRecords = defaultEngine.listLegacyRecords
export const associateLegacyRecord = defaultEngine.associateLegacyRecord