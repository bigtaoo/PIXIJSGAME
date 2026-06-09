# 数字消除游戏 美术文档

**版本：** v1.2  
**日期：** 2026年6月  
**关联文档：** 策划文档 v1.0

---

## 1. 整体风格定位

**主题：文具 / 便签本**

游戏画面以「在草稿纸上做数学题」为视觉隐喻，整体风格温暖、干净、易读。这一选择基于以下考量：

- 「数字写在纸上」是玩家最熟悉的数字呈现形式，认知门槛最低
- 浅色系背景对两端（CrazyGames / 微信小游戏）均有良好适配性
- 便签卡片风格易于实现三种清晰的格子状态
- 后期换皮成本低，节日主题可通过替换背景纹理和装饰元素实现

**色调参考：** 暖白 / 米黄为主，搭配饱和度适中的点缀色（金黄、天蓝、珊瑚红）

---

## 2. 数字

### 2.1 字形要求

| 属性 | 规格 |
|------|------|
| 字体风格 | 粗圆体（字重 Bold 或 Black） |
| 描边 | 深色描边（#333333 或深棕），宽度约为字号的 8–10% |
| 填色 | 白色或亮米白，**不使用渐变** |
| 对齐 | 视觉居中（非数学居中，需手动微调） |

**禁止项：** 细线字体、手写风格字体、像素字体。两位数在缩放 70% 后约为 84×84px，细线字体在此尺寸下会严重失去辨认度。

### 2.2 两位数排版

两位数（10–98）使用两个单数字精灵并排，整体缩放至格子尺寸的 **70%**，居中显示：

```
┌─────────────────┐
│                 │
│   ┌──┐ ┌──┐    │  ← 两数字各占 35% 格宽，合计 70%
│   │5 │ │2 │    │
│   └──┘ └──┘    │
│                 │
└─────────────────┘
```

两数字之间无间距（或仅 1–2px 间距），避免被误读为两个独立数字。

---

## 3. 格子（数字背景）

### 3.1 视觉形态

每个格子为**圆角矩形卡片**，形似便签贴纸，带轻微投影（shadow offset 2–4px，blur 4–6px，透明度 20–30%）。

### 3.2 状态定义

| 状态 | 视觉表现 | 触发条件 |
|------|----------|----------|
| **默认** | 暖白 / 米黄底色，正常投影 | 未被选中、未消除 |
| **选中** | 亮色描边（金黄 `#FFD700` 或天蓝 `#4FC3F7`）+ 轻度外发光，底色略亮 | 玩家点击选中 |
| **消除中** | 执行碎裂动画（见第 5 节），动画结束后格子消失（不留占位） | 配对成功瞬间 |

选中状态的描边建议宽度为格子边长的 4–5%，发光半径为 8–12px，过强的发光会干扰相邻格子阅读。

### 3.3 格子尺寸

代码中 `gridSize = 120`（逻辑像素），即每格 **120 × 120**。美术素材建议以 **240 × 240**（@2x）制作，保证高分辨率屏幕清晰显示。

---

## 4. 游戏背景

### 4.1 主背景

**方格纸纹理**，米白底色，浅灰网格线（透明度约 15–20%），不使用深色背景。

要求：
- 网格线足够淡，不与数字格子产生视觉竞争
- 纹理为无缝平铺，适应不同屏幕分辨率
- 避免任何高频细节（防止在低分辨率设备上产生摩尔纹）

### 4.2 背景装饰 ✅（v1.2 已实现）

可在背景四角或边缘添加**轻量装饰元素**，如：铅笔、橡皮擦、回形针、便签条等文具图案，作为静态装饰图层。装饰元素透明度建议 30–50%，不可干扰游戏区域。

**v1.2 实现：** `gameScene.ts` `buildBackgroundDecos()` 放置 8 个文具精灵，alpha 0.45。布局如下：

| 素材 | 位置 | 旋转 | 缩放 |
|------|------|------|------|
| `deco_pencil.png` | 左上角 | +15° | 1.0 |
| `deco_eraser.png` | 右上角 | −10° | 1.0 |
| `deco_paperclip.png` | 右下角 | +20° | 1.0 |
| `deco_pencil.png` | 左下角 | −20° | 1.0 |
| `deco_paperclip.png` | 左侧中段 | +85° | 0.8 |
| `deco_eraser.png` | 右侧中段 | −80° | 0.75 |
| `deco_paperclip.png` | 左上角辅助 | −30° | 0.7 |
| `deco_pencil.png` | 右下角辅助 | +10° | 0.7 |

