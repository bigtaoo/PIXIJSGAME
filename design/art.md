# 数字消除游戏 美术文档

**版本：** v1.8  
**日期：** 2026年6月  
**关联文档：** 策划文档 v1.0

---

## 1. 整体风格定位

### 1.0 美术大方向（v1.8 更新，2026-06-11）

**定位：水彩柔和·休闲亲切版。** 从"大众豪华感"转向更轻盈、眼睛友好的视觉风格。

**决策依据（v1.8 风格切换）：**

- v1.7 金色 3D 方向：描边太重、浮雕感强、多色饱和同时出现 → 视觉"刺眼"
- 新方向：muted pastel 底色 + 暖棕白描边数字 + 弱化的格子阴影 → 整体柔和，降低视觉疲劳
- 参考：NYT Games、休闲益智类移动游戏

**核心原则：**

1. **柔和优先**——格子颜色降饱和度，无高饱和金属感
2. **层级清晰**——数字用暖棕深色 + 白描边，保证在所有 tier 底色上可读
3. **去除过度装饰**——格子阴影极弱、高光透明度极低，接近扁平但保留微弱立体感
4. **风格一致性**——数字、格子、选中状态统一调整

**执行顺序（每步先出预览对比，确认后再部署）：**

| 步骤 | 内容 | 状态 |
|------|------|------|
| ① | 金色 3D 数字（程序化生成，见 2.1） | 进行中 |
| ② | 格子微调配套：底色略加深、内阴影"嵌在木板里"感，衬托金色数字 | 待开始 |
| ③ | 图标升级（爱心/时钟/星星/按钮跟随数字风格） | 待开始 |
| ④ | 动效粒子密度加码（消除爆裂感、连击冲击力） | 待开始 |
| ⑤ | CrazyGames 封面图/缩略图（对转化数据影响最大，单独认真做） | 待开始 |

**主题：文具 / 便签本**

游戏画面以「在草稿纸上做数学题」为视觉隐喻，整体风格温暖、干净、易读。这一选择基于以下考量：

- 「数字写在纸上」是玩家最熟悉的数字呈现形式，认知门槛最低
- 浅色系背景对两端（CrazyGames / 微信小游戏）均有良好适配性
- 便签卡片风格易于实现三种清晰的格子状态
- 后期换皮成本低，节日主题可通过替换背景纹理和装饰元素实现

**色调参考：** 暖白 / 米黄为主，搭配饱和度适中的点缀色（金黄、天蓝、珊瑚红）

---

## 2. 数字

### 2.1 字形与质感（v1.8 水彩扁平版）

| 属性 | 规格 |
|------|------|
| 字体风格 | 粗圆体（NotoSans-Bold + 微圆角处理） |
| 填色 | 近白 `#FFFCF8` |
| 描边 | 暖棕 `#8B5E30`，宽约字号 3%，外侧轻微高斯模糊软化 |
| 指纹纹理 | 水平正弦波浪线，间距 8px，振幅 2.5px，暖棕 `#B4824B`，alpha 38（若隐若现） |
| 3D 挤出 | **无** |
| 高光 | 顶部极弱暖白 bevel strip（alpha ≈ 0.45×，仅一层） |
| 对齐 | 视觉居中 |

**生成管线（程序化，可复现）：**

1. 脚本：`tools/generate_digits_watercolor.py`（Python + PIL），4× 超采样渲染后 LANCZOS 缩到目标尺寸
2. 渲染层序（自底向上）：暖棕描边（硬边 + 软发光） → 近白填充 → 波浪纹理（alpha 38） → 顶部极弱高光
3. 关键参数：`FILL_COLOR=(255,252,248)`，`OUTLINE_CLR=(139,94,48)`，`WAVE_COLOR=(180,130,75)`，`WAVE_ALPHA=38`
4. 输出 `digits.png`：1000 × 160，10 帧 × 100 × 160px，gap 0（与 `webAssetsManager.ts` 的 `DIGIT_W=100, DIGIT_H=160, DIGIT_GAP=0` 严格一致）
5. **三处副本必须同步**：`src/assets/digits.png`、`wechatgame/assets/digits.png`、`tools/digits.png`
6. 替换纹理后检查 `numbers.ts` `layoutTwoDigits` 的 `-15` 硬编码偏移（依赖字形留白，留白变了要微调）

