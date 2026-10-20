import Dexie from 'dexie'
import rules from '../../firestore.rules?raw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { FeiraDatabase } from '@/services/db'
import {
  createFirestoreSyncRemote,
  createSyncEngine,
  type SyncRecord,
  type SyncRemote,
} from '@/services/sync'
import { listCloudProducts } from '@/services/firestore/products'
import { createFairMetadataSyncEngine, type FairMetadataRemote } from '@/services/fairMetadataSync'
import type { Fair, Product, Sale, Settings } from '@/types/models'

const PROJECT_ID = 'demo-festa-camarao'
const EMULATOR_HOST = '127.0.0.1'
const EMULATOR_PORT = 8080
const TIME = '2026-06-01T12:00:00.000Z'
const UPDATED = '2026-06-01T12:05:00.000Z'

let testEnv: RulesTestEnvironment
const databases: FeiraDatabase[] = []

const firestoreFor = (userId: string): Firestore =>
  testEnv.authenticatedContext(userId).firestore() as unknown as Firestore

const makeFair = (id: string, ownerId: string, memberIds: string[] = []): Fair => ({
  id,
  name: `Synthetic ${id}`,
  ownerId,
  members: Object.fromEntries([ownerId, ...memberIds].map((memberId) => [memberId, true])),
  active: true,
  createdAt: TIME,
  updatedAt: TIME,
})

const makeProduct = (id: string, fairId = 'fair-a', overrides: Partial<Product> = {}): Product => ({
  id,
  fairId,
  name: 'Synthetic juice',
  price: 5,
  category: 'Bebidas',
  active: true,
  sortOrder: 1,
  createdAt: TIME,
  updatedAt: TIME,
  ...overrides,
})

const makeSale = (id: string, fairId = 'fair-a', overrides: Partial<Sale> = {}): Sale => ({
  id,
  fairId,
  createdAt: TIME,
  dateKey: '2026-06-01',
  items: [{
    lineId: 'line-1',
    productId: 'synthetic-juice',
    productName: 'Synthetic juice',
    unitPrice: 5,
    quantity: 2,
    total: 10,
  }],
  subtotal: 10,
  total: 10,
  paymentMethod: 'pix',
  status: 'confirmado',
  ...overrides,
})

const makeSettings = (id: string, fairId: string): Settings => ({
  id,
  fairId,
  storeName: 'Synthetic counter',
  currency: 'BRL',
})

const createDatabase = async (name = `sync-test-${crypto.randomUUID()}`) => {
  const database = new FeiraDatabase(name)
  databases.push(database)
  await database.open()
  return database
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
      rules,
    },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore
    await setDoc(doc(firestore, 'fairs/fair-a'), makeFair('fair-a', 'owner-a', ['member-a', 'member-b']))
    await setDoc(doc(firestore, 'fairs/fair-b'), makeFair('fair-b', 'owner-b', ['member-b']))
  })
})

afterEach(async () => {
  for (const database of databases.splice(0)) {
    database.close()
    await database.delete()
  }
})

afterAll(async () => {
  await testEnv?.cleanup()
})

