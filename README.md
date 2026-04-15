# Ours - 情侣任务积分小程序

一款为情侣 / 搭档设计的双人任务积分管理微信小程序。通过发布任务、完成挑战、积攒积分、兑换礼物的闭环玩法，为两人关系注入趣味与仪式感。

## 功能特性

**任务系统**
- 双人任务发布与分配（奖赏 / 惩罚两类）
- 任务状态流转：待处理 → 待验收 → 已完成
- 实时数据库监听，对方操作即时推送
- 完成动效（撒花 Confetti）与通知弹窗

**积分商城**
- 自定义礼物上架（名称、积分、封面、描述）
- 积分兑换与余额实时结算
- 瀑布流商品展示

**背包系统**
- 已兑换物品管理
- 物品使用与状态追踪
- 兑换历史记录查询（支持筛选）

**社交绑定**
- 邀请码绑定另一半
- 分享小程序卡片邀请
- 绑定状态全局感知

## 技术栈

| 层面 | 技术 |
|------|------|
| 跨端框架 | [Taro](https://taro.zone/) 4.1 |
| 前端框架 | React 18 + TypeScript |
| 组件库 | [Taroify](https://taroify.github.io/taroify.com/) |
| 状态管理 | [Zustand](https://github.com/pmndrs/zustand) |
| 后端服务 | 微信云开发（云函数 + 云数据库 + 云存储） |
| 样式方案 | SCSS |
| 构建工具 | Webpack 5 |

## 项目结构

```
├── src/
│   ├── pages/              # 页面（7 个）
│   │   ├── index/          # 任务主页
│   │   ├── store/          # 积分商城
│   │   ├── inventory/      # 背包
│   │   ├── me/             # 个人中心
│   │   ├── history/        # 积分明细
│   │   ├── gift-edit/      # 礼物编辑
│   │   └── exchange-history/ # 兑换历史
│   ├── components/         # 公共组件（17 个）
│   ├── hooks/              # 自定义 Hooks
│   ├── services/           # API 服务层（云函数调用封装）
│   ├── store/              # Zustand 全局状态
│   ├── types/              # TypeScript 类型定义
│   ├── styles/             # 全局样式
│   └── utils/              # 工具函数
├── cloudfunctions/         # 微信云函数（17 个）
│   ├── addTask/            # 发布任务
│   ├── updateTaskStatus/   # 更新任务状态
│   ├── revokeTask/         # 撤销任务
│   ├── getRecords/         # 获取积分记录
│   ├── buyItem/            # 兑换物品
│   ├── useItem/            # 使用物品
│   ├── getGifts/           # 获取礼物列表
│   ├── getItems/           # 获取背包物品
│   ├── manageGift/         # 礼物管理（增删改）
│   ├── getExchangeHistory/ # 兑换历史
│   ├── initUser/           # 用户初始化
│   ├── getUserInfo/        # 获取用户信息
│   ├── updateUserProfile/  # 更新用户资料
│   ├── syncBinding/        # 绑定同步
│   └── shared/             # 共享工具模块
└── config/                 # Taro 构建配置
```

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 16
- [pnpm](https://pnpm.io/) >= 8
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)

### 安装依赖

```bash
pnpm install
```

### 本地开发

```bash
# 启动微信小程序开发模式
pnpm dev:weapp
```

启动后在微信开发者工具中导入项目根目录，即可预览。

### 构建发布

```bash
pnpm build:weapp
```

构建产物输出至 `dist/` 目录。

### 云函数部署

在微信开发者工具中，右键 `cloudfunctions/` 下各云函数目录，选择「上传并部署：云端安装依赖」。

## 云开发配置

项目使用微信云开发作为后端服务，需要：

1. 在[微信公众平台](https://mp.weixin.qq.com/)创建小程序并开通云开发
2. 复制 `.env.example` 为 `.env.local`，填入你的云开发环境 ID
3. 在云开发控制台创建以下数据集合：`users`、`tasks`、`gifts`、`items`、`records`、`notices`

## 许可证

本项目采用 [MIT](LICENSE) 许可证。
