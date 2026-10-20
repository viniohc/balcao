import Dexie, { type Table } from 'dexie'
import type { Fair, Product, Sale, Settings } from '@/types/models'

export const DEMO_DATABASE_NAME = 'festa-camarao-portfolio-demo'
interface DemoMeta { id: string; version: number }

export class PortfolioDemoDatabase extends Dexie {
  fairs!: Table<Fair, string>
  products!: Table<Product, [string, string]>
  sales!: Table<Sale, [string, string]>
  settings!: Table<Settings, string>
  meta!: Table<DemoMeta, string>

  constructor(databaseName = DEMO_DATABASE_NAME) {
    super(databaseName)
    this.version(1).stores({
      fairs: '&id, name, active',
      products: '[fairId+id], fairId, name, category, active, deleted',
      sales: '[fairId+id], fairId, dateKey, createdAt, status, commandNumber',
      settings: '&id, fairId',
      meta: '&id',
    })
  }
}

export const demoDatabase = new PortfolioDemoDatabase()
const timestamp = '2026-08-01T16:00:00.000Z'

const initialFairs: Fair[] = [
  { id: 'demo-feira-praca', name: 'Feira da Praça', ownerId: 'demo-owner', members: { 'demo-member': true }, active: true, createdAt: timestamp, updatedAt: timestamp },
  { id: 'demo-feira-jardim', name: 'Festival do Jardim', ownerId: 'demo-owner', members: {}, active: true, createdAt: timestamp, updatedAt: timestamp },
]
const initialProducts: Product[] = [
  { id: 'demo-prod-caldo', fairId: 'demo-feira-praca', name: 'Caldo de abóbora', price: 18, category: 'Comidas', active: true, sortOrder: 1, createdAt: timestamp, updatedAt: timestamp },
  { id: 'demo-prod-limonada', fairId: 'demo-feira-praca', name: 'Limonada', price: 9, category: 'Bebidas', active: true, sortOrder: 2, createdAt: timestamp, updatedAt: timestamp },
  { id: 'demo-prod-bolo', fairId: 'demo-feira-jardim', name: 'Bolo de laranja', price: 12, category: 'Sobremesas', active: true, sortOrder: 1, createdAt: timestamp, updatedAt: timestamp },
]
const initialSales: Sale[] = [
  {
    id: 'demo-venda-001', fairId: 'demo-feira-praca', createdAt: timestamp, dateKey: '2026-08-01',
    items: [
      { lineId: 'demo-venda-001-1', productId: 'demo-prod-caldo', productName: 'Caldo de abóbora', unitPrice: 18, quantity: 1, total: 18 },
      { lineId: 'demo-venda-001-2', productId: 'demo-prod-limonada', productName: 'Limonada', unitPrice: 9, quantity: 2, total: 18 },
    ],
    subtotal: 36, total: 36, paymentMethod: 'pix', status: 'confirmado',
  },
  {
    id: 'demo-comanda-012', fairId: 'demo-feira-praca', createdAt: '2026-08-01T16:15:00.000Z', dateKey: '2026-08-01',
    items: [{ lineId: 'demo-comanda-012-1', productId: 'demo-prod-caldo', productName: 'Caldo de abóbora', unitPrice: 18, quantity: 2, total: 36 }],
    subtotal: 36, total: 36, paymentMethod: 'cash', status: 'confirmado',
    commandNumber: 'D-12', commandStatus: 'pronto', observation: 'Retirada no balcão.',
  },
]
const initialSettings: Settings[] = [
  { id: 'demo-feira-praca', fairId: 'demo-feira-praca', storeName: 'Barraca da Praça', currency: 'BRL' },
  { id: 'demo-feira-jardim', fairId: 'demo-feira-jardim', storeName: 'Cozinha do Jardim', currency: 'BRL' },
]

const seed = async (database: PortfolioDemoDatabase) => {
  await database.fairs.bulkPut(initialFairs)
  await database.products.bulkPut(initialProducts)
  await database.sales.bulkPut(initialSales)
  await database.settings.bulkPut(initialSettings)
  await database.meta.put({ id: 'seeded', version: 1 })
}
const tables = (database: PortfolioDemoDatabase) =>
  [database.fairs, database.products, database.sales, database.settings, database.meta]

export async function initializeDemoDatabase(database = demoDatabase) {
  await database.open()
  await database.transaction('rw', tables(database), async () => {
    if (await database.meta.get('seeded')) return
    const counts = await Promise.all([
      database.fairs.count(), database.products.count(), database.sales.count(), database.settings.count(),
    ])
    if (counts.some((count) => count > 0)) {
      await database.meta.put({ id: 'seeded', version: 1 })
      return
    }
    await seed(database)
  })
}

export async function resetDemoDatabase(database = demoDatabase) {
  await database.open()
  await database.transaction('rw', tables(database), async () => {
    await Promise.all([
      database.fairs.clear(), database.products.clear(), database.sales.clear(),
      database.settings.clear(), database.meta.clear(),
    ])
    await seed(database)
  })
}
