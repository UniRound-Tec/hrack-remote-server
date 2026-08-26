# HRack Platform

HRack 平台单仓库：**web**（平台站，Next.js 16）+ **relay**（远程控制中继，Node 22）。
落地页、账号体系与配对 URL 控制台在 `web/`；协议转发、房间生命周期在 `relay/`。

```
浏览器 ──► Nginx(TLS) ─┬─ /                       → web   (Next.js, :3000)
                        ├─ /remote、/remote/        → /dashboard
                        └─ /remote/{roomId}、/remote/v1/ws → relay (Node, :3000)
HRack 桌面端 ── 粘贴配对URL / 手机端扫码 ──┘（协议不变）
dsh.hrack.example ──► Relay DSH Gateway ──独立 WSS tunnel──► Desktop loopback DSH
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
npm --prefix relay run verify:dsh-d2 # 构建后真实进程的 DSH HTTP/WS/ticket 门禁
npm run test:ops     # 备份/监控运维模块
```

## 部署（单命令）

```sh
cd deploy
cp .env.example .env   # 填域名和长期密钥
# 放置 certs/fullchain.pem、certs/privkey.pem，并修改 nginx 示例的 server_name
docker compose config --quiet
docker compose --profile edge up -d --build --wait
```

不想要 compose 自带 nginx 时，使用 `--profile host-edge`：平台域名转到 8788，独立 DSH
域名转到 8789；不要把两者合并成一个 path proxy。完整的 TLS、备份、恢复和升级
步骤见 `docs/DEPLOYMENT.md`。

### 真实恢复门禁

从全新镜像、全新 SQLite 卷开始执行隔离式真实 Docker 恢复门禁：

```sh
npm run verify:p4-deployment
```

它使用随机项目名和 loopback 端口，不影响当前 3000 端口实例；成功或失败都会只清理
本次门禁创建的容器和卷。对已经运行且把 Relay 映射到宿主机的测试部署，也可直接执行
底层恢复门禁：

```sh
TARGET_ORIGIN=http://127.0.0.1:3000 \
RELAY_INTERNAL_ORIGIN=http://127.0.0.1:3001 \
RELAY_SERVICE_TOKEN="$RELAY_SERVICE_TOKEN" \
RELAY_CONTAINER=hrack-relay-1 \
WEB_CONTAINER=hrack-web-1 \
RECONCILER_CONTAINER=hrack-pairing-reconciler-1 \
npm --prefix relay run verify:durable-recovery
```

该命令会创建并最终删除一个临时账号与配对记录，并明确重启上述三个容器。
它以 15 秒硬超时验证 Relay/整套服务重启后 URL、roomId 与撤销凭据不变，
同时覆盖双向 WebSocket、封禁/解封和账号删除后不复活。

正式生产发布、真实邮件、手机公网远控、恢复演练和监控告警的关门条件见
[`docs/PAIRING-P5-PRODUCTION-RELEASE-SPEC.md`](docs/PAIRING-P5-PRODUCTION-RELEASE-SPEC.md)。
P5 明确区分自动探测与真实验收：本地测试通过不能替代 Resend 实际送达和手机 ↔ 桌面控制。
对真实域名执行只读发布探测：

```sh
npm run verify:p5-release -- --origin https://hrack.dev
```

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
