import { describe, it, expect } from 'vitest'
import { formatTime } from '../format'

describe('formatTime', () => {
  it('formats an ISO string as YYYY/MM/DD HH:mm with zero padding', () => {
    const result = formatTime('2026-01-05T03:07:00.000Z')

    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/)
  })

  it('pads single-digit month/day/hour/minute with zeros', () => {
    const date = new Date(2026, 0, 5, 3, 7)
    const result = formatTime(date.toISOString())

    expect(result).toBe('2026/01/05 03:07')
  })
})
