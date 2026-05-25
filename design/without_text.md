# 无文字化方案文档

**版本：** v1.0  
**日期：** 2026年5月24日  
**关联文档：** `retention.md` (留存系统)、`art.md` (美术规范)

---

## 📌 概述

本方案旨在**完全移除游戏内所有文字**，通过图标/图片传递信息。基于《美术文档》的**手绘暖色系风格**（无渐变、粗圆体、平面化），结合现有资源（如 `digits.png` 数字精灵图）和程序绘制能力实现。

**核心原则：**

- 所有**数字**保留为 `digits.png` 精灵图（已支持）。
- 新增图标需与现有风格一致：**手绘简笔画、暖色系、无阴影、无渐变**。
- 优先使用**程序绘制**（PIXI.Graphics），复杂图标（如火焰、奖杯）使用图片资源。

---

## 🎯 图标替换映射表

### 已有资源（直接复用）


| **原文本**      | **替换资源**                           | **位置**     | **说明**          |
| ------------ | ---------------------------------- | ---------- | --------------- |
| 每日挑战（标题/模式名） | `daily_challenge_icon.png`（8.5节设计） | 大厅入口、HUD左上 | 深琥珀金圆形 + 排行榜柱图标 |


---

### 程序绘制图标（PIXI.Graphics）


| **原文本** | **图标**  | **颜色**       | **绘制参数**                  | **应用场景**     |
| ------- | ------- | ------------ | ------------------------- | ------------ |
| 最佳      | 五角星（★）  | 金色 `#FFD700` | 5点星形，线条粗度 4px，填充金色        | 结算界面「最佳分数」前缀 |
| 天       | 日历（📅）  | 棕色 `#6D4C41` | 矩形（30×30px）+ 网格线，线条粗度 2px | 连续天数计数后缀     |
| 再玩      | 循环箭头（↻） | 棕色 `#6D4C41` | 圆圈（直径 40px）+ 箭头，线条粗度 4px  | 结算界面按钮       |
| 结束      | 对勾（✓）   | 棕色 `#6D4C41` | 线条粗度 3px，倾斜 45°           | 结算界面标题（可选）   |


---

### 新增图片资源（需制作）


| **原文本**    | **图标** | **文件名**      | **尺寸（@2x）** | **颜色**       | **应用场景**     |
| ---------- | ------ | ------------ | ----------- | ------------ | ------------ |
| 连续挑战       | 火焰（🔥） | `flame.png`  | 256×256     | 橙色 `#FF8C00` | 连续天数计数前缀     |
| NEW BEST ★ | 奖杯（🏆） | `trophy.png` | 256×256     | 金色 `#FFD700` | 破纪录提示（带发光动画） |


---

## 🏗️ 实现方案

### 1. 大厅每日挑战区

**原布局（含文字）：**

```
每日挑战
最佳: 128
连续挑战: 7 天
```

**新布局（无文字）：**

```
  [daily_challenge_icon.png]
  [★] [128]          ← ★ = 五角星（程序绘制），128 = 数字精灵图
  [🔥] [7] [📅]      ← 🔥 = flame.png，7 = 数字精灵图，📅 = 日历（程序绘制）
```

---

### 2. 每日挑战结算界面

**原布局（含文字）：**

```
每日挑战结束
最佳: 128
连续挑战: 7 天
NEW BEST ★
[再玩]
```

**新布局（无文字）：**

```
  [daily_challenge_icon.png] [✓]  ← ✓ = 对勾（程序绘制，可选）
  [★] [128]
  [🔥] [7] [📅]
  [🏆]                       ← 仅破纪录时显示，带发光动画
  [↻]                       ← 循环箭头按钮（程序绘制）
```

---

### 3. HUD 左上角

**原布局：**

```
每日挑战
```

**新布局：**

```
[daily_challenge_icon.png (缩小版)]
```

---

## 📁 资源清单

### 已有资源

- `daily_challenge_icon.png`（260×260px @2x，见 `art.md` 8.5节）
- `digits.png`（数字精灵图，脚本生成）

### 新增资源（需制作）


