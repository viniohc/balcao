import { describe, expect, it } from 'vitest'
import { formatDate, formatTime, getDateKey, isDateKey } from '@/services/date'

describe('date helpers', () => {
  it('uses the Brazil time zone for date keys after 21h in Brasilia', () => {
    expect(getDateKey(new Date('2026-05-16T00:30:00.000Z'))).toBe('2026-05-15')
  })

  it('keeps date-only strings on the selected calendar day', () => {
    expect(formatDate('2026-05-16')).toBe('16/05/2026')
    expect(isDateKey('2026-05-16')).toBe(true)
  })

  it('formats sale times in Brasilia time', () => {
    expect(formatTime('2026-05-16T00:30:00.000Z')).toBe('21:30')
  })
})
