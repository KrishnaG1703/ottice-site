#!/bin/sh
# Publish the site to https://ottervault.mechaclips.workers.dev: a Worker that serves the static
# files and the small API behind the updates and anonymous replies (worker/index.js).
# A workers.dev address rather than pages.dev: LinkedIn flags every *.pages.dev link as phishing.
# Copies only what the page needs, so .git, docs and this script stay behind.
set -e
cd "$(dirname "$0")"
DIST=$(mktemp -d)
for f in index.html classic.html support.html social.css social.js styles.css main.js otter3d.js; do cp "$f" "$DIST"/; done
cp -R assets vendor .well-known "$DIST"/
cp worker/index.js "$DIST/worker.js"
find "$DIST" -name '.DS_Store' -delete
cat > "$DIST/wrangler.jsonc" <<'JSON'
{
  "name": "ottervault",
  "main": "worker.js",
  "compatibility_date": "2025-09-01",
  "assets": { "directory": ".", "binding": "ASSETS" },
  "kv_namespaces": [{ "binding": "OTTER_SOCIAL", "id": "5ea711c8c5954305b46a6b6474a46d26" }]
}
JSON
printf 'wrangler.jsonc\nworker.js\n' > "$DIST/.assetsignore"
(cd "$DIST" && npx --yes wrangler@latest deploy)
rm -rf "$DIST"
echo
echo "The author token is a Worker secret. Set or change it with:"
echo "  npx wrangler secret put ADMIN_TOKEN --name ottervault"
