# HRack Platform

HRack 平台单仓库：**web**（平台站，Next.js 16）+ **relay**（远程控制中继，Node 22）。
落地页、账号体系与配对 URL 控制台在 `web/`；协议转发、房间生命周期在 `relay/`。

```
浏览器 ──► Nginx(TLS) ─┬─ /          → web     (Next.js, :3000)
                        └─ /remote/   → relay   (Node,     :3000)
HRack 桌面端 ── 粘贴配对URL / 手机端扫码 ──┘（协议不变）
```

## 目录

| 路径 | 内容 |
|---|---|
| `web/` | 平台站：落地页（5 语言）、注册登录（P1）、配对 URL 控制台（P3） |
| `relay/` | 中继：单进程内存态房间，零业务逻辑，服务凭证保护创建 |
| `deploy/` | `docker-compose.yml`（relay + web + 可选 nginx）与反代示例 |
| `docs/` | 平台规格（PAIRING-PLATFORM-SPEC）、部署与验证文档 |

## 开发

```sh
npm run dev          # 同时拉起 relay(dev) 与 web(next dev)
npm run dev:web      # 仅 web；端口默认 3000，可用 WEB_PORT=3002 覆盖
npm run dev:relay    # 仅 relay（tsx src/cli.ts，env 见 relay/README）
```

开发拓扑：web 在前（`:3000`），relay 在后（`:3001`）；web 的 `next.config.ts`
把 `/remote/*` rewrite 代理到中继（含 WebSocket 升级）。

## 构建与检查

```sh
npm run typecheck    # relay + web
npm run test         # relay 单测/黑盒
npm run build        # relay 产物 + web standalone 产物
npm run e2e          # relay Playwright
```

## 部署（单命令）

```sh
cd deploy
cp .env.example .env   # 填 PUBLIC_ORIGIN / RELAY_SERVICE_TOKEN / BETTER_AUTH_SECRET / PAIRING_ENC_KEY
docker compose --profile edge up -d --build
```

不想要 compose 自带 nginx 时，去掉 `--profile edge`，用宿主反代按
`deploy/nginx.hrack.conf.example` 分流 `/` 与 `/remote/`。

### 创建首位管理员

无邮件服务时有两条逃生路径：在 `.env` 配置至少 24 字节的随机
`ADMIN_SETUP_TOKEN` 后访问 `/admin/setup`（成功后删除该变量），或运行仓库钉死版本的 CLI：

```sh
docker compose --profile tools run --rm web-tools create-admin \
  --email ops@example.com --name Ops --role admin
```

CLI 会提示输入密码。`web-tools` 以 `1000:1000` 运行并共享 Web 的 SQLite 卷；不要改用 root 或 `npx @latest`。也不要依赖 CLI 默认发现配置：Compose 包装器会把固定的 `--config better-auth.config.ts` 放到 pinned `auth@1.7.1` 所要求的子命令后。`ADMIN_BOOTSTRAP_EMAIL` 只会在正常 OTP/OAuth 注册成功后提权，不是无邮件逃生路径。

安全基线：中继维持单副本、read-only、内存态房间；`/api/auth/*` 与
`/api/admin/*`、`/dashboard` 与 `/admin` 不落访问日志；SQLite 单文件在
`web-data` 卷，备份即拷贝。

详见 `docs/PAIRING-PLATFORM-SPEC.md`（平台规格）与 `docs/DEPLOYMENT.md`（中继加固）。
