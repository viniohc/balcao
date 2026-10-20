import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEMO_CREDENTIALS, hasDemoSession, loginDemo, logoutDemo } from '@/demo/auth'
import { DEMO_DATABASE_NAME, demoDatabase, initializeDemoDatabase, resetDemoDatabase } from '@/demo/database'
import {
  cancelDemoSale, createDemoFair, createDemoProduct, createDemoSale, deleteDemoProduct,
  readDemoSnapshot, saveDemoSettings, updateDemoProduct,
} from '@/demo/repository'
import { DEMO_STORAGE_KEYS, readDemoSelectedFairId, writeDemoSelectedFairId } from '@/demo/storage'

const demoSources = import.meta.glob<string>('../demo/**/*.{ts,vue}', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const otherDatabases: Dexie[] = []

afterEach(async () => {
  logoutDemo()
  for (const key of [
    DEMO_STORAGE_KEYS.selectedFairId,
    'festa-camarao-melhorado:selectedFairId',
    'caixa-feira:selectedFairId',
  ]) localStorage.removeItem(key)
  demoDatabase.close()
  await demoDatabase.delete()
  for (const database of otherDatabases.splice(0)) {
    database.close()
    await database.delete()
  }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('demonstração local de portfólio', () => {
  it('autentica localmente e lê feiras, produtos, vendas e configurações fictícias', async () => {
    await initializeDemoDatabase()
    expect(hasDemoSession()).toBe(false)
    expect(loginDemo('visitante@exemplo.local', 'senha-errada')).toBe(false)
    expect(loginDemo(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password)).toBe(true)
    expect(hasDemoSession()).toBe(true)
    const snapshot = await readDemoSnapshot('demo-feira-praca')
    expect(snapshot.fairs).toHaveLength(4)
    expect(snapshot.products.map((item) => item.name)).toContain('Caldo de abóbora')
    expect(snapshot.sales.some((item) => item.commandNumber === 'D-12')).toBe(true)
    expect(snapshot.settings?.storeName).toBe('Barraca da Praça')
  })

  it('cria, edita, cancela e exclui dados somente no repositório local da demo', async () => {
    await initializeDemoDatabase()
    const fairId = 'demo-feira-praca'
    const product = await createDemoProduct(fairId, { name: 'Milho fictício', price: 7, category: 'Comidas' })
    await updateDemoProduct(fairId, product.id, { name: 'Milho assado fictício', price: 8 })
    await saveDemoSettings(fairId, 'Barraca de teste local')
    const sale = await createDemoSale({
      fairId, items: [{ productId: product.id, productName: 'Milho assado fictício', unitPrice: 8, quantity: 2, total: 16 }],
      paymentMethod: 'pix', commandNumber: 'D-TESTE',
    })
    await cancelDemoSale(fairId, sale.id)
    await deleteDemoProduct(fairId, product.id)
    const snapshot = await readDemoSnapshot(fairId)
    expect(snapshot.products.some((item) => item.id === product.id)).toBe(false)
    expect(snapshot.sales.find((item) => item.id === sale.id)?.status).toBe('cancelado')
    expect(snapshot.settings?.storeName).toBe('Barraca de teste local')
  })

  it('restaura os dados sintéticos iniciais após alterações', async () => {
    await initializeDemoDatabase()
    await createDemoFair('Feira temporária')
    await createDemoProduct('demo-feira-praca', { name: 'Item temporário', price: 1, category: 'Outros' })
    await resetDemoDatabase()
    const snapshot = await readDemoSnapshot('demo-feira-praca')
    expect(snapshot.fairs).toHaveLength(4)
    expect(snapshot.products).toHaveLength(24)
    expect(snapshot.products.map((item) => item.name)).toEqual(expect.arrayContaining(['Caldo de abóbora', 'Limonada']))
    expect(snapshot.sales).toHaveLength(36)
    expect(snapshot.settings?.storeName).toBe('Barraca da Praça')
  })

  it('usa banco e chaves próprios e preserva outros marcadores sintéticos', async () => {
    const other = new Dexie('festa-camarao-melhorado')
    otherDatabases.push(other)
    other.version(1).stores({ records: '&id' })
    await other.open()
    await other.table('records').put({ id: 'synthetic-marker', value: 'preserved' })
    localStorage.setItem('festa-camarao-melhorado:selectedFairId', 'synthetic-copy-fair')
    localStorage.setItem('caixa-feira:selectedFairId', 'synthetic-legacy-fair')

    await initializeDemoDatabase()
    writeDemoSelectedFairId('demo-feira-praca')
    expect(DEMO_DATABASE_NAME).toBe('festa-camarao-portfolio-demo')
    expect(DEMO_DATABASE_NAME).not.toBe('festa-camarao-melhorado')
    expect(DEMO_DATABASE_NAME).not.toBe('caixa-da-feira')
    expect(DEMO_STORAGE_KEYS.session).toBe('festa-camarao-portfolio-demo:session')
    expect(DEMO_STORAGE_KEYS.selectedFairId).toBe('festa-camarao-portfolio-demo:selectedFairId')
    expect(readDemoSelectedFairId()).toBe('demo-feira-praca')
    expect(localStorage.getItem('festa-camarao-melhorado:selectedFairId')).toBe('synthetic-copy-fair')
    expect(localStorage.getItem('caixa-feira:selectedFairId')).toBe('synthetic-legacy-fair')
    expect(await other.table('records').get('synthetic-marker')).toMatchObject({ value: 'preserved' })
  })

  it('não chama rede e o grafo de módulos demo não importa Firebase nem endpoints', async () => {
    const fetchSpy = vi.fn()
    const websocketSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('WebSocket', websocketSpy)
    const xhrSpy = vi.spyOn(XMLHttpRequest.prototype, 'open')

    await initializeDemoDatabase()
    expect(loginDemo(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password)).toBe(true)
    const snapshot = await readDemoSnapshot()
    const product = await createDemoProduct(snapshot.selectedFairId, { name: 'Produto sintético', price: 2, category: 'Outros' })
    const sale = await createDemoSale({
      fairId: snapshot.selectedFairId,
      items: [{ productId: product.id, productName: product.name, unitPrice: 2, quantity: 1, total: 2 }],
      paymentMethod: 'pix',
    })
    await cancelDemoSale(sale.fairId, sale.id)
    await deleteDemoProduct(snapshot.selectedFairId, product.id)
    await resetDemoDatabase()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(websocketSpy).not.toHaveBeenCalled()
    expect(xhrSpy).not.toHaveBeenCalled()
    const source = Object.values(demoSources).join('\n')
    expect(Object.keys(demoSources).length).toBeGreaterThan(0)
    expect(source).not.toMatch(/from\s+['"][^'"]*firebase/i)
    expect(source).not.toMatch(/@\/lib\/firebase|https?:\/\/|\/(?:api|firestore)\//i)
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket/)
  })

  it('acrescenta os novos exemplos sem substituir edições, exclusões ou feiras removidas', async () => {
    await demoDatabase.open()
    const timestamp = '2026-01-01T12:00:00.000Z'
    await demoDatabase.fairs.add({ id: 'demo-feira-praca', name: 'Nome alterado pelo visitante', ownerId: 'demo-owner', members: {}, active: true, createdAt: timestamp, updatedAt: timestamp })
    await demoDatabase.products.add({ id: 'demo-prod-caldo', fairId: 'demo-feira-praca', name: 'Produto editado', price: 99, category: 'Comidas', active: true, sortOrder: 1, createdAt: timestamp, updatedAt: timestamp })
    await demoDatabase.settings.add({ id: 'demo-feira-praca', fairId: 'demo-feira-praca', storeName: 'Caixa personalizado', currency: 'BRL' })
    await demoDatabase.meta.put({ id: 'seeded', version: 1 })
    await initializeDemoDatabase()
    expect(await demoDatabase.fairs.get('demo-feira-praca')).toMatchObject({ name: 'Nome alterado pelo visitante' })
    expect(await demoDatabase.settings.get('demo-feira-praca')).toMatchObject({ storeName: 'Caixa personalizado' })
    expect(await demoDatabase.products.get(['demo-feira-praca', 'demo-prod-caldo'])).toMatchObject({ name: 'Produto editado', price: 99 })
    expect(await demoDatabase.products.get(['demo-feira-praca', 'demo-prod-limonada'])).toBeUndefined()
    expect(await demoDatabase.fairs.get('demo-feira-jardim')).toBeUndefined()
    expect(await demoDatabase.products.where('fairId').equals('demo-feira-jardim').count()).toBe(0)
    const added = (await demoDatabase.products.where('fairId').equals('demo-feira-praca').toArray()).find(p => p.id !== 'demo-prod-caldo')!
    await demoDatabase.products.delete([added.fairId, added.id])
    const counts = [await demoDatabase.fairs.count(), await demoDatabase.products.count(), await demoDatabase.sales.count()]
    await initializeDemoDatabase()
    await initializeDemoDatabase()
    expect([await demoDatabase.fairs.count(), await demoDatabase.products.count(), await demoDatabase.sales.count()]).toEqual(counts)
    expect(await demoDatabase.products.get([added.fairId, added.id])).toBeUndefined()
    expect(demoDatabase.verno).toBe(1)
  })

  it('mantém totais coerentes, referências válidas e exemplos em todos os estados', async () => {
    await initializeDemoDatabase()
    const fairs = await demoDatabase.fairs.toArray()
    const products = await demoDatabase.products.toArray()
    const sales = await demoDatabase.sales.toArray()
    expect(fairs).toHaveLength(4)
    expect(products).toHaveLength(60)
    expect(sales).toHaveLength(96)
    for (const fair of fairs) {
      expect(products.filter(p => p.fairId === fair.id).length).toBeGreaterThanOrEqual(8)
      expect(sales.some(s => s.fairId === fair.id)).toBe(true)
      expect(await demoDatabase.settings.get(fair.id)).toBeDefined()
    }
    for (const sale of sales) {
      expect(sale.total).toBe(sale.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))
      expect(sale.subtotal).toBe(sale.total)
      for (const item of sale.items) expect(products.some(p => p.id === item.productId && p.fairId === sale.fairId)).toBe(true)
    }
    expect(new Set(sales.map(s => s.paymentMethod))).toEqual(new Set(['pix', 'cash', 'card']))
    expect(new Set(sales.filter(s => s.commandNumber).map(s => s.commandStatus))).toEqual(new Set(['pendente', 'preparando', 'pronto', 'chamado', 'entregue']))
    expect(sales.some(s => s.status === 'cancelado')).toBe(true)
    const counts = [products.length, sales.length]
    await initializeDemoDatabase()
    expect([await demoDatabase.products.count(), await demoDatabase.sales.count()]).toEqual(counts)
  })

})
