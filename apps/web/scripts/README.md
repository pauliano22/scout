# PII Endpoint Audit

An automated audit script that scans all Next.js App Router API route handlers (`apps/web/app/api/`) for authentication guards and reports endpoints that may expose Personally Identifiable Information (PII) without proper auth.

## Usage

Run from the `apps/web` directory:

```bash
npm run audit:pii
```

Or directly:

```bash
npx tsx scripts/pii-endpoint-audit.ts
```

## Output

The script generates a table with the following columns:

| Column   | Description                                      |
| -------- | ------------------------------------------------ |
| Method   | HTTP method (GET, POST, PATCH, DELETE)           |
| Path     | Route path (e.g., `/api/opportunities`)          |
| Auth     | `YES` if an auth guard was detected, `NO` if not |
| Risk     | `✓ LOW` if guarded, `⚠️  HIGH` if unguarded      |
| Notes    | Which auth patterns were matched                 |

## Auth Patterns Detected

The script scans for the following authentication patterns:

| Pattern                        | Source                                 |
| ------------------------------ | -------------------------------------- |
| `requireUser()`                | `@/lib/auth`                           |
| `requireAdmin()`               | `@/lib/auth`                           |
| `requireAlumniOrAdmin()`       | `@/lib/auth`                           |
| `getAuthContext()`             | `@/lib/auth`                           |
| `resolveRequestUser()`         | `@/lib/requestAuth`                    |
| `supabase.auth.getUser()`      | Manual Supabase auth check             |
| `authorized()` / `authCheck()` | Custom admin/cron auth functions       |
| `Authorization` header         | Bearer token checks                    |
| Admin key query param          | `?key=ADMIN_API_TOKEN` pattern         |
| `Unauthorized` response        | Any handler returning a 401            |

## Interpreting Results

- **Guarded endpoints (✓ LOW)**: These have at least one auth guard. The risk is low.
- **Unguarded endpoints (⚠️ HIGH)**: These have **no detected auth guard**. Each should be reviewed to determine if:
  - **Intentional**: The endpoint is meant to be public (e.g., forgot-password, reset-password, alumni opt-in forms, avatar validation).
  - **Missing auth**: The endpoint needs authentication but none was implemented.
  - **Undetected pattern**: The auth guard uses a pattern not covered by this scanner.

## False Positives

Known intentionally public endpoints that will always appear as unguarded:

- `POST /api/alumni/submit` — Public alumni opt-in form
- `GET /api/avatar/check` — Public avatar placeholder check
- `POST /api/forgot-password` — Password reset flow
- `POST /api/reset-password` — Password reset flow
- `GET /api/reset-password` — Password reset flow

## CI Integration

The audit runs automatically via GitHub Actions on:

- Every PR that modifies files under `apps/web/app/api/`
- Pushes to `main` and `develop` that touch API routes
- Weekly schedule (Mondays at 9:00 UTC)
- Manual trigger via `workflow_dispatch`

The CI job uploads the audit report as a build artifact for review.

## Adding New Auth Patterns

If your project uses a new auth pattern, add it to the `AUTH_PATTERNS` array in `pii-endpoint-audit.ts`:

```typescript
{
  regex: /your-new-pattern/,
  label: 'Your Pattern Name',
  isStrong: true,
}
```