大厅场景同步通过 `buildLobbyDecos()` 放置相同四角布局。

### 4.3 层级结构

```
z层级（从底到顶）
├── 背景层：方格纸纹理
├── 装饰层：文具摆件（静态，可选）
├── 格子层：Grid（格子背景卡片）
├── 数字层：NumberLayer（数字精灵）
├── 特效层：EffectManager（消除特效 + 飞行加时）
└── UI层：Header / 结果浮层 / 设置浮层
```

---

## 5. 消除特效

### 5.1 主特效：粒子碎裂

消除成功时通过 `explosion.png` 粒子图集触发碎裂效果（`effect.ts` ExplosionSystem），总时长约 200–300ms。

粒子分为四个层级：

| 层级 | 帧 key 前缀 | 数量（普通 / 连消） | 说明 |
|------|------------|-------------------|------|
| 大碎片 | `large_0–2` | 2 / 3 | 向外高速散射，带旋转与重力 |
| 中碎片 | `medium_0–2` | 2 / 3 | 中等速度，带轻微旋转 |
| 小碎片 | `small_0–6` | 4 / 8 | 细小颗粒，快速消散 |
| 尘埃 | `dust_0–2` | 2 / 4 | 低速扩散，模拟粉尘飘散 |

连消时额外生成一个 `dust_cloud` 尘云粒子，强化视觉爆发感。所有粒子均使用对象池复用，无额外内存分配。

### 5.2 尺寸约束

特效最大影响半径不超过 **1.5 × gridSize（180px）**，防止遮挡相邻格子，影响玩家下一步操作。

---

## 6. 加时飞行动画

### 6.1 触发时机

每次消除成功后，在碎裂特效启动的**同一帧**触发加时飞行动画。两者并行播放，互不阻塞。

### 6.2 飞行精灵

| 属性 | 规格 |
|------|------|
| 内容 | 加时文字，如 `+2s` / `+3s` / `+4s` |
| 字体 | 与数字风格一致，粗圆体，白字深描边 |
| 颜色 | 金色 `#FFD700`（普通）/ 亮绿 `#76FF03`（连消时） |
| 尺寸 | 约 80–100px 高 |

连消时颜色从金色变为亮绿，强化「连消激活」的视觉信号。

### 6.3 飞行路径（实现：flyingBonus.ts）

```
起点：最后点击格子（idxB）的中心点，gameContainer 局部坐标转换为场景坐标
终点：Header 区域闹钟图标中心（header.getClockCenter()，直接返回场景坐标）

动画分三阶段，总时长 300ms（FlyingBonus.DURATION）：
  Phase 1（0–100ms）: 在起点弹出，scale 0 → 2.0（含轻微过冲，peak≈2.2）
  Phase 2（100–200ms）: 停留在起点，scale 保持 2.0
  Phase 3（200–300ms）: 沿弧线飞向时钟，scale 逐渐缩小，alpha 在 raw>0.4 后淡出

路径：二次贝塞尔弧线
  控制点 = 起终点 x 取中，y 取 min(sy, ey) − 200px
  （使精灵先向上弧起，再落向闹钟，形成自然弧线）
  位移参数沿弧线做 quadratic ease-in（t = raw²）
```

回调触发时机：动画开始后 250ms（CALLBACK_TIME），触发 `header.triggerClockBounce()`。

坐标变换（gameContainer 已缩放时）：
```typescript
startX = gameContainer.x + (posB.x + gridSize/2) * gameContainerScale
startY = gameContainer.y + (posB.y + gridSize/2) * gameContainerScale
```

### 6.4 闹钟接收动画

飞行精灵到达闹钟后，触发：

1. 飞行精灵淡出消失（alpha 1 → 0，50ms）✅
2. 闹钟执行弹跳：scale 1 → 1.3 → 1，共 200ms，使用弹性缓动（spring ease）✅
3. 时间数字短暂高亮：颜色从默认色变为金色，持续 300ms 后渐回原色 ✅（`header.ts` `updateHighlight`）

