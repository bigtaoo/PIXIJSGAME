# SumQuest Android 发布指南

> Capacitor 6 壳 + GitHub Actions 出包。两种产物：
> - **AAB**（App Bundle）→ Google Play
> - **universal APK** → 装测试机（Samsung A16）+ 上其他 Android 商店（Amazon Appstore、三星 Galaxy Store、华为 AppGallery 等）
>
> 两者用**同一个 upload keystore** 签名。最后更新：2026-06-15

---

## 0. 一次性收尾（重要）

`android/` 平台已生成并修正好（包名 `com.gamestao.sumquest`、版本号、Manifest、MainActivity、strings）。但有几步因云端环境权限限制没法做，**必须在本机执行一次**：

```powershell
# 1. 删掉一个卡住的 git 锁文件（云端创建后删不掉，会阻止本机 git）
del .git\index.lock

# 2. 删掉 cap 生成的多余 stub 目录（无害但应清掉）
rmdir /s /q android\app\src\main\java\com\getcapacitor

# 3. 重新跑一次 sync，干净地生成 capacitor.build.gradle 等 glue 文件
npm run build:mobile
npx cap sync android

# 4. 生成正式启动图标（覆盖默认 Capacitor 图标，源图已放在 assets/）
npx capacitor-assets generate --android
```

> 第 3、4 步在你的 Windows 上能正常跑（云端 sharp/权限跑不了）。`capacitor.build.gradle`、`capacitor.settings.gradle`、`capacitor-cordova-android-plugins`、`assets/public` 这些都是 cap sync 自动生成的，已在 `.gitignore` 里，CI 每次也会重新生成，不需要提交。

提交需要纳入版本库的是：`android/` 下除上述生成物以外的所有文件（结构同 `ios/`），以及 `assets/`（图标源图）、`tools/gen-android-keystore.*`、改动过的 `.github/workflows/release-android.yml` 和各 `.gitignore`。

---

## 1. 创建 upload keystore（只做一次）

前置：本机需 JDK（含 `keytool`）。没有的话：`winget install Microsoft.OpenJDK.17`

```powershell
powershell -ExecutionPolicy Bypass -File tools\gen-android-keystore.ps1
```

（WSL/Git Bash：`bash tools/gen-android-keystore.sh`）

脚本会提示输入 store/key 密码，生成：

- `tools/sumquest-upload.keystore` — 私钥，**只在本机产生**，已被 git 忽略
- `tools/sumquest-upload.keystore.b64` — base64，填进 GitHub secret

**立刻把 keystore 文件 + 两个密码 + alias 存进 `docs/KeePass.kdbx`。** 丢了这个 key 就无法用同一签名更新已上架的其他商店包（Google Play 因为开了 Play App Signing，upload key 可找 Google 重置，见 §5）。

---

## 2. 配置 GitHub Secrets

仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret | 值 |
|--------|----|
| `ANDROID_KEYSTORE_BASE64` | `sumquest-upload.keystore.b64` 的内容 |
| `ANDROID_KEYSTORE_PASSWORD` | store 密码 |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | key 密码 |
| `ANDROID_PACKAGE_NAME` | `com.gamestao.sumquest` |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Play 服务账号 JSON 全文（见 §5） |

> 只想出 APK 测试、还没搞 Play 账号？前 5 个配好即可，手动触发时把 **publish_play 取消勾选**，跳过 Play 发布那步。

---

## 3. 出包（CI）

工作流 `.github/workflows/release-android.yml`，两种触发：

**A. 打 tag（正式发布，自动发 Play）**
```bash
git tag v1.0.0
git push origin v1.0.0
```
- `versionName` 取自 tag（`v1.0.0` → `1.0.0`）
- `versionCode` 取 GitHub run number（单调递增，满足 Play 要求）
- 产出 AAB + APK，AAB 发到 Play 的 `internal` track

