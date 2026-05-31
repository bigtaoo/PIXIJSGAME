# 架构文档

**版本：** v1.4
**日期：** 2026年5月

---

## 1. 技术栈

| 项目 | 内容 |
|------|------|
| 渲染引擎 | PixiJS（pixi.js-legacy，兼容低端设备） |
| 语言 | TypeScript |
| 打包工具 | Webpack（Web / Mobile）/ Rollup（微信） |
| 平台 | Web（CrazyGames）、微信小游戏、iOS / Android（Capacitor） |

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

横竖屏切换由各入口负责监听并转发：

- **Web / CrazyGames**（`index.ts` / `crazygamesIndex.ts`）：`window.addEventListener('resize', ...)` → `coordinator.resize(window.innerWidth, window.innerHeight)`
- **微信小游戏**（`wechatIndex.ts`）：`wx.onWindowResize(res => coordinator.resize(res.windowWidth, res.windowHeight))`

`SceneCoordinator.resize(w, h)` 再调用当前活跃场景的 `resize(w, h)`。

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
| `gridSize` | 单格逻辑像素尺寸；以 header bar 宽度而非全画布宽度为约束（受锁定机制影响） |
| `offsetX / offsetY` | 格子区域起始偏移；offsetX 从 header bar 左边界居中，offsetY = OFFSET_Y = 300 固定值 |
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

## 7. 已修复的关键 Bug（v1.2 / v1.3）

### 7.1 数字 alpha 残留（numbers.ts）

**现象：** 提示闪烁动画运行期间发生关卡重试，旧动画继续作用于新格子的 Sprite，导致数字 alpha 卡在低值（视觉上变暗）。

**修复：**
- `NumberLayer.reconfigure()` 开头清空 `hintAnimations`，并将所有 Sprite 的 `alpha` 重置为 1。
- `layoutOneDigit()` / `layoutTwoDigits()` 中显式设置 `s.alpha = 1`，防止其他路径复用带低 alpha 的 Sprite。

### 7.2 爱心动画后尺寸异常（header.ts）

**现象：** 失去生命时爱心弹出动画结束后，两颗爱心变得异常巨大。

**原因：** 动画通过 `scale.set(factor)` 控制缩放，结束时 `scale.set(1)` 将 Sprite 的 scale 还原为 (1,1)，相当于按原始纹理像素尺寸渲染，远大于布局设定的 `heartSize`。

**修复：** `heartAnims` 中额外记录 `baseScaleX / baseScaleY`（动画开始时的实际布局 scale），所有 scale 操作均相对于基准值进行，动画结束后恢复到 `baseScaleX / baseScaleY`。

### 7.3 结算弹窗位置错误（gameResult.ts + gameScene.ts）

**现象：** 胜利时结算弹窗偏移到屏幕角落，失败时正常。

**原因：**
1. `portraitLayout()` 硬编码 `panelY = 710`，仅对逻辑高度 1920 的屏幕居中。
2. `buildScene()` 中创建 `resultOverlay` 后未调用 `resize()`，`_lastLayout` 停留在构造函数默认值，直到下次外部 resize 才更新。失败路径恰好在此之后，胜利路径可能先发生。

**修复：**
- `portraitLayout(screenH)` / `landscapeLayout(screenW, screenH)` 改为动态计算 `panelY = (screenH - panelH) / 2`，始终垂直居中。
- `buildScene()` 末尾补调 `resultOverlay.resize(screen)` 和 `settingsOverlay.resize(screen)`。

### 7.4 新增格子选中高亮被遮挡（grid.ts）

**现象：** 关卡扩大格子数（如从 4×7 升到 5×8）后，新增的行/列点击无选中高亮效果。

**原因：** `selectionHighlight` Sprite 在首次 `showSelection()` 时加入显示列表。后续 `reconfigure()` 再向同一容器 `addChild` 新格子 Sprite，这些 Sprite 渲染层级高于 `selectionHighlight`，将高亮遮盖。

**修复：** `showSelection()` 中若高亮已存在，调用 `setChildIndex(selectionHighlight, children.length - 1)` 将其置顶。

### 7.5 格子与 Header 对齐（screenConfig.ts + consts.ts）

**现象：** 宽屏设备上格子水平范围与 Header 不一致，整体偏右。

**原因：** `gridSize` 以全画布宽度（1080）为约束，`offsetX` 在全画布居中。Header bar 实际宽度 portrait=1020（x=30起）、landscape=1350（x=350起），与全画布不等宽，导致格子边界超出或不对齐 Header。

**修复：**
- `consts.ts` 新增 `HEADER_X_PORTRAIT=30`、`HEADER_BAR_W_PORTRAIT=1020`、`HEADER_X_LANDSCAPE=350`、`HEADER_BAR_W_LANDSCAPE=1350`。
- `ScreenConfig.gridSize`：宽度约束改为对应方向的 header bar 宽度。
- `ScreenConfig.offsetX`：从 header bar 左边界（`HEADER_X_*`）开始居中，格子左右边界与 Header 对齐。

### 7.6 时间耗尽不重置棋盘（gameScene.ts）

**旧行为：** 时间归零扣命 → 调 `retryStage()` 从第一个 target 重新开始，所有已消除的格子复原。

**新行为：** 时间归零扣命 → 清除当前选中 → 补 30s → **继续当前棋盘原状**。仅当 lives=0 且不看广告时才真正 game over + 重置。`tryExtraLife()` 中同理（不再调 `retryStage`）。

### 7.7 通关点击大厅后进度未记录（sceneCoordinator.ts + gameScene.ts）

