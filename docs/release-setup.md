# Mobile Release Setup

## 前置条件：Capacitor 初始化

项目目前还没有 Android/iOS 原生目录，需要先初始化 Capacitor。

```bash
npm install @capacitor/core @capacitor/android @capacitor/ios
npx cap init "PixiGame" "com.yourcompany.pixigame" --web-dir dist
npx cap add android
npx cap add ios
```

然后创建 iOS 打包配置文件 `ios/ExportOptions.plist`（根据你的 provisioning profile 类型调整）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store</string>
  <key>teamID</key>
  <string>YOUR_TEAM_ID</string>
  <key>uploadBitcode</key>
  <false/>
  <key>compileBitcode</key>
  <false/>
</dict>
</plist>
```

---

## GitHub Secrets 配置

在 GitHub → Settings → Secrets and variables → Actions 中添加以下 secrets：

### Android

| Secret | 说明 |
|--------|------|
| `ANDROID_KEYSTORE_BASE64` | Release keystore 文件的 base64 编码（`base64 -i release.keystore`） |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore 密码 |
| `ANDROID_KEY_ALIAS` | Key alias |
| `ANDROID_KEY_PASSWORD` | Key 密码 |
| `ANDROID_PACKAGE_NAME` | 应用包名，如 `com.yourcompany.pixigame` |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Google Play API 服务账号的 JSON 内容（明文，非 base64） |

#### 生成 Android Keystore

```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias pixigame \
  -keyalg RSA -keysize 2048 \
  -validity 10000
```

#### 创建 Google Play 服务账号

1. Google Play Console → 设置 → API 访问权限
2. 链接到 Google Cloud 项目，创建服务账号
3. 授予「发布管理员」角色
4. 下载 JSON 密钥，内容粘贴到 `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

---

### iOS

| Secret | 说明 |
|--------|------|
| `IOS_CERTIFICATE_P12_BASE64` | Distribution 证书 .p12 文件的 base64 编码 |
| `IOS_CERTIFICATE_P12_PASSWORD` | .p12 导出密码 |
| `IOS_BUNDLE_ID` | Bundle ID，如 `com.yourcompany.pixigame` |
| `IOS_PROVISIONING_PROFILE_NAME` | Provisioning profile 名称（Xcode 中显示的名字） |
| `APPSTORE_CONNECT_ISSUER_ID` | App Store Connect API → Keys 页面的 Issuer ID |
| `APPSTORE_CONNECT_KEY_ID` | API Key ID |
| `APPSTORE_CONNECT_PRIVATE_KEY` | API Key 的 `.p8` 文件内容（完整文本，包含 BEGIN/END 行） |

#### 导出 Distribution 证书

1. Keychain Access → 找到 Apple Distribution 证书 → 右键导出为 .p12
2. `base64 -i Certificates.p12 | pbcopy` → 粘贴到 `IOS_CERTIFICATE_P12_BASE64`

#### 创建 App Store Connect API Key

App Store Connect → Users and Access → Integrations → App Store Connect API → 创建 Key，角色选 App Manager。

---

## 触发方式

两个 workflow 均支持两种触发方式：

- **打 tag 自动触发**：`git tag v1.0.0 && git push origin v1.0.0`
- **手动触发**：GitHub → Actions → 选择 workflow → Run workflow（可选 track/destination）

Android 可选 track：`internal` / `alpha` / `beta` / `production`  
iOS 固定上传到 TestFlight，App Store 正式发布仍需在 App Store Connect 手动提交审核。
