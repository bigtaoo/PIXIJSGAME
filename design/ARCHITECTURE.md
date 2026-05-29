# 架构文档

**版本：** v1.1
**日期：** 2026年5月

---

## 1. 技术栈

| 项目 | 内容 |
|------|------|
| 渲染引擎 | PixiJS（pixi.js-legacy，兼容低端设备） |
| 语言 | TypeScript |
| 打包工具 | Webpack（Web）/ Rollup（微信） |
| 平台 | Web（CrazyGames）、微信小游戏 |

---

## 2. 目录结构

```
src/
├── assetsManager/        资源加载（Web / 微信双实现）
├── game/                 核心游戏逻辑
│   ├── appContext.ts     全局依赖注入容器
│   ├── consts.ts         常量（GAME_WIDTH=1080, OFFSET_Y=300）
│   ├── screenConfig.ts   屏幕/布局计算（含布局锁定机制）
│   ├── sceneCoordinator.ts  场景切换调度
│   ├── gameScene.ts      游戏场景（主入口）
│   ├── lobbyScene.ts     关卡大厅场景
│   ├── dailyChallengeScene.ts  每日挑战场景
│   ├── grid.ts           格子背景层
│   ├── numbers.ts        数字显示层
│   ├── effectManager.ts  爆炸特效 + 飞行奖励
│   ├── logic.ts          核心游戏逻辑（数字分配与消除）
│   ├── gameState.ts      时间池、暂停、结束状态
│   ├── header.ts         顶部 HUD（等式、计时器、命数）
│   ├── stageConfig.ts    19 关数据配置
│   └── ...
└── inputSystem/          点击/触摸事件分发
```

---

## 3. 场景生命周期

```
App 启动
  └─ SceneCoordinator
       ├─ LobbyScene          关卡大厅（选关、星级展示）
       ├─ GameScene            关卡游戏
       └─ DailyChallengeScene  每日挑战
```

`SceneCoordinator` 监听 `window.resize`，调用当前场景的 `resize(w, h)`。

---

## 4. 屏幕适配机制

### 4.1 逻辑坐标系

采用"短边固定为 1080 逻辑像素"方案：

- **竖屏**：`scale = windowWidth / 1080`，逻辑宽 = 1080，逻辑高 = windowHeight / scale
- **横屏**：`scale = windowHeight / 1080`，逻辑高 = 1080，逻辑宽 = windowWidth / scale

`GameScene` 自身通过 `this.scale.set(screen.scale)` 将逻辑坐标映射到物理像素，无黑边。

### 4.2 ScreenConfig

`ScreenConfig` 是布局计算的核心，所有依赖屏幕尺寸的数值都通过它获取：

| 属性/方法 | 说明 |
|-----------|------|
| `width / height` | 当前逻辑画布尺寸（随 resize 更新） |
| `scale` | 物理像素 / 逻辑像素 |
| `orientation` | Portrait / Landscape |
| `gridCountW / gridCountH` | 格子列数 / 行数（受锁定机制影响） |
| `gridSize` | 单格逻辑像素尺寸（受锁定机制影响） |
| `offsetX / offsetY` | 格子区域的起始偏移（offsetY = OFFSET_Y = 300，固定值） |
| `cellIndex(col, row)` | 编码：`col * 1000 + row` |
| `indexToPos(idx)` | 解码为屏幕坐标 |
| `lockLayout()` | 冻结格子相关计算值（见 4.3） |
| `unlockLayout()` | 解除冻结 |

### 4.3 布局锁定机制（v1.1 新增）

**问题背景：** 游戏运行中切换横竖屏时，`gridCountW/H` 互换（如 3×6 → 6×3），若重新调用 `reconfigure()` 会使格子位置与 `logic` 中的数字 index 映射错位，导致部分格子无数据。

**解决方案：** 在每次 `startCurrentTarget()`（数字分配完成后）调用 `screen.lockLayout()`，冻结以下值：

- `gridCountW / gridCountH`（不随方向切换而互换）
- `gridSize`（格子像素大小）
- `offsetX`（水平居中偏移）
- `lockedLogicalW / lockedLogicalH`（锁定时的完整逻辑画布尺寸）

锁定后，`resize()` 不再调用 `gridLayer.reconfigure()` 和 `numberLayer.reconfigure()`，改为：

1. 正常更新 `screen.width/height/scale/orientation`（背景、Header、Overlay 正常响应）
2. 对 `gameContainer`（包裹 grid + numbers + effects）做等比缩放，使其填满 Header 以下的可用区域

**缩放公式：**

```
availW = screen.width
availH = screen.height - OFFSET_Y
lockedPlayW = lockedLogicalW
lockedPlayH = lockedLogicalH - OFFSET_Y

s = min(availW / lockedPlayW, availH / lockedPlayH)

gameContainer.scale = s
gameContainer.x = (availW - lockedPlayW * s) / 2
gameContainer.y = OFFSET_Y * (1 - s)   // 补偿格子内置的 offsetY 被缩放
```

**坐标变换（飞行奖励）：**

`flyingLayer` 是场景级子节点（不在 `gameContainer` 内），飞行动画的起点需从 `gameContainer` 局部坐标变换到场景坐标：

```typescript
sceneX = gameContainer.x + localX * s
sceneY = gameContainer.y + localY * s
```

终点（时钟中心）由 `header.getClockCenter()` 直接返回场景坐标，无需变换。

**解锁时机：**

- `startCurrentTarget()` 开头先 `unlockLayout()`，确保 `logic.initialize()` 和 `reconfigure()` 使用当前方向的实际格子数
- 重新分配完毕后立刻 `lockLayout()`

---

## 5. 游戏场景内部结构

```
GameScene (PIXI.Container, scale = screen.scale)
├── bg                    背景 Graphics（随 resize 重绘）
├── gameContainer         游戏内容容器（锁定后做等比缩放）
│   ├── gridLayer         Grid — 格子背景精灵
│   ├── numberLayer       NumberLayer — 数字精灵
│   └── effectLayer       EffectManager — 爆炸粒子
├── header                Header — 顶部 HUD
├── effectLayer.flyingLayer  飞行奖励标签（场景级，渲染在 Header 之上）
├── resultOverlay         GameResultOverlay — 通关/失败弹窗
└── settingsOverlay       SettingsOverlay — 暂停菜单
```

---

## 6. 数据流

```
StageConfig（关卡配置）
  → GameScene.loadStage()
    → screen.setGridDims(w, h)
    → startCurrentTarget()
      → screen.unlockLayout()
      → logic.initialize(screen, target)   // 分配数字到 index
      → gridLayer.reconfigure()            // 创建/定位格子精灵
      → numberLayer.reconfigure(logic)     // 渲染数字
      → screen.lockLayout()               // 冻结布局
      → updateGameContainerTransform()     // 应用缩放
```

---

## 7. 跨平台差异

| 能力 | Web | 微信小游戏 |
|------|-----|-----------|
| 资源加载 | `webAssetsManager` | `wechatAssetsManager` |
| 存档 | `localStorage` | `wx.setStorageSync` |
| 平台回调 | `crazygamesIndex.ts` | — |
| 打包 | Webpack | Rollup |

平台差异通过 `AppContext.platform` 注入，游戏核心代码不感知平台。
