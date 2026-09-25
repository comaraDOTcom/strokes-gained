#!/usr/bin/env sh
# Rasterise src/app/icon.svg into the PNG sizes Android's "Add to Home screen" wants
# (public/icon-192.png, public/icon-512.png). iOS uses src/app/apple-icon.png (180px).
# Re-run whenever the mark changes, so the four stay in sync.
#
#   CHROME=/path/to/chrome-headless-shell sh scripts/make-pwa-icons.sh
#
# Any Chromium works: the headless shell (`npx @puppeteer/browsers install chrome-headless-shell`)
# or a desktop Chrome (add `--headless=new` yourself if it complains).
set -eu
CHROME="${CHROME:-chrome-headless-shell}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
for size in 192 512; do
  printf '<html><body style="margin:0;background:transparent"><img src="file://%s/src/app/icon.svg" style="width:%spx;height:%spx;display:block"></body></html>' \
    "$ROOT" "$size" "$size" > "$TMP/icon.html"
  "$CHROME" --headless --no-sandbox --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --force-device-scale-factor=1 --window-size="$size,$size" --screenshot="$ROOT/public/icon-$size.png" \
    "file://$TMP/icon.html" >/dev/null 2>&1
  test -s "$ROOT/public/icon-$size.png" || { echo "failed to write public/icon-$size.png" >&2; exit 1; }
  echo "wrote public/icon-$size.png"
done
