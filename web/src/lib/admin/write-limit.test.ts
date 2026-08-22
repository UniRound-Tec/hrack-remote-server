import { describe, expect, it } from 'vitest'
import { reserveAdminWrite } from './write-limit'

describe('administrator write limiter', () => {
  it('allows 30 writes per session each minute', () => {
    const id = `session-${Math.random()}`
    for (let i = 0; i < 30; i += 1) {
      expect(reserveAdminWrite(id, 1_000)).toBe(true)
    }
    expect(reserveAdminWrite(id, 1_000)).toBe(false)
    expect(reserveAdminWrite(id, 61_000)).toBe(true)
  })
})
