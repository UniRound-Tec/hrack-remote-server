# HRack 配对平台 P5 正式发布检查清单

> 对应规格：[P5 正式生产发布与运营关门](./PAIRING-P5-PRODUCTION-RELEASE-SPEC.md)
> 目标部署：`https://hrack.modplex.app`
> 状态：执行中

清单只记录结果、时间、耗时、commit/digest 和备份校验和。禁止填写邮箱全文、验证码、
密码、Cookie、Authorization、Resend key、配对 URL、roomId、revoke token 或终端内容。

## A. 代码与部署基线

- [x] Server 子仓库工作树干净，部署 commit 已记录
- [x] `typecheck`、测试、构建通过
- [x] P4 隔离式真实 Docker 门禁通过
- [x] 生产 Compose 配置解析通过，四枚长期密钥未改变
- [x] 数据库迁移前备份已完成

## B. 域名、TLS 与公网边界

- [x] DNS 指向预期生产主机
- [x] TLS 链受信任、域名匹配、剩余有效期 ≥ 14 天
- [x] HTTP 自动跳转 HTTPS
- [x] 首页和 `/remote/healthz` 为 200
- [x] 匿名创建为 401
- [x] system API 与 demo 为 404
- [x] WebSocket 通过 WSS Upgrade
- [x] `verify:p5-release` 真实公网探测通过

## C. Resend、注册、登录与管理员

- [x] 发件地址属于已验证 `modplex.app` 域
- [ ] 后台测试邮件真实送达
- [x] `EMAIL_VERIFICATION_REQUIRED=1`
- [x] 新邮箱注册收到真实 6 位验证码
- [x] 未验证账号不能进入 dashboard
- [x] 验证后可以登录 dashboard
- [x] 首位管理员初始化完成且能登录 `/admin`
- [x] `ADMIN_SETUP_TOKEN` 已删除并重建 Web
- [x] `/admin/setup` 已关闭，至少一位有效管理员存在

## D. 手机 ↔ HRack 桌面端公网远控

- [x] 已认证用户创建配对记录
- [x] HRack 桌面端使用该配对 URL 连接
- [ ] 手机从不同公网打开同一配对 URL
- [ ] 手机看到真实桌面 PTY 输出
- [ ] 手机发送普通输入成功
- [ ] 手机发送至少一个控制键成功
- [x] Relay 重启后 15 秒内用同一 URL 重连成功

## E. 备份与恢复

- [x] `backup:create` 生成非空归档和 manifest
- [x] 归档 SHA-256 已记录并复核
- [x] `.env` 长期密钥、TLS 配置和部署版本已在受控位置单独保存
- [x] `backup:rehearse` 在临时演练卷通过 SQLite `integrity_check`
- [ ] 隔离部署验证既有账号与管理员角色
- [ ] 隔离部署验证原配对 URL 未变化且可恢复
- [x] 演练资源已清理，生产卷未被修改

## F. 监控、告警与日志

- [x] Web、Relay、配对协调器均为 healthy
- [x] 生产监控持续运行
- [x] 至少一个独立告警接收端已配置
- [ ] 停止协调器后告警真实送达
- [ ] 恢复协调器后恢复通知真实送达
- [ ] 停止 Relay 后告警真实送达
- [ ] 恢复 Relay 后恢复通知真实送达
- [x] 所有长期容器启用有界日志轮转
- [x] 日志抽查无敏感信息

## G. 发布与回滚关门

- [ ] 生产冒烟和真实业务验收均通过
- [x] 当前部署 commit/镜像 digest 已记录
- [x] 回滚版本、回滚命令和恢复备份已确认
- [ ] 证书续期与告警接收责任人已确认
- [ ] 发布记录已签署

只有 A–G 全部勾选后，才可把平台规格状态改为“P1–P5 已完成”。

## H. 2026-08-23 执行记录

- 正式部署 commit：`51cc6c8dd67714ecfd7bbdeaa5f724ddce7ed5e1`；Web 镜像
  `sha256:8e7ccee99dd7…`，Relay 镜像 `sha256:5d98c669db8e…`。宿主 OpenResty 已将整个
  正式站点切到 `127.0.0.1:8788`；旧 `8787` Relay 暂留作回滚入口。
- 严格生产探测 16 项全绿：受信 TLS、HTTP 跳转、首页/health 200、匿名创建 401、
  system/demo 404、WSS、正式邮件配置、告警接收端、管理员 bootstrap 关闭均通过。
- Resend 正式域配置已启用。真实注册收到验证码；错误旧码被拒绝，新码验证成功；未验证登录
  403，验证后登录、dashboard、`/admin` 均 200。setup token 与 bootstrap email 已删除，
  `/admin/setup` 返回 404；数据库为 1 位已验证管理员。后台测试邮件 API 已由 Resend 接受，
  但收件箱人工确认仍待完成。
- 本机已安装 Android App 与 Electron HRack 通过正式公网 WSS 使用账号长期配对记录完成
  4.1 分钟真实门禁：普通命令、`Esc` 控制键、软键盘 `43×31 → 43×16 → 43×31`、
  横屏 `97×16`、手机端新建终端均通过；有界 PTY 突发约 888 KB。此证据仍不替代实体手机
  从另一公网验收。
- 生产 Relay 干净重启后，健康与账号配对投影在 5.992 秒恢复；同一长期 URL 已由
  Android/Electron 重连门禁验证，未轮换或撤销。
- 最终生产备份 `p5-final-20260823T145453Z` 为 27,159 字节，SHA-256
  `2b9b06b773b36db79ed53656bfa88e6587c6b9e9a133b9991fe0eba423ff3a926`；自动恢复演练
  `integrity_check=ok`、11 张表。隔离只读恢复审计与生产均为 1 位已验证管理员、1 条活动
  配对记录，配对 URL 摘要一致；临时目录已清理。完整隔离服务登录与 WSS 恢复仍待执行。
- 切流后的 `.env`、TLS、反代配置和管理员初始凭据已进入 root-only（0600）受控归档，
  SHA-256 `f9f95389ef99d037bae2b63d28fd7e99b67f5640089e6548b076944ca832774e4`；仍需复制到
  异地主机或外部秘密管理系统。
- 协调器与 Relay 停止/恢复故障均已真实注入；监控进程无重启，Resend 调用被接受，服务
  全部恢复 healthy。告警与恢复邮件是否到达收件箱仍需人工确认。
- 长期容器均使用 `json-file`、`10m × 5` 日志轮转，抽查未发现敏感信息。当前发布关门仅剩
  实体手机异网、邮件收件箱、完整隔离服务恢复、异地秘密副本、责任人确认和发布签署。
