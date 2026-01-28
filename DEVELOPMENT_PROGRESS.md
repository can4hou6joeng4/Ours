# Ours 小程序开发进度交接文档 (2026-01-29)

## 1. 当前项目状态
项目已完成核心积分生态闭环的开发，功能稳定且 UI 已进行自适应优化。

## 2. 已完成功能模块
- **[积分商城]**：
  - 双列自适应卡片布局。
  - 兑换逻辑：原子化积分扣减，同步写入 `Records` 和 `Items` 集合。
  - 入口优化：顶部积分气泡可跳转至明细。
- **[积分明细]**：
  - 修复了符号显示错误（+- 冲突），统一收支展示逻辑。
  - 适配了现有数据库字段名：`userId`, `amount`, `reason`, `createTime`。
- **[我的背包]**：
  - 新增背包页面 `pages/inventory/index`。
  - 支持物品展示与核销（`unused` -> `used`）。
- **[个人中心]**：
  - 移除冗余入口，新增“我的背包”入口，采用卡片化 UI。

## 3. 技术核心规范 (非常重要)
- **数据库 - Records 集合**：
  - `userId`: String (OpenID)
  - `amount`: Number (分值)
  - `reason`: String (描述)
  - `type`: String ('income' | 'outcome')
  - `createTime`: Date (服务器时间)
- **数据库 - Items 集合**：
  - `userId`: String (OpenID)
  - `name`: String (物品名)
  - `status`: String ('unused' | 'used')
  - `createTime`: Date
  - `useTime`: Date (核销时间)

## 4. 迁移后动作清单
1. **安装依赖**：在新设备执行 `npm install` (已安装 `dayjs`)。
2. **部署云函数**：需全量上传并部署以下 4 个云函数：
   - `buyItem`, `getRecords`, `getItems`, `useItem`。
3. **环境对齐**：确保微信开发者工具登录的是同一个云开发环境。
4. **编译项目**：执行编译以更新 `app.config.ts` 中的页面注册。

---
*本交接文档由 Claude 生成，旨在辅助跨设备任务延续。*
