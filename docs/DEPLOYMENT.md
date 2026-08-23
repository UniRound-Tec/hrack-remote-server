# HRack 平台部署与恢复

本文是 `web`、`relay`、`pairing-reconciler` 与 Nginx 的生产部署手册。Relay 自身是
单副本内存进程，但账号侧 SQLite 保存配对身份，协调器会在 Relay 或整套服务重启后
恢复**完全相同的 URL**。只有用户显式轮换或吊销才会让 URL 永久失效。

## 1. 前提

- Linux 主机、Docker Engine 与 Docker Compose v2；
- 一个解析到该主机的域名；
- 对应域名的 TLS `fullchain.pem` 与 `privkey.pem`；
- 只运行一个 Relay 副本；
- 防火墙只向公网开放 80/443，Web 与 Relay 不直接暴露。

Node 直接运行需要 22 或更新版本；Compose 镜像已经钉死 Node 22.23.0。

## 2. 首次配置

```sh
cd deploy
cp .env.example .env
```

编辑 `.env`：

```dotenv
COMPOSE_PROJECT_NAME=hrack
PUBLIC_ORIGIN=https://remote.example.com
RELAY_SERVICE_TOKEN=<openssl rand -hex 32>
BETTER_AUTH_SECRET=<openssl rand -hex 32>
PAIRING_ENC_KEY=<openssl rand -base64 32>
SETTINGS_ENC_KEY=<openssl rand -base64 32>
```

尖括号表示把命令输出填入文件，不要原样保留。以下值必须长期保存，重启、重建容器、
升级和恢复时不得重新生成：

| 变量 | 要求 | 丢失/变更影响 |
|---|---|---|
| `BETTER_AUTH_SECRET` | 至少 32 字节随机 | 现有会话失效 |
| `RELAY_SERVICE_TOKEN` | 至少 32 字节随机，三服务同值 | Web/协调器无法管理房间 |
| `PAIRING_ENC_KEY` | 32 字节 base64 | 现有配对凭据无法解密，URL 不可恢复 |
| `SETTINGS_ENC_KEY` | 32 字节 base64，建议独立 | 已存邮件/OAuth secret 无法解密 |

`ENABLE_DEV_CREATE` 必须为空。生产不要设置 `ALLOW_INSECURE_LOOPBACK`。`PUBLIC_ORIGIN`
必须只有 `https://` scheme 和 authority，不能带路径，也必须与浏览器最终访问 origin 一致。

### TLS 与域名

把证书放到：

```text
deploy/certs/fullchain.pem
deploy/certs/privkey.pem
```

将 `nginx.hrack.conf.example` 中的 `server_name hrack.example` 改为真实域名。80 端口只做
HTTPS 跳转，443 端口加载 `nginx.routes.conf` 中生产与真实门禁共用的路由策略。

## 3. 从零启动

先验证插值与 Nginx 配置，再构建启动：

```sh
docker compose config --quiet
docker compose --profile edge run --rm --no-deps nginx nginx -t
docker compose --profile edge up -d --build --wait
docker compose --profile edge ps
```

首次构建可能需要下载 Node/npm 与 Nginx 镜像。成功时应看到 `relay`、`web`、
`pairing-reconciler`、`nginx` 均为 running，Relay 与 Web 为 healthy。

基础冒烟：

```sh
curl -fsS https://remote.example.com/
curl -fsS https://remote.example.com/remote/healthz
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST https://remote.example.com/remote/v1/rooms \
  -H 'content-type: application/json' -d '{}'
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://remote.example.com/remote/v1/system/state
```

预期依次为 Web 200、Relay health 200、匿名创建 401、system API 404。

## 4. 首位管理员

无邮件服务时，在 `.env` 临时配置至少 24 字节的随机 `ADMIN_SETUP_TOKEN`，重新创建 Web：

```sh
docker compose up -d --force-recreate web
```

访问 `/admin/setup` 完成后从 `.env` 删除 token，再次重建 Web。也可使用钉死版本的 CLI：

```sh
docker compose --profile tools run --rm web-tools create-admin \
  --email ops@example.com --name Ops --role admin
```

CLI 会提示密码。不要改用 root、`npx @latest` 或依赖 CLI 自动发现配置。

