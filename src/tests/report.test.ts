import { describe, expect, it } from 'vitest'
import { calculateDailyProductRace, calculateDailyReport } from '@/services/report'
import type { Sale } from '@/types/models'

const makeSale = (overrides: Partial<Sale>): Sale => ({
  id: crypto.randomUUID(),
  fairId: 'fair-1',
  createdAt: '2026-05-16T12:00:00.000Z',
  dateKey: '2026-05-16',
  items: [
    {
      productId: 'pastel',
      productName: 'Pastel',
      unitPrice: 8,
      quantity: 2,
      total: 16,
    },
  ],
  subtotal: 16,
  total: 16,
  paymentMethod: 'pix',
  status: 'confirmado',
  ...overrides,
})

describe('calculateDailyReport', () => {
  it('soma vendas confirmadas e ignora vendas canceladas', () => {
    const report = calculateDailyReport(
      [
        makeSale({ paymentMethod: 'cash', amountReceived: 20, change: 4 }),
        makeSale({ id: 'cancelado', status: 'cancelado', paymentMethod: 'card' }),
      ],
      '2026-05-16',
    )

    expect(report.total).toBe(16)
    expect(report.saleCount).toBe(1)
    expect(report.byPayment.cash).toBe(16)
    expect(report.byPayment.card).toBe(0)
    expect(report.products[0]).toMatchObject({
      productName: 'Pastel',
      quantity: 2,
      total: 16,
    })
  })
})

describe('calculateDailyProductRace', () => {
  it('builds chronological product race frames for the selected day', () => {
    const frames = calculateDailyProductRace(
      [
        makeSale({
          id: 'later',
          createdAt: '2026-05-16T13:00:00.000Z',
          items: [
            {
              productId: 'suco',
              productName: 'Suco',
              unitPrice: 4,
              quantity: 3,
              total: 12,
            },
          ],
        }),
        makeSale({
          id: 'first',
          createdAt: '2026-05-16T12:00:00.000Z',
        }),
        makeSale({
          id: 'ignored',
          createdAt: '2026-05-16T12:30:00.000Z',
          status: 'cancelado',
        }),
      ],
      '2026-05-16',
    )

    expect(frames).toHaveLength(2)
    expect(frames[0]).toMatchObject({
      saleId: 'first',
      saleCount: 1,
      rows: [
        {
          productName: 'Pastel',
          quantity: 2,
          rank: 1,
        },
      ],
    })
    expect(frames[1].rows.map((row) => [row.productName, row.quantity, row.rank])).toEqual([
      ['Suco', 3, 1],
      ['Pastel', 2, 2],
    ])
  })
})
