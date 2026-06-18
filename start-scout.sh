#!/bin/bash
# Wrapper script for launchd — keeps the Scout dev server running
export PATH="/Users/q/.local/bin:/Users/q/.hermes/node/bin:/usr/local/bin:/usr/bin:/bin"
export NODE_ENV=development
cd /Users/q/Developer/scout || exit 1
exec /Users/q/.local/bin/npm run dev --workspace=apps/web
