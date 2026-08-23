# HRack 配对URL平台 · 规格说明书(Spec)v1

> 范围:单仓库双工作区 —— `relay/`(中继) 与 `web/`(平台站,Next.js)。
> 本文档是平台级唯一规格来源；状态：v1 的 P1–P4 已实现并通过真实验收（2026-08-23）。P2/P3/P4 可执行细则分别见对应独立规格。

---

## 1. 概述

为 HRack 远程控制功能引入账号体系:用户在 Web 平台(Next.js)注册登录后,可以创建**自己的配对URL**,用它把 HRack 桌面端与手机端配对。每个用户**同时只能持有一条**配对URL,可随时删除重建。

中继服务器(`relay/`)保持业务无关:新增服务凭证、系统状态与期望房间同步接口,但不保存账号数据或持久数据库。账号侧配对记录是持久事实,Relay 房间是可自动恢复的内存投影。

### 1.1 目标

- 落地页 + 注册/登录(邮箱密码、GitHub OAuth、Google OAuth)
- 注册需邮箱验证;OAuth 注册视为已验证
- 配对URL 的创建/查看/删除/失效重建,每用户同时仅一条 active
- 匿名建房接口封死(仅服务凭证可调)
- 配对URL 随账号持久化;Relay 或整套服务重启后自动恢复同一个 URL
- 保持中继现有安全属性:零敏感日志、单副本、可重建的内存态房间

### 1.2 非目标(v1 明确不做)

- 多条配对URL、组织/团队共享
- 配对URL 自定义别名、有效期、访问统计
- 忘记密码(后续版本;v1 丢失密码走人工)
- 中继水平扩展(维持单副本铁律)

> 修订:落地页 i18n(zh-CN/zh-TW/en/ja/ko)已随 P1 落地,不再列为非目标;
> 视觉基线定为 HRack Light(用户决策,落地页先行)。

## 2. 术语

| 术语 | 含义 |
|---|---|
| **配对URL(Pairing URL)** | 产品层概念,即一次配对的 joinUrl。用户可见、可管理的唯一对象 |
| room / roomId | 协议层概念。上游 vendored 协议与既有 HTTP 路径保持原名,**不改名** |
| 服务凭证 | Web 后端调用中继所用的 Bearer Token(`RELAY_SERVICE_TOKEN`) |
| active / revoked / stale | 配对URL 状态:有效 / 已永久吊销 / 持久凭证损坏或部署不兼容而无法自动恢复;Relay 重启不属于 stale |

## 3. 决策记录

| # | 决策 | 结论 |
|---|---|---|
| D1 | 桌面端匿名建房兼容性 | 生产桌面端无此业务,接口仅为早期调试便利 → **无兼容包袱,第一天封死** |
| D2 | 登录方式 | 邮箱密码 + GitHub/Google OAuth |
| D3 | 邮箱验证 | 需要;OAuth 注册跳过 |
| D4 | 数据库 | SQLite + Drizzle ORM |
| D5 | 中继内置生成页 | 仅 `ENABLE_DEV_CREATE=1` 的非 production loopback 环境提供;生产根页和 demo 均隐藏 |
| D6 | 认证库 | Better Auth(Auth.js v5 长期 beta 不采用) |
| D7 | 框架版本 | Next.js 16(App Router;注意 `proxy.ts` 更名、异步 request APIs) |
| D8 | 重启后的 URL | 账号数据库持久保存配对身份;协调器把有效记录恢复为相同 roomId 的 Relay 房间,不轮换 URL |

## 4. 总体架构

```
                      ┌────────────────────────────────────────────┐
 浏览器 ──► Nginx(TLS)┼─ /            →  Next.js 16 (web/)  │
                      │     落地页 · 登录注册 · 控制台 · (未来 /docs)│
                      └─ /remote/{roomId} → 中继 (relay/)  │
                            协议转发 · 服务凭证保护 · 可恢复内存房间
                                                              ▲
 HRack 手机端 ── 打开/扫码配对URL入会(现有流程,不变)          │
 HRack 桌面端 ── 粘贴配对URL完成配对(现有流程,不变)───────────┘

 账号SQLite ──► pairing-reconciler ──► Relay期望房间集合
```

- 生产:Nginx 分流,`/` 归 Next.js;精确 `/remote` 与 `/remote/` 转 `/dashboard`;`/remote/{roomId}`、`/remote/v1/ws` 归中继;`/remote/v1/system/*` 与 demo 不对公网开放。
- 开发:`next dev :3000` 对外;中继跑 `:3001`;Next `rewrites` 把 `/remote/*` 代理到中继(Next 16 rewrites 支持外部目标与 WebSocket 升级,P1 需冒烟验证)。

