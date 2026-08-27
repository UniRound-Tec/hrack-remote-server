import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

/** monorepo 里存在多个 lockfile，显式锚定本仓为工作区根，避免推断到上层。 */
const root = dirname(fileURLToPath(import.meta.url))

/**
 * PAIRING-PLATFORM-SPEC §4 开发拓扑：
 * `next dev :3000` 对外；中继跑 `:3001`（BASE_PATH=/remote）。
 * `/remote/*`（含 WebSocket 升级 `/remote/v1/ws`）由 rewrites 代理到中继。
 * 生产环境该路径由 Nginx 分流，此配置不参与。
 */
const relayOrigin =
  process.env.RELAY_INTERNAL_ORIGIN ?? 'http://127.0.0.1:3001'

const isDev = process.env.NODE_ENV === 'development'

function relayConnectSources(): string {
  const raw = process.env.RELAY_NODES_JSON
  if (!raw) return ''
  try {
    const nodes: unknown = JSON.parse(raw)
    if (!Array.isArray(nodes)) return ''
    const origins = new Set<string>()
    for (const node of nodes) {
      if (typeof node !== 'object' || node === null) continue
      const value = (node as Record<string, unknown>).relayPublicOrigin
      if (typeof value !== 'string') continue
      const url = new URL(value)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        origins.add(url.origin)
      }
    }
    return [...origins].join(' ')
  } catch {
    return ''
  }
}

const relaySources = relayConnectSources()
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  `connect-src 'self'${relaySources ? ` ${relaySources}` : ''}`,
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'self' blob: data:",
  "manifest-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  // Static Next headers cannot attach a per-request nonce. Inline hydration is
  // therefore allowed, while eval remains development-only for source maps.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:"
].join('; ')

const nextConfig: NextConfig = {
  // monorepo 里存在多个 lockfile，显式锚定本仓为 Turbopack 根。
  turbopack: { root },
  // Docker 部署走 standalone 产物（见 web/Dockerfile）
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  // dev 下允许 127.0.0.1 访问（HMR 握手被默认跨域拦截；值不带协议，见 Next 文档）
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy
          }
        ]
      }
    ]
  },
  async redirects() {
    return [
      { source: '/login', destination: '/auth', permanent: false },
      { source: '/register', destination: '/auth', permanent: false }
    ]
  },
  async rewrites() {
    return [
      {
        source: '/remote/:path*',
        destination: `${relayOrigin}/remote/:path*`
      }
    ]
  }
}

export default nextConfig