三个动作可略微错开（各差 30–50ms）形成连续节奏感。

---

## 7. Header UI

### 7.1 布局参考

```
┌────────────────────────────────────────────────┐
│  [提示公式]  3 + 7 = 10    [⏰] 042   [⚙] [♥♥♥] │
└────────────────────────────────────────────────┘
```

- **提示公式**：白底圆角标签，数字风格与格子一致，展示当前 Target 的一种配对示例
- **时间显示**：闹钟图标 + 三位数字，时间紧张时（< 10s）数字变红并轻微抖动
- **命数图标**：3 颗心形图标（或便签风格的其他图标），失去一条命时对应图标执行碎裂动画后消失
- **设置按钮**：齿轮或汉堡图标，风格与整体一致

### 7.2 时间预警

当剩余时间 < 10 秒时：
- 时间数字变红（`#FF5252`）
- 数字执行轻微左右抖动（振幅 2–3px，频率约 10fps）
- 背景可选：Header 背景颜色轻微变暖（加一层低透明度红色蒙版）

---

## 8. 大厅场景

### 8.1 整体概念

大厅以**手绘藏宝地图**为视觉隐喻：一张铺开的米黄/牛皮纸上，用简笔画风格描绘出一片小世界，一条蜿蜒的探险小路将 19 个关卡节点依次串联。整体风格延续文具/便签本主题——地图本身就像是玩家在方格本上信手涂鸦的冒险路线图。

所有 19 个节点通过 `lobbyLayout.ts` 静态定位于同一屏幕内，**不需要滚动**。

---

### 8.2 背景图

背景为一张覆盖整个屏幕的静态图片（`lobby_bg.png`），宽高与游戏画布一致。

**底色与纸张感**

| 属性 | 规格 |
|------|------|
| 底色 | 牛皮纸米黄，参考色 `#F5EDD6` |
| 纹理 | 轻微纸张颗粒感（噪点透明度 8–12%），避免高频细节 |
| 边缘 | 四周可有轻微暗角（vignette），增加手工感 |

**地图装饰元素（手绘简笔画风格）**

装饰元素分布于路径两侧的空白区域，透明度 60–80%，不进入关卡节点所在区域：

- 小树丛、圆形灌木
- 石头、小山丘
- 旗帜或路牌（可标注关卡组名，如「第一章」）
- 数学符号涂鸦（`+`、`=`、`?`）作为点缀
- 局部阴影晕染，增加地图的层次感

**色调参考**

暖棕、橄榄绿、土黄为主，避免高饱和色块，整体保持手绘水彩/彩铅的克制感。

**AI 图片生成参考 Prompt**

```
A hand-drawn adventure map illustration on warm beige kraft paper (#F5EDD6),
featuring a winding dirt path connecting 19 numbered stops,
surrounded by simple sketch-style decorations: small trees, bushes, rocks, hills,
and scattered math symbols (+, =, ?).
Warm brown, olive green, and earthy yellow palette.
Watercolor pencil style, soft edges, slight paper grain texture.
Vertical composition, 9:16 aspect ratio.
No characters, no text labels. Transparent decorations, clean path line.
--ar 9:16 --v 6 --style raw
```

---

### 8.3 探险小路

小路是连接所有关卡节点的视觉主线，采用手绘虚线风格（类似铅笔描绘的点划线），宽约 12–16px，颜色为深棕 `#6D4C41`，透明度 80%。

路径分两段状态显示：

| 段落 | 视觉 |
|------|------|
| **已通过段**（节点 ≤ 当前最高进度） | 正常显示，深棕实线或虚线 |
| **未解锁段** | 透明度降至 30%，颜色变灰，表示尚未踏足 |

路径本身为静态图层（跟随背景图），不需要独立动画。✅（`lobbyScene.ts` `refreshPath`，Graphics 虚线，lineWidth=6）

---

### 8.4 关卡节点

每个节点为**圆形**，内部显示关卡编号（使用与游戏相同的数字精灵）。节点直径建议 100px（逻辑像素）。

