import { describe, expect, it } from 'vitest'
import { pairingQrDataUrl } from './qr'

describe('pairing QR image', () => {
  it('renders the exact URL as an encoded SVG image source', () => {
    const joinUrl =
      'https://hrack.example/remote/MDEyMzQ1Njc4OWFiY2RlZg'
    const source = pairingQrDataUrl(joinUrl)

    expect(source).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    const svg = decodeURIComponent(source.slice(source.indexOf(',') + 1))
    expect(svg).toMatch(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    expect(svg).toContain('<path')
    expect(svg).not.toContain('<script')
  })
})
