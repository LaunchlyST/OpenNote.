#!/usr/bin/env bash
# Builds the API into one file and deploys it as the Supabase Edge Function "api".
# Needs: deno, and a Supabase personal access token sent to api.supabase.com
# (SUPABASE_ACCESS_TOKEN, or injected by a proxy). Usage: scripts/deploy-supabase.sh <project-ref>
set -euo pipefail
REF="${1:?project ref}"
deno bundle --platform deno --packages bundle --external better-sqlite3 --external pg-native \
  -o supabase/functions/api/index.js supabase/functions/api/entry.ts
AUTH=()
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")
curl -sS --fail-with-body "${AUTH[@]}" -X POST "https://api.supabase.com/v1/projects/$REF/functions/deploy?slug=api" \
  -F 'metadata={"entrypoint_path":"index.js","name":"api","verify_jwt":false};type=application/json' \
  -F "file=@supabase/functions/api/index.js;filename=index.js"
echo
