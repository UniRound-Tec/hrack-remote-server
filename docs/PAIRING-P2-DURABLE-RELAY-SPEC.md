# HRack P2：持久配对身份与 Relay 自动恢复规格

> 状态：已实现并通过真实恢复门禁（2026-08-23）
> 前置：账号、会话、SQLite、`pairings` 表已存在
> 后续：P3 在 `/dashboard` 接入创建、展示、轮换与吊销 UI
> 架构决策：[ADR-0001](./adr/0001-pairing-records-own-durable-identity.md)

## 1. 目标

P2 把 Relay 从“任何人都可匿名创建、重启即丢失全部 URL”的调试形态收口为账号平台的安全运行层：

1. 生产环境只有 Web 后端可以创建或查询配对房间；匿名创建默认返回 `401`。
2. 每条配对 URL 随用户账号持久化。只重启 Relay、只重启 Web 或整套服务重启，都不得改变 URL。
3. Relay 重启后自动恢复全部仍有效的账号配对，用户不需要重新生成 URL。
4. Relay 仍然不拥有持久数据库；账号侧 SQLite 是配对身份的唯一事实来源。
5. `/remote/` 不再是生产生成页。生产访问根路径进入账号控制台，只有带 roomId 的 URL 才是公开配对入口。

### 1.1 非目标

- P2 不实现 dashboard 的二维码与 CRUD 视觉界面；它们属于 P3。
- 不支持一个账号多条有效 URL。
- 不支持多 Relay 副本、分片或跨区恢复。
- 不承诺在 `PUBLIC_ORIGIN` 或 `BASE_PATH` 被人为修改后仍保持完整 URL 不变；域名迁移必须是显式运维操作。

## 2. 核心模型与不变量

### 2.1 模型

- **配对记录**：账号侧持久对象，保存 `userId`、`roomId`、`joinUrl`、加密的 revoke token 和生命周期状态。
- **配对 URL**：配对记录的稳定公开地址，格式为 `{PUBLIC_ORIGIN}{BASE_PATH}/{roomId}`。
- **运行时房间**：Relay 内存中对有效配对记录的投影，可在进程退出时消失并随后恢复。
- **期望状态快照**：账号数据库中当前应当存在于 Relay 的完整房间集合。

### 2.2 必须始终成立

1. 每个用户账号最多一条 `active` 配对记录。
2. Relay 重启不创建新的 `roomId`、revoke token 或 `joinUrl`。
3. 只有用户主动轮换、主动吊销、账号删除或不可恢复的数据损坏，才会永久终止旧 URL。
4. 账号被封禁时 URL 暂停工作；解除封禁后恢复**同一个** URL。
5. 会话过期、退出登录、修改密码不吊销配对 URL。
6. Relay 的内存状态可以全部删除并仅由账号数据库恢复出来。
7. 未完成当前 Relay 实例的首次同步前，Relay 必须 fail closed，不接受房间加入。

## 3. 生命周期

### 3.1 持久状态

`pairings.status` 保留以下值：

| 状态 | 含义 | 是否进入 Relay 期望状态 |
|---|---|---:|
| `active` | 配对记录有效 | 用户未被封禁时是 |
| `revoked` | 用户或账号生命周期已永久吊销 | 否 |
| `stale` | 持久数据无法解密、URL 与当前部署不兼容等不可自动恢复错误 | 否 |

Relay 重启、短暂离线或恢复尚未完成，**不得**把记录写成 `stale`。这些情况在界面上统一表现为派生状态 `recovering`，不落库。

### 3.2 事件语义

| 事件 | 配对记录 | 配对 URL | 运行时房间 |
|---|---|---|---|
| Relay 重启 | 不变 | 不变 | 自动恢复 |
| Web 重启 | 不变 | 不变 | 不变或由协调器校准 |
| 整套服务重启 | 不变 | 不变 | 自动恢复 |
| 用户退出登录 | 不变 | 不变 | 不变 |
| 账号封禁 | 保持 `active` | 保留 | 从 Relay 移除 |
| 账号解除封禁 | 保持 `active` | 原 URL | 自动恢复 |
| 用户吊销 | 改为 `revoked` | 永久失效 | 移除并断开连接 |
| 用户轮换 | 旧记录 `revoked`，新记录 `active` | 生成新 URL | 原子切换期望集合 |
| 账号删除 | 记录级联删除 | 永久失效 | 自动移除 |

## 4. 架构

