# 云函数 P0 变更说明（鉴权/校验/幂等/积分安全）

## 适用函数

- `addTask`
- `updateTaskStatus`
- `buyItem`
- `useItem`

## requestId 幂等

- 四个函数都新增可选入参 `requestId`。
- 当传入同一用户、同一函数、同一 `requestId` 重试时，返回首次成功响应，不重复写入业务数据。
- 若未传 `requestId`，保持原行为，不启用幂等。

## 响应兼容策略

- 旧字段保持不变：
- `addTask` / `updateTaskStatus` 继续返回 `message` 错误字段。
- `buyItem` / `useItem` 继续返回 `error` 错误字段（同时补 `message` 便于统一消费）。
- 成功响应在不破坏旧字段前提下，可额外包含 `requestId` 与 `balanceAfter`。

## 积分变更安全

- 所有本次覆盖到的积分扣减/增加逻辑改为“读取当前余额 -> 计算新余额 -> 校验不小于 0 -> 写回”。
- 扣减不足时直接失败，防止出现负积分。
- 积分流水 `Records` 在相关场景补充 `balanceAfter` 字段，便于前端和审计侧展示变更后余额。

## 共享 helper

新增目录：`cloudfunctions/shared`

- `validation.js`：输入归一化与参数校验
- `authz.js`：鉴权与角色检查
- `idempotency.js`：基于 `requestId` 的事务内幂等包装
- `points.js`：积分变更与非负校验