**历史版本记录：**

- v1.0–1.5：米色填充+深棕粗描边+纸纹理（已弃用）
- v1.7：金色 3D 挤出版（Poppins-Bold，描边太重，视觉疲劳，已替换）
- v1.8：水彩扁平版初版（NotoSans-Bold，暖棕填充+白描边）
- v1.8 定稿：近白填充+暖棕描边+波浪指纹纹理 alpha 38

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

### 3.1 视觉形态 ✅（v1.3 已实现）

每个格子为**圆角矩形立体卡片**，采用三层结构模拟 3D 按钮感：

| 层 | 内容 | 参数 |
|----|------|------|
| Layer 1：底部阴影条 | 同底色加深 12%（v1.8，原 28%），圆角矩形，偏移 `size × 4%`（原 10%） | 极弱厚度暗示 |
| Layer 2：主体面 | 当前 tier 颜色 + 细边线（同色加深 18%，alpha 0.7），圆角矩形 | 正面可见区域 |
| Layer 3：高光椭圆 | 白色 alpha 0.10（v1.8，原 0.38），随机数量 / 位置 | 几乎透明，保留结构 |

格子之间保留 **5px 间距**（GAP = 5），避免拥挤感。

### 3.2 颜色分档（Tier 系统）✅（v1.3 已实现）

格子颜色根据数字值与当前 Target 的比例自动分配，共三档：

| Tier | 颜色 | hex | 对应数值范围 |
|------|------|-----|------------|
| 0 — 小数 | muted 天蓝 | `#D5E8F2` | `value ≤ (target-1) / 3` |
| 1 — 中数 | 暖沙色 | `#F0E8D5` | `value ≤ (target-1) × 2/3` |
| 2 — 大数 | 柔玫瑰 | `#F2D5D5` | 其余 |

> v1.8 变更：三色整体降饱和，从"天蓝/奶油/珊瑚"→"muted 天蓝/暖沙/柔玫瑰"，配合暖棕数字。

Tier 颜色随 target 数值动态重算，同一 target 内保持不变。实现：`Grid.tierForValue(value, target)` + `Grid.setCellTier(idx, tier)`。

### 3.3 高光椭圆随机规则

每格在纹理生成时随机选取以下三种模式之一，位置同时随机，生成后固定（非逐帧随机）：

| 模式 | 数量 | 尺寸 |
|------|------|------|
| 1 个大椭圆 | 1 | `rx ≈ 18–27%`，`ry ≈ 9–14%` |
| 2 个中椭圆 | 2 | `rx ≈ 11–16%`，`ry ≈ 6–9%`，分布左右两侧 |
| 3 个小椭圆 | 3 | `rx ≈ 7–11%`，`ry ≈ 4–6%`，分布左中右 |

每种 tier 颜色生成 6 个随机变体（`GLOSS_PER_COLOR = 6`），共 18 张纹理，key 格式：`cell_t{tier}_g{glossIdx}.png`。每个格子在初始化时随机选取一个 gloss 变体并持久保留。

### 3.4 状态定义

| 状态 | 视觉表现 | 触发条件 |
|------|----------|----------|
| **默认** | Tier 颜色 + 3D 阴影 + 随机高光 | 未被选中、未消除 |
| **选中** | 金黄描边 `#EAB830` + 轻度外发光，底色略亮 | 玩家点击选中 |
| **消除中** | 执行碎裂动画（见第 5 节），动画结束后格子消失（不留占位） | 配对成功瞬间 |

### 3.5 格子动画 ✅（v1.4 新增）

