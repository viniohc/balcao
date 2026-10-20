import type {
  CartItem, CommandStatus, Fair, PaymentMethod, Product, ProductCategory, Sale, SaleItem, Settings,
} from '@/types/models'
import { demoDatabase, initializeDemoDatabase } from '@/demo/database'

export interface DemoSnapshot {
  fairs: Fair[]
  selectedFairId: string
  products: Product[]
  sales: Sale[]
  settings: Settings | null
}
export interface DemoSaleDraft {
  fairId: string
  items: CartItem[]
  paymentMethod: PaymentMethod
  commandNumber?: string
  observation?: string
}
export type DemoProductDraft = Pick<Product, 'name' | 'price' | 'category'> &
  Partial<Pick<Product, 'active' | 'sortOrder'>>

const makeId = (prefix: string) =>
  'demo-' + prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
const now = () => new Date().toISOString()

export async function readDemoSnapshot(preferredFairId?: string): Promise<DemoSnapshot> {
  await initializeDemoDatabase()
  const fairs = await demoDatabase.fairs.toArray()
  const selectedFairId = fairs.some((fair) => fair.id === preferredFairId)
    ? preferredFairId as string
    : fairs[0]?.id ?? ''
  if (!selectedFairId) return { fairs, selectedFairId: '', products: [], sales: [], settings: null }
  const [products, sales, settings] = await Promise.all([
    demoDatabase.products.where('fairId').equals(selectedFairId).toArray(),
    demoDatabase.sales.where('fairId').equals(selectedFairId).toArray(),
    demoDatabase.settings.where('fairId').equals(selectedFairId).first(),
  ])
  return { fairs, selectedFairId, products, sales, settings: settings ?? null }
}

export async function createDemoFair(name: string): Promise<Fair> {
  await initializeDemoDatabase()
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Informe o nome da feira.')
  const timestamp = now()
  const fair: Fair = {
    id: makeId('fair'), name: trimmedName, ownerId: 'demo-owner', members: {},
    active: true, createdAt: timestamp, updatedAt: timestamp,
  }
  await demoDatabase.transaction('rw', demoDatabase.fairs, demoDatabase.settings, async () => {
    await demoDatabase.fairs.add(fair)
    await demoDatabase.settings.put({ id: fair.id, fairId: fair.id, storeName: trimmedName, currency: 'BRL' })
  })
  return fair
}

export async function renameDemoFair(fairId: string, name: string) {
  await initializeDemoDatabase()
  const fair = await demoDatabase.fairs.get(fairId)
  const trimmedName = name.trim()
  if (!fair) throw new Error('Feira não encontrada na demonstração.')
  if (!trimmedName) throw new Error('Informe o nome da feira.')
  await demoDatabase.fairs.put({ ...fair, name: trimmedName, updatedAt: now() })
}

export async function deleteDemoFair(fairId: string) {
  await initializeDemoDatabase()
  await demoDatabase.transaction('rw', demoDatabase.fairs, demoDatabase.products, demoDatabase.sales, demoDatabase.settings, async () => {
    await Promise.all([
      demoDatabase.products.where('fairId').equals(fairId).delete(),
      demoDatabase.sales.where('fairId').equals(fairId).delete(),
      demoDatabase.settings.where('fairId').equals(fairId).delete(),
      demoDatabase.fairs.delete(fairId),
    ])
  })
}

export async function createDemoProduct(fairId: string, draft: DemoProductDraft) {
  await initializeDemoDatabase()
  const name = draft.name.trim()
  if (!name || !Number.isFinite(draft.price) || draft.price < 0) throw new Error('Informe um nome e um preço válido.')
  if (!(await demoDatabase.fairs.get(fairId))) throw new Error('Feira não encontrada.')
  const timestamp = now()
  const product: Product = {
    id: makeId('product'), fairId, name, price: draft.price, category: draft.category,
    active: draft.active ?? true, sortOrder: draft.sortOrder ?? 0, createdAt: timestamp, updatedAt: timestamp,
  }
  await demoDatabase.products.add(product)
  return product
}

