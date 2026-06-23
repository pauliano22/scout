#!/bin/bash
# =============================================================================
# Scout — Vercel Deployment Rollback Script
# =============================================================================
# Usage:
#   ./scripts/rollback.sh                       Roll back to previous stable
#   ./scripts/rollback.sh --list                List recent deployments
#   ./scripts/rollback.sh dpl_abc123            Roll back to a specific deploy
#   ./scripts/rollback.sh --health              Validate /api/health after
#   ./scripts/rollback.sh --yes                 Skip confirmation prompt
#   ./scripts/rollback.sh --help                Show this help message
#
# Prerequisites:
#   - Vercel CLI installed:  npm i -g vercel
#   - Logged in:             vercel login
#   - Linked to project:     vercel link
#
# Environment overrides:
#   VERCEL_TOKEN        Vercel API token (uses CLI auth if unset)
#   VERCEL_PROJECT_ID   Project ID (auto-reads from .vercel/project.json)
#   VERCEL_ORG_ID       Org ID (auto-reads from .vercel/project.json)
#   VERCEL_BASE_URL     Base URL for health checks (default: https://scout-inky.vercel.app)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VERCEL_BIN="${VERCEL_BIN:-vercel}"

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
show_help() {
  sed -n '2,/^$/p' "$0" | sed 's/^# //g; s/^#$//g'
  exit 0
}

# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
check_prereqs() {
  if ! command -v "$VERCEL_BIN" &>/dev/null; then
    error "Vercel CLI not found (tried '$VERCEL_BIN'). Install it:"
    echo "  npm i -g vercel"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Resolve project/org IDs from env or .vercel/project.json
# ---------------------------------------------------------------------------
resolve_vercel_ids() {
  if [[ -z "${VERCEL_PROJECT_ID:-}" || -z "${VERCEL_ORG_ID:-}" ]]; then
    local project_json="$REPO_DIR/.vercel/project.json"
    if [[ -f "$project_json" ]]; then
      VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-$(jq -r '.projectId // empty' "$project_json" 2>/dev/null || true)}"
      VERCEL_ORG_ID="${VERCEL_ORG_ID:-$(jq -r '.orgId // empty' "$project_json" 2>/dev/null || true)}"
    fi
  fi

  if [[ -z "${VERCEL_PROJECT_ID:-}" ]]; then
    error "VERCEL_PROJECT_ID is not set and could not be read from .vercel/project.json"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Raw API call wrapper (used when VERCEL_TOKEN is set)
# ---------------------------------------------------------------------------
vercel_api_get() {
  local path="$1"
  curl -sS \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    "https://api.vercel.com${path}"
}

vercel_api_post() {
  local path="$1"
  shift
  curl -sS -X POST \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    "https://api.vercel.com${path}" \
    "$@"
}

# ---------------------------------------------------------------------------
# List recent deployments
# ---------------------------------------------------------------------------
list_deployments() {
  info "Fetching recent deployments …"

  local output
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    resolve_vercel_ids
    output=$(vercel_api_get "/v9/projects/${VERCEL_PROJECT_ID}/deployments?limit=10")
  else
    cd "$REPO_DIR"
    output=$("$VERCEL_BIN" list --scope scout 2>&1) || true
  fi

  if echo "$output" | jq -e '.deployments' &>/dev/null 2>&1; then
    echo "$output" | jq -r '
      .deployments[] |
      [
        .uid[0:20],
        .name,
        .url,
        .state,
        (if .createdAt then (.createdAt / 1000 | strftime("%Y-%m-%d %H:%M:%S")) else "?" end),
        (.meta.githubCommitSha // "-" | .[0:7])
      ] | @tsv
    ' | column -t -s $'\t' -N 'UID,NAME,URL,STATE,CREATED,COMMIT'
  else
    # Fallback: print raw output
    echo "$output"
  fi
}

# ---------------------------------------------------------------------------
# Get the previous stable (READY) deployment ID
# ---------------------------------------------------------------------------
get_previous_stable() {
  local output
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    resolve_vercel_ids
    output=$(vercel_api_get "/v9/projects/${VERCEL_PROJECT_ID}/deployments?limit=20")
  else
    cd "$REPO_DIR"
    output=$("$VERCEL_BIN" list --scope scout --json 2>&1) || true
  fi

  local prev_id
  if echo "$output" | jq -e '.deployments' &>/dev/null 2>&1; then
    prev_id=$(echo "$output" | jq -r '
      [.deployments[] | select(.state == "READY")] |
      sort_by(.createdAt) |
      reverse |
      .[1].uid // empty
    ')
  else
    error "Cannot parse deployment list. Make sure the project is linked."
    return 1
  fi

  if [[ -z "$prev_id" || "$prev_id" == "null" ]]; then
    error "No previous stable (READY) deployment found."
    return 1
  fi

  echo "$prev_id"
}

# ---------------------------------------------------------------------------
# Rollback
# ---------------------------------------------------------------------------
rollback() {
  local target="$1"
  shift

  info "Rolling back to deployment: ${target}"

  local confirm="${1:-}"
  if [[ "$confirm" != "--yes" && "$confirm" != "-y" ]]; then
    echo -e -n "${YELLOW}Proceed with rollback to ${target}? [y/N]${NC} "
    read -r response
    if [[ ! "$response" =~ ^[Yy] ]]; then
      info "Rollback cancelled."
      return 0
    fi
  fi

  local output
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    output=$(vercel_api_post "/v12/deployments/${target}/rollback" 2>&1)
  else
    cd "$REPO_DIR"
    output=$("$VERCEL_BIN" rollback "$target" --yes 2>&1) || true
  fi

  if echo "$output" | grep -qiE '(error|failed|not found|404)'; then
    error "Rollback failed:"
    echo "$output"
    return 1
  fi

  ok "Rollback to ${target} completed successfully."
}

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
health_check() {
  local base_url="${VERCEL_BASE_URL:-https://scout-inky.vercel.app}"
  info "Performing health check against ${base_url}/api/health …"

  local http_code
  http_code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "${base_url}/api/health" 2>&1) || {
    error "Health check request failed."
    return 1
  }

  if [[ "$http_code" -ge 200 && "$http_code" -lt 400 ]]; then
    ok "Health check passed (HTTP ${http_code})."
    return 0
  else
    error "Health check FAILED (HTTP ${http_code})."
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  local do_health=false
  local target=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --help|-h)
        show_help
        ;;
      --list|-l)
        check_prereqs
        list_deployments
        exit $?
        ;;
      --health)
        do_health=true
        shift
        ;;
      --yes|-y|--yes=*)
        # Consumed by rollback() — pass through
        break
        ;;
      dpl_*)
        target="$1"
        shift
        ;;
      *)
        error "Unknown option: $1"
        echo "Run './scripts/rollback.sh --help' for usage."
        exit 1
        ;;
    esac
  done

  check_prereqs

  if [[ -z "$target" ]]; then
    info "No deployment specified — finding previous stable deployment …"
    target="$(get_previous_stable)" || exit 1
    ok "Target: ${target}"
  fi

  rollback "$target" "$@"

  if [[ "$do_health" == true ]]; then
    info "Waiting 15 seconds for deployment to settle …"
    sleep 15
    health_check || exit 1
  fi

  ok "Done."
}

main "$@"
