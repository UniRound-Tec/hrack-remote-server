# HRack P3：账号配对控制台规格

> 状态：已实现并通过真实浏览器验收（2026-08-23）
> 前置：[P2 持久配对与 Relay 自动恢复](./PAIRING-P2-DURABLE-RELAY-SPEC.md)
> 领域语言：[CONTEXT.md](../CONTEXT.md)

## 1. 目标

P3 把受认证保护的 `/dashboard` 从占位页变成完整的配对控制台：

1. 每个账号同时最多持有一条 `active` 配对记录；
2. 用户可以创建、复制、扫码、吊销和轮换配对 URL；
3. URL、roomId 与撤销凭据属于账号数据库，普通服务重启不得改写；
4. Relay 短暂不可达或刚重启时只展示 `recovering`，不得自动创建新 URL；
5. 不可恢复的持久数据才进入 `stale`，用户可以显式轮换；
6. 五语言 UI、键盘操作、移动端布局和真实浏览器主链路均需通过验收。

P3 不增加多配对、分享、配对历史管理、设备命名、使用统计或管理员代操作。

## 2. 不变量

- SQLite 中 `pairings` 是 URL 身份的唯一持久事实；Relay 房间只是可重建投影。
- 页面刷新、Web 重启、Relay 重启、协调器重启和整套重启都不得隐式轮换。
- `recovering` 是派生运行状态，不写入 `pairings.status`。
- `stale` 只表示密文无法解密、roomId 非法或 join URL 与当前部署不兼容。
- 浏览器永远拿不到 revoke token、密文、Relay 服务凭证或 system API 响应。
- 每次写操作都用 session 的 `user.id` 限定记录；浏览器提交的记录版本只能用作乐观并发条件，不能决定归属。
- `active` 唯一索引是最终并发兜底；应用层冲突返回赢家记录，不把正常双击显示成错误。

## 3. Dashboard 状态模型

服务端向 UI 返回以下联合类型：

```ts
type PairingView =
  | { kind: 'empty' }
  | {
      kind: 'ready' | 'recovering'
      version: string
      joinUrl: string
      createdAt: number
    }
  | {
      kind: 'stale'
      version: string
      createdAt: number
    }
```

`version` 是账号范围内的乐观并发标识，当前实现使用 pairing id；它不是 Relay roomId。

状态推导：

| 持久记录 | Relay system state | 房间探活 | UI |
|---|---|---|---|
| 无 active/stale | 任意 | 任意 | `empty` |
| `stale` | 任意 | 任意 | `stale` |
| `active` | 不可达或 `synchronized=false` | 任意 | `recovering` |
| `active` | 已同步 | 404/不可达 | `recovering` |
| `active` | 已同步 | 200 | `ready` |

`ready` 页面也每 5 秒校准一次；这样用户停留在页面时 Relay 重启会进入
`recovering`。`recovering` 每 2 秒校准，恢复后回到 `ready`。页面隐藏时暂停轮询。

## 4. 服务端模块边界

新增深模块 `web/src/lib/pairing/lifecycle.ts`，拥有完整生命周期语义；Server
Actions 和页面只能使用它，不直接拼 Relay 请求或写 `pairings` 表。

公开接口：

```ts
readUserPairing(userId): PairingView
createUserPairing(userId): Promise<PairingView>
revokeUserPairing(userId, expectedVersion): Promise<PairingView>
rotateUserPairing(userId, expectedVersion): Promise<PairingView>
refreshUserPairing(userId): Promise<PairingView>
reconcilePairingsNow(): Promise<void>
```

内部适配器集中负责：

- Relay 创建、存在性查询与撤销；
- 创建响应的 roomId/revoke token 长度与 canonical join URL 校验；
- revoke token AES-256-GCM 加解密；
- SQLite 事务、唯一索引冲突识别和补偿清理；
- P2 完整 projection 的即时重放。

错误只向 UI 暴露稳定类别：

```text
RELAY_UNAVAILABLE
RELAY_CAPACITY
PAIRING_CREATE_FAILED
PAIRING_REVOKE_FAILED
PAIRING_CHANGED
PAIRING_STALE
```

错误、Action 返回值和日志均不得含邮箱、userId、pairing id、roomId、join URL、
token、digest、Authorization 或请求体。

