import { describe, expect, it } from 'vitest'
import { allowNext } from './auth-navigation'

describe('allowNext', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/dashboard/pairing', '/dashboard/pairing'],
    ['/admin', '/admin'],
    ['/admin/users', '/admin/users']
  ])('accepts %s', (input, expected) => {
    expect(allowNext(input)).toBe(expected)
  })

  it.each([
    undefined,
    '/',
    '/administrator',
    '//evil.test',
    '/dashboard//evil.test',
    '/dashboard\\evil',
    '/dashboard:https://evil.test'
  ])('rejects %s', (input) => {
    expect(allowNext(input)).toBeUndefined()
  })
})