**B. 手动触发（Actions → Run workflow）**
- 选 track（internal/alpha/beta/production）
- `publish_play` 勾选才发 Play；不勾选只出 AAB/APK artifact
- `versionName` 取自 `package.json`

跑完在 run 页面的 Artifacts 下载：

- `SumQuest-<版本>-playstore-aab` — 上 Google Play
- `SumQuest-<版本>-universal-apk` — 装测试机 / 上其他商店

---

## 4. 装到 Samsung A16

下载 `universal-apk` artifact，解压得到 `app-release.apk`。

**方式一：adb（推荐，看得到日志）**
1. A16：设置 → 关于手机 → 连点「版本号」7 次开开发者选项 → 开启「USB 调试」
2. USB 连电脑，首次弹窗点「允许」
```bash
adb install -r app-release.apk
adb logcat | findstr -i "chromium console sumquest"   # 看 WebView 日志，排查白屏等
```

**方式二：直接传**
把 apk 通过 U 盘/网盘/邮件传到手机，点开安装（需允许「安装未知应用」）。

> 注意：这个 APK 用你的 upload key 签名，和未来从 Google Play 装的版本（Play 用 app signing key 重签）**签名不同**，两者不能互相覆盖更新。测试功能没问题；要测「和 Play 一致的签名」可在 Play Console 用 internal testing track 下发。

---

## 5. Google Play 首次上架

1. **注册** Google Play Console 开发者账号（一次性 $25）。
2. **创建应用** → 包名填 `com.gamestao.sumquest`（一经创建不可改）。
3. **Play App Signing**：保持默认开启。你上传的 AAB 用 upload key 签名，Google 用它自己保管的 app signing key 重新签名分发。好处：upload key 万一丢失可找 Google 重置。
4. **服务账号（CI 自动上传用）**：
   - Google Cloud Console 建 service account → 生成 JSON key → 全文填进 `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` secret。
   - Play Console → Users and permissions → 邀请该 service account 邮箱 → 授予「Release」相关权限（至少能发 internal track）。
   - 首次可能需要在 Play Console 手动上传一次 AAB 激活应用，之后 CI 才能用 API 推送。
5. **首次发布建议走 internal testing**：track 选 `internal`，加测试人员邮箱，验证无误再升到 production。
6. **商店素材**：图标、Feature graphic、截图（手机至少 2 张）、隐私政策 URL、内容分级问卷、目标受众等，按 Console 提示填。

---

## 6. 其他 Android 商店

都用 `universal-apk`（这些商店各自独立，签名不互通，用同一 upload key 即可）：

- **Amazon Appstore** — 个人可注册，免费，直接传 APK。
- **三星 Galaxy Store** — Samsung 设备覆盖好（和你的 A16 同生态），需开发者账号，传 APK。
- **华为 AppGallery** — 需企业/个人开发者认证，无 GMS，本游戏不依赖 Google 服务，理论可跑（按需评估）。

---

## 7. 版本号策略

- `versionName`：语义化版本，由 tag 决定（`v1.2.3`）。
- `versionCode`：CI 用 GitHub run number 自动注入，**每次构建都比上次大**，避免 Play「versionCode 已存在」报错。
- 本地手动出包可覆盖：`./gradlew bundleRelease -PversionCode=42 -PversionName=1.2.3 ...`

---

## 8. 常见问题

- **CI gradle 报 `capacitor.build.gradle` 找不到**：CI 的 `cap sync android` 步骤会生成；确认该步在 gradle 之前且成功。
- **白屏**（参考 iOS 已知问题）：用 `adb logcat` 看 WebView console，多半是资源路径或入口脚本问题。
- **签名失败**：核对 4 个签名 secret，`ANDROID_KEY_ALIAS` 必须等于建库时的 alias（`upload`）。
- **Play 拒绝 AAB**：检查 `targetSdkVersion`（当前 34，满足 Play 现行要求；若 Play 要求更高，改 `android/variables.gradle`）。
