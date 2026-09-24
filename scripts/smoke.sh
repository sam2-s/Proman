#!/usr/bin/env bash
# Smoke-test the Proman API end-to-end.
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:3000}"
EMAIL="smoke-$(date +%s)@proman.dev"
PASS="password123"

say() { printf '\n== %s ==\n' "$1"; }

say "health"
curl -sf "$BASE/api/health" | grep -q ok && echo OK

say "register"
REG=$(curl -sf -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Smoke Test\"}")
TOKEN=$(printf '%s' "$REG" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
AUTH="Authorization: Bearer $TOKEN"
echo "token acquired"

say "create project"
PROJ=$(curl -sf -X POST "$BASE/api/projects" -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Project","description":"created by smoke test"}')
PID=$(printf '%s' "$PROJ" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "project id=$PID"

say "boards"
BOARDS=$(curl -sf "$BASE/api/projects/$PID/boards" -H "$AUTH")
BID=$(printf '%s' "$BOARDS" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
echo "board id=$BID"

say "board detail"
curl -sf "$BASE/api/boards/$BID" -H "$AUTH" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert len(d["columns"])>=3;print("columns:",len(d["columns"]))'

say "create card on first column"
COL=$(curl -sf "$BASE/api/boards/$BID" -H "$AUTH" | python3 -c 'import sys,json;print(json.load(sys.stdin)["columns"][0]["column"]["id"])')
CARD=$(curl -sf -X POST "$BASE/api/columns/$COL/cards" -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Smoke task","priority":"high","start_date":"2026-09-24","due_date":"2026-10-01"}')
CID=$(printf '%s' "$CARD" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "card id=$CID"

say "subtask + comment"
curl -sf -X POST "$BASE/api/cards/$CID/subtasks" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"title":"child"}' >/dev/null
curl -sf -X POST "$BASE/api/cards/$CID/comments" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"body":"hi"}' >/dev/null
echo OK

say "move card to second column"
COL2=$(curl -sf "$BASE/api/boards/$BID" -H "$AUTH" | python3 -c 'import sys,json;print(json.load(sys.stdin)["columns"][1]["column"]["id"])')
curl -sf -X PATCH "$BASE/api/cards/$CID" -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d "{\"column_id\":$COL2,\"position\":0}" >/dev/null
echo OK

say "timeline"
N=$(curl -sf "$BASE/api/projects/$PID/cards" -H "$AUTH" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
echo "$N dated cards"
test "$N" -ge 1

say "bad login rejected"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"wrong\"}")
test "$CODE" = "401" && echo "401 as expected"

printf '\nALL SMOKE TESTS PASSED\n'
