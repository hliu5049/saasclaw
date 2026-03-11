#!/usr/bin/env bash
# test-chat.sh — end-to-end SSE chat smoke test
# Usage: bash scripts/test-chat.sh [base_url]
set -uo pipefail   # -e removed: we handle errors explicitly

BASE="${1:-http://localhost:3000}"
EMAIL="chattest@example.com"
PASS="chattest123"
NAME="ChatTester"
SSE_PID=""

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${CYAN}[test]${NC} $*"; }
ok()   { echo -e "${GREEN}[ok]${NC}   $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[fail]${NC} $*"; }

cleanup() {
  if [[ -n "$SSE_PID" ]] && kill -0 "$SSE_PID" 2>/dev/null; then
    kill "$SSE_PID" 2>/dev/null || true
    log "SSE subscriber stopped (pid $SSE_PID)"
  fi
}
trap cleanup EXIT

# ─────────────────────────────────────────────────────────────────────────────
# 1. Register (ignore 409 if user already exists)
# ─────────────────────────────────────────────────────────────────────────────
log "Step 1 — register user ${EMAIL}"
REG=$(curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"$NAME\"}")

if echo "$REG" | grep -q '"success":true'; then
  ok "Registered new user"
else
  warn "Register skipped ($(echo "$REG" | grep -o '"error":"[^"]*"' || echo 'already exists'))"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. Login → token + userId
# ─────────────────────────────────────────────────────────────────────────────
log "Step 2 — login"
LOGIN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")

TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || true)
USER_ID=$(echo "$LOGIN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)

if [[ -z "$TOKEN" ]]; then
  err "Login failed"; echo "$LOGIN"; exit 1
fi
ok "Token acquired (${TOKEN:0:32}…)  userId=$USER_ID"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Get or create an agent (owned by this user)
# ─────────────────────────────────────────────────────────────────────────────
log "Step 3 — resolve agent"
AGENTS=$(curl -s "$BASE/api/agents" -H "Authorization: Bearer $TOKEN")
AGENT_ID=$(echo "$AGENTS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)

if [[ -z "$AGENT_ID" ]]; then
  log "No agent for this user — creating TestBot"
  CREATE=$(curl -s -X POST "$BASE/api/agents" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"TestBot","description":"Smoke-test agent"}')
  AGENT_ID=$(echo "$CREATE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
  [[ -n "$AGENT_ID" ]] && ok "Created agent $AGENT_ID" || { err "Could not create agent"; echo "$CREATE"; exit 1; }
else
  ok "Using existing agent $AGENT_ID"
fi

SESSION_KEY="agent:${AGENT_ID}:webchat:user:${USER_ID}"
log "sessionKey: $SESSION_KEY"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Subscribe SSE in background — pretty-print events as they arrive
# ─────────────────────────────────────────────────────────────────────────────
log "Step 4 — start SSE subscriber"
SSE_URL="$BASE/api/chat/$AGENT_ID/stream?token=$TOKEN"

(
  PENDING_EVENT=""
  curl -sN "$SSE_URL" 2>/dev/null | while IFS= read -r line; do
    if [[ "$line" == "event:"* ]]; then
      PENDING_EVENT="${line#event: }"
      PENDING_EVENT="${PENDING_EVENT#event:}"
    elif [[ "$line" == "data:"* ]]; then
      DATA="${line#data: }"
      DATA="${DATA#data:}"
      case "$PENDING_EVENT" in
        ping)
          echo -e "${YELLOW}  ♥  heartbeat${NC}"
          ;;
        text)
          TEXT=$(echo "$DATA" | grep -o '"text":"[^"]*"' | cut -d'"' -f4 || echo "$DATA")
          echo -e "${GREEN}  ▶  text      ${NC}| $TEXT"
          ;;
        thinking)
          echo -e "${CYAN}  ●  thinking  ${NC}| $DATA"
          ;;
        done)
          echo -e "${BOLD}  ✓  done      ${NC}| $DATA"
          ;;
        tool_start)
          TOOL=$(echo "$DATA" | grep -o '"tool":"[^"]*"' | cut -d'"' -f4 || echo "$DATA")
          echo -e "${CYAN}  ⚙  tool      ${NC}| $TOOL"
          ;;
        message|"")
          [[ "$DATA" != "{}" ]] && echo "     $DATA"
          ;;
        *)
          echo "  event:$PENDING_EVENT  $DATA"
          ;;
      esac
      PENDING_EVENT=""
    fi
  done
) &
SSE_PID=$!
ok "SSE pid=$SSE_PID  url=$SSE_URL"
sleep 1  # let stream connect

# ─────────────────────────────────────────────────────────────────────────────
# 5. Send a message (35s timeout to survive RPC timeout if gateway offline)
# ─────────────────────────────────────────────────────────────────────────────
log "Step 5 — send message"
MSG="Hello, can you introduce yourself?"
echo -e "${BOLD}Sending:${NC} \"$MSG\""

SEND_HTTP=$(curl -s -o /tmp/send_body.txt -w "%{http_code}" --max-time 36 \
  -X POST "$BASE/api/chat/$AGENT_ID/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"message\":\"$MSG\"}" 2>/dev/null || echo "000")
SEND_BODY=$(cat /tmp/send_body.txt 2>/dev/null || true)

if [[ "$SEND_HTTP" == "200" ]]; then
  ok "Message sent — gateway accepted (HTTP $SEND_HTTP)"
  echo "  $SEND_BODY"
elif [[ "$SEND_HTTP" == "000" ]]; then
  warn "curl timed out — gateway likely unreachable"
else
  warn "Send returned HTTP $SEND_HTTP (gateway may be offline)"
  echo "  $SEND_BODY"
  warn "SSE heartbeat pings will still appear every 15 s"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 6. Watch SSE for 30 s more
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}── Watching SSE for 30 s ────────────────────────────────────────${NC}"
for i in 6 5 4 3 2 1; do
  sleep 5
  kill -0 "$SSE_PID" 2>/dev/null && log "${i} × 5s remaining…" || { warn "SSE process exited early"; break; }
done

echo -e "${BOLD}── Done ─────────────────────────────────────────────────────────${NC}"
ok "Script complete. Streaming text events appear as ▶ text lines above."
ok "Heartbeat pings appear as ♥ every 15 s regardless of gateway status."
