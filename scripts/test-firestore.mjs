import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

// Emulator-only: fixed demo project and loopback host; this file never reads .env.
const PROJECT_ID = 'demo-festa-camarao'
const EMULATOR_HOST = '127.0.0.1'
const EMULATOR_PORT = 8080
const TIME = '2026-01-02T03:04:05.000Z'
const UPDATED_TIME = '2026-01-02T04:05:06.000Z'
const currentDir = dirname(fileURLToPath(import.meta.url))
const rules = await readFile(join(currentDir, '..', 'firestore.rules'), 'utf8')

let testEnv

const makeFair = (id, ownerId, members) => ({
  id,
  name: 'Feira sintetica',
  ownerId,
  members,
  active: true,
  createdAt: TIME,
  updatedAt: TIME,
})

const makeProduct = (id, fairId = 'fair-a', overrides = {}) => ({
  id,
  fairId,
  name: 'Suco',
  price: 5,
  category: 'Bebidas',
  active: true,
  sortOrder: 1,
  createdAt: TIME,
  updatedAt: TIME,
  ...overrides,
})

const makeSale = (id, fairId = 'fair-a', overrides = {}) => ({
  id,
  fairId,
  createdAt: TIME,
  dateKey: '2026-01-02',
  items: [
    {
      lineId: 'line-1',
      productId: 'suco',
      productName: 'Suco',
      unitPrice: 5,
      quantity: 2,
      total: 10,
    },
  ],
  subtotal: 10,
  total: 10,
  paymentMethod: 'pix',
  status: 'confirmado',
  ...overrides,
})

const makeSettings = (id, fairId = 'fair-a', overrides = {}) => ({
  id,
  fairId,
  storeName: 'Caixa sintetico',
  currency: 'BRL',
  ...overrides,
})

before(async () => {
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
    const db = context.firestore()
    await setDoc(doc(db, 'fairs/fair-a'), makeFair('fair-a', 'owner-a', {
      'owner-a': true,
      'member-a': true,
    }))
    await setDoc(doc(db, 'fairs/fair-b'), makeFair('fair-b', 'owner-b', {
      'owner-b': true,
      'member-b': true,
    }))
    await setDoc(doc(db, 'fairs/fair-a/products/product-a'), makeProduct('product-a'))
    await setDoc(doc(db, 'fairs/fair-a/sales/sale-a'), makeSale('sale-a'))
    await setDoc(doc(db, 'fairs/fair-a/settings/default'), makeSettings('default'))
    await setDoc(doc(db, 'fairs/fair-b/products/product-b'), makeProduct('product-b', 'fair-b'))
  })
})

after(async () => {
  await testEnv?.cleanup()
})

