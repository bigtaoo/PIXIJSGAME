# SumQuest App Store 提审检查清单

> 生成日期：2026-06-13 · Bundle ID `com.gamestao.sumquest` · 版本 1.0 (build 1)
> 状态图例：✅ 已就绪 · ⚠️ 需你决策/补充 · ❌ 会被拒，必须处理

---

## 0. 总览

| 项 | 状态 | 说明 |
|----|------|------|
| App 图标 alpha 通道 | ✅ 已修复 | 原图标为 RGBA（带 alpha），苹果必拒；已就地转 RGB |
| 加密出口合规 | ✅ | `ITSAppUsesNonExemptEncryption = false` 已在 Info.plist |
| 权限用途字符串 | ✅ | 不申请任何权限，无需 `NS...UsageDescription` |
| 追踪 / ATT | ✅ | 无任何追踪、广告、分析 SDK，无需 ATT 弹窗 |
| iPhone 6.9" 截图 | ✅ | 4 张已生成（见第 2 节） |
| iPad 截图 | ⚠️ | 当前是 Universal 构建（iPhone+iPad），**iPad 截图为必填**，需决策 |
| 隐私政策 URL | ⚠️ | 所有 App 必填，需你提供一个可访问链接 |
| 白屏修复在提交构建里复测 | ⚠️ | 06-09 已在 iPhone 13 确认；上传 TestFlight 后再真机跑一次 |
| App Privacy 问卷 | ✅ 可直接填 | 选「Data Not Collected」 |
| 年龄分级 | ✅ 可直接填 | 全部选无 → 4+ |
| 元数据文案 | ⚠️ | 名称/副标题/描述/关键词待填（模板见第 5 节） |

---

## 1. 已修复项

### App 图标含 alpha 通道（会被拒 → 已处理）
`ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` 原为 `RGBA`，1024×1024。
苹果对 Marketing Icon 的硬性要求：**不能含 alpha 通道 / 透明度**，否则上传即报
`Invalid Large App Icon ... can't contain an alpha channel`。

该图 alpha 全为 255（无真实透明），已就地转为 `RGB` 并覆盖原文件，同时在
`markting/appstore/AppIcon-1024-noalpha.png` 留了一份副本。下次 `cap sync ios` 后请确认未被覆盖回 RGBA。

---

## 2. 截图素材（已交付）

来源：`markting/crazy games/portrait.mov`（最新水彩风实录，888×1920）。
目标尺寸取 **1290×2796**（iPhone 6.9" 槽位通用接受值），缩放到 cover 后居中裁切，去 alpha，RGB PNG，尺寸零误差。

目录：`markting/appstore/iphone_6.9/`

| 文件 | 画面 |
|------|------|
| `01_board.png` | 满盘对局（217 分） |
| `02_celebrate.png` | 过关庆祝（金色粒子爆发） |
| `03_levelmap.png` | 关卡地图大厅 |
| `04_board2.png` | 满盘对局（176 分） |

规格已逐张校验：1290×2796 / RGB / 无 alpha。每个机型 1–10 张，当前 4 张满足。

> 进 App Store Connect 时，6.9" 这一组传这 4 张即可；旧机型槽位苹果会自动缩放复用，无需单独准备。

### 预览视频（可选，本次建议跳过）
现有 `.mov` 是 888×1920，**不是** App Preview 接受的设备分辨率，且预览对编码/帧率/时长（15–30s, H.264/HEVC）有硬性要求。预览非必填，v1 先不传，上线后再补。

---

## 3. 需要你决策 / 补充的项

### 3.1 iPad 截图（Universal 构建的硬要求）⚠️
`project.pbxproj` 里 `TARGETED_DEVICE_FAMILY = "1,2"` → 应用同时面向 iPhone+iPad，
**App Store Connect 会要求至少 1 张 13" iPad 截图（2064×2752）才能提交**。

两条路，二选一：

- **A. 改成仅 iPhone（推荐，省事）**：把 `TARGETED_DEVICE_FAMILY` 改为 `"1"`，
  iPad 不再需要截图，也避免未在 iPad 实测导致的布局/拒审风险。
  （你没有 Mac，iPad 体验也未验证，先 iPhone-only 上线最稳。）
- **B. 保留 Universal**：需要补 iPad 截图。但手机比例的图直接拉到 iPad 4:3 会变形或留大黑边，
  容易被拒「截图不能代表 iPad 实际体验」。要走这条得先在 iPad 分辨率下真机/模拟器跑一遍再截。

> 我的建议是 A。需要的话我可以帮你改 `project.pbxproj` 并在文档里记一笔。

