#!/usr/bin/env bash
# Generates the SumQuest Android upload keystore (run in WSL / Linux / Git Bash).
# The private key is created locally and NEVER leaves your machine.
# Requires a JDK (keytool) on PATH.
#
# Usage:
#   bash tools/gen-android-keystore.sh
#
# Output (next to the script, both git-ignored):
#   sumquest-upload.keystore      -> store securely (KeePass), used for local signing
#   sumquest-upload.keystore.b64  -> paste into the ANDROID_KEYSTORE_BASE64 GitHub secret
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEYSTORE="$DIR/sumquest-upload.keystore"
ALIAS="upload"

if [[ -f "$KEYSTORE" ]]; then
  echo "Keystore already exists: $KEYSTORE (delete it first if you want a new key)" >&2
  exit 1
fi

# keytool prompts for the store + key passwords. Use a strong password and save it in KeePass.
keytool -genkeypair -v \
  -keystore "$KEYSTORE" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12 \
  -dname "CN=SumQuest, O=gamestao, C=DE"

base64 -w0 "$KEYSTORE" > "$KEYSTORE.b64" 2>/dev/null || base64 "$KEYSTORE" | tr -d '\n' > "$KEYSTORE.b64"

cat <<EOF

Done.
  Keystore : $KEYSTORE
  Alias    : $ALIAS
  Base64   : $KEYSTORE.b64

GitHub secrets to set (Settings -> Secrets and variables -> Actions):
  ANDROID_KEYSTORE_BASE64   = contents of $KEYSTORE.b64
  ANDROID_KEYSTORE_PASSWORD = the store password you just typed
  ANDROID_KEY_ALIAS         = $ALIAS
  ANDROID_KEY_PASSWORD      = the key password you just typed

Also store the keystore file + both passwords in docs/KeePass.kdbx.
EOF
