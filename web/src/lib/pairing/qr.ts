import { renderSVG } from 'uqr'

export function pairingQrDataUrl(joinUrl: string): string {
  const svg = renderSVG(joinUrl, {
    ecc: 'M',
    border: 3,
    pixelSize: 6,
    blackColor: '#171717',
    whiteColor: '#ffffff'
  })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