| 状态 | 视觉表现 |
|------|----------|
| **已通关** | 暖白底色 `#FAFAF8`，数字正常显示，无额外装饰 |
| **当前关**（最高进度） | 金色描边 `#EAB830` + 轻度外发光，微弱脉冲动画（scale 1 → 1.03 循环，800ms）✅ |
| **未解锁** | 灰色底色 `#BDBDBD`，透明度 50%，数字同步变灰，无图标 |

节点沿小路路径排布，相邻节点间距约 180–220px（逻辑像素），确保路径曲线自然且节点不拥挤。

---

### 8.5 每日挑战入口图标

#### 位置

固定于地图左侧中部区域，不依附于小路路径，作为地图上的「特殊地点」独立存在。逻辑坐标约为地图总高度的 **50%** 处、距左边缘 **80–100px**，放置在路径左侧的空地（树丛之间）。随地图整体滚动，不固定在屏幕上。

#### 形态

| 属性 | 规格 |
|------|------|
| 形状 | **圆形**，与关卡节点同族，但直径更大：**130px**（逻辑像素） |
| 底色 | 深琥珀金 `#C8862A`，带轻微径向亮光（中心略亮约 15%），强调「特殊」感 |
| 描边 | 深棕 `#6D4C41`，宽度 3–4px，与地图路径颜色呼应 |
| 投影 | offset (3, 4)px，blur 6px，透明度 35%，比关卡节点投影稍重以突出层级 |

#### 图标内容

圆形内绘制**排行榜柱状图标**，由三根竖柱组成（类似 🏆 奖台侧视图）：

```
  ┌─┐
  │ │ ← 中柱最高（金色 #FFD700），代表第 1 名
┌─┤ ├─┐
│ │ │ │ ← 左右柱较低（白色 #FAFAF8），代表第 2、3 名
└─┴─┴─┘
```

- 三柱整体居中，占圆直径的 **55%**
- 描边：深棕 `#5D4037`，宽约 2px
- 柱底可加一条横线（底座）

圆形**正下方**（圆外，间距 8px）显示文字标签：

| 属性 | 规格 |
|------|------|
| 内容 | `每日挑战` |
| 字体 | 与数字精灵同族粗圆体，或系统粗体 |
| 颜色 | 深棕 `#5D4037`，白色描边 2px |
| 尺寸 | 约 22px（逻辑像素） |

#### 动画

| 动画 | 参数 |
|------|------|
| 常态呼吸光晕 | 外发光 radius 8 → 14px，循环 1200ms，ease-in-out，颜色金色 `#FFD700` 透明度 50% ✅ |
| 点击反馈 | scale 1 → 0.92 → 1，100ms，spring ease ✅ |

无锁定状态，无需灰色变体——进入大厅即表示已通关第 1 关，图标始终以激活态显示。

#### AI 图片生成参考 Prompt（如需预渲染）

```
A circular game map icon, deep amber gold background (#C8862A), dark brown outline (#6D4C41),
featuring a simple leaderboard bar chart inside: three vertical bars, center bar tallest in gold,
side bars shorter in white, bold flat style, no gradient, transparent background,
centered on 260x260 canvas. Hand-drawn adventure map aesthetic. --ar 1:1 --v 6 --style raw
```

---

### 8.6 标题区域

大厅顶部（关卡 19 上方）放置游戏 Logo，使用 `logo.png`，居中显示，宽度约为画布宽的 60%。✅（`lobbyScene.ts` `buildLogo`）

---

### 8.7 层级结构

```
z 层级（从底到顶）
├── 背景层：手绘地图大图（随滚动位移）
├── 路径层：探险小路（静态，已通过段 / 未解锁段）
├── 节点层：关卡圆形节点 + 数字精灵
├── 特殊节点层：每日挑战入口圆形图标 + 文字标签
├── 状态层：勾 / 锁 / 脉冲光圈 / 每日挑战呼吸光晕
└── UI 层：顶部 Logo 横幅 / 底部固定导航栏（如有）
```

---

## 9. 素材清单

### 9.0 实现方式总览

