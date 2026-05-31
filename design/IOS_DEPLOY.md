# iOS 发布指南（GitHub Actions + Capacitor）

> 适用于 Windows 开发环境。所有 macOS 相关操作（Xcode 构建、签名）均在 GitHub Actions 的 `macos-latest` runner 上执行。

---

## 一、前置准备（只做一次）

### 1. Apple Developer 账号
确认已加入 [Apple Developer Program](https://developer.apple.com/programs/)（$99/年）。

### 2. 在 Apple Developer 网站创建 App ID
`developer.apple.com` → Identifiers → + → App IDs  
Bundle ID：`com.gamestao.sumquest`（与 `capacitor.config.ts` 中的 `appId` 一致）

### 3. 在 App Store Connect 创建 App
`appstoreconnect.apple.com` → My Apps → +  
Bundle ID 选择上一步创建的 `com.gamestao.sumquest`。

---

## 二、准备签名材料（Windows 用 OpenSSL）

需要两样东西：**Distribution Certificate（.p12）** 和 **Provisioning Profile（.mobileprovision）**。

### 2.1 生成 CSR（Certificate Signing Request）

在 Windows PowerShell 中（需安装 [OpenSSL for Windows](https://slproweb.com/products/Win32OpenSSL.html)）：

```powershell
# 生成私钥
openssl genrsa -out distribution.key 2048

# 生成 CSR（填写你的信息）
openssl req -new -key distribution.key -out distribution.csr \
  -subj "/emailAddress=tao.wang.go@gmail.com/CN=Tao Wang/C=DE"
```

### 2.2 在 Apple Developer 网站申请证书

`developer.apple.com` → Certificates → + → **Apple Distribution**  
上传 `distribution.csr` → 下载 `distribution.cer`

### 2.3 将 .cer 转为 .p12

```powershell
# 将 .cer 转为 .pem
openssl x509 -in distribution.cer -inform DER -out distribution.pem -outform PEM

# 打包私钥 + 证书为 .p12（设置一个密码，记住它）
openssl pkcs12 -export  -inkey distribution.key -in distribution.pem -out distribution.p12  -name "Apple Distribution"
```

### 2.4 创建 Provisioning Profile

`developer.apple.com` → Profiles → + → **App Store Connect**  
选择 App ID `com.gamestao.sumquest`，选择上一步的 Distribution certificate，下载 `xxx.mobileprovision`。

记录 Profile 的 **Name**（后面配 `PROVISIONING_PROFILE_NAME` secret 用）。

---

## 三、准备 App Store Connect API Key

`appstoreconnect.apple.com` → Users and Access → Integrations → **App Store Connect API** → Generate API Key  
权限选择 **App Manager**。下载 `AuthKey_XXXXXX.p8`（只能下载一次）。

记录：
- **Key ID**（如 `ABC123DEF4`）
- **Issuer ID**（页面顶部的 UUID）

---

## 四、将所有文件编码为 Base64（PowerShell）

```powershell
# distribution certificate
[Convert]::ToBase64String([IO.File]::ReadAllBytes("distribution.p12")) | Set-Content -NoNewline cert_b64.txt

# provisioning profile
[Convert]::ToBase64String([IO.File]::ReadAllBytes("comgamestaosumquestprofile.mobileprovision")) | Set-Content -NoNewline profile_b64.txt

# App Store Connect API key
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_7AGSL2YMN7.p8")) | Set-Content -NoNewline apikey_b64.txt
```

---

## 五、在 GitHub 添加 Secrets

`GitHub repo` → Settings → Secrets and variables → Actions → New repository secret

| Secret 名称 | 值来源 |
|-------------|--------|
| `BUILD_CERTIFICATE_BASE64` | `cert_b64.txt` 的内容 |
| `P12_PASSWORD` | 步骤 2.3 中设置的 .p12 密码 |
| `KEYCHAIN_PASSWORD` | 任意随机字符串（CI 临时 keychain 密码） |
| `BUILD_PROVISION_PROFILE_BASE64` | `profile_b64.txt` 的内容 |
| `PROVISIONING_PROFILE_NAME` | Provisioning Profile 的 Name（如 `PixiGame App Store`） |
| `APPLE_TEAM_ID` | `developer.apple.com` → Account → Membership → Team ID |
| `ASC_API_KEY_ID` | App Store Connect API Key ID（如 `ABC123DEF4`） |
| `ASC_API_ISSUER_ID` | App Store Connect Issuer ID（UUID） |
| `ASC_API_KEY_CONTENT_BASE64` | `apikey_b64.txt` 的内容 |

---

## 六、触发发布

打一个版本 tag 即可自动触发 workflow：

```bash
git tag v1.0.0
git push origin v1.0.0
```

也可在 GitHub Actions 页面手动点击 **Run workflow**。

---

## 七、Workflow 执行流程概览

```
Checkout → npm ci → build:crazygames → cap sync ios
  → 导入签名证书（import-codesign-certs）
  → 手动安装 Provisioning Profile（base64 decode → ~/Library/MobileDevice/Provisioning Profiles/）
  → xcodebuild archive → xcodebuild -exportArchive (IPA)
  → upload-testflight-build 上传至 App Store Connect
```

上传成功后，在 App Store Connect → TestFlight 即可看到新构建。

---

## 八、ios/ 目录说明

`ios/` 目录**需要提交到仓库**。首次发布前，在本地执行：

```bash
npm install
npx cap add ios
git add ios/
git commit -m "feat: add capacitor ios platform"
git push
```

之后 CI 只需 `cap sync ios`（同步 web 产物到已有的 ios 目录），无需重新 `cap add`。

屏幕方向（Portrait + LandscapeLeft + LandscapeRight）在 `ios/App/App/Info.plist` 中配置，随 `ios/` 一起入库，CI 无需额外 patch。
