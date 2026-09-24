#!/usr/bin/env bash
# Seed a demo account and sample project for local development.
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:3000}"
EMAIL="${EMAIL:-demo@proman.dev}"
PASS="${PASS:-password123}"

echo "Seeding demo user $EMAIL …"

REG=$(curl -s -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Demo User\"}")

if echo "$REG" | grep -q token; then
  TOKEN=$(printf '%s' "$REG" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
  echo "registered new account"
else
  LOGIN=$(curl -s -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
  TOKEN=$(printf '%s' "$LOGIN" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
  echo "logged in existing account"
fi

AUTH="Authorization: Bearer $TOKEN"

PROJ=$(curl -s -X POST "$BASE/api/projects" -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Product Launch","description":"Sample project for demos"}')
PID=$(printf '%s' "$PROJ" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))')
echo "project: $PID"

BID=$(curl -s "$BASE/api/projects/$PID/boards" -H "$AUTH" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
BOARD=$(curl -s "$BASE/api/boards/$BID" -H "$AUTH")
COL1=$(printf '%s' "$BOARD" | python3 -c 'import sys,json;print(json.load(sys.stdin)["columns"][0]["column"]["id"])')
COL2=$(printf '%s' "$BOARD" | python3 -c 'import sys,json;print(json.load(sys.stdin)["columns"][1]["column"]["id"])')

create() {
  local col=$1 title=$2 prio=$3 start=$4 due=$5
  curl -s -X POST "$BASE/api/columns/$col/cards" -H "$AUTH" \
    -H 'Content-Type: application/json' \
    -d "{\"title\":\"$title\",\"priority\":\"$prio\",\"start_date\":\"$start\",\"due_date\":\"$due\"}" >/dev/null
}

create "$COL1" "Define launch goals" "high" "2026-09-24" "2026-09-28"
create "$COL1" "Draft press kit" "medium" "2026-09-27" "2026-10-03"
create "$COL2" "Build landing page" "urgent" "2026-09-24" "2026-10-01"
create "$COL1" "Record demo video" "low" "2026-10-01" "2026-10-07"

echo "Seeded. Login with $EMAIL / $PASS"
