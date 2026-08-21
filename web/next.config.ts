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

const nextConfig: NextConfig = {
  // monorepo 里存在多个 lockfile，显式锚定本仓为 Turbopack 根。
  turbopack: { root },
  // Docker 部署走 standalone 产物（见 web/Dockerfile）
  output: 'standalone',
  // dev 下允许 127.0.0.1 访问（HMR 握手被默认跨域拦截）
  allowedDevOrigins: ['http://127.0.0.1', 'http://localhost'],
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