| 元素 | 实现方式 | 说明 |
|------|----------|------|
| 游戏背景 | **程序绘制** | Graphics 画矩形 + 网格线 |
| 格子（普通/选中） | **程序绘制** → `generateTexture` | `cell.png` / `cell_selected.png` |
| 闹钟表盘 | **程序绘制** → `generateTexture` | `clock_face.png`，圆形 + 刻度 |
| 闹钟指针 | **程序绘制** → `generateTexture` | `clock_hand.png`，独立旋转 |
| 加号 | **程序绘制** → `generateTexture` | `plus.png`，用于飞行加时动画 |
| 等号 | **程序绘制** → `generateTexture` | `equa.png` |
| 字母 s | **程序绘制** → `generateTexture` | `s.png`，用于飞行加时动画（"+2s" 中的 "s"） |
| 按钮图标 | **程序绘制** → `generateTexture` | `retry.png` / `next.png` / `lobby.png` / `settings.png`；**v1.1 起每个图标外加背景圆角矩形框（见下方规格）** |
| 数字 0–9 | **图片（脚本预生成）** | `digits.png` 精灵图，运行时切片为 `0.png`–`9.png`（120×160px/帧） |
| 心形图标 | **图片** | `heart.png` / `heart_empty.png`，见下方规格 |
| 消除序列帧 | **图片** | `explosion.png` + `explosion.json` 图集 |
| 大厅地图背景 | **图片** | `lobby_bg.png` |
| 每日挑战图标 | **图片** | `daily_challenge_icon.png` |
| 星星 / 奖杯 / 火焰 / 音乐 | **图片** | `star.png` / `trophy.png` / `fire.png` / `music.png` |
| 大厅节点锁/勾 | **无需图片** | 仅用颜色区分状态，见 8.4 节 |

---

### 9.1 图片素材（src/assets/）

| 素材 | 说明 | 尺寸（@2x） |
|------|------|------------|
| `digits.png` | 数字 0–9 横向精灵图（脚本生成），运行时按帧宽 120px 切片 | 1290 × 160 |
| `heart.png` | 命数图标·满（见下方规格） | 160 × 160 |
| `heart_empty.png` | 命数图标·空（见下方规格） | 160 × 160 |
| `explosion.png` + `explosion.json` | 消除粒子图集，用于数字消除时的碎裂特效 | 各帧不超过 64 × 64 |
| `lobby_bg.png` | 大厅手绘地图背景（见第 8 节） | 与画布等宽等高（9:16） |
| `logo.png` | 游戏 Logo（见 8.6 节） | — |
| `daily_challenge_icon.png` | 每日挑战入口图标（见 8.5 节） | 260 × 260 |
| `star.png` | 星星图标（关卡大厅星级显示） | — |
| `trophy.png` | 奖杯图标 | — |
| `fire.png` | 火焰图标 | — |
| `music.png` | 音乐图标 | — |

### 9.1.1 心形图标规格

`heart.png` 以图片形式提供，通过 `generateTexture()` 等效复用。

| 属性 | 规格 |
|------|------|
| 尺寸 | 80 × 80px（@2x 输出 160 × 160） |
| 填色 | 珊瑚红 `#FF6B6B` |
| 描边 | 深红 `#C0392B`，宽度约 3–4px |
| 风格 | 饱满圆润心形，无渐变，无阴影，透明背景 |
| 变体 | 两张：`heart.png`（满）/ `heart_empty.png`（空，灰色 `#BDBDBD`） |

失去命数时，对应心形执行 scale pop 动画（1→1.3→0，230ms），动画结束后切换为 `heart_empty.png`。✅（`header.ts` `triggerHeartLost`）

**AI 图片生成参考 Prompt（两张分别生成）**

```
A single cute heart icon, coral red fill (#FF6B6B), dark red outline (#C0392B),
bold rounded style, flat design, no gradient, no shadow, transparent background,
centered on 160x160 canvas. Clean game UI asset. --ar 1:1 --v 6 --style raw

A single cute heart icon, gray fill (#BDBDBD), dark gray outline (#9E9E9E),
bold rounded style, flat design, no gradient, no shadow, transparent background,
centered on 160x160 canvas. Empty/depleted state. --ar 1:1 --v 6 --style raw
```

---

### 9.2 可选素材 ✅（v1.2 全部已实现）