**点击弹性（Cell Bounce）**

玩家选中格子时，选中高光精灵执行一次 scale pop 动画：

| 参数 | 值 |
|------|----|
| 时长 | 120ms |
| 峰值 scale | 1.12 |
| 阶段 | Phase 1（0–60ms）：1.0 → 1.12 线性；Phase 2（60–120ms）：1.12 → 1.0 线性 |
| 实现 | `Grid.updateBounce()`，`showSelection()` 触发，`hideSelection()` 取消 |

**格子闲置呼吸（Cell Idle Shimmer）**

游戏进行中，随机可见格子周期性执行一次 alpha 呼吸，提升画面活跃感：

| 参数 | 值 |
|------|----|
| 触发间隔 | 约 1600ms，±25% 随机抖动 |
| 动画时长 | 500ms（前半下降，后半回升） |
| Alpha 最低值 | 0.78（midpoint） |
| 最大同时数量 | 2 个 |
| 安全机制 | 仅选取 `alpha === 1` 的可见格子；`hideCell()` 取消进行中的 pulse |
| 实现 | `Grid.updateIdle()` + `spawnIdlePulse()`，每帧由 `GameScene.update()` 驱动 |

### 3.5 格子尺寸

代码中 `gridSize = 120`（逻辑像素），即每格 **120 × 120**。纹理以 **120 × 120** 程序生成（`CELL_BASE = 120`），显示时 width/height 均设为 `gridSize - 5`（即 115px）。

---

## 4. 游戏背景

### 4.1 主背景 ✅（v1.3 已实现）

**暖色格子纸纹理**，程序绘制（`drawBackground()`，`graphicsFactory.ts`）。

| 属性 | 规格 |
|------|------|
| 底色 | 米白 `C.bgFill`（接近 `#FAFAF8`） |
| 格线颜色 | 暖棕褐 `#B8A88A` |
| 次格线 | 间距 24px，宽 0.8px，alpha 0.22 |
| 主格线 | 每 4 格一条（间距 96px），宽 1.2px，alpha 0.40 |
| 交叉点 | 次格线交叉处绘制小圆点（半径 1.2px，alpha 0.28） |
| 暗角（vignette） | 四边各 `min(w,h) × 18%` 深棕渐进条带，8 层二次方 alpha 衰减，最大 alpha 0.05 |

要求：
- 网格线可见但不抢格子视觉，与格子层形成"写在纸上"的层次感
- 主格线比次格线明显，便于视觉分区
- 暗角仅微弱提示，不影响格子辨识

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

- **提示公式**：暖奶油底色圆角槽位，展示当前 Target 的配对示例
- **时间显示**：闹钟图标 + 三位数字，时间紧张时（< 10s）数字变红并轻微抖动
- **命数图标**：3 颗心形图标，失去一条命时对应图标执行碎裂动画后消失
- **设置按钮**：汉堡线图标，风格与整体一致

### 7.1.1 Header 背景条 ✅（v1.3 已实现）

Header 定位为浮于格子纸背景之上的独立面板，采用暖羊皮纸色。

| 层 | 内容 | 参数 |
|----|------|------|
| 底部阴影 | 深棕 `#3D2200`，alpha 0.18，向下偏移 5px | 制造悬浮 / 抬升感 |
| 主体面板 | 暖羊皮纸 `#EAD5A8`，暖金边框 `#C4A068`（alpha 0.55，1.5px） | 与格子纸底色形成对比 |
| 顶部高光 | 白色 alpha 0.18，高度约 38% | 轻微凸起感 |
| 圆角 | 16px | — |

### 7.1.2 提示槽位（? 格）✅（v1.3 已实现）

| 属性 | v1.2（旧） | v1.3（新） |
|------|-----------|-----------|
| 边框颜色 | 灰色 `#BBBBBB` | 暖金 `#C4A068`，alpha 0.80 |
| 填充色 | 白色 `#F0F0F0` | 暖奶油 `#F5E8C8` |
| 问号颜色 | 灰色 `#BBBBBB` | 暖棕 `#8B6030` |
| + / = 尺寸 | 与槽位等大 | 槽位的 **2/3**，在格内居中 |

