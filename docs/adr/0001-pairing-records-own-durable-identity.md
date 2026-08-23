---
status: accepted
---

# 配对记录拥有持久身份，Relay 房间是可重建投影

账号侧数据库中的配对记录是配对 URL、roomId 与吊销凭证的唯一持久事实；Relay 继续只保存可重建的内存房间。Relay 重启后，协调器把全部有效配对记录重新投影为相同 roomId 的房间，因此重启不会轮换 URL，也不会把记录标记为 stale。

## Considered Options

- 让 Relay 自建持久数据库：会产生第二份配对事实和跨库一致性问题，拒绝。
- Relay 重启后让所有 URL 失效：实现简单，但违反账号持有稳定 URL 的产品语义，拒绝。
- 从账号侧期望状态恢复 Relay：保留单一事实来源和 Relay 的无持久状态，采用。

## Consequences

部署必须包含一个持续运行的配对协调器，并为 Relay 提供幂等、鉴权、原子应用的期望状态接口。Relay 在当前启动实例尚未完成首次同步前必须 fail closed；用户主动轮换、吊销或账号删除才会永久改变有效 URL 集合。
