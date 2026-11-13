#!/usr/bin/env bash
# Builds the API into one file and deploys it as the Supabase Edge Function "api".
# Needs: deno (2.4+), and a Supabase personal access token sent to api.supabase.com
# (SUPABASE_ACCESS_TOKEN, or injected by a proxy). Usage: scripts/deploy-supabase.sh <project-ref>
#
# Supabase refuses functions over 5 MB, so the bundle is shrunk by removing whitespace only.
# Do NOT use `deno bundle --minify`: it breaks a dynamic require ("node:tty") and the function
# then fails to start (this took the API down briefly, versions 67 and 69).
set -euo pipefail
REF="${1:?project ref}"
OUT=supabase/functions/api/index.js
deno bundle --platform deno --packages bundle --external better-sqlite3 --external pg-native \
  -o "$OUT" supabase/functions/api/entry.ts
ESBUILD="$(ls node_modules/.bin/esbuild node_modules/tsx/node_modules/.bin/esbuild 2>/dev/null | head -1 || true)"
[ -n "$ESBUILD" ] || ESBUILD="npx --yes esbuild@0.25.5"
$ESBUILD "$OUT" --minify-whitespace --format=esm --outfile="$OUT" --allow-overwrite --log-level=warning
SIZE=$(wc -c < "$OUT")
if [ "$SIZE" -ge 5000000 ]; then echo "Bundle is $SIZE bytes; Supabase allows 5 MB. Not deploying." >&2; exit 1; fi
AUTH=()
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")
curl -sS --fail-with-body "${AUTH[@]}" -X POST "https://api.supabase.com/v1/projects/$REF/functions/deploy?slug=api" \
  -F 'metadata={"entrypoint_path":"index.js","name":"api","verify_jwt":false};type=application/json' \
  -F "file=@$OUT;filename=index.js"
echo
# The function must actually start: a startup error answers every request with 503.
CODE=000
for i in 1 2 3 4 5 6; do
  sleep 5
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://$REF.supabase.co/functions/v1/api/launch/status" || true)
  if [ "$CODE" = "200" ]; then echo "Live API is up (launch status 200)."; exit 0; fi
done
echo "WARNING: the deployed API is not answering 200 (last status $CODE). Check the function logs and redeploy the previous version." >&2
exit 1