| **文件名**      | **尺寸（@2x）** | **用途** | **AI 生成 Prompt** |
| ------------ | ----------- | ------ | ---------------- |
| `flame.png`  | 256×256     | 连续挑战图标 | 见下方 **Prompt 1** |
| `trophy.png` | 256×256     | 破纪录图标  | 见下方 **Prompt 2** |


---

## 🔥 火焰图标设计 Prompt

### Prompt 1: 火焰图标（`flame.png`）

```plaintext
A hand-drawn flame icon, warm orange (#FF8C00), bold rounded shape, flat design, no gradient, no shadow, transparent background, sketchy pencil style, slightly imperfect edges, centered on 256x256 canvas. Simple, clean, and playful. The flame should have a thick base and tapering top, with subtle hand-drawn wobbles in the outline. --ar 1:1 --v 6 --style raw
```

**设计要点：**

- **形状**：火焰底部宽，顶部逐渐变窄，轮廓带手绘波动感（非完美对称）。
- **风格**：与《美术文档》一致——**无渐变、无阴影、平面填色**。
- **颜色**：主色为 `#FF8C00`（暖橙色），轮廓可加深棕色 `#6D4C41`（线宽 2px）。
- **用途**：用于表示“连续挑战”天数，尺寸建议 40×40px（逻辑像素）。

---

## 🏆 奖杯图标设计 Prompt

### Prompt 2: 奖杯图标（`trophy.png`）

```plaintext
A hand-drawn trophy cup icon, gold (#FFD700), flat design, no gradient, no shadow, transparent background, sketchy pencil style. The trophy has a wide base, a tall cup body, and two small side handles. Bold outline (#C8862A, 2px). Centered on 256x256 canvas. Simple, symmetric, and celebratory. --ar 1:1 --v 6 --style raw
```

**设计要点：**

- **形状**：奖杯主体高大，底座宽稳，两侧对称把手。
- **颜色**：主色 `#FFD700`（金色），轮廓 `#C8862A`（深琥珀金，线宽 2px）。
- **特效**：破纪录时添加**发光动画**（外发光半径 8–14px，金色 `#FFD700`，透明度 50%，循环 1200ms）。

---

## 🛠️ 程序绘制参考代码（PIXI.js）

### 1. 五角星（★）

```javascript
// 绘制五角星（中心在 (0,0)，外接圆半径 20px）
const star = new PIXI.Graphics();
star.lineStyle(4, 0xFFD700); // 金色轮廓
star.beginFill(0xFFD700);   // 金色填充
const points = [];
for (let i = 0; i < 5; i++) {
  const angle = (i * 72 - 90) * Math.PI / 180;
  points.push(
    Math.cos(angle) * 20, 
    Math.sin(angle) * 20
  );
}
star.drawPolygon(points);
star.endFill();
```

### 2. 日历（📅）

```javascript
// 绘制日历（30x30px）
const calendar = new PIXI.Graphics();
calendar.lineStyle(2, 0x6D4C41); // 棕色轮廓
calendar.beginFill(0xF5EDD6);   // 牛皮纸色填充
calendar.drawRect(0, 0, 30, 30);
calendar.endFill();
// 绘制网格线（3x3）
for (let i = 1; i < 3; i++) {
  calendar.moveTo(0, i * 10).lineTo(30, i * 10);
  calendar.moveTo(i * 10, 0).lineTo(i * 10, 30);
}
```

### 3. 循环箭头（↻）

```javascript
// 绘制循环箭头（直径 40px）
const replay = new PIXI.Graphics();
replay.lineStyle(4, 0x6D4C41); // 棕色轮廓
replay.beginPath();
replay.arc(20, 20, 18, 0, Math.PI * 2); // 圆圈
replay.moveTo(20, 5);
replay.lineTo(25, 10);
replay.lineTo(20, 15);
replay.lineTo(15, 10);
replay.closePath();
```

---

## 📝 后续行动清单

- 使用 **Prompt 1** 生成 `flame.png` 并验证风格一致性。
- 使用 **Prompt 2** 生成 `trophy.png` 并验证风格一致性。
- 实现程序绘制图标（五角星、日历、循环箭头、对勾）的 PIXI.Graphics 代码。
- 更新 `art.md`，添加新增图标的规格和用途说明。
- 更新 `retention.md`，移除所有文字描述，替换为图标引用。