## 5. 创建语义

1. 先读账号现有 active；存在则直接返回，不调用 Relay。
2. 使用服务凭证调用 Relay 创建房间。
3. 严格校验响应并加密 revoke token。
4. 插入 active 配对记录。
5. 数据库提交后立即调用 `reconcilePairingsNow()`；失败不回滚持久记录，UI 返回
   `recovering`，周期协调器继续兜底。
6. 插入唯一冲突表示另一请求获胜：立即用刚创建的 revoke token 补偿吊销孤儿，
   然后返回赢家记录。
7. 其它数据库失败同样补偿吊销；补偿失败仍由下一次完整快照删除孤儿。

创建期间 Relay 401/协议错误映射 `PAIRING_CREATE_FAILED`，503 映射
`RELAY_CAPACITY`，网络错误映射 `RELAY_UNAVAILABLE`。失败不得消耗账号唯一名额。

## 6. 吊销语义

1. 用 `userId + expectedVersion + active` 读取目标；版本已变化返回最新视图，不吊销
   新记录。
2. 解密 revoke token，调用 Relay DELETE；204 和 404 都算成功。
3. Relay 网络失败时不修改 active 记录，返回 `PAIRING_REVOKE_FAILED`，避免 UI 声称
   已永久吊销但旧运行时仍可继续使用。
4. Relay 成功后在事务内把目标改为 `revoked` 并写 `revokedAt`。
5. 提交后立即完整协调；即时协调失败不复活记录，周期协调器最终移除运行时房间。
6. stale 记录无需调用 Relay，可直接改为 `revoked`。

成功后返回 `empty`。历史 revoked 行保留，不在 dashboard 展示。

## 7. 轮换语义

轮换不能用“先吊销再创建”，否则创建失败会让用户丢失仍可用的旧 URL。采用：

1. 读取当前 active/stale 记录及 `expectedVersion`；
2. 先向 Relay 创建候选房间；创建失败时旧记录原样保留；
3. 单个 SQLite 事务中：
   - 将仍匹配 `expectedVersion` 的旧记录改为 `revoked`；
   - 插入候选 active 记录；
4. 若版本已变化或唯一索引冲突，事务回滚、吊销候选孤儿并返回当前赢家；
5. 事务提交后吊销旧 Relay 房间，并立即重放完整期望状态；
6. 旧房间直连吊销失败不回滚新身份，完整快照最终移除旧房间。

因此任意时刻数据库中最多一条 active，且候选创建失败不会破坏旧 URL。

## 8. stale 判定

读取 active 记录时验证：

- roomId 必须是无 padding base64url 编码的 16 字节；
- revoke token 密文格式可解析且能用当前 `PAIRING_ENC_KEY` 解密；
- 明文 token 必须是无 padding base64url 编码的 32 字节；
- `joinUrl` 必须精确等于
  `${origin(BETTER_AUTH_URL)}/remote/${roomId}`，不得带 query/hash/userinfo。

失败时用 `id + status='active'` 条件更新为 stale；一个坏账号不得阻塞其它账号。
错误页面不显示损坏字段，只提供“轮换配对 URL”。

全局密钥配置缺失或格式非法是部署错误，不得把全部记录批量写 stale。

## 9. Server Actions

新增 `web/src/app/dashboard/actions.ts`：

```ts
createPairingAction()
revokePairingAction({ version })
rotatePairingAction({ version })
refreshPairingAction()
```

每个 Action：

- 通过 Better Auth 服务端 session 取得 userId；无 session 不执行写操作；
- 不接受 userId、roomId、joinUrl 或 token 作为浏览器输入；
- 返回 `{ ok, pairing?, error? }` 的可序列化安全对象；
- 写成功调用 `revalidatePath('/dashboard')`；
- 依赖 Next Server Actions 的同源校验，不另建匿名 REST CRUD 接口。

`dashboard/page.tsx` 在服务端读取首屏状态，把安全 `PairingView` 交给客户端控制台。

## 10. UI 与交互

Dashboard 使用 HRack Light，不渲染终端背景，包含：

