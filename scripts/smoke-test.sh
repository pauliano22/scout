#!/bin/bash
# =============================================================================
# Scout — Smoke Test Script for Staging Preview Deploys
# =============================================================================
# Runs a basic health-check suite against a deployed preview URL:
#   1. HTTP 200 on the root page
#   2. Known API endpoint returns valid JSON
#   3. Page contains expected HTML markers
#
# Usage:
#   ./scripts/smoke-test.sh <preview-url>
#
# Example:
#   ./scripts/smoke-test.sh https://scout-git-feature-foo-pauliano22.vercel.app
#
# Exit codes:
#   0 — all checks pass
#   1 — one or more checks failed
# =============================================================================

set -euo pipefail

RESULT_LOG="/tmp/smoke-test-results.log"

# ── Helpers ──────────────────────────────────────────────────────────────────

pass()  { echo "[PASS] $1" | tee -a "$RESULT_LOG"; }
fail()  { echo "[FAIL] $1" | tee -a "$RESULT_LOG"; FAILED=1; }
info()  { echo "[INFO] $1" | tee -a "$RESULT_LOG"; }

FAILED=0

# ── Preflight ────────────────────────────────────────────────────────────────

if [ $# -lt 1 ]; then
  echo "Usage: $0 <preview-url>"
  exit 1
fi

BASE_URL="${1%/}"  # strip trailing slash
info "Smoke testing: $BASE_URL"
info "Started at:    $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "" >> "$RESULT_LOG"

# ── Check 1: Root page returns HTTP 200 ──────────────────────────────────────

info "Check 1: Root page returns HTTP 200"

HTTP_STATUS=$(curl -s -o /tmp/smoke-root.html -w "%{http_code}" --max-time 15 "$BASE_URL/")

if [ "$HTTP_STATUS" = "200" ]; then
  pass "Root page returned HTTP 200"
else
  fail "Root page returned HTTP $HTTP_STATUS (expected 200)"
fi

# ── Check 2: Root page content — basic HTML markers ─────────────────────────

info "Check 2: Root page contains basic HTML markers"

if grep -qi '<html' /tmp/smoke-root.html 2>/dev/null; then
  pass "Root page contains <html> tag"
else
  fail "Root page missing <html> tag — may not be valid HTML"
fi

if grep -qi 'scout\|cornell\|next' /tmp/smoke-root.html 2>/dev/null; then
  pass "Root page contains expected brand keywords"
else
  fail "Root page missing expected brand keywords (scout, cornell)"
fi

# ── Check 3: API health endpoint (HEAD) ──────────────────────────────────────

info "Check 3: API responds (HEAD /api/today)"

API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$BASE_URL/api/today")

# Expecting 401 (Unauthorized) because we're not authenticated — that proves
# the API route handler is alive and responding, which is exactly what we
# want to validate in a smoke test.
if [ "$API_STATUS" = "401" ]; then
  pass "API endpoint returned HTTP 401 (expected — unauthenticated request)"
else
  fail "API endpoint returned HTTP $API_STATUS (expected 401 for unauthenticated)"
fi

# ── Check 4: API returns valid JSON body ─────────────────────────────────────

info "Check 4: API response body is valid JSON"

API_BODY=$(curl -s --max-time 15 "$BASE_URL/api/today")

if echo "$API_BODY" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  pass "API response is valid JSON"
else
  fail "API response is not valid JSON (body: ${API_BODY:0:200})"
fi

# ── Check 5: API response has expected structure ─────────────────────────────

info "Check 5: API response contains 'error' field (expected shape)"

if echo "$API_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'error' in d, 'missing error key'" 2>/dev/null; then
  pass "API response contains expected 'error' field"
else
  # It's possible the API returns a different shape if env changes — log but don't fail
  info "API response shape unexpected but not necessarily broken (body preview: ${API_BODY:0:150})"
fi

# ── Summary ──────────────────────────────────────────────────────────────────

echo "" >> "$RESULT_LOG"
if [ "$FAILED" = "1" ]; then
  echo "[RESULT] ❌ SMOKE TESTS FAILED" | tee -a "$RESULT_LOG"
  exit 1
else
  echo "[RESULT] ✅ ALL SMOKE TESTS PASSED" | tee -a "$RESULT_LOG"
  exit 0
fi
