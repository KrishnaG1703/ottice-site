#!/bin/sh
# Publish the site to https://ottervault.mechaclips.workers.dev as a static-assets Worker.
# A workers.dev address rather than pages.dev: LinkedIn flags every *.pages.dev link as phishing.
# Copies only what the page needs, so .git, docs and this script stay behind.
set -e
cd "$(dirname "$0")"
DIST=$(mktemp -d)
for f in index.html styles.css main.js otter3d.js; do cp "$f" "$DIST"/; done
cp -R assets vendor .well-known "$DIST"/
find "$DIST" -name '.DS_Store' -delete
cat > "$DIST/wrangler.jsonc" <<JSON
{ "name": "ottervault", "compatibility_date": "2025-09-01", "assets": { "directory": "." } }
JSON
printf 'wrangler.jsonc\n' > "$DIST/.assetsignore"
(cd "$DIST" && npx --yes wrangler@latest deploy)
rm -rf "$DIST"