| 素材 | 说明 | 状态 |
|------|------|------|
| `deco_pencil.png` | 游戏场景 + 大厅背景装饰·铅笔 | ✅ 已加载 |
| `deco_eraser.png` | 游戏场景 + 大厅背景装饰·橡皮擦 | ✅ 已加载 |
| `deco_paperclip.png` | 游戏场景 + 大厅背景装饰·回形针 | ✅ 已加载 |
| `combo_glow.png` | 连消激活时格子额外发光层（程序生成） | ✅ 已实现 |

> `combo_glow.png` 通过 `drawComboGlow()` 程序绘制生成，无需提供图片文件。连消2 着色为金黄 `#FFD700`，连消3+ 着色为亮绿 `#76FF03`，混合模式 `ADD`。

---

### 9.3 按钮背景框规格（v1.1 新增）

当前 `retry.png` / `next.png` / `lobby.png` / `settings.png` 仅包含图标本身，无背景框，视觉上悬浮感不足。

**修改方案：** 在 `graphicsFactory.ts` 中新增 `drawButtonBackground(g, size)` 函数，并在 `webAssetsManager.ts` 生成各按钮纹理时先调用背景函数、再绘制图标。

#### 背景框参数

| 属性 | 规格 |
|------|------|
| 填色 | 暖皮纸 `0xEEDFBD`（与大厅节点 `nodeFill` 一致） |
| 边框颜色 | 暖金 `0xC4A870`（与 `nodeBorder` 一致） |
| 边框宽度 | `max(3, size * 0.025)` |
| 圆角半径 | `size * 0.20` |
| 投影 | offset (2, 3)px，暗棕 `0x3D2200`，alpha 0.20 |
| 顶部高光条 | 白色 alpha 0.15，高度 `size * 0.35`，圆角与主体一致，模拟凸面高光 |

#### 图标缩放

加背景框后，图标本身在纹理内的占比缩减，避免紧贴边缘：

| 按钮尺寸 | 图标绘制区偏移 | 图标有效区 |
|---------|-------------|-----------|
| 200px（retry / next / lobby） | 四边内缩 `size * 0.16`（≈ 32px） | 136 × 136px |
| 80px（settings） | 四边内缩 `size * 0.14`（≈ 11px） | 58 × 58px |

#### 代码参考

```typescript
// graphicsFactory.ts（新增）
export function drawButtonBackground(g: PIXI.Graphics, size: number): void {
  const r   = Math.round(size * 0.20);
  const bw  = Math.max(3, Math.round(size * 0.025));
  // Drop shadow
  g.lineStyle(0);
  g.beginFill(0x3D2200, 0.20);
  g.drawRoundedRect(2, 3, size, size, r);
  g.endFill();
  // Main body
  g.lineStyle(bw, 0xC4A870, 1);
  g.beginFill(0xEEDFBD);
  g.drawRoundedRect(0, 0, size, size, r);
  g.endFill();
  // Top highlight
  g.lineStyle(0);
  g.beginFill(0xFFFFFF, 0.15);
  g.drawRoundedRect(bw, bw, size - bw * 2, size * 0.35, r - 2);
  g.endFill();
}

// webAssetsManager.ts（修改示例，以 next.png 为例）
this.textures['next.png'] = makeTexture(renderer, g => {
  drawButtonBackground(g, BTN_SIZE);
  const pad = Math.round(BTN_SIZE * 0.16);
  // 平移画笔坐标使图标居中
  g.position.set(pad, pad);           // ← 伪代码，实际需将图标函数接受 offset 参数
  drawNextIcon(g, BTN_SIZE - pad * 2);
}, BTN_SIZE);
```

> **实现提示**：最简单的做法是给 `drawRetryIcon` / `drawNextIcon` / `drawLobbyIcon` 各自增加 `(x, y, size)` 偏移参数，调用时传入 `pad` 值，而不需要修改 Graphics 坐标系。

---

## 10. 连消视觉反馈（已确认）

连消（combo）视觉反馈采用以下组合方案：

### 方案 B：粒子增强（已实现）

`effect.ts` 中 `isCombo` 分支已差异化处理：

| 层级 | 普通 | 连消 |
|------|------|------|
| 大碎片 | 2 | 3 |
| 中碎片 | 2 | 3 |
| 小碎片 | 4 | 8 |
| 尘埃 | 2 | 4 |
| 尘云 | — | +1 dust_cloud |

