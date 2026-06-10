# SumQuest 项目分析报告

> 2026-06-10 · 基于全量代码审查（src/ 约 9200 行 TS）

## 总评

架构扎实：平台抽象干净（assetsManager / playerPrefs / audioManager / inputSystem 各有接口 + 三端实现，游戏逻辑里没有散落的平台判断），依赖注入用 AppContext 统一，文档（ARCHITECTURE.md）与代码基本一致。主要问题集中在：仓库安全、每日挑战时区 bug、代码重复、CI 缺失。

---

## 🔴 高优先级（建议立即处理）

### 1. 敏感文件被 git 跟踪
`docs/KeePass.kdbx` 和 `docs/ios release.7z` 在 git 历史中。仓库一旦公开或泄露，密码库和签名材料全部暴露。

```bash
git rm --cached "docs/KeePass.kdbx" "docs/ios release.7z"
echo -e "*.kdbx\n*.7z" >> .gitignore
```

历史中已存在的版本需要 `git filter-repo` 清除（或视为已泄露、轮换密码）。

### 2. dist/ 和 crazygames/ 构建产物仍被跟踪
.gitignore 写了 `/dist` 和 `/crazygames`，但文件是在加 ignore 之前提交的，依然在 git 里（`git ls-files` 可见）。每次构建都会产生脏 diff。

```bash
git rm -r --cached dist crazygames
```

### 3. 每日挑战种子用本地时间（时区 bug）
`dailyChallengeConfig.ts:19`：`new Date(now.getFullYear(), 0, 0)` 按本地时区算 day-of-year。德国玩家和中国玩家在同一时刻拿到不同的"今日"关卡，跨时区排行榜不公平；`dailyChallengeStore.ts:80-83` 的 streak 日期同样用本地时间。统一改为 UTC（`getUTCFullYear` 等）即可，但注意：上线后切换会导致当天种子跳变，最好趁早改。

### 4. ENCRYPTION_KEY 为空，排行榜提分静默失败
`dailyChallengeResult.ts:17`。roadmap Phase 1 已列出，CrazyGames 对接入排行榜的游戏有流量加权——这是上线前 ROI 最高的一项。

---

## 🟡 中优先级（下个迭代）

### 5. CI 没有 lint / typecheck 关卡
四个 workflow 只做 build + 部署，ESLint 从不在 CI 跑。加一个最便宜的 job：

```yaml
- run: npx tsc --noEmit
- run: npx eslint src --max-warnings 0
```

### 6. 每日挑战与主线代码重复
| 重复对 | 行数 | 重叠度 |
|---|---|---|
| header.ts / dailyChallengeHeader.ts | 719 / 481 | ~67% |
| gameScene.ts / dailyChallengeScene.ts | 692 / 373 | ~45% |
| gameResult.ts / dailyChallengeResult.ts | 250 / 215 | ~40% |

roadmap 里的"每周挑战"会复用每日挑战架构——如果不先抽公共基类，重复会变成三份。建议在做每周挑战之前抽 `BaseHeader` / `BaseResultOverlay`。

### 7. header.ts 是 god class（719 行）
混合了布局、计时、提示、命数四块职责。配合第 6 条一起拆。

### 8. 零测试
`logic.ts`（数字分配与消除）和 `seededRng.ts` 是纯函数逻辑，最适合先补单测——不需要 mock PixiJS。建议 vitest，半天工作量，能锁住核心规则不被改坏。

---

## 🟢 低优先级 / 可选

- **无 i18n 机制**：目前 UI 走 without_text.md 的无文字设计，问题不大；但若加文案（如排名提示"今日排名第X"），先建一个最简 strings 表。
- **杂物清理**：`.DS_Store` 多处被跟踪（加入 .gitignore）；`markting/` 目录拼写应为 `marketing/`；`art/` 里的 `.xcf` 源文件约占仓库大头，可考虑移出 git 或用 LFS。
- **commit message 质量**：`fix.`、`arts` 这类信息量低，独立开发可接受，但回溯 bug 时会吃亏。
- **roadmap 技术债确认仍存在**：Auth 状态只打 log（crazygamesIndex.ts）、Banner 广告 API 已实现未调用、微信 `AppContext.platform` 未实现（微信端零变现）。

---

## 代码质量正面项（不用动）

- 平台抽象完整，无 `if (isWechat)` 散落
- 错误处理覆盖 storage / 资源加载 / promise，未发现未捕获 promise 和内存泄漏（PixiJS destroy、listener 清理都有做）
- `any` 仅 12 处且有理由，无 `@ts-ignore` 滥用
- 布局锁定机制（横竖屏切换）设计文档化且实现一致

## 建议执行顺序

1. git 清理（#1 #2，半小时）
2. 时区改 UTC（#3，1 小时，趁未上线）
3. ENCRYPTION_KEY + 排行榜接通（#4，roadmap Phase 1）
4. CI lint job（#5，半小时）
5. 做每周挑战前先抽公共基类（#6 #7）
6. logic.ts 单测（#8）
