export type ProductCategory = 'Comidas' | 'Bebidas' | 'Sobremesas' | 'Outros'

export type PaymentMethod = 'cash' | 'pix' | 'card'

export type SaleStatus = 'confirmado' | 'cancelado'

export type CommandStatus = 'pendente' | 'preparando' | 'pronto' | 'chamado' | 'entregue'

export interface Product {
  id: string
  fairId: string
  name: string
  price: number
  category: ProductCategory
  active: boolean
  sortOrder: number
  deleted?: boolean
  deletedAt?: string
  createdAt: string
  updatedAt: string
}

export interface SaleItem {
  lineId?: string
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  total: number
}

export interface Sale {
  id: string
  fairId: string
  createdAt: string
  dateKey: string
  items: SaleItem[]
  subtotal: number
  total: number
  paymentMethod: PaymentMethod
  amountReceived?: number
  change?: number
  status: SaleStatus
  observation?: string
  cancelledAt?: string
  commandNumber?: string
  commandStatus?: CommandStatus
  commandUpdatedAt?: string
  commandReturnedAt?: string
}

export interface Settings {
  id: string
  fairId: string
  storeName: string
  currency: 'BRL'
}

export interface Fair {
  id: string
  name: string
  ownerId: string
  members: Record<string, true>
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CartItem {
  lineId?: string
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  total: number
}

export interface CommandQueueItem {
  saleId: string
  commandNumber: string
  status: CommandStatus
  createdAt: string
  updatedAt?: string
  returnedAt?: string
  observation?: string
  items: SaleItem[]
  total: number
}