describe('offline synchronization against synthetic Firestore Emulator data', () => {
  it('retries an acknowledged write idempotently when the first response is lost', async () => {
    const database = await createDatabase()
    const actualRemote = createFirestoreSyncRemote(firestoreFor('member-a'))
    let attempts = 0
    let committedWrites = 0
    const remote: SyncRemote = {
      reference: actualRemote.reference,
      async transact<T>(
        reference: DocumentReference<DocumentData, DocumentData>,
        operation: (current: SyncRecord | null, write: (record: SyncRecord) => void) => T,
      ): Promise<T> {
        attempts += 1
        let requestedWrite = false
        const result = await actualRemote.transact(reference, (current, write) => operation(current, (record) => {
          requestedWrite = true
          write(record)
        }))
        if (requestedWrite) committedWrites += 1
        if (attempts === 1) throw new Error('synthetic lost response after commit')
        return result
      },
    }
    const engine = createSyncEngine(database, { remote })
    const product = makeProduct('retry-product')

    await engine.saveLocal('products', product)
    expect(await engine.syncRecord('products', product.fairId, product.id)).toMatchObject({ status: 'pending' })
    expect((await engine.getStatus(product.fairId)).pending).toBe(1)
    expect(await engine.syncRecord('products', product.fairId, product.id)).toEqual({ status: 'synced' })
    expect(await engine.syncRecord('products', product.fairId, product.id)).toEqual({ status: 'synced' })

    expect(attempts).toBe(2)
    expect(committedWrites).toBe(1)
    expect((await engine.getStatus(product.fairId)).pending).toBe(0)
    const remoteSnapshot = await getDoc(doc(
      firestoreFor('member-a'),
      'fairs/fair-a/products/retry-product',
    ))
    expect(remoteSnapshot.data()).toMatchObject({ id: product.id, fairId: 'fair-a', name: product.name })
  })

  it('keeps both device edits and requires an explicit choice before replacing the newer remote version', async () => {
    const databaseA = await createDatabase()
    const databaseB = await createDatabase()
    const firestoreA = firestoreFor('member-a')
    const firestoreB = firestoreFor('member-b')
    const engineA = createSyncEngine(databaseA, { firestore: firestoreA })
    const engineB = createSyncEngine(databaseB, { firestore: firestoreB })
    const baseline = makeProduct('two-device-product')

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, 'fairs/fair-a/products/two-device-product'), baseline)
    })
    await engineA.mergeRemote('products', 'fair-a', [baseline])
    await engineB.mergeRemote('products', 'fair-a', [baseline])

    const editA = { ...baseline, name: 'Device A edit', price: 6, updatedAt: UPDATED }
    const editB = { ...baseline, name: 'Device B edit', price: 7, updatedAt: UPDATED }
    await engineA.saveLocal('products', editA)
    expect(await engineA.syncRecord('products', 'fair-a', baseline.id)).toEqual({ status: 'synced' })
    await engineB.saveLocal('products', editB)
    expect(await engineB.syncRecord('products', 'fair-a', baseline.id)).toMatchObject({ status: 'conflict' })

    expect(await databaseB.products.get(['fair-a', baseline.id])).toMatchObject({ name: 'Device B edit', price: 7 })
    expect(await engineB.getStatus('fair-a')).toMatchObject({ pending: 1, conflicts: [{ recordId: baseline.id }] })
    const remoteBeforeChoice = await getDoc(doc(firestoreA, 'fairs/fair-a/products/two-device-product'))
    expect(remoteBeforeChoice.data()).toMatchObject({ name: 'Device A edit', price: 6 })

    await engineB.resolveConflict('products', 'fair-a', baseline.id, 'local')
    expect(await engineB.syncRecord('products', 'fair-a', baseline.id)).toEqual({ status: 'synced' })
    const remoteAfterChoice = await getDoc(doc(firestoreA, 'fairs/fair-a/products/two-device-product'))
    expect(remoteAfterChoice.data()).toMatchObject({ name: 'Device B edit', price: 7 })
  })

  it('chooses the remote version without deleting sibling records', async () => {
    const database = await createDatabase()
    const engine = createSyncEngine(database, { firestore: firestoreFor('member-a') })
    const baseline = makeProduct('remote-choice-product')
    const sibling = makeProduct('sibling-product', 'fair-a', { name: 'Preserved sibling' })
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore() as unknown as Firestore
      await setDoc(doc(firestore, 'fairs/fair-a/products/remote-choice-product'), baseline)
      await setDoc(doc(firestore, 'fairs/fair-a/products/sibling-product'), sibling)
    })
    await engine.mergeRemote('products', 'fair-a', [baseline, sibling])

    await engine.saveLocal('products', { ...baseline, name: 'Local contender', updatedAt: UPDATED })
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, 'fairs/fair-a/products/remote-choice-product'), {
        ...baseline,
        name: 'Remote winner',
        updatedAt: UPDATED,
      })
    })
    expect(await engine.syncRecord('products', 'fair-a', baseline.id)).toMatchObject({ status: 'conflict' })

    await engine.resolveConflict('products', 'fair-a', baseline.id, 'remote')
    expect(await database.products.get(['fair-a', baseline.id])).toMatchObject({ name: 'Remote winner' })
    expect(await database.products.get(['fair-a', sibling.id])).toMatchObject({ name: 'Preserved sibling' })
    expect((await engine.getStatus('fair-a')).conflicts).toEqual([])
  })

  it('does not replace a pending local edit when a realtime read brings a newer remote version', async () => {
    const database = await createDatabase()
    const engine = createSyncEngine(database, { firestore: firestoreFor('member-a') })
    const baseline = makeProduct('realtime-conflict-product')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, 'fairs/fair-a/products/realtime-conflict-product'), baseline)
    })
    await engine.mergeRemote('products', 'fair-a', [baseline])

    const localEdit = { ...baseline, name: 'Unsynced local edit', price: 8, updatedAt: UPDATED }
    const remoteEdit = { ...baseline, name: 'New remote edit', price: 9, updatedAt: UPDATED }
    await engine.saveLocal('products', localEdit)
    await engine.mergeRemote('products', 'fair-a', [remoteEdit])

    expect(await database.products.get(['fair-a', baseline.id])).toMatchObject({
      name: 'Unsynced local edit',
      price: 8,
    })
    expect(await engine.getStatus('fair-a')).toMatchObject({
      pending: 1,
      conflicts: [{ recordId: baseline.id, remoteExists: true }],
    })
  })

  it('keeps local writes pending while offline and uploads them after reconnection', async () => {
    const database = await createDatabase()
    const firestore = firestoreFor('member-a')
    const emulatorRemote = createFirestoreSyncRemote(firestore)
    let online = false
    let networkAttempts = 0
    const remote: SyncRemote = {
      reference: emulatorRemote.reference,
      transact<T>(
        reference: DocumentReference<DocumentData, DocumentData>,
        operation: (current: SyncRecord | null, write: (record: SyncRecord) => void) => T,
      ): Promise<T> {
        networkAttempts += 1
        if (!online) return Promise.reject(new Error('synthetic offline transport'))
        return emulatorRemote.transact(reference, operation)
      },
    }
    const engine = createSyncEngine(database, { remote })
    const product = makeProduct('offline-product')

    await engine.saveLocal('products', product)
    expect(await engine.syncRecord('products', product.fairId, product.id)).toMatchObject({ status: 'pending' })
    expect((await engine.getStatus(product.fairId)).pending).toBe(1)
    expect(networkAttempts).toBe(1)
    const absentWhileOffline = await getDoc(doc(firestore, 'fairs/fair-a/products/offline-product'))
    expect(absentWhileOffline.exists()).toBe(false)

    online = true
    expect(await engine.syncRecord('products', product.fairId, product.id)).toEqual({ status: 'synced' })
    expect((await engine.getStatus(product.fairId)).pending).toBe(0)
    const presentAfterReconnect = await getDoc(doc(firestore, 'fairs/fair-a/products/offline-product'))
    expect(presentAfterReconnect.data()).toMatchObject({ fairId: 'fair-a', id: 'offline-product' })
  })

  it('keeps sales, command updates, cancellations and settings synchronized', async () => {
    const database = await createDatabase()
    const engine = createSyncEngine(database, {
      firestore: firestoreFor('member-a'),
    })
    const sale = makeSale('command-sale', 'fair-a', {
      commandNumber: '42',
      commandStatus: 'pendente',
      commandUpdatedAt: TIME,
    })

    await engine.saveLocal('sales', sale)
    expect(await engine.syncRecord('sales', 'fair-a', sale.id)).toEqual({ status: 'synced' })
    const calledSale = { ...sale, commandStatus: 'chamado' as const, commandUpdatedAt: UPDATED }
    await engine.saveLocal('sales', calledSale)
    expect(await engine.syncRecord('sales', 'fair-a', sale.id)).toEqual({ status: 'synced' })
    const cancelledSale = { ...calledSale, status: 'cancelado' as const, cancelledAt: UPDATED }
    await engine.saveLocal('sales', cancelledSale)
    expect(await engine.syncRecord('sales', 'fair-a', sale.id)).toEqual({ status: 'synced' })

    const settings = makeSettings('default-fair-a', 'fair-a')
    await engine.saveLocal('settings', settings)
    expect(await engine.syncRecord('settings', 'fair-a', settings.id)).toEqual({ status: 'synced' })

    const remoteSale = await getDoc(doc(
      firestoreFor('member-a'),
      'fairs/fair-a/sales/command-sale',
    ))
    expect(remoteSale.data()).toMatchObject({
      commandNumber: '42',
      commandStatus: 'chamado',
      status: 'cancelado',
    })
    const remoteSettings = await getDoc(doc(
      firestoreFor('member-a'),
      'fairs/fair-a/settings/default-fair-a',
    ))
    expect(remoteSettings.data()).toMatchObject({ storeName: settings.storeName, fairId: 'fair-a' })
  })

  it('isolates equal record IDs by fair in IndexedDB and Firestore paths', async () => {
    const database = await createDatabase()
    const engineA = createSyncEngine(database, {
      firestore: firestoreFor('member-a'),
    })
    const engineB = createSyncEngine(database, {
      firestore: firestoreFor('member-b'),
    })
    const productA = makeProduct('same-id', 'fair-a', { name: 'Product fair A' })
    const productB = makeProduct('same-id', 'fair-b', { name: 'Product fair B' })

    await engineA.saveLocal('products', productA)
    await engineB.saveLocal('products', productB)
    expect(await engineA.syncRecord('products', 'fair-a', 'same-id')).toEqual({ status: 'synced' })
    expect(await engineB.syncRecord('products', 'fair-b', 'same-id')).toEqual({ status: 'synced' })
    expect(await database.products.get(['fair-a', 'same-id'])).toMatchObject({ name: 'Product fair A' })
    expect(await database.products.get(['fair-b', 'same-id'])).toMatchObject({ name: 'Product fair B' })

    const fairA = await getDoc(doc(firestoreFor('member-a'), 'fairs/fair-a/products/same-id'))
    const fairB = await getDoc(doc(firestoreFor('member-b'), 'fairs/fair-b/products/same-id'))
    expect(fairA.data()).toMatchObject({ fairId: 'fair-a', name: 'Product fair A' })
    expect(fairB.data()).toMatchObject({ fairId: 'fair-b', name: 'Product fair B' })
  })

  it('merges manual product pulls with remote soft-deletion tombstones', async () => {
    const database = await createDatabase()
    const engine = createSyncEngine(database, { firestore: firestoreFor('member-a') })
    const baseline = makeProduct('product-a')
    const tombstone = makeProduct('product-a', 'fair-a', {
      active: false,
      deleted: true,
      deletedAt: UPDATED,
      updatedAt: UPDATED,
    })
    await engine.mergeRemote('products', 'fair-a', [baseline])
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(
        context.firestore() as unknown as Firestore,
        'fairs/fair-a/products/product-a',
      ), tombstone)
    })

    const pulled = await listCloudProducts('fair-a', {
      includeInactive: true,
      includeDeleted: true,
      firestore: firestoreFor('member-a'),
    })
    expect(pulled).toContainEqual(expect.objectContaining({ id: 'product-a', deleted: true }))
    await engine.mergeRemote('products', 'fair-a', pulled)

    expect(await database.products.get(['fair-a', 'product-a'])).toMatchObject({
      active: false,
      deleted: true,
      deletedAt: UPDATED,
    })
  })

  it('detects fair metadata conflicts and applies the explicit remote choice only to metadata', async () => {
    const database = await createDatabase()
    const engine = createFairMetadataSyncEngine(database, { firestore: firestoreFor('owner-a') })
    const baseline = makeFair('fair-a', 'owner-a', ['member-a', 'member-b'])
    await engine.mergeRemoteFair(baseline)
    await engine.saveLocalPatch('fair-a', { name: 'Local name' })
    await updateDoc(doc(firestoreFor('owner-a'), 'fairs/fair-a'), {
      name: 'Remote name',
      updatedAt: UPDATED,
    })

    expect(await engine.syncFair('fair-a', 'owner-a')).toEqual({ status: 'conflict' })
    expect(await database.fairs.get('fair-a')).toMatchObject({ name: 'Local name' })
    expect((await engine.getStatus('fair-a')).conflict).toMatchObject({
      localData: { name: 'Local name' },
      remoteData: { name: 'Remote name' },
    })

    await engine.resolveConflict('fair-a', 'remote')
    expect(await database.fairs.get('fair-a')).toMatchObject({ name: 'Remote name' })
    expect(await database.fairSyncStates.get('fair-a')).toBeUndefined()
    expect(await database.products.toArray()).toEqual([])
    expect(await database.sales.toArray()).toEqual([])
  })

  it('patches metadata fields without replacing a fresh remote member map', async () => {
    const database = await createDatabase()
    const engine = createFairMetadataSyncEngine(database, { firestore: firestoreFor('owner-a') })
    const baseline = makeFair('fair-a', 'owner-a', ['member-a', 'member-b'])
    await engine.mergeRemoteFair(baseline)
    await engine.saveLocalPatch('fair-a', { name: 'Renamed locally' })
    await updateDoc(doc(firestoreFor('owner-a'), 'fairs/fair-a'), {
      members: { 'owner-a': true, 'member-a': true, 'member-b': true, 'member-c': true },
      updatedAt: UPDATED,
    })

    expect(await engine.syncFair('fair-a', 'owner-a')).toEqual({ status: 'synced' })
    const remote = await getDoc(doc(firestoreFor('owner-a'), 'fairs/fair-a'))
    expect(remote.data()).toMatchObject({
      name: 'Renamed locally',
      members: { 'member-c': true },
    })
  })

  it('requires fresh-state confirmation when the remote fair state changed', async () => {
    const database = await createDatabase()
    const engine = createFairMetadataSyncEngine(database, { firestore: firestoreFor('owner-a') })
    await updateDoc(doc(firestoreFor('owner-a'), 'fairs/fair-a'), {
      active: false,
      updatedAt: UPDATED,
    })

    expect(await engine.setActive('fair-a', 'owner-a', true, false)).toMatchObject({
      status: 'conflict',
      fair: { active: false },
    })
  })

  it('keeps local membership and fair state unchanged when remote administration is offline', async () => {
    const database = await createDatabase()
    const localFair = makeFair('fair-a', 'owner-a', ['member-a'])
    await database.fairs.put(localFair)
    const remote: FairMetadataRemote = {
      async transact<T>(
        _fairId: string,
        _operation: (current: Fair | null, write: (patch: Partial<Fair>) => void) => T,
      ): Promise<T> {
        throw new Error('synthetic offline transport')
      },
    }
    const engine = createFairMetadataSyncEngine(database, { remote })

    await expect(engine.updateMemberAccess('fair-a', 'owner-a', 'member-b', true)).rejects.toThrow('synthetic offline')
    await expect(engine.setActive('fair-a', 'owner-a', true, false)).rejects.toThrow('synthetic offline')
    expect(await database.fairs.get('fair-a')).toEqual(localFair)
    expect(await database.fairSyncStates.get('fair-a')).toBeUndefined()
  })

  it('edits the member map from a fresh remote transaction', async () => {
    const database = await createDatabase()
    const engine = createFairMetadataSyncEngine(database, { firestore: firestoreFor('owner-a') })
    await updateDoc(doc(firestoreFor('owner-a'), 'fairs/fair-a'), {
      members: { 'owner-a': true, 'member-a': true, 'member-b': true, 'member-c': true },
      updatedAt: UPDATED,
    })

    const updated = await engine.updateMemberAccess('fair-a', 'owner-a', 'member-d', true)
    expect(updated.members).toMatchObject({
      'member-c': true,
      'member-d': true,
    })
    expect((await getDoc(doc(firestoreFor('owner-a'), 'fairs/fair-a'))).data()?.members).toMatchObject({
      'member-c': true,
      'member-d': true,
    })
  })

  it('preserves records without fairId during v3-to-v4 migration and associates only after explicit selection', async () => {
    const name = `sync-migration-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(1).stores({
      products: 'id, category, active, sortOrder',
      sales: 'id, dateKey, createdAt, status, paymentMethod',
      settings: 'id',
    })
    oldDatabase.version(2).stores({
      products: 'id, fairId, [fairId+category], [fairId+active], sortOrder',
      sales: 'id, fairId, [fairId+dateKey], createdAt, status, paymentMethod',
      settings: 'id, fairId',
      fairs: 'id, ownerId, active',
    })
    oldDatabase.version(3).stores({
      products: 'id, fairId, [fairId+category], [fairId+active], deleted, sortOrder',
      sales: 'id, fairId, [fairId+dateKey], createdAt, status, paymentMethod',
      settings: 'id, fairId',
      fairs: 'id, ownerId, active',
    })
    await oldDatabase.open()
    await oldDatabase.table('products').put({ id: 'orphan-product', name: 'Synthetic orphan' })
    await oldDatabase.table('products').put(makeProduct('already-assigned'))
    await oldDatabase.table('sales').put({ id: 'orphan-sale', createdAt: TIME, commandNumber: '17' })
    await oldDatabase.table('sales').put(makeSale('already-assigned-sale'))
    await oldDatabase.table('settings').put({ id: 'orphan-settings', storeName: 'Synthetic orphan settings' })
    await oldDatabase.table('settings').put(makeSettings('already-assigned-settings', 'fair-a'))
    await oldDatabase.close()

    const database = await createDatabase(name)
    expect(await database.legacyProducts.get('orphan-product')).toMatchObject({ id: 'orphan-product' })
    expect(await database.products.get(['fair-a', 'orphan-product'])).toBeUndefined()
    expect(await database.products.get(['fair-a', 'already-assigned'])).toMatchObject({ fairId: 'fair-a' })
    expect(await database.legacyProducts.get('already-assigned')).toBeUndefined()
    expect(await database.legacySales.get('orphan-sale')).toMatchObject({ id: 'orphan-sale' })
    expect(await database.sales.get(['fair-a', 'orphan-sale'])).toBeUndefined()
    expect(await database.sales.get(['fair-a', 'already-assigned-sale'])).toMatchObject({ fairId: 'fair-a' })
    expect(await database.legacySales.get('already-assigned-sale')).toBeUndefined()
    expect(await database.legacySettings.get('orphan-settings')).toMatchObject({ id: 'orphan-settings' })
    expect(await database.settings.get(['fair-a', 'orphan-settings'])).toBeUndefined()
    expect(await database.settings.get(['fair-a', 'already-assigned-settings'])).toMatchObject({ fairId: 'fair-a' })
    expect(await database.legacySettings.get('already-assigned-settings')).toBeUndefined()

    await database.fairs.put(makeFair('fair-a', 'owner-a', ['member-a']))
    const engine = createSyncEngine(database, {
      firestore: firestoreFor('member-a'),
    })
    expect(await engine.listLegacyRecords()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'products', id: 'orphan-product' }),
      expect.objectContaining({ entity: 'sales', id: 'orphan-sale' }),
      expect.objectContaining({ entity: 'settings', id: 'orphan-settings' }),
    ]))
    for (const orphan of [
      { entity: 'products' as const, id: 'orphan-product' },
      { entity: 'sales' as const, id: 'orphan-sale' },
      { entity: 'settings' as const, id: 'orphan-settings' },
    ]) {
      await engine.associateLegacyRecord(orphan, 'fair-a')
      expect(await database.syncStates.get(['fair-a', orphan.entity, orphan.id])).toMatchObject({ pending: true })
    }
    expect(await database.products.get(['fair-a', 'orphan-product'])).toMatchObject({ fairId: 'fair-a' })
    expect(await database.sales.get(['fair-a', 'orphan-sale'])).toMatchObject({ fairId: 'fair-a' })
    expect(await database.settings.get(['fair-a', 'orphan-settings'])).toMatchObject({ fairId: 'fair-a' })
    expect(await database.legacyProducts.get('orphan-product')).toBeUndefined()
    expect(await database.legacySales.get('orphan-sale')).toBeUndefined()
    expect(await database.legacySettings.get('orphan-settings')).toBeUndefined()
  })
})