## 5. 用户旅程

1. 访问 `/` 落地页 → 点击"注册"
2. 邮箱+密码注册,或 GitHub/Google 一键授权
3. 邮箱密码注册后进入"查收验证邮件"页;点击邮件链接完成验证(**验证前无法登录**)
4. 登录进入 `/dashboard`
5. 点击"创建配对URL" → 获得 URL + 二维码,可复制
6. 把 URL 粘贴进 HRack 桌面端(或手机端扫码)完成配对
7. 随时可"删除配对URL";删除后可再创建新的
8. Relay 重启时 dashboard 可短暂显示"正在恢复";协调器自动拉起原 roomId,URL 不变

## 6. 功能需求

### FR-1 落地页 `/`
产品介绍 + 登录/注册入口。视觉沿用 HRack Light 配色与 Maple Mono 字体;五语言(zh-CN/zh-TW/en/ja/ko)即时切换,文案集中于 `web/src/i18n/`。

### FR-2 注册 `/register`
- 邮箱 + 密码(最小长度 8);注册即发送验证邮件
- 提供 GitHub / Google OAuth 按钮
- 同邮箱策略:受信提供商(GitHub/Google)可与同邮箱的既有账号自动关联(Better Auth `accountLinking`,实现时按其配置项落地)

### FR-3 邮箱验证
- 验证链接有效期 24 小时,可重发(每账号每小时最多 3 次)
- **未验证账号禁止登录**(Better Auth `emailVerification.requireEmailVerification`),登录接口返回明确错误码,前端引导去重发
- OAuth 注册的账号直接标记已验证

### FR-4 登录 `/login`
- 邮箱密码 + GitHub/Google 两个 OAuth 按钮;登录建立 HTTPOnly Cookie 会话

### FR-5 控制台 `/dashboard`(登录可见)
- 展示当前配对URL:完整 URL、二维码(uqr 渲染)、复制按钮、创建时间
- 空态:显示"创建配对URL"按钮
- 删除按钮(二次确认);删除成功后回到空态
- 恢复中(recovering)态:Relay 暂不可达或尚未同步时显示"正在恢复",不修改持久状态、不要求重新生成
- stale 仅用于凭证无法解密或 origin/base 不兼容等不可自动恢复错误,提供显式轮换
- 未验证不可达(被 FR-3 拦在登录前)

### FR-6 每用户一条约束
- 数据层:`partial UNIQUE INDEX (user_id) WHERE status='active'` 兜底
- 应用层:创建前检查;并发双击由唯一索引兜底,冲突时返回既有 active 配对而非报错

### FR-7 匿名建房封死
- 中继 `POST /v1/rooms` 必须携带有效服务凭证,否则 401
- 仅当环境变量 `ENABLE_DEV_CREATE=1` 时放行匿名(本地调试用),生产严禁开启

## 7. 系统设计

### 7.1 Web 应用(`web/`)

| 项 | 选择 |
|---|---|
| 框架 | Next.js 16.2.x,App Router,TypeScript |
| 样式 | Tailwind CSS v4;主题色/字体对齐 HRack Dark + Maple Mono |
| 认证 | Better Auth(email/password + GitHub/Google + 邮箱验证) |
| ORM/DB | Drizzle + SQLite(文件:`data/app.db`,容器内挂卷) |
| 二维码 | uqr |
| 邮件 | 抽象 Provider:`resend`(API)或 `smtp`;开发环境未配置时把验证链接打印到服务端控制台 |

**路由结构**

```
app/
  page.tsx                # 落地页
  login/page.tsx
  register/page.tsx
  register/check-email/page.tsx
  dashboard/page.tsx      # proxy.ts 保护
  api/auth/[...all]/route.ts   # Better Auth handler
proxy.ts                  # matcher: /dashboard → 未登录 302 /login
```

**数据模型(Drizzle)**

```sql
-- Better Auth 自管四张表:user / session / account / verification
-- (user 含 email_verified 字段;account 承载 OAuth 绑定,一用户多提供商)

CREATE TABLE pairings (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES "user"(id),
  room_id          TEXT NOT NULL,
  join_url         TEXT NOT NULL,        -- 稳定快照(PUBLIC_ORIGIN+BASE_PATH+roomId);普通服务重启不得改写
  revoke_token_enc TEXT NOT NULL,        -- AES-256-GCM,密钥 PAIRING_ENC_KEY
  status           TEXT NOT NULL DEFAULT 'active',  -- active|revoked|stale
  created_at       INTEGER NOT NULL,
  revoked_at       INTEGER
);
CREATE UNIQUE INDEX one_active_per_user
  ON pairings(user_id) WHERE status = 'active';
```

