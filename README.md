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
| `web/` | 平台站：落地页（5 语言）、账号/OAuth、运营后台与配对控制台 |
| `relay/` | 中继：单进程内存态房间，零业务逻辑，服务凭证保护创建 |
| `deploy/` | `docker-compose.yml`（relay + web + 配对协调器 + 可选 nginx）与反代示例 |

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
npm run test         # relay + web 单测/黑盒
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

### 邮件与 OAuth

默认不强制邮箱验证，注册后可直接登录。要强制验证时，先在 `/admin/mail`
保存并测试邮件配置，再开启开关；代码路径同时设置
`emailAndPassword.requireEmailVerification` 与 GitHub/Google 的同名 provider
选项，避免 OAuth 绕过。邮件及 OAuth secret 使用 AES-256-GCM 存入
`web-data`；设置 `SETTINGS_ENC_KEY` 可与配对密钥隔离，否则复用
`PAIRING_ENC_KEY`。

OAuth 可在 `/admin/oauth` 配置，也可由环境变量钉死。Provider 控制台的回调地址为：

```text
${PUBLIC_ORIGIN}/api/auth/callback/github
${PUBLIC_ORIGIN}/api/auth/callback/google
```

GitHub 需授权 `user:email`；私有主邮箱会从 `/user/emails` 解析。Provider
仍未返回邮箱时不会创建账号，而是回到 `/auth?error=email_not_found`。

### 安全基线

- 全站下发 CSP：资源、连接和表单仅允许同源，禁止 object/iframe 与被嵌入。
  Next 静态 header 为 hydration 保留 `'unsafe-inline'`；`'unsafe-eval'` 仅开发态启用。
- Session Cookie 为 HTTPOnly、SameSite=Lax，HTTPS 下为 Secure；缓存关闭，禁用、删号和重置密码会立即撤销会话。
- `/api/admin/*` 写操作校验可信 Origin 并限流；最后一位有效管理员不能被禁用、删除或降级；impersonation 端点禁用。
- SMTP/OAuth secret、密码、OTP、Cookie、Authorization、setup token 与配对 token 不进入 API 响应、审计字段或访问日志。
- `/api/auth/*`、`/api/admin/*`、`/dashboard` 与 `/admin` 在 Nginx 示例中关闭访问日志；SQLite 位于 `web-data` 卷，升级或回滚前先备份。

中继继续维持单副本、read-only、无状态卷；账号数据库持久保存稳定的配对
URL 与加密撤销凭据，独立协调器每 5 秒把有效账号投影回内存房间。Relay
重启后会自动恢复相同 URL，不依赖用户访问 dashboard；内部调用统一使用
`RELAY_SERVICE_TOKEN`，可通过 `PAIRING_RECONCILE_INTERVAL_MS` 调整校准周期。
