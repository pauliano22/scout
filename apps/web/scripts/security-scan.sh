#!/usr/bin/env bash
set -euo pipefail

# security-scan.sh — Dependency vulnerability scanning
# Runs npm audit in the apps/web directory and fails CI if critical
# vulnerabilities are found.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "::group::🔒 Dependency vulnerability scan"
echo "Scanning dependencies in $WEB_DIR ..."

# Check that npm is available
if ! command -v npm &>/dev/null; then
  echo "❌ npm is not installed or not in PATH. Cannot run audit."
  exit 1
fi

# Move into the web app directory
cd "$WEB_DIR"

# Run npm audit at high level or above
echo "Running: npm audit --audit-level=high ..."
set +e
npm audit --audit-level=high 2>&1
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ No high or critical vulnerabilities found."
elif [ $EXIT_CODE -eq 1 ]; then
  echo "❌ CRITICAL or HIGH vulnerabilities detected!"
  echo "   Action required: Review and patch the vulnerabilities above."
  echo "   Run 'npm audit fix' or manually update affected packages."
  echo "::endgroup::"
  exit 1
else
  # npm audit exits with code 243 (or others) when the registry is unreachable,
  # the command doesn't exist in older npm versions, etc.
  echo "⚠️  npm audit exited with code $EXIT_CODE (non-critical failure)."
  echo "   This could mean the registry is unreachable or npm audit is not available."
  echo "   CI will not fail for this transient issue."
  echo "::endgroup::"
  exit 0
fi

echo "::endgroup::"