### 7.1.3 时钟 ✅（v1.3 已实现）

时钟采用三层同心圆结构，程序绘制（`drawClockFace()`），含 12 个刻度：

| 层 | 颜色 | 说明 |
|----|------|------|
| 投影圆 | 深棕 alpha 0.22，偏移 (1.5, 2.5) | 立体悬浮感 |
| 外圈（深棕边框） | `#7A5530` | 表圈 rim |
| 金色内环 | `#E8C060` | bevel 高光 |
| 表盘面 | `#FFF8F0`（近白暖色） | 警告时 tint 为红色 `#FF5252` |

刻度规格：
- 4 个主刻度（12/3/6/9 点）：宽约 `radius × 6%`，长约 `radius × 22%`，alpha 1.0
- 8 个次刻度：宽约 `radius × 4%`，长约 `radius × 13%`，alpha 0.65

表盘中心绘制实心圆点（`radius × 9%`，深棕 `#6B4C2A`）。

纹理分辨率：`CLOCK_RADIUS = 80`（160×160px），竖屏显示 158×158px，接近 1:1。

指针比例（相对 `clockSize`）：宽 6.3%，高 35%，轴心在顶端中心，位于表盘中心。

### 7.2 时间预警

当剩余时间 < 10 秒时：
- 时间数字变红（`#FF5252`）
- 时钟表盘整体 tint 为 `#FF5252`（面盘呈鲜红，指针呈深红）
- 数字执行轻微左右抖动（振幅 3px，sin 周期 ~100ms）

---

## 8. 大厅场景

### 8.1 整体概念

大厅以**手绘藏宝地图**为视觉隐喻：一张铺开的米黄/牛皮纸上，用简笔画风格描绘出一片小世界，一条蜿蜒的探险小路将 19 个关卡节点依次串联。整体风格延续文具/便签本主题——地图本身就像是玩家在方格本上信手涂鸦的冒险路线图。

所有 19 个节点通过 `lobbyLayout.ts` 静态定位于同一屏幕内，**不需要滚动**。

---

### 8.2 背景图

背景为覆盖整个屏幕的静态图片，**仅一张横屏图**，竖屏时整图旋转 90° 复用（v1.6 修订）：

| 素材 | 尺寸（@1x） | 比例 |
|------|------------|------|
| `lobby_bg.png` | 1920 × 1080 | 16:9 |

**横竖屏规则** ✅（v1.6 已实现，`lobbyScene.ts` `updateBgSize()`：中心锚点 + 竖屏 `rotation = π/2` + 旋转后等效尺寸做 cover）

- 横屏：直接使用，cover 缩放（`max(canvasW/texW, canvasH/texH)`）铺满逻辑画布，居中裁剪。
- 竖屏：将图片**顺时针旋转 90°**（等效得到 1080 × 1920），再按相同 cover 规则铺满。分辨率与专门出竖屏图完全等效。
- 素材比例与目标画布一致，标准 16:9 / 9:16 屏幕下缩放系数 ≈ 1，**无明显放大与裁剪**；仅非标准比例屏幕（超宽屏、刘海屏）有少量边缘裁切，属预期行为。

**构图约束（旋转复用的前提）**

