import type { PaymentMethod, Sale } from '@/types/models'

export interface ProductReportRow {
  productId: string
  productName: string
  quantity: number
  total: number
}

export interface SalesReport {
  label: string
  total: number
  saleCount: number
  averageTicket: number
  byPayment: Record<PaymentMethod, number>
  products: ProductReportRow[]
}

export interface ProductRaceRow extends ProductReportRow {
  rank: number
}

export interface ProductRaceFrame {
  saleId: string
  createdAt: string
  saleCount: number
  rows: ProductRaceRow[]
}

const emptyPaymentTotals = (): Record<PaymentMethod, number> => ({
  cash: 0,
  pix: 0,
  card: 0,
})

export const calculateSalesReport = (sales: Sale[], label: string): SalesReport => {
  const validSales = sales.filter((sale) => sale.status === 'confirmado')
  const productMap = new Map<string, ProductReportRow>()
  const byPayment = emptyPaymentTotals()
  const total = validSales.reduce((sum, sale) => {
    byPayment[sale.paymentMethod] += sale.total

    sale.items.forEach((item) => {
      const current = productMap.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        total: 0,
      }

      current.quantity += item.quantity
      current.total += item.total
      productMap.set(item.productId, current)
    })

    return sum + sale.total
  }, 0)

  const products = Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity || b.total - a.total)

  return {
    label,
    total,
    saleCount: validSales.length,
    averageTicket: validSales.length ? total / validSales.length : 0,
    byPayment,
    products,
  }
}

export const calculateDailyReport = (sales: Sale[], dateKey: string) =>
  calculateSalesReport(sales.filter((sale) => sale.dateKey === dateKey), dateKey)

export const calculateDailyProductRace = (sales: Sale[], dateKey: string): ProductRaceFrame[] => {
  const productMap = new Map<string, ProductReportRow>()

  return sales
    .filter((sale) => sale.status === 'confirmado' && sale.dateKey === dateKey)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((sale, index) => {
      sale.items.forEach((item) => {
        const current = productMap.get(item.productId) ?? {
          productId: item.productId,
          productName: item.productName,
          quantity: 0,
          total: 0,
        }

        current.quantity += item.quantity
        current.total += item.total
        productMap.set(item.productId, current)
      })

      const rows = Array.from(productMap.values())
        .sort((a, b) => b.quantity - a.quantity || b.total - a.total || a.productName.localeCompare(b.productName))
        .map((product, rowIndex) => ({
          ...product,
          rank: rowIndex + 1,
        }))

      return {
        saleId: sale.id,
        createdAt: sale.createdAt,
        saleCount: index + 1,
        rows,
      }
    })
}