连消粒子速度范围和存活时长也略高于普通，整体视觉爆发感更强。

### 方案 C：扩散光圈（已实现）

连消时，两个消除格子各出现一圈扩散光圈（`ComboRipple`，`effectManager.ts` 内部管理）：

| 属性 | 规格 |
|------|------|
| 形状 | Graphics 圆环（lineStyle，不填充） |
| 起始半径 | `gridSize * 0.5`（即格子内切圆半径） |
| 结束半径 | `gridSize * 1.0` |
| 颜色 | 连消2：金黄 `#FFD700`；连消3+：亮绿 `#76FF03` |
| 线宽 | 3px |
| 时长 | 200ms，linear |
| alpha | 1 → 0（线性淡出） |

实现为对象池，无额外 GC 压力。

### 方案 A：屏幕边缘泛光 ✅（v1.2 已实现）

高连消（≥3）时叠加屏幕边缘泛光（`comboVignette`，`gameScene.ts`）：

| 属性 | 规格 |
|------|------|
| 实现 | `PIXI.Graphics` 四边矩形，程序绘制 |
| 深度 | `min(w, h) * 0.18` |
| alpha | 连消3：金黄 `#FFD700`，连消4+：亮绿 `#76FF03`，填充 alpha 0.15 |
| 淡出 | 触发后约 400ms 线性衰减至 0 |
| 层级 | 位于特效层之上、结果浮层之下 |

---

## 11. 动画参数速查

| 动画 | 时长 | 缓动 | 实现 |
|------|------|------|------|
| 格子消除（冲击帧） | 50ms | linear | ✅ |
| 格子消除（碎裂） | 150ms | ease-out | ✅ |
| 粒子消散 | 150ms | ease-out | ✅ |
| 加时精灵飞行（总） | 300ms | 弹出 100ms + 停留 100ms + quadratic ease-in | ✅ |
| 闹钟弹跳 | 200ms | sin 弧（峰值 ×1.25） | ✅ |
| 时间数字高亮 | 300ms | ease-in-out | ✅ |
| 命数图标 pop | 230ms | scale 1→1.3→0 | ✅ |
| 当前关脉冲 | 800ms 循环 | sin | ✅ |
| 每日挑战光晕呼吸 | 1200ms 循环 | sin | ✅ |
| 每日挑战点击弹性 | 100ms | sin arc | ✅ |
| 时间预警数字抖动 | 持续，sin 100ms/周期 | sin | ✅ |

> **实现提示**：最简单的做法是给 `drawRetryIcon` / `drawNextIcon` / `drawLobbyIcon` 各自增加 `(x, y, size)` 偏移参数，调用时传入 `pad` 值，而不需要修改 Graphics 坐标系。

---

## 12. 小关过关庆祝动画 ✅（v1.2 已实现）

### 12.1 触发时机

每次清除单个 Target（即 `onTargetCleared()` 检测到仍有剩余 target 时），在进入下一个 target 之前播放庆祝动画。最后一个 target 清除时不触发（直接显示关卡结算 `GameResultOverlay`）。

### 12.2 视觉描述

屏幕中央弹出一个数字 Banner，展示刚刚通过的 Target 数值，同时棋盘上多处爆发粒子效果，持续约 900ms 后自动进入下一个 target。

**Banner 元素：**
- 背景：`drawPanel` 圆角面板，宽 500px、高 280px，居中于屏幕
- 核心内容：已清除的 target 数值（`DigitDisplay`），字号约为正常棋盘内数字的 2 倍
- 文字标签："CLEAR!" 用与 Header 一致的 `drawLetterS` 风格手写字（或跳过，仅显示大数字）
- 粒子：在棋盘格子层随机选取 4–6 个位置，触发 `effectManager.playEffect()`

**动画时序（总时长 900ms）：**

| 阶段 | 时间 | 内容 |
|------|------|------|
| Pop-in | 0–200ms | Banner 从 scale 0.2 → 1.0，cubic ease-out（1−(1−t)³） |
| Hold | 200–900ms | Banner 静止显示；粒子在进入时立即触发（4–6 随机格子） |
| Done | 900ms | Banner 销毁，回调 `startCurrentTarget()`，`isPause = false` |

