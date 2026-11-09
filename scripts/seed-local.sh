#!/usr/bin/env bash
# Seeds the LOCAL Supabase stack (supabase start) with demo data.
# Keys are read from `supabase status` at runtime and never written to disk.
# Usage: DEMO_PASSWORD='YourPass123' npm run seed:local
set -euo pipefail

if [[ -z "${DEMO_PASSWORD:-}" ]]; then
  echo "✖ Укажите пароль для демо-пользователей: DEMO_PASSWORD='...' npm run seed:local" >&2
  exit 1
fi

eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"

SUPABASE_URL="$API_URL" \
SUPABASE_PUBLISHABLE_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
DEMO_PASSWORD="$DEMO_PASSWORD" \
  node scripts/seed-demo.ts