默认不强制邮箱验证。要开启验证，先在 `/admin/mail` 保存并发送真实测试邮件，确认送达后
再打开开关。OAuth 回调地址为：

```text
${PUBLIC_ORIGIN}/api/auth/callback/github
${PUBLIC_ORIGIN}/api/auth/callback/google
```

## 5. 配对 URL 持久化模型

- `hrack_web-data` 保存账号、配对 URL、roomId 与加密撤销凭据；
- Relay 不挂持久卷，房间是可重建内存投影；
- `pairing-reconciler` 与 Web 共享数据卷和密钥，每 5 秒校准一次；
- 只重启 Relay 时，现有 WebSocket 会断开，但同一 URL 应在 Relay health 恢复后 15 秒内可用；
- 重启 Web、协调器或整套 Compose 不得改写 URL；
- 不要因为 Relay 内存为空而轮换 URL，也不要删除 `web-data`；
- 用户显式吊销/轮换、账号删除或账号封禁才会移除投影。

检查服务日志时只看计数、revision 和错误类别。日志不应出现邮箱、roomId、完整 URL、
token、Cookie 或协议 payload。

## 6. Nginx 路由和安全边界

`nginx.routes.conf` 是共用路由策略：

| 路径 | 上游/结果 |
|---|---|
| `/` | Web |
| `/remote`、`/remote/` | `307 /dashboard` |
| `/remote/{roomId}`、`/remote/v1/ws` | Relay，保留 WebSocket Upgrade |
| `/remote/v1/system/*` | 404 |
| `/remote/demo/*` | 404 |

`/remote/` 整段关闭 access log，因为 URL 路径包含 roomId。认证、管理与 dashboard 路径
同样关闭 access log。不要在 CDN、WAF 或上层负载均衡重新记录完整 `/remote/*` 请求 URI。

不用 Compose 自带 Nginx 时，只启动无 profile 的三个服务，并由宿主反代复刻相同策略。
这时需要用只绑定 loopback 的 Compose override 显式发布 Web/Relay 端口；不要把 3000
直接暴露到公网。内部 `/remote/v1/system/*` 永远不得由宿主反代公开。

## 7. 备份

备份必须同时包含：

1. `hrack_web-data`；
2. `.env` 中四个长期密钥（建议进入独立秘密管理系统）；
3. TLS 私钥/证书与 Nginx 的本地修改；
4. 当前 Git commit 或镜像版本。

在仓库根执行一致性备份：

```sh
npm run backup:create -- --output deploy/backups/2026-08-23T-release
```

工具只停止备份前确实在运行的 Web 与协调器，归档完整 `web-data`（包含 WAL/SHM），并在
`finally` 中恢复这些写入者。输出包含 `web-data.tar.gz` 和 `manifest.json`；manifest 记录
SHA-256、大小、Git commit 与镜像标识，但明确不包含秘密。Relay 在短暂停写期间继续承载
已有运行时房间。

将归档、manifest 与对应密钥版本放到受控位置。`.env`、TLS 私钥和长期密钥必须单独进入
秘密管理/加密备份；不要把它们复制进普通归档或工单。

## 8. 恢复演练

先执行自动隔离演练：

```sh
npm run backup:rehearse -- \
  --manifest deploy/backups/2026-08-23T-release/manifest.json
```

工具先复核 SHA-256，只允许恢复到它自己创建且带
`com.hrack.restore-rehearsal=true` 标签的临时卷，然后用真实 SQLite
`PRAGMA integrity_check` 检查数据库和必需表，最后删除临时卷。它拒绝把生产卷当作目标。

正式发布前还要把备份恢复到隔离 Compose 项目，使用与备份匹配的长期密钥，并人工验证：

1. 既有账号能登录，管理员角色不变；
2. dashboard 中原配对 URL 完全不变；
3. 协调器把该配对记录恢复为运行时房间，真实 WebSocket 可重新连接。

只有灾难恢复时才允许覆盖生产卷。操作前下线生产、再次核对精确卷名和备份 SHA-256；
恢复命令必须在维护窗口按已审核工单执行。不要使用：

```sh
docker compose down -v
```

它会永久删除账号和配对事实。

## 9. 升级与回滚

升级：