**Server Actions(Web 内部)**

| Action | 行为 |
|---|---|
| `createPairing` | 校验登录 → 无 active 配对 → 调中继 create → 加密存 revokeToken → 返回;唯一索引冲突则返回既有配对 |
| `deletePairing` | 调中继 DELETE(bearer=revokeToken)→ **404 视为成功**(中继可能已重启)→ 标记 revoked |
| `regeneratePairing` | deletePairing + createPairing 的原子封装 |
| `refreshPairingStatus` | 读取 Relay 同步状态;暂不可达返回 recovering,不得因重启写 stale |

### 7.2 中继改动(`relay/`)

| 项 | 规格 |
|---|---|
| 服务凭证 | 环境变量 `RELAY_SERVICE_TOKEN`(≥32 字节随机);`Authorization: Bearer <token>` 常量时间比较;**绝不写入日志** |
| 创建保护 | `POST {base}/v1/rooms`:无有效凭证 → 401;`ENABLE_DEV_CREATE=1` 时豁免(调试);带凭证的请求**不受** `CREATE_RATE_*` IP 限流约束(限流责任移至 Web 层) |
| 探活端点(新增) | `GET {base}/v1/rooms/{roomId}` + 服务凭证 → 200 `{ "exists": true }` / 404;`exists` 语义 = 房间为 `open`(可加入),revoked/不存在一律 404 —— 直接复用 `roomAvailability()` 判定;仅报告存在性,不泄露其它信息 |
| 删除 | 现有 `DELETE {base}/v1/rooms/{roomId}`(bearer=revokeToken)**零改动**;注意 404 双语义(房间不存在 / token 错误均返回 404),Web 侧一律视为删除成功 —— 假设 revokeToken 来自创建响应且加密落盘,错误 token 概率可忽略 |
| 生成页 | 仅 `ENABLE_DEV_CREATE=1` 的非 production loopback 环境提供;生产根页和 demo 返回 404,Nginx 根入口转 `/dashboard` |
| 自动恢复 | Relay 每次启动生成 `instanceId`,首次应用账号侧完整期望快照前 fail closed;协调器在 15 秒内恢复相同 roomId |
| 持久边界 | Relay 不挂持久卷;只接收 roomId + revoke digest,账号侧 SQLite 是唯一事实来源 |
| 日志纪律 | 不变:不记录 token、joinUrl、roomId、IP 之外的任何身份信息;Web 侧同样禁止记录邮箱明文到访问日志(Nginx 对 `/api/auth/*`、`/dashboard` 关闭 access_log) |

### 7.3 Web ↔ 中继服务契约

| 调用 | 请求 | 成功 | 失败 |
|---|---|---|---|
| 创建 | `POST /remote/v1/rooms`,Bearer 服务凭证 | 201 `{roomId, joinUrl, revokeToken}` | 401 凭证错 / 503 房间满 / 429(仅 `ENABLE_DEV_CREATE=1` 时匿名请求可能触发限流) |
| 探活 | `GET /remote/v1/rooms/{roomId}`,Bearer 服务凭证 | 200 `{exists:true}` | 404 不存在 |
| 删除 | `DELETE /remote/v1/rooms/{roomId}`,Bearer revokeToken | 204 | 404(容错为成功) |
| 系统状态 | `GET /remote/v1/system/state`,Bearer 服务凭证 | `{instanceId,synchronized,appliedRevision}` | 401 凭证错 |
| 期望状态 | `PUT /remote/v1/system/rooms`,Bearer 服务凭证 | 原子应用完整 active 集合 | 409 旧 revision/凭证冲突;503 超容量 |

## 8. 安全与非功能需求

- 密码哈希:Better Auth 内置(scrypt 默认;如需 argon2 在实现期配置,不影响规格)
- 会话:HTTPOnly + Secure + SameSite=Lax Cookie
- 限流(Web 层):注册/登录每 IP 10 次/分钟(Better Auth 内置 rateLimit 插件);重发验证每账号 3 次/小时;配对创建每用户天然 ≤1 条
- 加密:revokeToken 落盘 AES-256-GCM;`PAIRING_ENC_KEY` 为 32 字节 base64 环境变量
- CSP:沿用严格白名单风格(`script-src 'self'` 等);OAuth 跳转不受影响
- 部署:中继容器维持 read-only 加固不变;Web 容器需挂载 SQLite 卷;整体仍单副本
- 备份:SQLite 单文件,备份即拷贝(配合 `VACUUM INTO` 或 litestream,后续可选)

