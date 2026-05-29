# Post-Launch Roadmap

> 19关通关约40小时，内容量足够支撑上架。以下为上架后的迭代优先级。

---

## Phase 1 — 变现与平台基础（上架后立刻）

### CrazyGames 排行榜接通
- 填写 `ENCRYPTION_KEY`（`dailyChallengeResult.ts` 第17行）
- 将 `saveDailyScore` 之后调用 `crazyGames.saveScore(levelId, score)`
- 结果页显示"今日排名第X"
- **影响：** CrazyGames 平台对接入排行榜的游戏有流量加权

### 微信端激励广告
- WeChat 构建中实现 `AppContext.platform`（目前为 `undefined`）
- 接入 `wx.createRewardedVideoAd`，对应换命逻辑已有，只差平台层
- **影响：** 微信端目前零变现

---

## Phase 2 — 留存（第一个月）

### 无尽模式
- 第19关通关后进入无尽循环，target 继续递增（100、101…）
- 网格固定 6×10，时限略压缩
- 改动范围：`stageConfig.ts` 动态生成 + `sceneCoordinator.ts` 去掉关卡上限判断
- **工作量：** 约1-2天

### 每周挑战
- 复用每日挑战全部架构，种子改为周数
- 特殊棋盘参数（更小时限、更高target起点）
- **工作量：** 约半天

---

## Phase 3 — 社交传播（第一个月底）

### 微信分享图
- 每日挑战结束生成分享图：分数 + streak天数 + 日期
- 调用 `wx.shareAppMessage` 带 imageUrl
- 好友点进来显示"今天你的好友最高X分"
- **工作量：** 约3天（图片生成 + 分享接口）

### 微信好友排行榜
- 使用 `wx.getFriendCloudStorage` 拉取好友每日分数
- 纯客户端实现，无需服务端
- **工作量：** 约2天

### Streak 日历
- 把连续游玩天数可视化为日历格子（类似 GitHub contribution graph）
- 放在每日挑战结果页，可截图分享
- **工作量：** 约1天

---

## Phase 4 — 内容扩展（视数据反馈）

### 特殊规则关卡
候选变体（需要数据支撑再决定做哪个）：
- **步数模式**：限定N步内清空，无倒计时
- **双target**：同时追踪两个目标值
- **障碍格**：部分格子不可消除，需绕路

---

## 技术债（随时可修）

| 项目 | 位置 | 说明 |
|------|------|------|
| `ENCRYPTION_KEY` 为空 | `dailyChallengeResult.ts:17` | 排行榜提分功能目前静默失败 |
| Auth 状态只打 log | `crazygamesIndex.ts:84` | 登录状态未与 UI 联动 |
| Banner 广告未接入 | `crazygamesService.ts` | API 已实现，未在任何场景调用 |