export async function updateDemoProduct(
  fairId: string,
  productId: string,
  changes: Partial<Pick<Product, 'name' | 'price' | 'category' | 'active' | 'sortOrder'>>,
) {
  await initializeDemoDatabase()
  const current = await demoDatabase.products.get([fairId, productId])
  if (!current) throw new Error('Produto não encontrado nesta feira.')
  const name = changes.name?.trim() ?? current.name
  const price = changes.price ?? current.price
  if (!name || !Number.isFinite(price) || price < 0) throw new Error('Informe um nome e um preço válido.')
  await demoDatabase.products.put({ ...current, ...changes, name, price, fairId, updatedAt: now() })
}

export async function deleteDemoProduct(fairId: string, productId: string) {
  await initializeDemoDatabase()
  await demoDatabase.products.delete([fairId, productId])
}

export async function createDemoSale(draft: DemoSaleDraft): Promise<Sale> {
  await initializeDemoDatabase()
  if (!draft.items.length) throw new Error('Adicione ao menos um item à venda.')
  if (!(await demoDatabase.fairs.get(draft.fairId))) throw new Error('Feira não encontrada.')
  const id = makeId('sale')
  const items: SaleItem[] = draft.items.map((item, index) => ({
    lineId: item.lineId ?? id + '-line-' + String(index + 1),
    productId: item.productId, productName: item.productName, unitPrice: item.unitPrice,
    quantity: item.quantity, total: Math.round(item.unitPrice * item.quantity * 100) / 100,
  }))
  if (items.some((item) => item.quantity < 1 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
    throw new Error('Confira os itens e quantidades da venda.')
  }
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100
  const timestamp = now()
  const commandNumber = draft.commandNumber?.trim()
  const sale: Sale = {
    id, fairId: draft.fairId, createdAt: timestamp, dateKey: timestamp.slice(0, 10), items,
    subtotal, total: subtotal, paymentMethod: draft.paymentMethod, status: 'confirmado',
    observation: draft.observation?.trim() || undefined,
    commandNumber: commandNumber || undefined,
    commandStatus: commandNumber ? 'pendente' : undefined,
    commandUpdatedAt: commandNumber ? timestamp : undefined,
  }
  await demoDatabase.sales.add(sale)
  return sale
}

export async function cancelDemoSale(fairId: string, saleId: string) {
  await initializeDemoDatabase()
  const sale = await demoDatabase.sales.get([fairId, saleId])
  if (!sale) throw new Error('Venda não encontrada nesta feira.')
  await demoDatabase.sales.put({ ...sale, status: 'cancelado', cancelledAt: now() })
}

export async function updateDemoCommandStatus(fairId: string, saleId: string, status: CommandStatus) {
  await initializeDemoDatabase()
  const sale = await demoDatabase.sales.get([fairId, saleId])
  if (!sale?.commandNumber) throw new Error('Comanda não encontrada nesta feira.')
  const timestamp = now()
  await demoDatabase.sales.put({
    ...sale, commandStatus: status, commandUpdatedAt: timestamp,
    commandReturnedAt: status === 'entregue' ? timestamp : sale.commandReturnedAt,
  })
}

export async function saveDemoSettings(fairId: string, storeName: string) {
  await initializeDemoDatabase()
  const fair = await demoDatabase.fairs.get(fairId)
  const trimmedName = storeName.trim()
  if (!fair) throw new Error('Feira não encontrada.')
  if (!trimmedName) throw new Error('Informe o nome do estabelecimento.')
  const current = await demoDatabase.settings.get(fairId)
  await demoDatabase.settings.put({
    id: fairId, fairId, storeName: trimmedName, currency: current?.currency ?? 'BRL',
  })
}

export const demoCategories: ProductCategory[] = ['Comidas', 'Bebidas', 'Sobremesas', 'Outros']