- **背景图不含路径**（v1.6 最终方案）：路基与进度虚线均由代码绘制（见 8.3 节），节点布局无需与背景图对齐，非标准比例屏幕的 cover 裁剪也不会造成错位。生成模型对路径的形态（实线/虚线/标线/长度/走向）控制太差，多次尝试后放弃图内路径。
- **方向性元素不画进图**：直立树木、旗帜、文字等旋转后会横躺，一律排除。文具装饰（铅笔、别针、橡皮擦）复用游戏场景现有精灵（`deco_pencil.png` / `deco_paperclip.png` / `deco_eraser.png`），由代码按横竖屏分别摆放（`buildLobbyDecos()`），旋转方向始终正确。
- **无方向点缀直接生成进图**：石头、对称涂鸦、墨点晕染等旋转后不违和的元素。注意水彩渍要选圆形/对称形态，下滴状颜料痕旋转后会横流。
- 纹理、暗角保持四向对称；点缀不进入四边 10% 区域（非 16:9 屏幕的 cover 裁剪带）。

> **历史问题（v1.5 及之前）**：旧版仅有一张 1024×1024 正方形 `lobby_bg.png`，横屏下被 cover 放大约 1.875 倍并裁掉上下 44%，导致分辨率明显不足。v1.6 起按上表重新出图。

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

生成工具：**Leonardo.ai**（app.leonardo.ai）。注意 Leonardo 不识别 Midjourney 语法（`--ar` / `--no` / `--style`），参数全部通过 UI 设置。

**UI 设置**

| 设置项 | 值 |
|--------|----|
| Aspect Ratio | 16:9（或 Custom 填 1920 × 1080） |
| Negative Prompt | Advanced Settings 中打开开关，填入下方 Negative Prompt 内容 |

**Prompt（正文，只写想要的内容）**

```
A warm beige aged kraft paper texture background,
mostly clean empty paper surface.
Lightly scattered subtle decorations:
about a dozen small gray rocks in loose clusters,
several soft round watercolor stains, scattered tiny ink dots.
Warm brown, olive green, and earthy yellow palette.
Watercolor pencil style, soft edges, slight paper grain texture, subtle vignette.
```

> 点缀密度基准：石头约 12 颗 + 水彩渍若干 + 墨点散布，以大面积留白为主——节点、路径、面板会占据画面大部分。

**Negative Prompt（填入独立输入框）**

```
road, path, trail, dirt road, lines, dashed line, dotted line,
text, letters, words, labels, numbers, writing, trees, forest, flags, banners,
compass, compass rose, map border, frame, legend, stars, starbursts,
buildings, animals, characters, icons, arrows, pencils, stationery,
X marks, crosses, footprints, paint drips
```

> **Prompt 写法要点（v1.6 教训）**：
> 1. 排除项写在正文里（"no trees, no text"）会让模型反而画出来，必须放 Negative Prompt 独立输入框。
> 2. Negative Prompt 是软约束，顽固元素（如指南针、小树）多 roll 几次挑一张。
> 3. 比例必须在 UI 里选 16:9，写进 prompt 无效（会出 1:1）。
> 4. 曾尝试把路径生成进图，但模型对线条形态控制太差（反复出现虚线、公路标线、长度不足、自我交叉），最终改为代码绘制（8.3 节）。正文已去掉 map / trail 字样，避免诱导地图元素。

---

### 8.3 探险小路

小路**完全由代码绘制**（v1.6 最终方案，`refreshPath()`），双层结构：

| 层 | 视觉 | 参数 |
|----|------|------|
| 路基 | 连续实线折线，连接全部节点中心 | 暖沙棕 `#C19A6B`，宽 22px，alpha 0.45，圆头端点 + 圆角拐点（`LINE_CAP.ROUND` / `LINE_JOIN.ROUND`） |
| 状态虚线 | 手绘抖动虚线，叠加在路基上 | 宽 6px，已通过段深棕 `#6D4C41` alpha 0.8，未解锁段暖棕 `#8B6E47` alpha 0.55 |

两层均按 `lobbyLayout` 节点坐标绘制，横竖屏自动适配，与背景图无对齐依赖。

路径分两段状态显示：

| 段落 | 视觉 |
|------|------|
| **已通过段**（节点 ≤ 当前最高进度） | 正常显示，深棕实线或虚线 |
| **未解锁段** | 透明度降至 30%，颜色变灰，表示尚未踏足 |

