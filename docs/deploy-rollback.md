# Deployment Rollback Mechanism

> **Idea #20** — Add a documented Vercel deploy-on-verify flow with one-click rollback to the previous stable deploy.

## Overview

Scout deploys to Vercel automatically on pushes to `main`. If a broken deploy slips through (missing migration, broken API endpoint, runtime error), there is currently **no rollback button** — users are stuck until a fix ships through the full deploy cycle.

This document defines two complementary mechanisms:

1. **Interactive rollback** — a shell script that reverts to the previous stable deployment.
2. **Health-check gate** — a `/api/health` endpoint verification step that can be integrated into CI/CD pipelines.

---

## Prerequisites

- [Vercel CLI](https://vercel.com/docs/cli) installed: `npm i -g vercel`
- Authenticated: `vercel login`
- Project linked: `vercel link` (run from `apps/web/`)

```bash
cd apps/web
vercel link --project scout
```

---

## Quick Start

### Roll back to the previous stable deployment

```bash
./scripts/rollback.sh
```

The script will:
1. Fetch recent deployments via the Vercel CLI.
2. Find the most recent `READY` deployment **before** the current one.
3. Prompt for confirmation, then execute the rollback.

### Roll back with a health check

```bash
./scripts/rollback.sh --health
```

After rolling back, the script waits 15 seconds and then calls `GET /api/health`. If the endpoint returns a non-2xx/3xx status, the script exits with an error.

### List recent deployments

```bash
./scripts/rollback.sh --list
```

Shows a table of the last 10 deployments with UID, name, URL, state, creation time, and commit SHA.

### Roll back to a specific deployment

```bash
./scripts/rollback.sh dpl_abc123
```

### Skip confirmation (for automated/CI use)

```bash
./scripts/rollback.sh --yes
./scripts/rollback.sh dpl_abc123 --yes
```

---

## Script Reference

```text
Usage:
  ./scripts/rollback.sh                       Roll back to previous stable
  ./scripts/rollback.sh --list                List recent deployments
  ./scripts/rollback.sh dpl_abc123            Roll back to a specific deploy
  ./scripts/rollback.sh --health              Validate /api/health after
  ./scripts/rollback.sh --yes                 Skip confirmation prompt
  ./scripts/rollback.sh --help                Show help

Environment:
  VERCEL_TOKEN        Vercel API token (uses CLI auth if unset)
  VERCEL_PROJECT_ID   Project ID (auto-reads from .vercel/project.json)
  VERCEL_ORG_ID       Org ID (auto-reads from .vercel/project.json)
  VERCEL_BASE_URL     Override health-check URL (default: https://scout-inky.vercel.app)
```

---

## API Token Mode (CI/CD)

When running in CI (GitHub Actions, cron, etc.), there may be no interactive terminal. Set `VERCEL_TOKEN` to use the Vercel REST API directly instead of the CLI.

```bash
export VERCEL_TOKEN="your_vercel_api_token"
export VERCEL_PROJECT_ID="prj_xxx"
export VERCEL_ORG_ID="team_xxx"

./scripts/rollback.sh --yes
```

---

## Health Check Endpoint

The health check relies on the `/api/health` route handler. If this route does not exist yet, create it at `apps/web/app/api/health/route.ts`:

```typescript
// apps/web/app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
```

The endpoint should return HTTP 200 when the app is healthy. You can extend it to check database connectivity, external service health, etc.

---

## CI/CD Integration (GitHub Actions Example)

Add the following job to your deploy workflow to enable automatic health-gated rollback:

```yaml
# .github/workflows/deploy.yml (partial)
deploy:
  steps:
    - uses: actions/checkout@v4
    - run: npm ci

    - name: Deploy to Vercel
      run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}

    - name: Health check
      run: |
        sleep 15
        curl -sf --max-time 15 https://scout-inky.vercel.app/api/health || \
          echo "Health check failed! Consider rolling back."

    - name: Rollback on failure
      if: failure()
      run: ./scripts/rollback.sh --yes
      env:
        VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
```

---

## Manual Rollback via Vercel Dashboard

If the CLI is unavailable, you can also roll back through the Vercel web dashboard:

1. Go to [vercel.com/pauliano22/scout](https://vercel.com/pauliano22/scout)
2. Navigate to **Deployments**
3. Find the deployment you want to restore (the one before the broken deploy)
4. Click the **•••** menu and select **Promote to Production**

---

## Failure Modes

| Situation | Resolution |
|-----------|-----------|
| No previous stable deployment | The script tells you and exits. Deploy a fix manually. |
| Vercel CLI not installed | Install it: `npm i -g vercel`. Or use `VERCEL_TOKEN` mode. |
| Health check fails after rollback | The previous deploy might have been broken too. Roll back further. |
| Database migration mismatch | The rollback restores the app code but not the DB schema. Run `npm run db:migrate` to reconcile if needed. |

---

## Related

- [`scripts/rollback.sh`](../scripts/rollback.sh) — the rollback script
- [`apps/web/vercel.json`](../apps/web/vercel.json) — Vercel project config
- [Vercel Rollback Docs](https://vercel.com/docs/deployments/rollbacks)
