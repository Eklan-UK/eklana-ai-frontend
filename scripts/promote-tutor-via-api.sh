#!/usr/bin/env bash
# Promote a user to tutor via POST /api/v1/admin/assign-role
#
# Prereqs:
#   - App running (e.g. npm run dev)
#   - You are logged in as admin in the browser
#
# 1) Copy the Cookie header for your app origin from DevTools → Network → any request,
#    or from Application → Cookies (e.g. session cookie name/value used by Better Auth).
# 2) Run:
#    export ADMIN_COOKIE='name=value; name2=value2'
#    ./scripts/promote-tutor-via-api.sh 69d02e8c4bd5158bba4cae8e
#
# Or one line:
#    ADMIN_COOKIE='...' ./scripts/promote-tutor-via-api.sh 69d02e8c4bd5158bba4cae8e
#
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3000}"
USER_ID="${1:-69d02e8c4bd5158bba4cae8e}"

if [[ -z "${ADMIN_COOKIE:-}" ]]; then
  echo "Error: set ADMIN_COOKIE to your browser cookie string while logged in as admin."
  echo "Example: export ADMIN_COOKIE='better-auth.session_token=YOUR_TOKEN'"
  exit 1
fi

curl -sS -X POST "${BASE_URL}/api/v1/admin/assign-role" \
  -H "Content-Type: application/json" \
  -H "Cookie: ${ADMIN_COOKIE}" \
  -d "{\"userId\":\"${USER_ID}\",\"role\":\"tutor\",\"profileData\":{}}"
echo
