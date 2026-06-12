# SumQuest

一款数字配对消除小游戏。棋盘上随机分布若干数字，点击两个加和等于目标值的数字将其消除，共 19 关，难度随目标数字（6 → 99）自然递增。

**平台**：CrazyGames（Web）、微信小游戏、iOS / Android（Capacitor）

---

## 技术栈

| 项目 | 内容 |
|------|------|
| 渲染引擎 | PixiJS 7（pixi.js-legacy，兼容低端设备） |
| 语言 | TypeScript |
| 打包 | Webpack（Web / Mobile）、Rollup（微信） |
| 移动端壳 | Capacitor 6 |

---

## 目录结构

```
src/
├── assetsManager/         资源加载（Web / 微信双实现）
├── game/                  核心逻辑
│   ├── appContext.ts      全局依赖注入容器
│   ├── sceneCoordinator.ts 场景调度
│   ├── gameScene.ts       关卡游戏场景
│   ├── lobbyScene.ts      关卡大厅场景
│   ├── dailyChallengeScene.ts 每日挑战场景
│   ├── logic.ts           数字分配 & 消除逻辑
│   ├── gameState.ts       时间池 / 暂停 / 结束状态
│   ├── screenConfig.ts    屏幕适配 & 布局锁定
│   ├── stageConfig.ts     19 关数据配置
│   ├── graphicsFactory.ts 程序化纹理生成
│   └── ...
├── inputSystem/           点击 / 触摸事件分发
├── index.ts               Web 入口
├── crazygamesIndex.ts     CrazyGames 入口
└── wechatgame/            微信小游戏入口 & 适配层
design/                    策划 & 架构文档
```

---

## 本地开发

```bash
npm install
npm start          # 启动 dev server，端口 8888
```

---

## 构建

```bash
npm run build:web          # Web（GitHub Pages）
npm run build:crazygames   # CrazyGames
npm run build:mobile       # iOS / Android（Capacitor）
npm run build:wechat       # 微信小游戏（Rollup）
```

> **移动端高清资源**：`build:mobile` 会用 `src/mobileAssets/` 下的同名资源（按文件名主干匹配，忽略扩展名）替换 `src/assets/` 的导入——例如 `lobby_bg.webp` 的导入会命中 `mobileAssets/lobby_bg.png`。仅 mobile 构建生效，其他平台不受影响。splash 在手机端拉伸铺满全屏。

### 同步到移动端

```bash
npm run deploy:ios         # build:mobile + cap sync ios
npm run deploy:android     # build:mobile + cap sync android
cap open ios               # 在 Xcode 中打开
cap open android           # 在 Android Studio 中打开
```

---

## CI/CD

| 工作流 | 触发 | 目标 |
|--------|------|------|
| `deploy.yml` | push main | GitHub Pages |
| `release-ios.yml` | tag | App Store Connect |
| `release-android.yml` | tag | Google Play |

iOS 发布详见 `design/IOS_DEPLOY.md`。

---

## 核心玩法

- 每关有 5 个 Target（第 19 关 4 个），每个 Target 开始时补充 30 秒时间
- 时间耗尽扣 1 条命（共 3 条），3 条耗尽可看广告续 1 次命
- 消除所有数字通关，按剩余时间评 1–3 星
- **每日挑战**：固定每日种子，无命数限制，按分数排名

### 棋盘规格

| Target 范围 | 格子（列×行） |
|-------------|--------------|
| 6–10（关卡 1） | 3×6 |
| 11–20（关卡 2–3） | 4×7 |
| 21–30（关卡 4–5） | 5×8 |
| 31–70（关卡 6–13） | 6×8 |
| 71–99（关卡 14–19） | 6×10 |

横屏时列数与行数自动互换。

---

## 屏幕适配

短边固定为 1080 逻辑像素，长边按实际宽高比伸缩，全平台无黑边：

- **竖屏**：`scale = windowWidth / 1080`
- **横屏**：`scale = windowHeight / 1080`

游戏中旋转屏幕时不重新分配数字，对 `gameContainer` 做等比缩放（布局锁定机制，见 `screenConfig.ts`）。

---

## 文档

- `design/ARCHITECTURE.md` — 架构详解
- `design/gameplay.md` — 策划文档
- `design/art.md` — 美术规范
- `design/IOS_DEPLOY.md` — iOS 发布指南
