#!/bin/bash

# FCM Test Notification Script
# Usage: bash scripts/send-test-notification.sh

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN}"

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Error: ADMIN_TOKEN environment variable not set"
  echo ""
  echo "Usage:"
  echo "  ADMIN_TOKEN=<your_session_token> bash scripts/send-test-notification.sh"
  echo ""
  echo "To get your admin session token:"
  echo "  1. Login as admin in the browser"
  echo "  2. Open DevTools → Application → Cookies"
  echo "  3. Find the session cookie and copy its value"
  exit 1
fi

echo "🧪 Sending test notification to all users..."
echo "Base URL: $BASE_URL"
echo ""

RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/fcm/test-notification" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=$ADMIN_TOKEN" \
  -d '{}')

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

echo ""
echo "✅ Test notification request sent!"
echo ""
echo "Next steps:"
echo "  1. Check the browser console for 'FCM Message received'"
echo "  2. Look for the test notification in the bottom-right corner"
echo "  3. Check browser notifications if the app is in the background"
