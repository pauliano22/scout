#!/usr/bin/env bash
#
# check-migrations.sh — Migration Safety CI Gate
#
# Scans SQL migration files in apps/web/supabase/migrations/ for
# high-risk SQL patterns: DROP, TRUNCATE, RENAME, DELETE.
#
# Usage:
#   bash apps/web/scripts/check-migrations.sh
#   bash apps/web/scripts/check-migrations.sh <file1.sql> [file2.sql ...]
#
# If no files are provided, scans the entire migrations directory.
#
# Exit code: 0 if no high-risk patterns found, 1 if any are found.
#

set -o pipefail

MIGRATIONS_DIR="apps/web/supabase/migrations"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MIGRATIONS_PATH="$REPO_ROOT/$MIGRATIONS_DIR"

# High-risk SQL patterns (case-insensitive)
# We match whole "words" to avoid false positives on e.g. "updated_at"
PATTERNS=(
  '\bDROP\b'
  '\bTRUNCATE\b'
  '\bRENAME\b'
  '\bDELETE\b'
)

FOUND_ANY=0

# Determine which files to scan
if [ $# -gt 0 ]; then
  FILES=("$@")
else
  if [ -d "$MIGRATIONS_PATH" ]; then
    # shellcheck disable=SC2207
    FILES=($(ls "$MIGRATIONS_PATH"/*.sql 2>/dev/null))
  else
    echo "ERROR: Migrations directory not found: $MIGRATIONS_PATH"
    exit 1
  fi
fi

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No migration files to check."
  exit 0
fi

echo "=== Migration Safety Check ==="
echo "Scanning ${#FILES[@]} migration file(s) for high-risk SQL patterns..."
echo ""

for FILE in "${FILES[@]}"; do
  # Resolve relative to repo root if it's a relative path
  if [ ! -f "$FILE" ]; then
    CANDIDATE="$MIGRATIONS_PATH/$(basename "$FILE")"
    if [ -f "$CANDIDATE" ]; then
      FILE="$CANDIDATE"
    else
      echo "WARNING: File not found, skipping: $FILE"
      continue
    fi
  fi

  REL_PATH="${FILE#$REPO_ROOT/}"
  LINE_NUM=0
  FILE_HIT=0

  while IFS= read -r LINE; do
    LINE_NUM=$((LINE_NUM + 1))
    # Skip comment-only lines and empty lines
    TRIMMED="$(echo "$LINE" | sed 's/^[[:space:]]*--.*//; s/^[[:space:]]*$//')"
    if [ -z "$TRIMMED" ]; then
      continue
    fi

    for PATTERN in "${PATTERNS[@]}"; do
      # Use grep to check if pattern exists (not inside a comment)
      # Strip inline SQL comments before matching
      CODE="$(echo "$LINE" | sed 's/--.*//')"
      if echo "$CODE" | grep -iqE "$PATTERN"; then
        # Extract what matched
        MATCHED=$(echo "$CODE" | grep -ioE "$PATTERN" | head -1)
        echo "  $REL_PATH:$LINE_NUM  -  $MATCHED"
        FILE_HIT=1
        FOUND_ANY=1
      fi
    done
  done < "$FILE"

  if [ "$FILE_HIT" -eq 0 ]; then
    echo "  ✓ $REL_PATH — clean"
  fi
done

echo ""
if [ "$FOUND_ANY" -eq 1 ]; then
  echo "❌ FAILED: High-risk SQL patterns detected. Manual review required."
  exit 1
else
  echo "✅ PASSED: No high-risk SQL patterns found."
  exit 0
fi