```text
                  持久事实                         可重建投影

  user ──1:0..1── pairing record    ──snapshot──► Relay room map
                    │                                  │
                    ├─ roomId                          ├─ roomId
                    ├─ joinUrl                         ├─ revokeDigest
                    └─ encrypted revokeToken           └─ live sockets
                              ▲
                              │ read + reconcile
                    pairing-reconciler
```

### 4.1 责任边界

- Web/SQLite 拥有账号归属、URL 身份、吊销凭证和生命周期。
- Relay 拥有连接、方向转发、背压、心跳与当前内存房间。
- `pairing-reconciler` 持续把账号侧期望状态投影到 Relay。
- Relay 不反向读取 Web 数据库，也不挂载 SQLite 卷。

### 4.2 协调器运行方式

P2 新增单实例长运行进程 `pairing-reconciler`，与 Web 共用配对数据访问层和 `PAIRING_ENC_KEY`，通过内部 Docker 网络调用 Relay：

- 启动时立即同步一次；
- 每 `PAIRING_RECONCILE_INTERVAL_MS` 再校准一次，默认 `5000` ms；
- 发现 Relay `instanceId` 变化时立即完整同步；
- P3 的创建、吊销和轮换动作在数据库提交后调用同一 `reconcileNow()`，不等待下一次轮询；
- 失败使用带抖动的指数退避，但最长等待不得超过常规轮询周期。

部署保持单 Web、单协调器、单 Relay。协调器不得通过页面请求“顺便启动”，也不得依赖某个用户访问 dashboard 才开始恢复。

## 5. 数据与并发

### 5.1 现有 `pairings` 表

P2 沿用现有字段，不重写已生成的 URL：

```text
id, user_id, room_id, join_url, revoke_token_enc,
status, created_at, revoked_at
```

继续保留部分唯一索引：

```sql
UNIQUE (user_id) WHERE status = 'active'
```

### 5.2 投影修订号

新增单行表：

```sql
CREATE TABLE pairing_projection_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  revision  INTEGER NOT NULL
);
```

数据库迁移必须为 `pairings` 的 `INSERT`、`UPDATE`、`DELETE` 建立触发器，在同一事务内把 `revision` 加一。这样账号级联删除和后台管理操作也不会绕过修订号。

协调器必须在同一个 SQLite 读事务中读取：

1. 当前 `revision`；
2. 所有 `status='active'` 且用户未封禁的配对记录。

快照中的 `revokeDigest` 定义为：

```text
base64url(SHA-256(UTF8(revokeToken)))
```

协调器解密 `revoke_token_enc` 后只把摘要发给 Relay，不发送明文 revoke token。

### 5.3 并发规则

- Relay 仅接受高于当前 `appliedRevision` 的快照。
- 相同 revision 且内容摘要相同是幂等成功。
- 更低 revision 返回 `409 STALE_REVISION`，不得修改内存状态。
- 相同 revision 但内容不同返回 `409 REVISION_CONFLICT`，不得部分应用。
- 两个协调请求乱序到达时，较新的数据库状态必须获胜。

## 6. Relay 配置与鉴权

### 6.1 环境变量

| 变量 | 规则 |
|---|---|
| `RELAY_SERVICE_TOKEN` | 生产必填，至少 32 字节；Web 与协调器调用系统接口时使用 |
| `ENABLE_DEV_CREATE` | 默认关闭；仅非 production 且 `PUBLIC_ORIGIN` 为 loopback 时允许设为 `1` |
| `PAIRING_RECONCILE_INTERVAL_MS` | 协调器轮询间隔，默认 5000，允许 1000–60000 |

若 production 启用了 `ENABLE_DEV_CREATE=1`，或非 loopback 环境启用该开关，Relay 必须启动失败，不允许仅打印警告后继续。

服务凭证比较使用常量时间算法；凭证、roomId、joinUrl、revoke token 与 revoke digest 均不得写日志。

### 6.2 创建接口

```http
POST {BASE_PATH}/v1/rooms
Authorization: Bearer {RELAY_SERVICE_TOKEN}
Content-Type: application/json
```

| 场景 | 结果 |
|---|---|
| 有效服务凭证且 Relay 已同步 | `201 {roomId, joinUrl, revokeToken}` |
| 无凭证或凭证错误 | `401` |
| Relay 尚未完成首次同步 | `503` + `Retry-After` |
| `ENABLE_DEV_CREATE=1` 的合规本地环境 | 允许匿名创建并保留 IP 限流 |

带服务凭证的创建不受匿名 IP 创建限流约束；容量限制仍然生效。

### 6.3 系统状态接口

```http
GET {BASE_PATH}/v1/system/state
Authorization: Bearer {RELAY_SERVICE_TOKEN}
```

成功返回：

