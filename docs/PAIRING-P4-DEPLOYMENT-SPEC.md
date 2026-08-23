# HRack 配对平台 P4：可复现部署与运维规格

> 上游规格：[配对 URL 平台规格](./PAIRING-PLATFORM-SPEC.md)
> 前置：[P2 持久配对与自动恢复](./PAIRING-P2-DURABLE-RELAY-SPEC.md)、[P3 账号控制台](./PAIRING-P3-DASHBOARD-SPEC.md)
> 状态：已实现并通过真实 Docker 验收（2026-08-23）

## 1. 目标

P4 把已实现的账号、配对生命周期和 Relay 投影收口为一套可从零部署、可验证、
可备份与可恢复的生产拓扑。部署者仅依赖仓库内的 Compose、Nginx 示例与本文档，
即可得到下列行为：

1. Web、Relay、`pairing-reconciler` 与可选 Nginx 使用同一份明确配置启动；
2. SQLite 卷和加密密钥共同保存账号与配对身份；
3. Relay 不挂持久卷且保持单副本，重启后由协调器在 15 秒内恢复同一 URL；
4. `/remote` 与 `/remote/` 进入账号控制台，只有 `/remote/{roomId}` 是公开配对入口；
5. Relay system API 与 demo 不暴露公网，roomId 不进入 Nginx access log；
6. 升级前能备份，恢复时不会因重建密钥而令现有 URL 失效；
7. 仓库提供隔离式真实门禁，自动证明从零部署和重启恢复，而非只检查 YAML。

## 2. 非目标

- Relay 多副本、跨节点房间迁移与零中断 Relay 升级；
- 外置数据库、Kubernetes、云厂商专有负载均衡配置；
- 自动签发公网证书；
- 自动轮换 `PAIRING_ENC_KEY`。该密钥轮换需要专门的数据迁移设计。

## 3. 部署不变量

| 编号 | 不变量 |
|---|---|
| P4-I1 | `web-data` 中 SQLite 是账号和配对身份的唯一持久事实 |
| P4-I2 | `roomId`、`joinUrl`、加密 revoke token 只因用户显式轮换/吊销而改变 |
| P4-I3 | Relay 单副本、无持久卷；Relay 房间只是 SQLite 的内存投影 |
| P4-I4 | Web 与协调器必须使用同一 `web-data`、`PAIRING_ENC_KEY`、`RELAY_SERVICE_TOKEN` |
| P4-I5 | 普通 Relay/Web/协调器/整套 Compose 重启不得生成新 URL |
| P4-I6 | 从 Relay `/healthz` 恢复起 15 秒内，同一 roomId 必须重新可配对 |
| P4-I7 | `PUBLIC_ORIGIN`、`BETTER_AUTH_URL` 与浏览器最终 origin 完全一致 |
| P4-I8 | 生产只允许 HTTPS；loopback HTTP 只用于自动门禁 |
| P4-I9 | `/remote/v1/system/*`、`/remote/demo/*` 公网 404，匿名创建房间为 401 |
| P4-I10 | `/remote/*`、认证、管理和 dashboard 敏感路径关闭 Nginx access log |

## 4. 权威制品

| 文件 | 用途 |
|---|---|
| `deploy/.env.example` | 完整环境变量模板，不含真实秘密 |
| `deploy/docker-compose.yml` | 生产服务、共享卷、启动依赖与安全基线 |
| `deploy/nginx.hrack.conf.example` | TLS 终止与 HTTP→HTTPS 跳转 |
| `deploy/nginx.routes.conf` | 生产和本地门禁共用的路由/日志策略 |
| `deploy/docker-compose.verify.yml` | 仅 loopback 的真实门禁覆盖层 |
| `deploy/nginx.verify.conf` | 仅门禁使用的 HTTP 边缘配置 |
| `scripts/verify-p4-deployment.mjs` | 从零拉起、验证、清理隔离 Compose 项目 |
| `docs/DEPLOYMENT.md` | 生产部署、备份、恢复、升级与排障手册 |

生产不得使用 `docker-compose.verify.yml` 或 `nginx.verify.conf`。

## 5. 配置与密钥

首次部署必须生成并长期保存：

- `BETTER_AUTH_SECRET`：至少 32 字节随机值；
- `RELAY_SERVICE_TOKEN`：至少 32 字节随机值，Relay/Web/协调器相同；
- `PAIRING_ENC_KEY`：32 随机字节的 base64，用于持久配对撤销凭据；
- `SETTINGS_ENC_KEY`：建议独立的 32 随机字节 base64，用于 SMTP/OAuth 设置；
- TLS 私钥和证书链。

