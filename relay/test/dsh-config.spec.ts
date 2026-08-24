import { describe, expect, it } from 'vitest'

import { defaultRelayConfig, loadRelayConfig } from '../src/relay/relay-config.js'

describe('D2 DSH configuration', () => {
  it('keeps the capability disabled until an independent canonical HTTPS origin is configured', () => {
    expect(defaultRelayConfig().dshPublicOrigin).toBeNull()
    expect(defaultRelayConfig({ dshPublicOrigin: 'https://dsh.example' }).dshPublicOrigin).toBe('https://dsh.example')
    expect(() => defaultRelayConfig({ dshPublicOrigin: 'http://dsh.example' })).toThrow(/canonical HTTPS/)
    expect(() => defaultRelayConfig({ dshPublicOrigin: 'https://dsh.example/path' })).toThrow(/canonical HTTPS/)
    expect(() => defaultRelayConfig({
      publicOrigin: 'https://dsh.example',
      dshPublicOrigin: 'https://dsh.example'
    })).toThrow(/independent origin/)
  })

  it('loads bounded ticket and cookie lifetimes from production environment', () => {
    const config = loadRelayConfig({
      NODE_ENV: 'production',
      PUBLIC_ORIGIN: 'https://hrack.example',
      DSH_PUBLIC_ORIGIN: 'https://dsh.hrack.example',
      RELAY_SERVICE_TOKEN: 'production-service-token-is-at-least-32-bytes',
      DSH_TICKET_TTL_MS: '15000',
      DSH_SESSION_TTL_MS: '3600000'
    })
    expect(config.dshTicketTtlMs).toBe(15_000)
    expect(config.dshSessionTtlMs).toBe(3_600_000)
    expect(() => defaultRelayConfig({ dshTicketTtlMs: 30_001 })).toThrow(/30000/)
    expect(() => defaultRelayConfig({ dshSessionTtlMs: 43_200_001 })).toThrow(/12 hours/)
  })
})
