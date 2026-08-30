#!/usr/bin/env bash
# macOS / Linux equivalent of setup.ps1. See that file's comments for why SDK 54
# is the default: Expo Go on the iOS App Store is frozen there.
#   ./setup.sh ~/sofra 54
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${1:-$HOME/sofra}"
SDK="${2:-54}"

command -v node >/dev/null || { echo "✗ Node.js is not installed."; exit 1; }
[ -e "$DEST" ] && { echo "✗ $DEST already exists."; exit 1; }

echo "→ Creating an Expo project (SDK $SDK) at $DEST"
npx create-expo-app@latest "$DEST" --template "default@sdk-$SDK"
cd "$DEST"

echo "→ Copying Sofra's source in"
rm -rf app
cp -R "$SRC/app" "$SRC/src" "$SRC/tools" .
mkdir -p assets && cp -R "$SRC/assets/data" assets/

echo "→ Adding the two extra dependencies"
npx expo install expo-localization @react-native-async-storage/async-storage

echo "→ Patching app.json"
node tools/patch-app-json.js

echo "→ Checking versions against the SDK"
npx expo install --fix

echo "→ Running the engine tests"
node src/__tests__/engine.test.js

echo
echo "  Done:  cd $DEST && npx expo start"
echo "  Then scan the QR with Expo Go, and set ios.bundleIdentifier in app.json."
