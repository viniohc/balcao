import Dexie, { type Table, type Transaction } from 'dexie'
import { getDateKey } from '@/services/date'
import type { CommandStatus, Fair, Product, Sale, SaleStatus, Settings } from '@/types/models'

const nowIso = () => new Date().toISOString()

export const APP_DATABASE_NAME = 'festa-camarao-melhorado'

const isValidFairId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)

export type FairMetadataField = 'name' | 'active'
export type FairMetadataValues = Pick<Fair, FairMetadataField>

export interface FairSyncState {
  fairId: string
  baseData: FairMetadataValues
  pendingData: Partial<FairMetadataValues>
  revision: number
  conflict?: {
    remoteData: Fair | null
    fields: FairMetadataField[]
    detectedAt: string
  }
}

const migrateAssignedRecords = async (transaction: Transaction) => {
  const tablePairs = [
    ['products', 'productsByFair'],
    ['sales', 'salesByFair'],
    ['settings', 'settingsByFair'],
  ] as const

  for (const [legacyName, scopedName] of tablePairs) {
    const legacyTable = transaction.table(legacyName)
    const scopedTable = transaction.table(scopedName)
    const records = await legacyTable.toArray() as Array<Record<string, unknown>>

    for (const record of records) {
      if (isValidFairId(record.fairId) && typeof record.id === 'string') {
        await scopedTable.put(record)
        await legacyTable.delete(record.id)
      }
    }
  }
}

export class FeiraDatabase extends Dexie {
  products!: Table<Product, [string, string]>
  sales!: Table<Sale, [string, string]>
  settings!: Table<Settings, [string, string]>
  fairs!: Table<Fair, string>
  fairSyncStates!: Table<FairSyncState, string>
  syncStates!: Table<{
    fairId: string
    entity: 'products' | 'sales' | 'settings'
    recordId: string
    pending: boolean
    baseKnown: boolean
    baseData: Product | Sale | Settings | null
    revision: number
    conflict?: {
      remoteData: Product | Sale | Settings | null
      detectedAt: string
    }
  }, [string, string, string]>
  legacyProducts!: Table<Product, string>
  legacySales!: Table<Sale, string>
  legacySettings!: Table<Settings, string>

  constructor(databaseName = APP_DATABASE_NAME) {
    super(databaseName)
    this.version(1).stores({
      products: 'id, category, active, sortOrder',
      sales: 'id, dateKey, createdAt, status, paymentMethod',
      settings: 'id',
    })
    this.version(2).stores({
      products: 'id, fairId, [fairId+category], [fairId+active], sortOrder',
      sales: 'id, fairId, [fairId+dateKey], createdAt, status, paymentMethod',
      settings: 'id, fairId',
      fairs: 'id, ownerId, active',
    })
    this.version(3).stores({
      products: 'id, fairId, [fairId+category], [fairId+active], deleted, sortOrder',
      sales: 'id, fairId, [fairId+dateKey], createdAt, status, paymentMethod',
      settings: 'id, fairId',
      fairs: 'id, ownerId, active',
    })
    this.version(4).stores({
      products: 'id, fairId, [fairId+category], [fairId+active], deleted, sortOrder',
      sales: 'id, fairId, [fairId+dateKey], createdAt, status, paymentMethod',
      settings: 'id, fairId',
      fairs: 'id, ownerId, active',
      productsByFair: '[fairId+id], id, fairId, [fairId+category], [fairId+active], deleted, sortOrder',
      salesByFair: '[fairId+id], id, fairId, [fairId+dateKey], createdAt, status, paymentMethod',
      settingsByFair: '[fairId+id], id, fairId',
      syncStates: '[fairId+entity+recordId], fairId, entity, recordId, pending',
    }).upgrade(migrateAssignedRecords)
    this.version(5).stores({
      products: 'id, fairId, [fairId+category], [fairId+active], deleted, sortOrder',
      sales: 'id, fairId, [fairId+dateKey], createdAt, status, paymentMethod',
      settings: 'id, fairId',
      fairs: 'id, ownerId, active',
      productsByFair: '[fairId+id], id, fairId, [fairId+category], [fairId+active], deleted, sortOrder',
      salesByFair: '[fairId+id], id, fairId, [fairId+dateKey], createdAt, status, paymentMethod',
      settingsByFair: '[fairId+id], id, fairId',
      syncStates: '[fairId+entity+recordId], fairId, entity, recordId, pending',
      fairSyncStates: '&fairId',
    })

    this.products = this.table('productsByFair') as Table<Product, [string, string]>
    this.sales = this.table('salesByFair') as Table<Sale, [string, string]>
    this.settings = this.table('settingsByFair') as Table<Settings, [string, string]>
    this.syncStates = this.table('syncStates') as FeiraDatabase['syncStates']
    this.fairSyncStates = this.table('fairSyncStates') as Table<FairSyncState, string>
    this.legacyProducts = this.table('products') as Table<Product, string>
    this.legacySales = this.table('sales') as Table<Sale, string>
    this.legacySettings = this.table('settings') as Table<Settings, string>
  }
}

export const db = new FeiraDatabase()

const normalizeSaleStatus = (status: SaleStatus | string): SaleStatus => {
  if (status === 'cancelled' || status === 'cancelado') {
    return 'cancelado'
  }

  return 'confirmado'
}

const normalizeCommandStatus = (status?: CommandStatus | string): CommandStatus | undefined => {
  if (!status) return undefined

  const statusMap: Record<string, CommandStatus> = {
    pending: 'pendente',
    preparing: 'preparando',
    ready: 'pronto',
    called: 'chamado',
    delivered: 'entregue',
    pendente: 'pendente',
    preparando: 'preparando',
    pronto: 'pronto',
    chamado: 'chamado',
    entregue: 'entregue',
  }

  return statusMap[status]
}

export const normalizeSalesDateKeys = (sales: Sale[]) =>
  sales.map((sale) => ({
    ...sale,
    dateKey: getDateKey(sale.createdAt),
    status: normalizeSaleStatus(sale.status),
    commandStatus: normalizeCommandStatus(sale.commandStatus),
  }))

export const cleanupDuplicateProducts = async (fairId: string) => {
  const products = await db.products.where('fairId').equals(fairId).toArray()
  const groupedProducts = new Map<string, Product[]>()

  products
    .filter((product) => !product.deleted)
    .forEach((product) => {
      const key = product.name.trim().toLocaleLowerCase() + '|' + product.category + '|' + product.price
      groupedProducts.set(key, [...(groupedProducts.get(key) ?? []), product])
    })

  const timestamp = nowIso()
  await Promise.all(
    Array.from(groupedProducts.values()).flatMap((group) => {
      const sortedGroup = group.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
      return sortedGroup.slice(1).map((product) =>
        db.products.update([fairId, product.id], {
          active: false,
          deleted: true,
          deletedAt: timestamp,
          updatedAt: timestamp,
        }),
      )
    }),
  )
}

export const seedDatabase = async (fairId: string) => {
  const settingsId = 'default-' + fairId
  const settings = await db.settings.get([fairId, settingsId])
  if (!settings) {
    await db.settings.add({
      id: settingsId,
      fairId,
      storeName: 'Caixa da Feira',
      currency: 'BRL',
    })
  }
}