```sh
# 先完成第 7 节备份
git pull --ff-only
docker compose config --quiet
docker compose --profile edge up -d --build --wait
docker compose --profile edge ps
```

随后用既有账号验证 dashboard、原 URL 和真实 WebSocket。Relay 升级会造成瞬时断线，
协调器会恢复同一 URL。

回滚代码时保持当前卷与密钥。如果新版本已经执行不兼容迁移，应先下线整套服务，再同时
恢复升级前数据卷备份、密钥和代码版本。不要只回滚镜像却猜测数据库兼容。

## 10. 自动从零部署门禁

开发/发布机器上在仓库根运行：

```sh
npm run verify:p4-deployment
```

该命令使用随机项目名、随机 loopback 端口、随机密钥与全新数据卷，构建真实 Dockerfile，
并验证：公网路由边界、匿名创建 401、持久账号配对、双向 WebSocket、Relay 重启同 URL、
整套服务重启同 URL、封禁/解封、删号不复活和敏感日志扫描。成功或失败后只清理本次随机
项目，不触碰当前 3000 端口实例或生产卷。

本地门禁使用 `docker-compose.verify.yml` 和 HTTP loopback Nginx；这两个文件不能用于公网。

## 11. 健康监控、告警与日志轮转

Compose 默认启动 `production-monitor`。它每 30 秒检查公网 TLS/HTTPS、公开安全边界、
内部 Web/Relay 和 `pairing-reconciler` 的独立健康接口；连续 3 次失败才告警，恢复后只通知
一次。协调器从最近一次成功开始超过 `max(30 秒, 3 × 校准周期)` 会变为 unhealthy。

至少配置一个独立接收端：

```dotenv
MONITOR_ALERT_WEBHOOK_URL=https://alerts.example/hooks/hrack
# 或复用 Resend，但告警进程不依赖 Web 存活：
MONITOR_ALERT_EMAIL_TO=ops@example.com
RESEND_API_KEY=...
SMTP_FROM=HRack <noreply@modplex.app>
```

告警只包含检查名和时间，不包含响应 body、邮箱、配对 URL、roomId 或 token。上线时在维护
窗口依次停止/恢复 `pairing-reconciler` 和 Relay，等待失败阈值，确认真实告警与恢复通知。

所有长期容器默认使用 Docker `json-file` 的 `10m × 5` 上限，可用 `LOG_MAX_SIZE` 和
`LOG_MAX_FILES` 调整。可用下列命令核对，输出中的 `Config` 应含 `max-size`/`max-file`：

```sh
docker inspect hrack-web-1 --format '{{json .HostConfig.LogConfig}}'
docker compose ps
```

真实公网只读关门检查：

```sh
npm run verify:p5-release -- --origin https://hrack.modplex.app
```

在生产主机加载受控 `.env` 后，可设置 `P5_REQUIRE_PRODUCTION_CONFIG=1` 再运行；它只报告
配置项是否存在，不输出值，并额外检查强制验证、Resend 发件域、告警接收端、setup token
已删除及匿名调试开关关闭。正式清单见
[`PAIRING-P5-RELEASE-CHECKLIST.md`](./PAIRING-P5-RELEASE-CHECKLIST.md)。

## 12. Relay 运行限制与容量

`GET /remote/healthz` 只返回 `{ "ok": true }`，不暴露房间数或同步 revision。Relay 必须
保持单副本。多副本需要另行设计房间所有权、跨实例协调和路由，不能用 round-robin 或
sticky session 掩盖多个独立内存 authority。

默认拒绝上限：

| 变量 | 默认值 |
|---|---:|
| `MAX_ROOMS` | 10000 |
| `MAX_CONNECTIONS` | 20000 |
| `MAX_RATE_LIMIT_KEYS` | 50000 |
| `MAX_FRAME_BYTES` | 1048576 |
| `MAX_ROOM_BUFFERED_BYTES` | 1048576 |
| `HELLO_DEADLINE_MS` | 5000 |
| `PING_INTERVAL_MS` | 30000 |
| `PONG_TIMEOUT_MS` | 10000 |
| `REVOKE_DRAIN_MS` | 500 |

这些是拒绝上限，不是机器容量结论。上线前按目标机器运行 `relay` 的 load gate 并保存报告；
不要仅因容器 healthy 就宣称容量达标。
