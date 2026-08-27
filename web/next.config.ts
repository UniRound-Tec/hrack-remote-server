import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { contentSecurityPolicy } from './src/lib/security/csp'

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
const staticContentSecurityPolicy = contentSecurityPolicy({
  isDevelopment: isDev
})

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
            value: staticContentSecurityPolicy
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