### 3.2 隐私政策 URL ⚠️
所有 App 提交都必须填「隐私政策网址」，哪怕不收集任何数据。
你这款只用 `localStorage` 存进度，不联网传用户数据 → 政策内容可以很短。
可选：我帮你写一份极简隐私政策（中/英/德），你挂到任意可访问页面（GitHub Pages / 你的域名）即可。

### 3.3 元数据文案 ⚠️
见第 5 节模板，需你确认/微调。

---

## 4. 逐条核对（提交向导里会遇到的字段）

| 字段 / 检查点 | 结论 | 备注 |
|---------------|------|------|
| App 名称 | 待填 | 「SumQuest」≤30 字符 |
| 副标题 Subtitle | 待填 | ≤30 字符，建议放卖点 |
| 描述 Description | 待填 | 见模板 |
| 关键词 Keywords | 待填 | 共 ≤100 字符，逗号分隔 |
| 推广文本 Promotional Text | 可空 | ≤170 字符，可后期改 |
| 支持网址 Support URL | ⚠️ 必填 | 可用 GitHub 仓库或落地页 |
| 营销网址 Marketing URL | 可空 | — |
| 分类 Category | 建议 Games → Puzzle | 主分类 Puzzle，次 Casual |
| App Privacy（数据收集问卷）| Data Not Collected | 无任何 SDK 收集，照实填「不收集」 |
| ATT / 追踪 | 不涉及 | 无追踪 |
| 加密出口合规 | 已声明非豁免加密=false | 只用 HTTPS，免填年度自查 |
| 权限弹窗 | 无 | 不申请相机/定位/麦克风等 |
| 年龄分级问卷 | 全选「无」→ 4+ | 无暴力/博彩/成人内容 |
| 登录 / 演示账号 | 不需要 | iOS 端无账号体系 |
| App 内购 / 订阅 | 无 | iOS 端不含 IAP / 广告（变现仅在 CrazyGames/微信） |
| 版本号 / 构建号 | 1.0 / 1 | 首发可用 |
| 部署目标 | iOS 13.0 | OK |
| LaunchScreen | 已配置 | `LaunchScreen.storyboard` 存在 |
| 内容版权 | 自有 | 字体确认授权（见下） |

### 字体授权提醒
界面/素材用到 NotoSans、Lilita One 等（`markting/Lilita_One,Noto_Sans`）。这两个都是 OFL 开源授权，可商用，没问题；只需确认没夹带其他未授权字体。

---

## 5. 元数据文案模板（待你确认）

```
名称:      SumQuest
副标题:    Add up. Clear the board.   (≤30 字符)

关键词:    number puzzle,math game,merge,brain,casual,numbers,
           addition,relax,logic,daily   (合计 ≤100 字符，逗号无空格更省字符)

描述:
SumQuest is a cozy number puzzle. Tap tiles that add up to the target,
clear the board, and work through 19 hand-crafted levels.

· 19 levels, targets growing from 6 to 99
· A new Daily Challenge every day — same board for everyone, 90 seconds
· Keep your streak going day after day
· Soft watercolor look, relaxing soundtrack
· No account, no ads, just play

分类:      Games / Puzzle (次: Casual)
年龄分级:  4+
```

> 德语区可加一套 `de-DE` 本地化文案；需要我写德语版描述/关键词就说一声。

---

## 6. 提交前最后动作清单

- [ ] 决定 iPhone-only 还是 Universal（见 3.1）→ 若 only，改 `TARGETED_DEVICE_FAMILY="1"`
- [ ] 提供隐私政策 URL（或让我生成一份极简政策）
- [ ] 确认元数据文案（第 5 节）
- [ ] 打 tag 触发 CI 出包，上传到 TestFlight
- [ ] TestFlight 真机跑一遍：**重点复测启动白屏**（`webAssetsManager.ts:182` 的 `fetch(explosion.json)`）
- [ ] 确认 CI 实际构建的是 iOS 入口而非 crazygames 产物（`IOS_DEPLOY.md` 第 123 行写的是 `build:crazygames`，与白屏相关，提交前核对一次）
- [ ] App Store Connect 填完元数据 + 上传 6.9" 截图（4 张）+（如 Universal）iPad 截图
- [ ] 填 App Privacy = Data Not Collected、年龄分级 4+、加密合规
- [ ] 选构建版本 → 提交审核

---

## 附：本次已自动完成
1. 生成 4 张 iPhone 6.9" 合规截图（`markting/appstore/iphone_6.9/`）
2. 修复 App 图标 alpha 通道（`AppIcon-512@2x.png` → RGB）
