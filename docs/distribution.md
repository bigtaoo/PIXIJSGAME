# SumQuest 平台分发计划

> 维护游戏在各 Web/社交平台的上架状态与接入顺序。最后更新：2026-06-14

## 当前状态

| 平台 | 状态 | 备注 |
|------|------|------|
| itch.io | ✅ 已上线 | Web build（`build:web`），嵌入框需用**竖屏**比例（如 540×960），横屏会裁切 |
| CrazyGames | 🔄 审核中 | SDK v3 已接入（`crazygamesIndex.ts`），`build:crazygames` |
| Poki | 🔄 开发者申请中 | ⚠️ 见下方独占说明 |
| Telegram Mini App | 🔧 代码已搭好，待托管+BotFather | `build:telegram`，见下方指南 |
| Facebook（Instant Games） | ⬜ 计划中 | Telegram 之后 |
| GameDistribution | ⬜ 计划中 | 一次接入，分发到大量小站 |
| 微信小游戏 | ⏸ 已有 build，未发布 | `build:wechat` |
| iOS | 🔄 审核中 | App Store 已提交审核 |
| Android | ⏸ Capacitor 壳，未发布 | `build:mobile` + `deploy:android` |

### ⚠️ Poki Web 独占冲突
Poki 默认要求 **open web 独占**（仅在 Poki 发布），默认锁 **5 年**。Steam、手机应用商店不算独占，但 **itch.io 和 CrazyGames 都属于 open web**。
- 若签 Poki → 必须从 itch、CrazyGames 撤下。
- 当前策略：走**多平台铺量**路线，Poki 仅在其主动接受且条件足够好时再单独评估。

#### Poki 签约前必查条款清单
5 年 open-web 独占代价不轻。若 Poki 给 offer，签字前逐条确认：
- [ ] **退出 / 终止条款** — Poki 表现不达标时能否提前解约？通知期多长？
- [ ] **保底 / 预付款（guarantee / advance）** — 有没有一次性预付或最低收入保证？
- [ ] **业绩下限** — 合同是否约定最低导流 / 收入，达不到自动解锁独占？
- [ ] **独占范围确认** — 书面确认仅限 open web，Steam / iOS / Android 不受限。
- [ ] **收入分成比例** — 广告分成具体百分比、结算周期、最低提现额。
- [ ] **资产 / IP 归属** — 确认游戏 IP、源码、美术资产仍归你所有。
- [ ] **续约条款** — 5 年到期是自动续约还是默认终止？

> 提醒：以上属合同条款，我不是律师。拿到合同文本后请逐条核对，必要时找专业人士过目。

## 接入顺序（多平台路线）

1. **Telegram Mini App** — 不同流量源（社交裂变），个人可发，无 web 独占冲突
2. **Facebook Instant Games** — Messenger / Feed 内即玩
3. **GameDistribution** — 铺量渠道，一次接入分发到数千小站

---

# Telegram Mini App 接入指南

Telegram Mini App = 托管在你自己 HTTPS 域名上的 Web 应用，通过一个 bot 在 Telegram 内打开。本质就是把现有 Web build 套一层 Telegram SDK。无需公司，个人 BotFather 即可发布。

