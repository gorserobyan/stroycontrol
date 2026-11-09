#!/usr/bin/env bash
# Runs the API-level security smoke test against the LOCAL stack.
# Usage: DEMO_PASSWORD='YourPass123' npm run verify:local
set -euo pipefail
: "${DEMO_PASSWORD:?Укажите DEMO_PASSWORD}"
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY)=')"
SUPABASE_URL="$API_URL" SUPABASE_PUBLISHABLE_KEY="$ANON_KEY" DEMO_PASSWORD="$DEMO_PASSWORD" \
  node scripts/verify-api.ts
