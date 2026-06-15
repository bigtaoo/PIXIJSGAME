# SumQuest 平台分发计划

> 维护游戏在各 Web/社交平台的上架状态与接入顺序。最后更新：2026-06-15

## 当前状态

| 平台 | 状态 | 备注 |
|------|------|------|
| itch.io | ✅ 已上线 | Web build（`build:web`），嵌入框需用**竖屏**比例（如 540×960），横屏会裁切 |
| CrazyGames | 🔄 审核中 | SDK v3 已接入（`crazygamesIndex.ts`），`build:crazygames` |
| Poki | 🔄 开发者申请中 | ⚠️ 见下方独占说明 |
| Telegram Mini App | 🔧 代码已搭好，待托管+BotFather | `build:telegram`，见下方指南 |
| ~~Facebook Instant Games~~ | ❌ 已弃用 | Meta 将于 **2026-09-30 关停**整个 Web Games 平台，不再投入 |
| Discord Activities | 💡 可选 | 西方「社交即玩」最有活力的新平台，见文末 |
| GameDistribution | 🔧 代码已搭好，待填 gameId + 上传 | `build:gamedistribution`，gameId 占位 `__GD_GAME_ID__` |
| 微信小游戏 | ⏸ 已有 build，未发布 | `build:wechat` |
| iOS | 🔄 审核中 | App Store 已提交审核 |
| Android | 🔧 平台已生成，CI 出 AAB+APK，待配 keystore/Play | 见 `docs/ANDROID_DEPLOY.md`；AAB 上 Google Play，universal APK 测试/其他商店 |

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
2. **GameDistribution** — 铺量渠道，一次接入分发到数千合作小站
3. **（可选）Discord Activities** — 西方现存最有活力的「社交内即玩」平台

> ~~Facebook Instant Games~~ 已从计划移除：Meta 宣布 **2026-09-30 关停** Web Games 平台，SDK 文档 2026-06 底即停更，不值得为只剩数月寿命的平台投入。详见文末。

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

# GameDistribution 接入流程

铺量型聚合平台：一次接入，自动分发到数千个合作小游戏站。个人可注册、免费、广告分成、无独占。沿用 crazygames/telegram 的隔离入口模式。

## 流程
1. **注册** — gamedistribution.com 开发者后台（个人即可，免费），创建游戏条目，拿到 `gameId`。
2. **接 GD HTML5 SDK**（隔离入口 `src/gdIndex.ts` + `public/gamedistribution.html` + webpack `gamedistribution` target）。SDK 通过全局 `GD_OPTIONS` 配置 + 脚本加载，核心是几个广告 / 生命周期钩子：
   - 配置 `GD_OPTIONS = { gameId, onEvent }`，监听 `SDK_READY` / `SDK_GAME_START` / `SDK_GAME_PAUSE`
   - 插屏广告：关卡切换时 `gdsdk.showAd('interstitial')`
   - 激励广告（换命）：`gdsdk.preloadAd('rewarded')` + `gdsdk.showAd('rewarded')`
   - 广告播放期间静音并暂停游戏，`SDK_GAME_START` 回调里恢复
   - 映射到 `AppContext.platform`：`requestInterstitialAd` / `requestExtraLife` / `gameplayStart` / `gameplayStop`（接口已存在，见 `appContext.ts`）

   > ⚠️ GD SDK 的具体方法名 / 事件名以当前 GD 官方 HTML5 SDK 文档为准，接入前核对一遍，不要照抄本文。
3. **上传** — 把 `build:gamedistribution` 产物打 zip 传到后台。
4. **审核 → 分发** — 通过内容审核后自动分发到合作网络，广告分成被动结算。

## 适配清单（最小集）
- [x] `public/gamedistribution.html`（含 `GD_OPTIONS` + SDK 脚本，gameId 占位 `__GD_GAME_ID__`）
- [x] `src/gdIndex.ts` + `src/platform/gdService.ts`（init + 广告钩子映射到 `platform`，SDK 事件经 `gd-sdk-event` 路由）
- [x] webpack `gamedistribution` target + `build:gamedistribution`
- [ ] **待你做**：后台创建游戏 → 把 `public/gamedistribution.html` 里的 `__GD_GAME_ID__` 换成真实 gameId → 上传 zip → 完整看完一次 pre-roll 激活集成 → 过审

---

# Discord Activities（可选 — 西方社交即玩）

西方「社交平台内即玩」里目前最有活力的是 **Discord Activities**（不是衰退中的 FB / Snapchat）。游戏跑在 Discord 语音频道内，天然多人 / 社交。

- 用 **Embedded App SDK**（`@discord/embedded-app-sdk`）包装现有 Web build，通常几百行 glue code。
- 需 Discord 开发者应用 + OAuth 流程；托管在自己的 HTTPS。
- 适合之后想做多人 / 社交玩法时再上；单机消除可先放后面。
- 参考：[Discord Activities Overview](https://docs.discord.com/developers/activities/overview) · [embedded-app-sdk](https://github.com/discord/embedded-app-sdk)

---

# 附：Facebook 关停说明 & 欧美 Web Game 平台对标

## Facebook Instant Games 关停时间线
- **2025-08-01**：所有新 Instant Game 必须用 Zero Permissions（NEZP）体系。
- **2026-06 底**：Instant Games SDK 文档停止维护。
- **2026-09-30**：整个 Web Games 平台关停，未迁移到 Zero Permissions 的游戏全部下架。

## 已在 FB 上运营的游戏怎么办？
- 关停前：只能迁到 Zero Permissions 续命到 9-30，之后平台整体消失，**没有「保留」选项**。
- Meta 未提供完善的数据 / 玩家迁移工具；FB 排行榜、好友数据等绑死在其 API 上，基本**带不走**，到新平台等于重开。
- 唯一能带走的是你自己的 **HTML5 build 和资产**（本就归你）。务实做法：把 build 重新部署到 CrazyGames / GameDistribution / Telegram / Discord / 自有站点。
- 对 SumQuest 的意义：幸好我们**还没**在 FB 投入，直接跳过即可。

## 欧美对标平台一览
西方社交平台（FB Instant Games、Snapchat Games、甚至 TikTok）都试图复制亚洲（微信小游戏）的即玩生态，但**基本都没成功**，多数已衰退或停摆。当前真正活跃的分两类：

**纯 H5 门户 / 聚合（铺量为主）**
- CrazyGames、Poki（头部，策展型）
- GameDistribution、GamePix、Softgames、CoolGames、Playgama（聚合 / 铺量型）
- Coolmath Games、Y8、Newgrounds、itch.io（社区 / 长尾）

**社交内即玩（FB Instant Games 的真正对标）**
- **Discord Activities** — 上升期，西方最接近的「社交即玩」
- **Telegram Mini Apps** — 全球化、裂变强（你已在做）
- ~~Facebook Instant Games / Snapchat Games~~ — 衰退 / 关停

**结论**：西方没有一个像微信那样繁荣的「社交即玩」巨头。务实路线就是你现在走的——CrazyGames + 聚合平台铺量，配 Telegram（+ 可选 Discord）拿社交流量。