describe('Firestore rules: synthetic Emulator data', () => {
  it('denies unauthenticated reads and writes', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'fairs/fair-a')))
    await assertFails(getDoc(doc(db, 'fairs/fair-a/products/product-a')))
    await assertFails(getDocs(query(
      collection(db, 'fairs/fair-a/sales'),
      where('fairId', '==', 'fair-a'),
    )))
    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/products/anonymous-product'),
      makeProduct('anonymous-product'),
    ))
  })

  it('lets a member verify that a valid document ID is not created yet', async () => {
    const db = testEnv.authenticatedContext('member-a').firestore()
    await assertSucceeds(getDoc(doc(db, 'fairs/fair-a/products/not-created-yet')))
    await assertSucceeds(getDoc(doc(db, 'fairs/fair-a/sales/not-created-yet')))
    await assertSucceeds(getDoc(doc(db, 'fairs/fair-a/settings/default-not-created-yet')))
    await assertFails(getDoc(doc(db, 'fairs/fair-b/products/not-created-yet')))
  })

  it('lets an owner or member read only fairs and data they belong to', async () => {
    const member = testEnv.authenticatedContext('member-a').firestore()
    const owner = testEnv.authenticatedContext('owner-a').firestore()

    await assertSucceeds(getDoc(doc(member, 'fairs/fair-a')))
    await assertSucceeds(getDoc(doc(owner, 'fairs/fair-a/products/product-a')))
    const products = await assertSucceeds(getDocs(query(
      collection(member, 'fairs/fair-a/products'),
      where('fairId', '==', 'fair-a'),
    )))
    assert.equal(products.size, 1)

    const fairs = await assertSucceeds(getDocs(query(
      collection(member, 'fairs'),
      where('members.member-a', '==', true),
    )))
    assert.equal(fairs.size, 1)
  })

  it('lets a member create and update products, sales, and settings in their fair', async () => {
    const db = testEnv.authenticatedContext('member-a').firestore()

    await assertSucceeds(setDoc(
      doc(db, 'fairs/fair-a/products/product-new'),
      makeProduct('product-new'),
    ))
    await assertSucceeds(updateDoc(
      doc(db, 'fairs/fair-a/products/product-a'),
      { price: 6, updatedAt: UPDATED_TIME },
    ))

    await assertSucceeds(setDoc(
      doc(db, 'fairs/fair-a/sales/sale-new'),
      makeSale('sale-new'),
    ))
    await assertSucceeds(updateDoc(
      doc(db, 'fairs/fair-a/sales/sale-a'),
      { status: 'cancelado', cancelledAt: UPDATED_TIME },
    ))

    await assertSucceeds(setDoc(
      doc(db, 'fairs/fair-a/settings/default-fair-a'),
      makeSettings('default-fair-a'),
    ))
  })

  it('denies members access to another fair and its subcollections', async () => {
    const db = testEnv.authenticatedContext('member-a').firestore()
    await assertFails(getDoc(doc(db, 'fairs/fair-b')))
    await assertFails(getDoc(doc(db, 'fairs/fair-b/products/product-b')))
    await assertFails(getDocs(query(
      collection(db, 'fairs/fair-b/products'),
      where('fairId', '==', 'fair-b'),
    )))
    await assertFails(setDoc(
      doc(db, 'fairs/fair-b/products/foreign-write'),
      makeProduct('foreign-write', 'fair-b'),
    ))
  })

  it('keeps fair administration, membership changes, and deletion owner-only', async () => {
    const member = testEnv.authenticatedContext('member-a').firestore()
    const owner = testEnv.authenticatedContext('owner-a').firestore()

    await assertFails(updateDoc(doc(member, 'fairs/fair-a'), { name: 'Tentativa membro' }))
    await assertFails(updateDoc(doc(member, 'fairs/fair-a'), { ownerId: 'member-a' }))
    await assertFails(updateDoc(doc(member, 'fairs/fair-a'), {
      members: { 'owner-a': true, 'member-a': true, intruder: true },
    }))
    await assertFails(deleteDoc(doc(member, 'fairs/fair-a')))

    await assertSucceeds(updateDoc(doc(owner, 'fairs/fair-a'), {
      name: 'Feira atualizada',
      active: false,
      members: { 'owner-a': true, 'member-b': true },
      updatedAt: UPDATED_TIME,
    }))
    await assertFails(updateDoc(doc(owner, 'fairs/fair-a'), { ownerId: 'member-b' }))
    await assertSucceeds(deleteDoc(doc(owner, 'fairs/fair-a')))
  })

  it('validates ids, fairId paths, allowed fields, and data shapes', async () => {
    const db = testEnv.authenticatedContext('member-a').firestore()

    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/products/wrong-fair'),
      makeProduct('wrong-fair', 'fair-b'),
    ))
    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/products/wrong-id'),
      makeProduct('different-id'),
    ))
    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/products/unknown-field'),
      makeProduct('unknown-field', 'fair-a', { admin: true }),
    ))
    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/products/negative-price'),
      makeProduct('negative-price', 'fair-a', { price: -1 }),
    ))

    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/sales/wrong-fair'),
      makeSale('wrong-fair', 'fair-b'),
    ))
    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/sales/empty-items'),
      makeSale('empty-items', 'fair-a', { items: [] }),
    ))
    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/sales/invalid-payment'),
      makeSale('invalid-payment', 'fair-a', { paymentMethod: 'gift-card' }),
    ))
    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/sales/unknown-field'),
      makeSale('unknown-field', 'fair-a', { isAdmin: true }),
    ))

    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/settings/wrong-fair'),
      makeSettings('wrong-fair', 'fair-b'),
    ))
    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/settings/invalid-currency'),
      makeSettings('invalid-currency', 'fair-a', { currency: 'USD' }),
    ))
  })

  it('denies reads and writes to subcollection documents without fairId', async () => {
    const db = testEnv.authenticatedContext('member-a').firestore()
    const missingDocuments = [
      ['products', 'missing-fair-id', (() => {
        const product = makeProduct('missing-fair-id')
        delete product.fairId
        return product
      })()],
      ['sales', 'missing-fair-id', (() => {
        const sale = makeSale('missing-fair-id')
        delete sale.fairId
        return sale
      })()],
      ['settings', 'default-missing-fair-id', (() => {
        const settings = makeSettings('default-missing-fair-id')
        delete settings.fairId
        return settings
      })()],
    ]

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore()
      for (const [collectionName, recordId, data] of missingDocuments) {
        await setDoc(doc(adminDb, 'fairs/fair-a/' + collectionName + '/' + recordId), data)
      }
    })

    for (const [collectionName, recordId] of missingDocuments) {
      await assertFails(getDoc(doc(db, 'fairs/fair-a/' + collectionName + '/' + recordId)))
    }

    const missingProduct = makeProduct('missing-fair-create')
    delete missingProduct.fairId
    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/products/missing-fair-create'),
      missingProduct,
    ))

    const missingSale = makeSale('missing-fair-create')
    delete missingSale.fairId
    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/sales/missing-fair-create'),
      missingSale,
    ))

    const missingSettings = makeSettings('default-missing-fair-create')
    delete missingSettings.fairId
    await assertFails(setDoc(
      doc(db, 'fairs/fair-a/settings/default-missing-fair-create'),
      missingSettings,
    ))
  })

  it('denies reads of subcollection documents whose fairId disagrees with the path', async () => {
    const db = testEnv.authenticatedContext('member-a').firestore()
    const mismatchedDocuments = [
      ['products', 'mismatched-fair-id', makeProduct('mismatched-fair-id', 'fair-b')],
      ['sales', 'mismatched-fair-id', makeSale('mismatched-fair-id', 'fair-b')],
      ['settings', 'default-mismatched-fair-id', makeSettings('default-mismatched-fair-id', 'fair-b')],
    ]

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore()
      for (const [collectionName, recordId, data] of mismatchedDocuments) {
        await setDoc(doc(adminDb, 'fairs/fair-a/' + collectionName + '/' + recordId), data)
      }
    })

    for (const [collectionName, recordId] of mismatchedDocuments) {
      await assertFails(getDoc(doc(db, 'fairs/fair-a/' + collectionName + '/' + recordId)))
    }
  })
  it('denies physical deletion of products, sales, and settings', async () => {
    const member = testEnv.authenticatedContext('member-a').firestore()
    const owner = testEnv.authenticatedContext('owner-a').firestore()

    await assertFails(deleteDoc(doc(member, 'fairs/fair-a/products/product-a')))
    await assertFails(deleteDoc(doc(member, 'fairs/fair-a/sales/sale-a')))
    await assertFails(deleteDoc(doc(member, 'fairs/fair-a/settings/default')))
    await assertFails(deleteDoc(doc(owner, 'fairs/fair-a/products/product-a')))
    await assertFails(deleteDoc(doc(owner, 'fairs/fair-a/sales/sale-a')))
    await assertFails(deleteDoc(doc(owner, 'fairs/fair-a/settings/default')))
  })

  it('denies unmatched collections by default', async () => {
    const db = testEnv.authenticatedContext('member-a').firestore()
    await assertFails(getDoc(doc(db, 'fairs/fair-a/private-data/secret')))
  })
})