路径本身为静态图层（跟随背景图），不需要独立动画。✅（`lobbyScene.ts` `refreshPath`，Graphics 虚线，lineWidth=6）

**手绘抖动（v1.4 新增）**：每段虚线的两端各施加一个确定性垂直偏移（±3px），偏移值由 `Math.sin(segIdx × 7.3)` 计算，与重绘无关——同一路径每次渲染结果相同。效果模拟铅笔描绘时的手持抖动感。

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

### 8.5.1 功能面板与音乐按钮 ✅（v1.6 新增）

每日挑战图标、统计行与音乐按钮共同坐落于一块**暖羊皮纸功能面板**上，视觉上与游戏内 Header 背景条（7.1.1）同族。

**面板（`lobbyScene.ts` `drawPanelShape`）**

| 层 | 内容 | 参数 |
|----|------|------|
| 底部阴影 | 深棕 `#3D2200`，alpha 0.18，向下偏移 5px | 悬浮感 |
| 主体 | 暖羊皮纸 `#EAD5A8`，alpha 0.85（半透明，透出地图纸纹），边框暖金 `#C4A068`（alpha 0.55，1.5px） | 与 Header 背景条同配色 |
| 顶部高光 | 白色 alpha 0.18，高度 48px | 轻微凸起感 |
| 圆角 | 24px | — |

> **历史问题（v1.5 及之前）**：面板曾为深色半透明 `#1A0F00` alpha 0.55，与牛皮纸手绘地图风格冲突，v1.6 起改为上表规格。

**音乐按钮**

| 属性 | 规格 |
|------|------|
| 背景框 | 复用 `drawButtonBackground()`（9.3 节规格：暖皮纸 `#EEDFBD` + 暖金边框 + 圆角 20% + 投影 + 顶部高光） |
| 尺寸 | 109 × 109px（逻辑像素） |
| 图标 | `music.png`，四边内缩 `size × 0.16`（≈ 17px），有效区约 75 × 75px |
| 关闭态 | 图标 tint `#999999` + alpha 0.55，叠加深棕 `#6D4C41` 斜杠线（宽 8px，alpha 0.9，右上 → 左下）；**不再对整个按钮做灰色 tint** |
| 点击区域 | 覆盖整个 109px 背景框（透明 hit 精灵） |

### 8.6 标题区域

大厅顶部（关卡 19 上方）放置游戏 Logo，使用 `logo.png`，居中显示，宽度约为画布宽的 60%。✅（`lobbyScene.ts` `buildLogo`）

---

### 8.7 层级结构

```
z 层级（从底到顶）
├── 背景层：手绘地图大图（随滚动位移）
├── 路径层：探险小路（静态，已通过段 / 未解锁段）
├── 节点层：关卡圆形节点 + 数字精灵
├── 面板层：每日挑战功能面板（暖羊皮纸，见 8.5.1）
├── 特殊节点层：每日挑战入口圆形图标 + 音乐按钮 + 文字标签
├── 状态层：勾 / 锁 / 脉冲光圈 / 每日挑战呼吸光晕
└── UI 层：顶部 Logo 横幅 / 底部固定导航栏（如有）
```

---

## 9. 素材清单

### 9.0 实现方式总览

