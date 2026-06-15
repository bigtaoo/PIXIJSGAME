# Generates the SumQuest Android upload keystore (run on Windows, PowerShell).
# The private key is created locally and NEVER leaves your machine.
# Requires a JDK on PATH (keytool). Install one with: winget install Microsoft.OpenJDK.17
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tools\gen-android-keystore.ps1
#
# Output (written next to the script, both are git-ignored):
#   sumquest-upload.keystore        -> store securely (KeePass), used by Android Studio
#   sumquest-upload.keystore.b64    -> paste into the ANDROID_KEYSTORE_BASE64 GitHub secret

$ErrorActionPreference = 'Stop'

$keystore = Join-Path $PSScriptRoot 'sumquest-upload.keystore'
$alias    = 'upload'

if (Test-Path $keystore) {
    Write-Error "Keystore already exists: $keystore  (delete it first if you really want a new key)"
}

# keytool prompts interactively for the store + key passwords. Use a strong password and save it in KeePass.
& keytool -genkeypair -v `
    -keystore $keystore `
    -alias $alias `
    -keyalg RSA -keysize 2048 -validity 10000 `
    -storetype PKCS12 `
    -dname "CN=SumQuest, O=gamestao, C=DE"

if ($LASTEXITCODE -ne 0) { Write-Error "keytool failed (exit $LASTEXITCODE)" }

# Base64 for the GitHub secret.
$b64Path = "$keystore.b64"
[Convert]::ToBase64String([IO.File]::ReadAllBytes($keystore)) | Set-Content -NoNewline $b64Path

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  Keystore : $keystore"
Write-Host "  Alias    : $alias"
Write-Host "  Base64   : $b64Path"
Write-Host ""
Write-Host "GitHub secrets to set (Settings -> Secrets and variables -> Actions):"
Write-Host "  ANDROID_KEYSTORE_BASE64   = contents of $b64Path"
Write-Host "  ANDROID_KEYSTORE_PASSWORD = the store password you just typed"
Write-Host "  ANDROID_KEY_ALIAS         = $alias"
Write-Host "  ANDROID_KEY_PASSWORD      = the key password you just typed"
Write-Host ""
Write-Host "Also store the keystore file + both passwords in docs/KeePass.kdbx." -ForegroundColor Yellow
