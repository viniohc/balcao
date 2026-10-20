import type { SalesReport } from '@/services/report'
import { formatCurrency } from '@/services/currency'

const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`

export const buildReportCsv = (report: SalesReport) => {
  const rows = [
    ['Período', report.label],
    ['Total vendido', formatCurrency(report.total)],
    ['Número de vendas', report.saleCount],
    ['Ticket médio', formatCurrency(report.averageTicket)],
    ['Dinheiro', formatCurrency(report.byPayment.cash)],
    ['Pix', formatCurrency(report.byPayment.pix)],
    ['Cartão', formatCurrency(report.byPayment.card)],
    [],
    ['Produto', 'Quantidade', 'Faturamento'],
    ...report.products.map((product) => [
      product.productName,
      product.quantity,
      formatCurrency(product.total),
    ]),
  ]

  return rows.map((row) => row.map(escapeCsv).join(';')).join('\n')
}

export const downloadCsv = (filename: string, content: string) => {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