| 元素 | 实现方式 | 说明 |
|------|----------|------|
| 游戏背景 | **程序绘制** | Graphics 画矩形 + 网格线 |
| 格子（Tier × Gloss） | **程序绘制** → `generateTexture` | `cell_t{0‑2}_g{0‑5}.png`，共 18 张；`cell.png` 为 `t0_g0` 别名 |
| 格子（选中） | **程序绘制** → `generateTexture` | `cell_selected.png`，金黄描边 |
| 闹钟表盘 | **程序绘制** → `generateTexture` | `clock_face.png`，160×160px，三层同心圆 + 12 刻度 |
| 闹钟指针 | **程序绘制** → `generateTexture` | `clock_hand.png`，宽 12px × 长 64px 纹理，显示尺寸按 clockSize 比例计算 |
| 加号 | **程序绘制** → `generateTexture` | `plus.png`，用于飞行加时动画 |
| 等号 | **程序绘制** → `generateTexture` | `equa.png` |
| 字母 s | **程序绘制** → `generateTexture` | `s.png`，用于飞行加时动画（"+2s" 中的 "s"） |
| 按钮图标 | **程序绘制** → `generateTexture` | `retry.png` / `next.png` / `lobby.png` / `settings.png`；**v1.1 起每个图标外加背景圆角矩形框（见下方规格）** |
| 数字 0–9 | **图片（脚本预生成）** | `digits.png` 精灵图，运行时切片为 `0.png`–`9.png`（100×160px/帧）；纹理含渐变 + 高光 + 仿钞票波浪曲线（alpha 38） |
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
| `digits.png` | 数字 0–9 横向精灵图（脚本生成），运行时按帧宽 100px 切片（`DIGIT_W=100, DIGIT_GAP=0`）；含渐变、高光、仿钞票波浪纹理（alpha 38） | 1000 × 160 |
| `heart.png` | 命数图标·满（见下方规格） | 160 × 160 |
| `heart_empty.png` | 命数图标·空（见下方规格） | 160 × 160 |
| `explosion.png` + `explosion.json` | 消除粒子图集，用于数字消除时的碎裂特效 | 各帧不超过 64 × 64 |
| `lobby_bg.png` | 大厅地图背景（纯纸纹 + 无方向点缀，不含路径），竖屏时旋转 90° 复用（见 8.2 节） | 1920 × 1080（16:9） |
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
>
> **v1.4 改进**：从 8 层改为 **16 层**同心圆，alpha 采用三次方衰减（`0.22 × (1-norm)³`，含轻微补偿），过渡更柔和，无明显色带。

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

## 10. 场景切换过渡动画 ✅（v1.4 新增）

所有场景切换（大厅 → 游戏 / 游戏 → 大厅 / 大厅 → 每日挑战）均通过一个置于最顶层的暖米白遮罩层（`transOverlay`）执行淡入淡出过渡。

### 10.1 时序

```
[当前场景可见]
  ↓ fade_in（80ms）: overlay alpha 0 → 0.55
[overlay 完全不透明时: 切换场景、调用 resize()]
  ↓ fade_out（150ms）: overlay alpha 0.55 → 0
[新场景可见]
```

### 10.2 参数

| 参数 | 值 |
|------|----|
| 遮罩颜色 | 暖米白 `#F5EDD6`（与大厅背景底色一致） |
| 峰值 alpha | 0.55 |
| 淡入时长 | 80ms |
| 淡出时长 | 150ms |
| 场景切换时机 | 淡入完成时（遮罩最不透明时），确保旧场景在遮罩下隐藏 |
| 实现 | `SceneCoordinator.startTransition(switchFn)` + `updateTransition(deltaMs)` |
| 层级 | `transOverlay` 作为 `SceneCoordinator` 的最后一个子节点，始终位于所有场景之上 |
| 交互屏蔽 | `transOverlay.interactiveChildren = false`，过渡期间不阻断输入事件 |

---

## 11. 关卡结算星星动画 ✅（v1.4 新增）

### 11.1 触发时机

`GameResultOverlay.show(true, stars)` 被调用时（玩家通关），结算面板显示后触发星星逐颗弹出动画。

### 11.2 视觉描述

三颗星星按 0 → 150ms → 300ms 错开依次弹出（每颗 +150ms stagger），每颗独立执行 scale pop：