## 9. 环境变量清单

**Web(`web/`)**

| 变量 | 说明 |
|---|---|
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | 会话签名 / 对外地址 |
| `GITHUB_CLIENT_ID/SECRET`、`GOOGLE_CLIENT_ID/SECRET` | OAuth |
| `MAIL_PROVIDER=resend\|smtp` + 对应凭证 | 邮件发送 |
| `PAIRING_ENC_KEY` | revokeToken 加密密钥 |
| `RELAY_SERVICE_TOKEN` | 调中继凭证(与中继侧同值) |
| `RELAY_INTERNAL_ORIGIN` | 如 `http://127.0.0.1:3001` |

**中继(`relay/` 新增)**

| 变量 | 说明 |
|---|---|
| `RELAY_SERVICE_TOKEN` | 服务凭证;未设置且未开调试开关时,创建一律 401 |
| `ENABLE_DEV_CREATE` | `=1` 放行匿名创建(仅本地调试) |

**协调器(`pairing-reconciler` 新增)**

| 变量 | 说明 |
|---|---|
| `RELAY_INTERNAL_ORIGIN` | 内部 Relay 地址,如 `http://relay:3000` |
| `RELAY_SERVICE_TOKEN` | 与 Relay 一致的系统接口凭证 |
| `PAIRING_ENC_KEY` | 解密 revoke token 并生成恢复摘要 |
| `PAIRING_RECONCILE_INTERVAL_MS` | 完整校准周期,默认 5000 ms |

## 10. 边界情况

| 场景 | 行为 |
|---|---|
| 并发双击创建 | 唯一索引兜底,返回既有 active 配对 |
| 删除时中继已重启(404) | 视为删除成功,标记 revoked |
| Relay 重启或暂不可达 | 保持 active,展示 recovering;协调器自动恢复同一 URL |
| 账号封禁/解封 | 从期望集合移除/重新加入;解封恢复同一 URL |
| revoke token 无法解密 | 标记 stale,不阻塞其它账号恢复,要求显式轮换 |
| OAuth 邮箱与本地账号同邮箱 | 受信提供商自动关联同一账号 |
| 验证邮件链接过期 | 登录报错引导重发;旧链接作废 |
| 中继 503(房间满) | 前端提示稍后再试;不消耗用户的唯一名额 |

## 11. 测试计划

- **中继黑盒(Vitest)**:无凭证 401 / 有凭证 201;`ENABLE_DEV_CREATE=1` 仅本地回归;原子 reconcile、revision 乱序、首次同步 fail closed;凭证与房间身份不出日志
- **Web 单测(Vitest)**:加密工具、配对状态机、唯一约束、projection revision、有效账号快照
- **恢复集成测试**:真实账号记录→真实 WebSocket 配对→仅重启 Relay→15 秒内用完全相同 URL 再次配对
- **E2E(Playwright)**:注册→登录→创建→展示二维码→删除→轮换;恢复中不生成新 URL;未登录访问 /dashboard 被 302
- **开发冒烟**:`next dev` 与 `next start` 各验证一次 `/remote/*` rewrites 的 WebSocket 升级路径(`/remote/v1/ws`)
- **既有门禁不回退**:`npm run typecheck`、`npm test`、`npm run e2e`、`verify:live` 全绿

## 12. 实施阶段与验收

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| **P1** | `web/` 脚手架;落地页;注册/登录/邮箱验证;GitHub/Google OAuth | 全部认证流走通(开发环境验证链接打印到控制台);`/dashboard` 空壳受 proxy 保护 |
| **P2** | 服务凭证 + 调试开关 + 原子期望状态接口 + projection revision + 自动协调器 | 匿名创建 401;生产无生成根页;Relay 重启后 15 秒内恢复相同 URL;详见 P2 独立规格 |
| **P3** | dashboard 完整 CRUD + 二维码 + recovering/轮换交互 | E2E 主链路全绿;恢复过程不生成新 URL |
| **P4** | Nginx 示例更新、Compose 隔离门禁、部署/备份/恢复文档；详见 [P4 独立规格](./PAIRING-P4-DEPLOYMENT-SPEC.md) | `verify:p4-deployment` 从零部署通过；同 URL 重启恢复 |

## 13. 未来扩展(非 v1)

- `/docs` 文档区:App Router 直接加路由;需要文档站体验时套 Fumadocs/Nextra(MDX)
- 更多 OAuth:Better Auth 内置数十家;国内提供商走 `genericOAuth` 插件
- 忘记密码、邮箱改绑、会话管理页
- litestream SQLite 异地备份
