# HRack 配对平台 P5 正式发布检查清单

> 对应规格：[P5 正式生产发布与运营关门](./PAIRING-P5-PRODUCTION-RELEASE-SPEC.md)
> 目标部署：`https://hrack.modplex.app`
> 状态：执行中

清单只记录结果、时间、耗时、commit/digest 和备份校验和。禁止填写邮箱全文、验证码、
密码、Cookie、Authorization、Resend key、配对 URL、roomId、revoke token 或终端内容。

## A. 代码与部署基线

- [ ] Server 子仓库工作树干净，部署 commit 已记录
- [ ] `typecheck`、测试、构建通过
- [ ] P4 隔离式真实 Docker 门禁通过
- [ ] 生产 Compose 配置解析通过，四枚长期密钥未改变
- [ ] 数据库迁移前备份已完成

## B. 域名、TLS 与公网边界

- [ ] DNS 指向预期生产主机
- [ ] TLS 链受信任、域名匹配、剩余有效期 ≥ 14 天
- [ ] HTTP 自动跳转 HTTPS
- [ ] 首页和 `/remote/healthz` 为 200
- [ ] 匿名创建为 401
- [ ] system API 与 demo 为 404
- [ ] WebSocket 通过 WSS Upgrade
- [ ] `verify:p5-release` 真实公网探测通过

## C. Resend、注册、登录与管理员

- [ ] 发件地址属于已验证 `modplex.app` 域
- [ ] 后台测试邮件真实送达
- [ ] `EMAIL_VERIFICATION_REQUIRED=1`
- [ ] 新邮箱注册收到真实 6 位验证码
- [ ] 未验证账号不能进入 dashboard
- [ ] 验证后可以登录 dashboard
- [ ] 首位管理员初始化完成且能登录 `/admin`
- [ ] `ADMIN_SETUP_TOKEN` 已删除并重建 Web
- [ ] `/admin/setup` 已关闭，至少一位有效管理员存在

## D. 手机 ↔ HRack 桌面端公网远控

- [ ] 已认证用户创建配对记录
- [ ] HRack 桌面端使用该配对 URL 连接
- [ ] 手机从不同公网打开同一配对 URL
- [ ] 手机看到真实桌面 PTY 输出
- [ ] 手机发送普通输入成功
- [ ] 手机发送至少一个控制键成功
- [ ] Relay 重启后 15 秒内用同一 URL 重连成功

## E. 备份与恢复

- [ ] `backup:create` 生成非空归档和 manifest
- [ ] 归档 SHA-256 已记录并复核
- [ ] `.env` 长期密钥、TLS 配置和部署版本已在受控位置单独保存
- [ ] `backup:rehearse` 在临时演练卷通过 SQLite `integrity_check`
- [ ] 隔离部署验证既有账号与管理员角色
- [ ] 隔离部署验证原配对 URL 未变化且可恢复
- [ ] 演练资源已清理，生产卷未被修改

## F. 监控、告警与日志

- [ ] Web、Relay、配对协调器均为 healthy
- [ ] 生产监控持续运行
- [ ] 至少一个独立告警接收端已配置
- [ ] 停止协调器后告警真实送达
- [ ] 恢复协调器后恢复通知真实送达
- [ ] 停止 Relay 后告警真实送达
- [ ] 恢复 Relay 后恢复通知真实送达
- [ ] 所有长期容器启用有界日志轮转
- [ ] 日志抽查无敏感信息

## G. 发布与回滚关门

- [ ] 生产冒烟和真实业务验收均通过
- [ ] 当前部署 commit/镜像 digest 已记录
- [ ] 回滚版本、回滚命令和恢复备份已确认
- [ ] 证书续期与告警接收责任人已确认
- [ ] 发布记录已签署

只有 A–G 全部勾选后，才可把平台规格状态改为“P1–P5 已完成”。