| 参数 | 值 |
|------|----|
| 延迟（每颗） | 150ms stagger（第 0 颗 0ms，第 1 颗 150ms，第 2 颗 300ms） |
| 动画时长 | 220ms |
| 峰值 scale | 1.25 |
| 时序 | Phase 1（0–110ms）：scale 0 → 1.25；Phase 2（110–220ms）：1.25 → 1.0 |
| 初始状态 | `show()` 时所有星星 scale 重置为 0 |
| 奖励星数 | 由 `StarManager.calculateStars()` 计算，不足 3 颗的位置保持 `scale(0)`（不弹出） |
| 实现 | `GameResultOverlay.update(deltaMs)` 驱动，由 `GameScene.update()` 在 `resultOverlay.visible` 时调用 |

---

## 12. 连消视觉反馈（已确认）

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

## 13. 动画参数速查

| 动画 | 时长 | 缓动 | 实现 |
|------|------|------|------|
| 格子消除（冲击帧） | 50ms | linear | ✅ |
| 格子消除（碎裂） | 150ms | ease-out | ✅ |
| 粒子消散 | 150ms | ease-out | ✅ |
| 加时精灵飞行（总） | 700ms | 弹出 160ms（overshoot）+ 停留 200ms + 飞行 340ms（ease-in + 轻旋转） | ✅ |
| 闹钟弹跳 | 200ms | sin 弧（峰值 ×1.25） | ✅ |
| 时间数字高亮 | 300ms | ease-in-out | ✅ |
| 命数图标 pop | 230ms | scale 1→1.3→0 | ✅ |
| 当前关脉冲 | 800ms 循环 | sin | ✅ |
| 每日挑战光晕呼吸 | 1200ms 循环 | sin | ✅ |
| 每日挑战点击弹性 | 100ms | sin arc | ✅ |
| 时间预警数字抖动 | 持续，sin 100ms/周期 | sin | ✅ |
| **格子点击弹性（v1.4）** | 120ms | linear 双段（0→peak→1） | ✅ |
| **格子闲置呼吸（v1.4）** | 500ms，约 1600ms 触发一次 | linear 双段（下降/回升） | ✅ |
| **场景切换淡入（v1.4）** | 80ms | linear | ✅ |
| **场景切换淡出（v1.4）** | 150ms | linear | ✅ |
| **星星弹出（v1.4）** | 220ms × 3，stagger 150ms | linear 双段（0→peak→1） | ✅ |

> **实现提示**：最简单的做法是给 `drawRetryIcon` / `drawNextIcon` / `drawLobbyIcon` 各自增加 `(x, y, size)` 偏移参数，调用时传入 `pad` 值，而不需要修改 Graphics 坐标系。

---

## 14. 小关过关庆祝动画 ✅（v1.2 已实现）

### 12.1 触发时机

每次清除单个 Target（即 `onTargetCleared()` 检测到仍有剩余 target 时），在进入下一个 target 之前播放庆祝动画。最后一个 target 清除时不触发（直接显示关卡结算 `GameResultOverlay`）。

### 12.2 视觉描述

格子全部清空后，在空棋盘上随机打 50 次爆炸特效，位置和开始时间均随机，持续 1.8s 后自动进入下一个 target。无任何横幅或浮层。

**实现参数：**

| 参数 | 值 |
|------|----|
| 特效数量 | 50 次（位置可重复，不受格子数量限制） |
| 特效类型 | `effectLayer.playEffect(idx, true, 3)`（连消3级，最大粒子量） |
| 触发时间分布 | 0–1500ms 内随机，排序后逐帧触发 |
| 总暂停时长 | 1800ms，之后 `isPause = false` 并回调 `startCurrentTarget()` |
| 时序机制 | `PIXI.Ticker.shared` + `elapsedMS` 累加（非帧数 delta） |

**动画时序（总时长 1.8s）：**

| 阶段 | 时间 | 内容 |
|------|------|------|
| 特效爆发 | 0–1500ms | 50 次粒子爆炸随机触发，最晚 1500ms 开始 |
| 粒子收尾 | 1500–1800ms | 最后一批粒子（最长寿命 300ms）播完 |
| Done | 1800ms | `isPause = false`，回调 `startCurrentTarget()` |

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