- 顶栏：Brand、`remote` 眉标、账号邮箱、语言选择、退出；管理员可进入 `/admin`；
- 空态：解释一账号一条稳定 URL，主按钮“创建配对 URL”；
- ready：完整等宽 URL、二维码、复制按钮、创建时间、绿色状态；
- recovering：保留同一 URL 与二维码，禁用轮换/吊销的重复提交，显示“正在恢复”；
- stale：不显示可能不兼容的 URL，只显示不可恢复说明和轮换按钮；
- 吊销：二次确认，明确旧 URL 永久失效；成功后空态；
- 轮换：二次确认，明确所有已粘贴旧 URL 永久失效；成功后展示新 URL；
- 操作中按钮禁用并显示进度；失败提示可重试，不清空当前卡片。

二维码使用 `uqr`。SVG 只以 `data:image/svg+xml` 图片源展示，不把 URL 作为 HTML
注入；CSP 继续允许同源与 `img-src data:`。复制优先 Clipboard API，失败时提供可选择
的只读文本框与本地化错误。

全部可见文案进入五份 `web/src/i18n/*` 字典。交互元素有可读 label、明显焦点、
确认对话框可用键盘取消，状态变化通过 `aria-live` 宣告。

## 11. 安全边界

- `/dashboard` 继续由 `proxy.ts` 与服务端 layout 双重校验会话。
- 不新增浏览器可访问的 Relay system 转发；Nginx 继续直接 404。
- Action 输入使用严格对象形状与长度限制；乐观版本最大 128 字符。
- URL 可以显示和复制，但不得进入服务端结构化日志或 Nginx access log。
- revoke token 只在 Relay 创建响应、Web 进程加密/吊销内存中短暂存在。
- 不使用 `dangerouslySetInnerHTML` 渲染二维码或服务端错误。
- 账号 A 的版本值在账号 B 的 Action 中只能得到 B 的当前视图，不能泄露 A 是否存在。

## 12. 测试与真实验收

### 12.1 生命周期集成测试

使用真实临时 SQLite 和真实本地 HTTP Relay fixture，覆盖：

- 首次创建、密文落盘、响应不含 token；
- 已有 active 幂等返回且零创建请求；
- 并发创建只有一个赢家，孤儿被吊销；
- 创建后数据库失败的补偿吊销；
- DELETE 204/404 成功、网络失败保持 active；
- 轮换创建失败保留旧记录；成功时数据库原子切换；并发轮换不连续换两次；
- 写提交后即时完整 reconcile；失败时记录保持且视图为 recovering；
- Relay 未同步、404、网络失败为 recovering，绝不写 stale；
- 密文/roomId/origin 损坏只隔离当前记录；全局坏密钥不批量 stale；
- 用户间完全隔离。

### 12.2 UI 与 Action 测试

- 无 session Action 不调用生命周期服务；
- 只接受安全 version 输入，错误结果不泄密；
- empty/ready/recovering/stale 四态渲染；
- QR 解码回完全相同 URL；复制、确认取消、提交禁用和五语言切换；
- 未登录访问 dashboard 跳 `/auth?next=/dashboard`。

### 12.3 真实浏览器与 Docker 门禁

1. 注册或创建真实测试账号并登录；
2. 空态创建，检查 URL、二维码和数据库归属；
3. 用真实 WebSocket 完成双向配对；
4. 只重启 Relay，页面进入 recovering 后在 15 秒内恢复，URL/QR 不变；
5. 轮换后旧 URL `bad-key`、新 URL可配对；
6. 吊销后二次确认回空态，旧 URL 永久失效；
7. 再创建得到不同 URL；
8. 整套重启后新 URL 仍恢复；
9. 临时账号与配对记录清理完成。

门禁命令：

```text
npm test
npm run typecheck
npm run build
npm run e2e
npm --prefix relay run verify:durable-recovery
```

## 13. 实施切片

1. **P3.1 生命周期服务**：严格 Relay client、创建/吊销/轮换、并发补偿、即时协调。
2. **P3.2 Actions 与首屏**：session 边界、安全 view model、四态服务端读取。
3. **P3.3 控制台 UI**：Shell、二维码、复制、确认、五语言和响应式布局。
4. **P3.4 状态刷新**：ready/recovering 轮询、stale 轮换、操作错误恢复。
5. **P3.5 真实主链路**：浏览器 CRUD、QR 解码、旧 URL 失效、重启同 URL、文档收口。

每个切片独立提交并保持全仓测试、类型检查和构建通过。
