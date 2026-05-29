# CrazyGames Web 发布文档

PixiJS 数字消除游戏 · Web 平台

---

## 1. 概述

| 项目 | 说明 |
|------|------|
| 游戏引擎 | PixiJS 7 (pixi.js-legacy) |
| 构建工具 | webpack 5 |
| 目标平台 | CrazyGames (HTML5) |
| SDK 版本 | CrazyGames SDK v3 |
| 输出目录 | `crazygames/` |

---

## 2. 本地构建

### 构建命令

```bash
npm run build:crazygames
```

等价于：

```bash
webpack --mode production --env TARGET=crazygames
```

### 构建输出

```
crazygames/
  index.html               # 入口页面（含 SDK 脚本）
  index.js                 # 游戏主包（webpack bundle）
  *.png / *.ogg / *.json   # 资源文件（webpack asset/resource 处理）
```

上传时将 `crazygames/` 下所有文件打包为 zip 后整体上传，CrazyGames CDN 会自行处理传输层压缩。

### 注意事项

- 构建前确保 Node.js ≥ 18，执行 `npm ci` 安装依赖。
- 生产模式会启用 Brotli 预压缩（`brotli-webpack-plugin`），threshold 10KB，压缩比 > 0.8 的文件才会生成 `.br` 副本。
- 不要手动修改 `crazygames/` 目录内容，每次构建会 `clean: true` 清空重建。
- 如需本地预览构建结果：`npx serve crazygames`

---

## 3. CrazyGames SDK 集成说明

SDK 集成代码位于 `src/platform/crazygamesService.ts`，入口文件为 `src/crazygamesIndex.ts`。

| SDK 事件 | 触发位置 / 说明 |
|----------|----------------|
| `SDK.init()` | 游戏最先调用，在任何其他 SDK 方法之前 |
| `game.loadingStart()` | `init()` 完成后立即调用，通知平台开始加载 |
| `game.loadingStop()` | 所有资源加载完毕、游戏进入可交互状态时 |
| `game.gameplayStart()` | 玩家进入可玩状态（关卡开始）时调用 |
| `game.gameplayStop()` | 关卡结束、菜单打开、游戏暂停时调用 |
| `ad.requestAd('interstitial')` | 关卡间插页广告（已限流：最短间隔 10 分钟） |
| `ad.requestAd('rewarded')` | 激励广告，玩家主动触发（如复活） |
| `game.sdkGameLoadingStart()` | `beforeunload` 事件中调用，告知平台页面将刷新（非崩溃） |

> ⚠️ `loadingStart` → `loadingStop` 之间的时间计入「初始下载时间」。CrazyGames 要求此阶段下载量 ≤ 50MB，移动端首页推荐 ≤ 20MB。

---

## 4. 发布前检查清单

### 技术要求

- [ ] 总文件大小 ≤ 250MB，文件数 ≤ 1500
- [ ] 初始下载量（loadingStart → loadingStop）≤ 50MB
- [ ] 所有资源路径使用相对路径，无绝对路径
- [ ] SDK v3 脚本在 `index.html` 中最先加载
- [ ] `loadingStart` / `loadingStop` 事件正确触发
- [ ] `gameplayStart` / `gameplayStop` 事件正确触发
- [ ] Chrome / Edge 下无报错，功能正常
- [ ] 移动端触摸操作正常（无放大菜单、无选中）
- [ ] 横屏/竖屏显示正确

### CrazyGames HTML 模板

- [ ] `body` 包含 `user-select: none`（移动端防长按）
- [ ] `wheel` 事件阻止默认滚动
- [ ] `ArrowUp` / `ArrowDown` / `Space` 阻止默认行为
- [ ] `contextmenu` 事件阻止右键菜单

### 广告（全 SDK 集成要求）

- [ ] 插页广告在关卡结束等自然间隙触发
- [ ] 插页广告限流间隔 ≥ 10 分钟
- [ ] 激励广告完成后正确发放奖励
- [ ] 广告展示期间游戏音频暂停

---

## 5. 提交步骤

### 首次发布

1. 执行 `npm run build:crazygames`，确认 `crazygames/` 目录生成正常。
2. 打开 https://developer.crazygames.com，登录开发者账号。
3. 点击「Submit a game」，填写游戏基本信息（名称、描述、分类、标签）。
4. 将 `crazygames/` 目录下所有文件打包为 `.zip` 后上传。注意：zip 根目录需直接包含 `index.html`，不要再套一层文件夹。
5. 设置游戏封面图（至少提交 512×512 方形封面，建议同时提供 1200×630 横版图）。
6. 提交审核，等待 CrazyGames QA 团队反馈（通常 3–7 个工作日）。

### 版本更新

1. 执行 `npm run build:crazygames` 生成新版本产物。
2. 进入 CrazyGames 开发者后台，找到对应游戏。
3. 点击「Update game」，上传新的 `crazygames/` 打包 zip。
4. 填写更新说明（Change Log），提交等待审核。

### 打包命令

```bash
# 构建
npm run build:crazygames

# 打包 zip（macOS / Linux）
cd crazygames && zip -r ../crazygames-release.zip . && cd ..

# 打包 zip（Windows PowerShell）
Compress-Archive -Path crazygames\* -DestinationPath crazygames-release.zip -Force
```

---

## 6. GitHub Actions 自动化构建

CrazyGames 目前不提供公开的上传 API，自动化止步于生成 zip artifact，仍需手动到开发者后台上传。可在 `.github/workflows/release-web.yml` 中添加：

```yaml
name: Build CrazyGames

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build:crazygames
      - run: cd crazygames && zip -r ../crazygames-release.zip .
      - uses: actions/upload-artifact@v4
        with:
          name: crazygames-release.zip
          path: crazygames-release.zip
```

---

## 7. 已知限制与注意事项

- **Sitelock**：如需防止游戏被嵌入第三方站点，参考 [CrazyGames sitelock 文档](https://docs.crazygames.com/resources/html5/sitelock/)，需白名单所有 CrazyGames 域名。
- **iOS 音频恢复**：若将来支持移动端，需在 `touchend` 事件中调用 `AudioContext.resume()`，否则 iOS 后台切换后音频不恢复。
- **AdBlock 检测**：`crazygamesService` 暴露 `hasAdblock` getter，可在 UI 上给屏蔽广告的用户展示提示。
- **用户账号 / 排行榜**：`leaderboard`、`saveScore`、`getUser` 等功能已在 `crazygamesService.ts` 中实现，但当前未接入游戏 UI，如需启用需要额外开发。
