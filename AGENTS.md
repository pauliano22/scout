# Scout — Monorepo Rules

Scout is an npm-workspaces monorepo for a Cornell athlete alumni networking platform with three personas: Admins, Alumni, Student-Athletes.

## Workspace Layout
- `apps/web` — Next.js 14 (App Router). Admin portal, alumni web experience, and all API routes (Route Handlers). Server of record.
- `apps/mobile` — Expo / React Native. The student-athlete client. Consumes `apps/web` APIs; no server code of its own.
- `packages/shared` — Cross-platform code only: DB types, Zod schemas, API response types, pure utils. No Next.js or Expo runtime deps.

## Hard Rules
1. No cross-runtime dependency mixing. `apps/web` must not import `expo`/`react-native`/`expo-*`; `apps/mobile` must not import `next`/`next/*` or server-only Node modules (`fs`, `node:*`). Shared symbols go in `packages/shared`.
2. All shared DB types live in `packages/shared/types/database.ts`. Neither app defines its own Supabase row types. Import as `import type { ... } from "@scout/shared/types/database"`.
3. Plan before UI work. Any new screen, page, or non-trivial component requires a short written plan first — routes, data sources, state shape, navigation impact — approved before code.
4. API contract flows web → mobile. Mobile never writes to Supabase directly; it calls `apps/web` routes. Read paths may use the Supabase client with RLS; auth/session always goes through web endpoints.
5. Migrations live in `apps/web/supabase/migrations/` only. One source of truth for the schema.

## Secrets & Safety
- Secrets live in `apps/web/.env.local`. Never commit, print, or paste their contents.
- Never run destructive database or migration commands without explicit confirmation.

## Personas
- Admin — internal ops: monthly reports, alumni moderation, event management.
- Alumni — posts opportunities, joins events, receives outreach.
- Student-Athlete — primary mobile user: discovery, matching, job-search progress.

## Commands (from repo root)
- `npm run dev:web` — Next.js dev server
- `npm run dev:mobile` — Expo dev server
- `npm run build:web` — production build for web
- `npm run lint` — lint all workspaces

## Do Not
- Add a second `package.json` with `workspaces` — root is the only one.
- Import server-only code into `packages/shared`.
- Create documentation files unless explicitly requested.
- Start UI work without a plan.