参考：[Mini Apps on Telegram](https://core.telegram.org/bots/webapps) · [Fullscreen Mini Apps 2.0](https://telegram.org/blog/fullscreen-miniapps-and-more)

## 架构原则（沿用 crazygames 模式）
新增一个隔离的平台入口，不污染 web/wechat build：
- `public/telegram.html` — 入口模板，比 web 多一行 SDK script
- `src/telegramIndex.ts` — Telegram 平台入口
- webpack 增加 `telegram` target + `build:telegram` 脚本

## Step 1 — HTML 模板
复制 `public/index.html` 为 `public/telegram.html`，在 bundle script **之前**加：

```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```

## Step 2 — 平台入口 src/telegramIndex.ts
以 `index.ts`（web 入口）为基础，开头加 Telegram 初始化：

```ts
// Telegram WebApp bootstrap — must run before the game boots.
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  tg.ready();                 // tell Telegram the app is loaded
  tg.expand();                // expand to full viewport height
  tg.requestFullscreen?.();   // Bot API 8.0+: true fullscreen (optional)
  tg.disableVerticalSwipes?.(); // stop swipe-to-close stealing taps  ← important for a tap game
  tg.setHeaderColor?.('#000000');
  tg.setBackgroundColor?.('#000000');
}
```

然后和 web 入口一样初始化 PixiJS 应用。广告钩子用 no-op（Telegram 无原生激励广告）：

```ts
const adHooks = {
  // No native rewarded ads on Telegram. For now: skip revive ad,
  // or grant the life directly. Adsgram can be added later if desired.
  showRewarded: async () => false,
  gameplayStart: () => {},
  gameplayStop: () => {},
};
```

## Step 3 — 安全区与视口
全屏模式下顶部会被 Telegram 控件占用，布局要避让安全区：

```ts
const topInset = tg?.safeAreaInset?.top ?? 0;
const stableH = tg?.viewportStableHeight ?? window.innerHeight;
// 用 stableH 而非 innerHeight 做 resize，HUD 下移 topInset 像素
```

`screenConfig.ts` 现有 resize 逻辑大体可复用，只需把高度来源换成 `viewportStableHeight` 并在 HUD 顶部留 `safeAreaInset.top`。

## Step 4 — webpack target
`webpack.config.js` 的 `platformConfig` 增加：

```js
telegram: {
  entry: './src/telegramIndex.ts',
  outputPath: path.resolve(__dirname, 'telegram'),
  htmlTemplate: './public/telegram.html',
  useMobileAssets: false,
},
```

`package.json` 增加脚本：

```json
"build:telegram": "webpack --mode production --env TARGET=telegram"
```

（favicon 已由全局 CopyPlugin 自动拷入，无需额外处理。）

## Step 5 — 托管（HTTPS 必需）
Telegram 要求合法 HTTPS。项目已有 GitHub Pages（`deploy.yml`），可：
- 在同仓库 Pages 下放一个 `/telegram/` 子路径，或
- 单开一个分支/仓库专门部署 telegram build。
部署后拿到形如 `https://<user>.github.io/sumquest-telegram/` 的 URL。

## Step 6 — BotFather 配置
1. Telegram 内搜索 **@BotFather** → `/newbot` → 设置名称和 username → 得到 bot（token 暂时用不到，纯 Mini App 不需要后端）。
2. `/newapp` → 选刚建的 bot → 填标题、简介、图标、**Web App URL（Step 5 的地址）**、short name → 得到直链 `t.me/<bot>/<appname>`。
   - 或：`/mybots` → 选 bot → Bot Settings → Menu Button → 设置 URL。
3. 在 Telegram 里打开该直链即可进游戏。

## Step 7 — 测试
BotFather 无沙箱，直接在 Telegram（桌面或手机）打开链接测试。桌面端可右键 Inspect 调试；移动端可临时引入 eruda 看 console。

## 可选增强（之后做）
- **每日挑战分享**：`tg.shareMessage()` / 分享直链，做社交裂变（最契合 Telegram 的传播属性）。
- **存档**：`tg.CloudStorage` 持久化 streak / 关卡进度，按用户云存储，无需自建服务端。
- **变现**：Telegram 无原生激励广告，常用第三方 **Adsgram** 接激励视频，可后续评估。

## 适配改动清单（最小集）
- [x] `public/telegram.html` + SDK script
- [x] `src/telegramIndex.ts` 入口（init，无 platform 广告钩子，行为同 web build）
- [x] webpack `telegram` target + `build:telegram`
- [x] resize 改用 `viewportStableHeight`（已接入；fullscreen 安全区避让留待开启 requestFullscreen 时处理）
- [x] `disableVerticalSwipes()` 防止滑动关闭误触
- [ ] 部署到 HTTPS（GitHub Pages）
- [ ] BotFather 建 bot + Mini App，拿直链测试

---

# Facebook Instant Games（待办占位）
- 平台：Messenger / Feed 内即玩，HTML5。
- 需 Facebook 开发者账号 + App Review；接 Instant Games SDK（`FBInstant`）。
- 同样建隔离入口 `facebookIndex.ts` + build target。
- 细节待 Telegram 完成后展开。

# GameDistribution（待办占位）
- 铺量渠道：接入 GD SDK（`gdsdk`，广告钩子），上传到后台，自动分发到合作小站。
- 个人可注册，广告分成。
- 同样建隔离入口 + build target。
