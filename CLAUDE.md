# Scout — Monorepo Rules

Scout is an npm-workspaces monorepo for a Cornell athlete alumni networking platform with three personas: **Admins**, **Alumni**, **Student-Athletes**.

## Workspace Layout

- `apps/web` — Next.js 14 (App Router). Hosts the **admin portal**, **alumni web experience**, and all **API routes** (Route Handlers). This is the server of record.
- `apps/mobile` — Expo / React Native app. The **student-athlete client**. Consumes `apps/web` APIs; has no server code of its own.
- `packages/shared` — Cross-platform code only: database types, Zod schemas, API response types, pure utility functions. No runtime deps on Next.js or Expo.

## Hard Rules

1. **No cross-runtime dependency mixing.**
   - `apps/web` MUST NOT import from `expo`, `react-native`, `@react-native-*`, `expo-*`.
   - `apps/mobile` MUST NOT import from `next`, `next/*`, or any server-only Node module (`fs`, `node:*`).
   - If a symbol needs both sides, it belongs in `packages/shared`.

2. **All shared DB types live in `packages/shared/types/database.ts`.**
   - Neither app may define its own copy of Supabase row types.
   - Import as `import type { ... } from "@scout/shared/types/database"`.

3. **Use the `/plan` tool before writing UI code.**
   - Any new screen, page, or non-trivial component requires a plan first (routes, data sources, state shape, navigation impact). No UI changes without an approved plan.

4. **API contract flows web → mobile.**
   - Mobile never talks to Supabase directly for write paths — it calls `apps/web` routes. Read paths may use Supabase client with RLS when appropriate, but auth/session handling goes through web endpoints.

5. **Migrations live in `apps/web/supabase/migrations/` only.** One source of truth for the schema.

## Personas & Access

- **Admin** — internal ops; monthly reports, alumni moderation, event management.
- **Alumni** — posts opportunities, joins events, receives outreach.
- **Student-Athlete** — primary mobile user; discovery, matching, job-search progress.

## Commands (run from repo root)

- `npm run dev:web` — Next.js dev server
- `npm run dev:mobile` — Expo dev server
- `npm run build:web` — production build for web
- `npm run lint` — lint all workspaces

## What Not To Do

- Do not add a second `package.json` with `workspaces` — root is the only one.
- Do not import server-only code into `packages/shared`.
- Do not create documentation files unless explicitly requested.
- Do not bypass `/plan` for UI work.