```json
{
  "instanceId": "每次进程启动随机生成的标识",
  "synchronized": true,
  "appliedRevision": 42
}
```

公开的 `GET {BASE_PATH}/healthz` 继续只返回 `{ "ok": true }`，不泄露 revision、房间数或实例状态。

### 6.4 期望状态接口

```http
PUT {BASE_PATH}/v1/system/rooms
Authorization: Bearer {RELAY_SERVICE_TOKEN}
Content-Type: application/json

{
  "revision": 42,
  "rooms": [
    { "roomId": "...", "revokeDigest": "..." }
  ]
}
```

成功返回：

```json
{
  "instanceId": "...",
  "appliedRevision": 42,
  "activeRoomCount": 7
}
```

处理规则：

1. 完整校验 body、重复 roomId、roomId 格式、digest 格式与 `MAX_ROOMS`，任一错误则整批拒绝。
2. 先构造下一状态，再一次性应用；禁止前半批成功、后半批失败。
3. roomId 与 digest 均相同的现有房间保留原对象与活连接。
4. 快照新增的房间以 `open` 状态恢复。
5. 快照缺少的房间被吊销，现有客户端收到 `revoked` 后关闭。
6. 同 roomId 但 digest 不同返回 `409 ROOM_CREDENTIAL_CONFLICT`，整批不应用，禁止静默替换凭证。
7. 当前启动实例首次成功应用快照后才把 `synchronized` 置为 `true`；空快照同样算成功同步。

系统接口只允许内部网络调用；Nginx 对公网精确屏蔽 `{BASE_PATH}/v1/system/`，即使请求携带伪造凭证也不转发。

## 7. 自动恢复流程

### 7.1 正常启动

1. Relay 启动为空房间集合，生成新的 `instanceId`，`synchronized=false`。
2. `/healthz` 成功后 Web 与协调器启动。
3. 协调器读取一致的数据库快照并调用 `PUT /v1/system/rooms`。
4. Relay 原子应用快照并进入 `synchronized=true`。
5. 原有配对 URL 使用相同 roomId 重新可用。

### 7.2 仅 Relay 重启

1. 现有 WebSocket 断开，这是进程重启不可避免的瞬时中断。
2. 协调器发现 `instanceId` 变化或系统接口暂时不可达。
3. Relay 恢复健康后，协调器重放当前完整快照。
4. 桌面端与手机端使用原 URL 重连；不得要求用户进入 dashboard 轮换。

### 7.3 恢复 SLO

在账号数据库、密钥与内部网络正常的前提下，从 Relay `/healthz` 首次恢复 200 起，所有有效房间必须在 **15 秒内**恢复。真实容器验收测试使用 15 秒硬超时，不以人工刷新为准。

## 8. 账号绑定规则

- 查询期望状态时必须联结用户表；`banned=true` 的账号不投影到 Relay。
- 解除封禁后不生成新记录，协调器恢复原 roomId。
- 删除账号前的业务钩子仍应主动吊销；数据库级联删除与 revision 触发器是最终兜底。
- Admin 删除、公开账号删除和未来批量删除必须走同一配对生命周期服务。
- 改邮箱、改密码、撤销会话和角色变化不影响配对 URL。

## 9. 页面与公网路由

生产 Nginx 必须区分“平台入口”和“配对入口”：

| 路径 | 生产行为 |
|---|---|
| `/remote`、`/remote/` | `307 /dashboard`；未登录随后由 Web 转到 `/auth?next=/dashboard` |
| `/remote/{roomId}` | 转发 Relay，公开配对页 |
| `/remote/v1/ws` | 转发 Relay WebSocket |
| `/remote/healthz` | 转发公开最小探活 |
| `/remote/v1/system/*` | Nginx 直接 `404`，不进入 Relay |
| `/remote/demo`、`/remote/demo/*` | 生产直接 `404` |

相对重定向必须使用 `absolute_redirect off`，避免容器端口覆盖外部端口。

Relay 自身在 `ENABLE_DEV_CREATE` 关闭时，对生成根页和 demo 页返回 `404`。调试生成页只能通过明确开启开关的本地开发实例访问。

## 10. 故障处理

