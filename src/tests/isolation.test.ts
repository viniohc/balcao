import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { APP_DATABASE_NAME, FeiraDatabase } from '@/services/db'
import { APP_STORAGE_KEYS, APP_STORAGE_NAMESPACE } from '@/services/storage'

const temporaryDatabases: Dexie[] = []

afterEach(async () => {
  for (const database of temporaryDatabases.splice(0)) {
    database.close()
    await database.delete()
  }
})

describe('copy-local storage isolation', () => {
  it('uses a private IndexedDB name and leaves the original database untouched', async () => {
    const original = new Dexie('caixa-da-feira')
    temporaryDatabases.push(original)
    original.version(3).stores({
      products: 'id, fairId, [fairId+category], [fairId+active], deleted, sortOrder',
      sales: 'id, fairId, [fairId+dateKey], createdAt, status, paymentMethod',
      settings: 'id, fairId',
      fairs: 'id, ownerId, active',
    })
    await original.open()
    await original.table('products').put({ id: 'synthetic-original-row', name: 'Synthetic original' })

    const copy = new FeiraDatabase()
    temporaryDatabases.push(copy)
    await copy.open()

    expect(APP_DATABASE_NAME).toBe('festa-camarao-melhorado')
    expect(APP_DATABASE_NAME).not.toBe('caixa-da-feira')
    expect(await original.table('products').get('synthetic-original-row'))
      .toMatchObject({ name: 'Synthetic original' })
    expect(await copy.legacyProducts.get('synthetic-original-row')).toBeUndefined()
  })

  it('namespaces local and session storage keys without touching the previous names', () => {
    const oldSelection = localStorage.getItem('caixa-feira:selectedFairId')
    const oldSaleFlag = sessionStorage.getItem('saleSaved')
    localStorage.setItem('caixa-feira:selectedFairId', 'synthetic-original-fair')
    sessionStorage.setItem('saleSaved', 'synthetic-original-sale')

    localStorage.setItem(APP_STORAGE_KEYS.selectedFairId, 'synthetic-copy-fair')
    sessionStorage.setItem(APP_STORAGE_KEYS.saleSaved, 'synthetic-copy-sale')

    expect(APP_STORAGE_NAMESPACE).toBe('festa-camarao-melhorado')
    expect(APP_STORAGE_KEYS.selectedFairId).toBe('festa-camarao-melhorado:selectedFairId')
    expect(APP_STORAGE_KEYS.saleSaved).toBe('festa-camarao-melhorado:saleSaved')
    expect(localStorage.getItem('caixa-feira:selectedFairId')).toBe('synthetic-original-fair')
    expect(sessionStorage.getItem('saleSaved')).toBe('synthetic-original-sale')

    if (oldSelection === null) localStorage.removeItem('caixa-feira:selectedFairId')
    else localStorage.setItem('caixa-feira:selectedFairId', oldSelection)
    if (oldSaleFlag === null) sessionStorage.removeItem('saleSaved')
    else sessionStorage.setItem('saleSaved', oldSaleFlag)
    localStorage.removeItem(APP_STORAGE_KEYS.selectedFairId)
    sessionStorage.removeItem(APP_STORAGE_KEYS.saleSaved)
  })
})