> 淡出阶段当前版本省略，Banner 在 900ms 时直接移除。后续可加入 alpha 淡出。

### 12.3 游戏状态

动画播放期间 `state.isPause = true`，防止输入和时间推进。动画结束后在调用 `startCurrentTarget()` 前重置 `state.isPause = false`。

时间池（`state.timeRemainingMs`）在 `startCurrentTarget()` 内部调用 `state.addTime(30_000)` 补充，不需要提前处理。

### 12.4 建议实现方式

在 `gameScene.ts` 中新增私有方法，**不需要新建独立文件**：

```typescript
// gameScene.ts（新增）
private showTargetClearCelebration(clearedTarget: number, onDone: () => void): void {
  this.state.isPause = true;

  // 1. 建 Banner 容器
  const banner = new PIXI.Container();
  const bg = new PIXI.Graphics();
  drawPanel(bg, 500, 280);
  bg.x = (this.screen.width  - 500) / 2;
  bg.y = (this.screen.height - 280) / 2;
  banner.addChild(bg);

  // 2. 数字显示（复用 DigitDisplay）
  const display = new DigitDisplay(this.ctx, 2);  // scale factor 2
  display.setValue(clearedTarget);
  display.x = this.screen.width  / 2;
  display.y = this.screen.height / 2;
  banner.addChild(display);

  this.addChild(banner);
  banner.scale.set(0);

  // 3. 粒子位置：target 清除时棋盘已全空，直接从网格坐标范围随机取 index。
  //    effectManager.playEffect() 内部只用 screen.indexToPos(index) 换算屏幕坐标，
  //    不关心格子是否存在，因此不需要格子有数字。
  const total = this.screen.cols * this.screen.rows;
  const indices: number[] = [];
  while (indices.length < 5) {
    const idx = Math.floor(Math.random() * total);
    if (!indices.includes(idx)) indices.push(idx);
  }
  let particleTimer = 0;

  // 4. Ticker 驱动动画
  let elapsed = 0;
  const TOTAL = 900;
  const onTick = (deltaMs: number) => {
    elapsed += deltaMs;
    particleTimer += deltaMs;

    // 粒子分批（每 60ms 一批）
    if (particleTimer > 60 && indices.length > 0) {
      this.effectLayer.playEffect(indices.shift()!, false, 1);
      particleTimer = 0;
    }

    // Pop-in: 0–120ms
    if (elapsed < 120) {
      const t = elapsed / 120;
      const s = t < 0.7 ? (t / 0.7) * 1.08 : 1.08 - (t - 0.7) / 0.3 * 0.08;
      banner.scale.set(s);
    } else if (elapsed < 700) {
      banner.scale.set(1);
    } else {
      // Fade-out: 700–900ms
      const t = (elapsed - 700) / 200;
      banner.alpha = 1 - t;
      banner.scale.set(1 - t * 0.15);
    }

    if (elapsed >= TOTAL) {
      this.removeChild(banner);
      banner.destroy({ children: true });
      this.state.isPause = false;
      onDone();
    }
  };

  // 挂到 gameScene 的 update() 或用临时 PIXI.Ticker
  this._celebrationTick = onTick;
}

private _celebrationTick: ((deltaMs: number) => void) | null = null;

// 在 update() 中添加调用：
public update(deltaMs: number): void {
  this._celebrationTick?.(deltaMs);
  if (this._celebrationTick) return;   // 动画期间跳过其余更新
  // ... 原有 update 逻辑
}
```

`screen.cols` 和 `screen.rows` 在 `ScreenConfig` 上已有，网格 index 范围 `[0, cols * rows)`，无需改动 `logic.ts`。

### 12.5 动画参数速查

| 动画 | 时长 | 缓动 |
|------|------|------|
| Banner pop-in | 120ms | ease-out（0→70%: linear 0→1.08，70%→100%: 1.08→1.0） |
| Banner hold | 580ms | 静止 |
| Banner fade-out | 200ms | linear（alpha + scale） |
| 粒子触发 | 每 60ms 一批，共 ~5 次 | — |
| 总时长 | **900ms** | — |