| 故障 | 行为 |
|---|---|
| Relay 不可达 | 配对记录保持 `active`，展示/返回 `recovering`，协调器重试 |
| 服务凭证不一致 | Relay 保持 fail closed；协调器记录不含秘密的配置错误 |
| revoke token 无法解密 | 该记录改为 `stale`，不进入快照；其它账号继续恢复 |
| URL 与当前 origin/base 不兼容 | 该记录改为 `stale`，要求运维迁移或用户轮换 |
| 活跃记录超过 `MAX_ROOMS` | 快照整批拒绝，Relay 不宣布同步完成；明确告警容量不足 |
| 协调器重启 | Relay 当前房间继续工作；协调器恢复后重新校准 |
| 数据库暂不可读 | 不发送空快照，避免把“读取失败”误判成“期望集合为空” |
| 创建成功但 DB 写入失败 | Web 尝试补偿吊销；周期完整快照最终清理孤儿房间 |

## 11. 安全与日志

- `RELAY_SERVICE_TOKEN` 与 `PAIRING_ENC_KEY` 只存在于 Web、协调器和 Relay 的运行环境，不进入浏览器。
- Relay 只接收 revoke digest 进行恢复；明文 revoke token 仅在创建响应和 Web 解密内存中短暂存在。
- 协调日志允许记录：结果、revision、恢复数量、耗时、错误类别。
- 协调日志禁止记录：邮箱、userId、roomId、joinUrl、token、digest、请求 body。
- 公网匿名 `POST /remote/v1/rooms` 必须稳定为 `401`；不能依赖“页面没有按钮”作为安全边界。
- 所有 system API body 设置独立大小上限，并在 JSON 解析前限制请求体。

## 12. 测试计划

### 12.1 Relay 单元与黑盒

- 未配置、错误和正确服务凭证的 `POST /v1/rooms` 分别为 401、401、201。
- `ENABLE_DEV_CREATE=1` 只在非 production loopback 生效；错误环境启动失败。
- system state 与 reconcile 接口必须鉴权。
- 空快照完成首次同步。
- 同 revision 同内容幂等；旧 revision 与冲突内容均不改变状态。
- 完整快照新增、保留、删除房间；保留房间不踢掉活连接。
- 输入一项非法时整批不生效。
- 默认根生成页与 demo 为 404；显式开发开关回归旧调试流程。
- 日志捕获断言所有秘密与房间身份均未出现。

### 12.2 Web/协调器

- 在同一读事务中取得 revision 与有效记录。
- active + 未封禁进入快照；revoked、stale、封禁账号不进入。
- revoke token 解密后生成固定 SHA-256 base64url 测试向量。
- 任意 `pairings` 插入、更新、删除和账号级联删除都会递增 revision。
- 两个乱序 reconcile 请求最终以较高 revision 为准。
- 数据库读取失败时不会发送空快照。

### 12.3 真实容器恢复验收

必须使用真实 SQLite、真实 Web/协调器、真实 Relay 子进程或容器验证：

1. 为真实账号写入一条 active 配对并记录 URL。
2. 桌面端与手机端通过该 URL 完成一次真实 WebSocket 配对。
3. 仅重启 Relay 容器。
4. 不访问 dashboard、不创建新记录，等待最多 15 秒。
5. 使用**完全相同的 URL**再次完成双向消息转发。
6. 重启整套服务后重复一次。
7. 封禁账号后原 URL 不可加入；解封后相同 URL 自动恢复。
8. 删除账号后重启 Relay，旧 URL 仍不得恢复。

## 13. P2 验收门禁

P2 只有同时满足以下条件才可结束：

- 匿名创建真实请求为 401；生产根生成页不可访问。
- 服务凭证创建、查询和期望状态同步全部通过黑盒测试。
- Relay 重启后相同 URL 在 15 秒内自动恢复，roomId 与 revoke token 不变化。
- 封禁/解封保留同一 URL，删除/吊销永久移除。
- Relay 容器仍无持久卷，删除其容器后仍可从账号数据库恢复。
- `npm run typecheck`、`npm test`、Relay E2E、真实容器恢复测试全绿。
- 日志扫描确认无账号身份、URL、roomId 或秘密泄露。

## 14. 建议实现切片

每个切片保持可独立审查：

1. **P2.1 Relay 鉴权与开发开关**：解析服务凭证、匿名 401、生产误开调试开关时启动失败、隐藏生成根页/demo。
2. **P2.2 Relay 期望状态协议**：instanceId、system state、原子 reconcile、revision 与连接保留测试。
3. **P2.3 SQLite 投影版本**：revision 表、触发器、一致快照与 digest 构造。
4. **P2.4 自动协调器**：启动/周期/实例变化恢复、退避、compose 服务与健康行为。
5. **P2.5 公网边界**：Nginx 根路径转 dashboard、system/demo 404、公开配对与 WebSocket 回归。
6. **P2.6 真实恢复门禁**：同 URL 重启恢复、封禁/解封、删除后不复活、文档收口。
