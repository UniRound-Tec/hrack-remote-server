import { describe, expect, it } from 'vitest'
import { hasAdminRole } from './guard'

describe('admin guard roles', () => {
  it.each([
    ['admin', true],
    ['user,admin', true],
    ['admin, user', true],
    ['user', false],
    ['', false],
    [null, false]
  ])('detects admin in %s', (role, expected) => {
    expect(hasAdminRole(role)).toBe(expected)
  })
})