容器重建、主机重启和版本升级必须继续使用原 `PAIRING_ENC_KEY`。丢失该密钥时，
SQLite 中现有配对记录不可恢复，不能用“生成一个新密钥”冒充恢复。恢复备份必须同时
恢复数据库和对应密钥版本。

`ENABLE_DEV_CREATE`、`ALLOW_INSECURE_LOOPBACK` 在生产必须为空。邮件/OAuth 可以后置配置，
但开启邮箱验证前必须先完成真实邮件测试。

## 6. 启动与恢复顺序

1. Relay 启动并通过最小 `/remote/healthz`；此时尚未同步，服务凭证创建 fail closed；
2. Web 打开/迁移共享 SQLite；
3. 协调器读取完整 active 集合，向 Relay 原子提交期望状态；
4. Relay 标记 synchronized，现有 URL 重新可用；
5. Nginx 只负责公网分流，不拥有任何配对状态。

Compose 的 `depends_on` 只保证启动依赖。长期恢复由独立协调器每 5 秒执行，不能依赖
用户刷新 dashboard。Relay 重启会断开现有 WebSocket，但不会改变 URL；客户端重连即可。

## 7. 公网路由与日志

| 路径 | 结果 |
|---|---|
| `/`、`/auth`、`/dashboard`、`/admin` | Web |
| `/remote`、`/remote/` | `307 /dashboard`，相对 Location |
| `/remote/{roomId}`、`/remote/v1/ws`、`/remote/healthz` | Relay |
| `/remote/v1/system`、`/remote/v1/system/*` | 404 |
| `/remote/demo`、`/remote/demo/*` | 404 |
| 匿名 `POST /remote/v1/rooms` | 401 |

`/remote/` 下路径包含 roomId，因此整个 Relay location 必须 `access_log off`。内部 system
接口不得通过“知道服务 token”绕过公网 404；服务间只走 Compose 网络。

## 8. 数据保护与升级

- `web-data` 与 `.env`/秘密管理系统必须分别备份并成对标记版本；
- 一致性文件备份时先停止 Web 与协调器，Relay 可继续承载已建立的内存房间；
- 恢复前整套服务下线，不允许两个 Web 实例同时写同一 SQLite；
- 升级顺序是：备份 → 拉取/构建 → `docker compose up -d --build --wait` → 冒烟；
- 回滚代码时保留当前数据卷和密钥；若数据库迁移不向后兼容，恢复升级前整套备份；
- 永远不要用 `docker compose down -v` 操作生产项目，除非明确要永久删除账号数据。

完整命令与检查项见 `docs/DEPLOYMENT.md`。

## 9. 自动真实门禁

```sh
npm run verify:p4-deployment
```

门禁必须：

1. 使用随机 Compose project、随机 loopback 端口、随机密钥和全新 `web-data` 卷；
2. 构建并启动真实生产 Dockerfile 产物；
3. 向全新 SQLite 写入临时账号配对，经 Nginx 打开公开 URL 并完成双向 WebSocket；
4. 只重启 Relay，确认 URL、roomId、密文不变并在 15 秒内恢复；
5. 封禁后移除房间、解封后恢复同一 URL；
6. 重启 Relay/Web/协调器，重复同 URL 与双向 WebSocket 验证；
7. 删除账号后重启 Relay，确认旧 URL 不复活；
8. 扫描各容器日志，确认测试账号标识、roomId、URL 和秘密未泄露；
9. 无论成功失败都只清理本次随机项目及其数据卷，不触碰已有部署。

## 10. P4 验收

- `npm test`、`npm run typecheck`、`npm run build`、`npm run e2e` 全绿；
- `docker compose config --quiet` 在填入合法生产变量后通过；
- `npm run verify:p4-deployment` 输出 `result: passed`；
- Nginx 静态门禁证明共用路由、WebSocket header、敏感路径 404 和 access log 策略；
- 按 `docs/DEPLOYMENT.md` 从空主机/空卷部署步骤可复现；
- 文档不再把“Relay 内存态”错误解释为“账号 URL 在重启后失效”。

## 11. 实施切片

1. **P4.1 边缘收口**：共用路由、Server Action authority、system/demo 封锁、日志策略；
2. **P4.2 Compose 门禁**：隔离覆盖层、自动端口/密钥、真实重启恢复与安全清理；
3. **P4.3 运维手册**：TLS、密钥、首位管理员、备份/恢复、升级/回滚；
4. **P4.4 真实验收**：全仓门禁、从零 Compose、结果记录与平台规格状态收口。