**原因 A（async 竞态）：** `showGame()` 等广告 `await` 期间玩家点大厅，await 结束后 `showGame()` 继续覆盖大厅场景。修复：用 `navGeneration` 计数器；`showLobby()`/`showDailyChallenge()` 递增，await 后检测不一致则提前 return。

**原因 B（防御性）：** `GameScene.persistWinIfComplete()` 在 `showLobby()` 调用，确保 `isGameEnd && allTargetsCleared` 时二次写入星级和 maxCompleted（幂等）。

### 7.8 每日挑战格子与 Header 不对齐（dailyChallengeHeader.ts + screenConfig.ts）

**原因：** DC Header bar 为 `barX=20, barW=1040`，但 `ScreenConfig` 使用游戏关卡 Header 的常量（`barX=30, barW=1020`），导致格子整体偏移。

**修复：** `ScreenConfig.setGridBounds()` 方法允许各场景传入自己的 header bar 边界；`dailyChallengeHeader.ts` 导出 `DC_HEADER_X_*` / `DC_HEADER_BAR_W_*` 常量；`DailyChallengeScene.applyGridDims()` 调用 `setGridBounds()`。

### 7.9 每日挑战结算弹窗位置错误（dailyChallengeScene.ts）

**同 7.3**：`buildScene()` 创建 `resultOverlay` 后未调 `resize(screen)`，首次显示时用硬编码默认坐标。修复：`buildScene()` 末尾补调 `resultOverlay.resize(this.screen)`。

### 7.10 每日挑战 Header UI 重构（dailyChallengeHeader.ts）

**变更：** 从"顶角小图标 + 独立内容行"改为全元素同行对齐。

**新布局（主内容行，y=150 上下居中）：**
`公式` | `闹钟 + 倒计时` | `奖杯 + 分数(左对齐)` | `音乐按钮 + 排行榜按钮`

- 音乐 / 排行榜按钮移入内容行右端（与公式、时钟同高），portrait/landscape 均 78px（原 52px × 1.5）
- 奖杯：portrait 82px（55 × 1.5）右移 20px；landscape 90px（60 × 1.5）右移 20px
- 分数由居中改为**左对齐**，`scoreX` = 奖杯右边界 + 8px，避免有限空间下居中时压入奖杯区域
- `getScoreCenterPos()` 返回 `scoreX + totalWidth / 2`（飞分动画终点）
- 接口字段 `scoreCenterX` 已重命名为 `scoreX`

### 7.12 重试按钮箭头方向错误（graphicsFactory.ts）

**现象：** retry 图标的三角形尖端在弧线末端，应为底边在末端。

**修复：** `drawRetryIcon()` 中将基边中心放在弧线端点 `(ax, ay)`，尖端沿切线方向延伸 `ah` 距离，并将基边整体向弧线内退 3px 以覆盖弧线末端，接缝更自然。

---

## 8. 跨平台差异

| 能力 | Web / Mobile | 微信小游戏 |
|------|-------------|-----------|
| 资源加载 | `webAssetsManager` | `wechatAssetsManager` |
| 存档 | `localStorage` | `wx.setStorageSync` |
| 平台回调 | `crazygamesIndex.ts` | — |
| 打包 | Webpack | Rollup |
| 横竖屏事件 | `window` resize | `wx.onWindowResize` |

平台差异通过 `AppContext.platform` 注入，游戏核心代码不感知平台。

---

## 9. iOS / Android 发布（Capacitor）

Capacitor 将 Web 构建（`dist/`）包装为原生 App（WKWebView on iOS，WebView on Android）。配置文件：`capacitor.config.ts`。

### 9.1 横竖屏支持

WKWebView / Android WebView 在设备旋转时正常触发 `window` resize 事件，现有 `index.ts` 中的监听**无需修改**。  
iOS 允许哪些方向由 Xcode → Target → General → **Supported Orientations** 控制，需勾选 Portrait + Landscape Left + Landscape Right。

### 9.2 首次初始化（只做一次）

```bash
npm install
npx cap add ios      # 生成 ios/ 目录（需要 macOS + Xcode）
npx cap add android  # 生成 android/ 目录（需要 Android Studio）
```

`ios/` 和 `android/` 目录生成后应加入 git（含 Xcode project 和 Gradle 文件）。

> 完整的 Windows 配置步骤（证书、Secrets、首次 cap add ios）见 `design/IOS_DEPLOY.md`。

### 9.3 日常发布流程

```bash
# iOS
npm run deploy:ios       # = build:web + cap sync ios
npm run cap:open:ios     # 打开 Xcode → Archive → App Store Connect

# Android
npm run deploy:android   # = build:web + cap sync android
npm run cap:open:android # 打开 Android Studio → Build → Generate Signed APK/AAB
```

### 9.4 Safe Area（刘海 / 圆角屏）

`capacitor.config.ts` 设置了 `ios.contentInset: 'always'`，WKWebView 会在安全区域内布局。  
若游戏内容被 home indicator 或 notch 遮挡，在 `public/index.html` 的 `body` 样式中追加：

```css
padding: env(safe-area-inset-top) env(safe-area-inset-right)
         env(safe-area-inset-bottom) env(safe-area-inset-left);
```

### 9.5 技术栈更新

| 项目 | 内容 |
|------|------|
| 打包工具 | Webpack（Web / Mobile）/ Rollup（微信） |
| 平台 | Web（CrazyGames）、微信小游戏、iOS（Capacitor）、Android（Capacitor） |
