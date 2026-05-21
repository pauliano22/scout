---
name: scout-product
description: Product, UX, and engineering context for the Scout alumni networking platform. Load whenever implementing or reviewing any Scout feature — screens, APIs, onboarding flows, recommendation logic, profile/account work, or data models.
triggers:
  - implementing or reviewing a Scout screen, component, or API route
  - working on Discover, Network, or You screens
  - onboarding flow changes (mobile or web)
  - recommendation scoring or personalization work
  - profile, resume, or account features
---

# Scout Product Skill

Use this skill whenever implementing or reviewing any Scout feature — screens, APIs, data models, recommendation logic, onboarding flows, or profile/account work. It captures the product philosophy, UX rules, and engineering constraints that are not obvious from reading the code alone.

---

## 1. Product Context

Scout is a mobile-first alumni networking platform for student-athletes. There are three personas:

- **Student-Athlete** — the primary mobile user. Discovers alumni, saves connections, drafts outreach messages, tracks relationship status.
- **Alumni** — creates a profile, posts opportunities, receives outreach. Web-first, mobile-optional.
- **Admin** — internal ops team. Uses the web portal for moderation, monthly reports, and event management.

The core value proposition for a student-athlete is: *find a Cornell alum who played your sport, works in your target industry, and is willing to talk*. Every feature should make that loop faster and higher-quality.

---

## 2. Mobile vs Web Philosophy

| Concern | Mobile (`apps/mobile`) | Web (`apps/web`) |
|---|---|---|
| Primary user | Student-Athlete | Alumni + Admin |
| Interaction model | Touch, swipe, gestures | Mouse, keyboard, forms |
| Data writes | Call `apps/web` API routes; never Supabase direct | Supabase server client or Route Handler |
| Data reads | Supabase RLS client is OK; auth through web endpoints | Supabase server client |
| Navigation | React Navigation bottom tabs (Discover / Network / You) | Next.js App Router |
| Styling | `scoutTheme` tokens only — never raw hex/pixel values | Tailwind |
| Server code | Forbidden — no `fs`, `node:*`, `next/*` | Fine |

**Golden rule:** if a symbol needs to exist on both sides, it lives in `packages/shared`. Neither app defines its own copy.

---

## 3. Discover Page Rules

File: `apps/mobile/src/screens/DiscoverScreen.tsx`

- **Deck-first, not list-first.** The top card dominates the viewport. At most 3 cards are rendered (the rest of the deck is pre-scored in memory, not on screen).
- **Three actions only:** Pass (left swipe or ✕ button), Save (right swipe or bookmark button), View (opens `AlumniDetailModal`). No fourth action.
- **Pass is irreversible** in the current model. Do not add undo unless explicitly requested.
- **"Saved to your Network" toast** fires on every save action — from swipe and from button. Keep it at 1800ms.
- **Empty state:** Show "You're caught up." with two CTAs — "Edit Preferences" (navigates to You screen) and "Refresh" (calls `load()`). Do not show a sad face or negative language.
- **Loading state:** Always `SkeletonCard`, never a spinner inside the deck area.
- **Preference icon** is top-right of the header; navigates to YouScreen. Do not add more header icons without a strong reason.
- **Count pill** shows the deck length only when `deck.length > 0` and not loading. Hide it during load.
- `useFocusEffect` only calls `load()` if the deck is empty — do not reload on every focus.

---

## 4. Network UI Rules

File: `apps/mobile/src/screens/NetworkScreen.tsx`

- **Status pipeline:** `saved → message_drafted → contacted → replied → meeting_set`. These are the only valid statuses. The filter chips map exactly to this set plus "All".
- **StatusBadge** renders in the row's top-right. It must always be visible at a glance — never hide it behind a secondary tap.
- **Search** filters on name, currentCompany, currentRole, and industry. Do not add more fields without confirming they're indexed.
- **Filter chips** scroll horizontally; never wrap to two lines.
- **Grouped list** (`listGroup` style): rounded container with hairline dividers, not individual cards. Preserve this layout unless redesigning Network is the explicit task.
- **Pull-to-refresh** is the primary refresh mechanism. Do not add a refresh button in the header.
- **Generate message flow:** AlumniDetailModal → GenerateMessageModal. The current implementation uses a short delay between close and open to avoid visual overlap — preserve this if the modal sequence is unchanged.
- **Network reads from Supabase directly** (RLS read path). Status updates should call a web API route.

---

## 5. Onboarding Rules

Mobile file: `apps/mobile/src/screens/OnboardingScreen.tsx`  
Web file: `apps/web/app/onboarding/OnboardingClient.tsx`

### Mobile onboarding (student-athlete, 4 steps)
- Step 0: Athletic background (sport + graduation year)
- Step 1: Career interests (target industries + target roles)
- Step 2: Career stage (single-select radio cards: exploring / recruiting / interviewing / referrals / relationship_building)
- Step 3: Target locations

**Rules:**
- Every step is skippable ("Skip for now") except the final step which shows "Finish Setup".
- Dot progress indicator: active dot is wider than inactive dots, done dots render at reduced opacity. Match the current visual treatment in `OnboardingScreen.tsx` unless the design changes.
- Fade transition between steps (not slide) — match the current animation style unless the design changes.
- On submit, first save to `profiles` table, then `saveUserPreferences`, then `refreshProfile`. Order matters.
- Sport is single-select autocomplete. Industries, roles, and locations are tag inputs (multi).
- The first industry added becomes `primary_industry`; remaining go to `secondary_industries`.

### Web onboarding (alumni, 8 steps)
- Includes a resume upload step via `ResumeUpload` component.
- Sport list is gender-specific and more granular than the mobile list (e.g., "Men's Basketball" vs "Basketball").
- Track onboarding events with `trackEvent` (PostHog).

**Shared rule:** never ask for the same data twice across onboarding + profile. If data can be pre-populated from a resume upload, do it silently.

---

## 6. Profile / Account / Resume Rules

- **Avatar** is rendered by `AlumniAvatar` (mobile) / `Avatar` (web). Never render raw `<Image>` for a person — always go through these components so initials fallback works.
- **Resume upload** (web) lives in `ResumeUpload.tsx`. It parses the PDF server-side and updates the `profiles` table. The mobile "You" screen currently shows a read-only view of the same profile data. If asked to add mobile resume upload, build it — don't assume it doesn't belong there.
- **Profile refresh** after any write: always call `refreshProfile()` from `AuthContext` so the UI stays consistent. Do not patch local state directly.
- **Graduation year** is stored as a 4-digit integer. Display as `'YY` format (e.g., `'27`) using `formatGradYearShort`. Never display the full year in compact contexts.
- **Sport meta line** in profile card: `{sport}  ·  Class of '{YY}`. Dot-separator, not slash.
- The "You" screen header title is exactly "You" (one word). Do not rename it.
- Preferences auto-save via `PreferencesContext`. Show the autosave indicator row (saving → saved flash → "Changes save automatically"). Do not add a save button.

---

## 7. Recommendation / Personalization Rules

File: `apps/mobile/src/services/recommendations.ts`

### Scoring weights (base, as of current code — verify against `BASE_WEIGHTS` in `recommendations.ts` before changing)
| Signal | Weight |
|---|---|
| Industry match | 30 |
| Role match | 20 |
| Sport match | 20 |
| Prestige | 25 |
| Location match | 15 |
| Company match | 10 |
| Completeness | 10 |
| Graduation year | 5 |

- **Adaptive swipe weights** adjust per-category by ±4 per save / ±2 per pass, clamped to ±12. They nudge but never dominate.
- **Quality threshold:** high-quality alumni require `profileCompletenessScore >= 50`. Falls back to `>= 30` when fewer than 5 high-quality candidates are available. Never show below the soft floor.
- **Exclude set:** already-swiped and already-networked alumni are excluded from the deck before scoring. This is computed fresh on every `fetchRecommendations` call.
- **DB ordering:** `prestige_score DESC` at query time so the candidate pool is already biased toward top-tier alumni before client-side scoring.
- **`whyThisMatch` reasons:** max 4, ordered: past-company tenure > industry pivot > industry > sport > location > role > company > career depth > prestige. Keep them scannable — one phrase each.
- When adding new scoring dimensions, also update `ScoreBreakdown`, `BASE_WEIGHTS`, and `computeWhyThisMatch` together — they must stay in sync.

### Prestige scoring
- `prestige_score` is 0–100, set in the migration. Linear contribution to the total.
- A top-tier firm (≥90) gets nearly the full 25-point prestige weight.
- Prestige callout in `whyThisMatch` only fires when no company line is already shown.

---

## 8. Engineering Rules

These apply across all Scout code:

1. **No cross-runtime imports.** Mobile must never import from `next/*` or `node:*`. Web must never import from `expo*` or `react-native`.
2. **All DB types from `packages/shared/types/database.ts`.** Import as `import type { ... } from "@scout/shared/types/database"`.
3. **Use `/plan` before any new screen, page, or non-trivial component.** Confirm routes, data sources, state shape, and navigation impact before writing code.
4. **API contract flows web → mobile.** All write paths from mobile call `apps/web` Route Handlers. Mobile never calls Supabase directly for writes.
5. **Migrations live only in `apps/web/supabase/migrations/`.** One source of truth.
6. **Theme tokens always.** In mobile code, use `colors.*`, `spacing.*`, `radius.*`, `typography.*`, `shadows.*` from `scoutTheme`. Never use raw values. In web code, use Tailwind classes.
7. **`StyleSheet.hairlineWidth`** for all dividers and borders that should be 1px-or-less. Never use `borderWidth: 0.5` or `borderWidth: 1` for hairlines.
8. **`hitSlop={8}`** on any Pressable smaller than 44×44pt.
9. **Fail gracefully in services.** All Supabase calls in `services/` are wrapped in try/catch and return safe defaults on error. Do not let recommendation or network failures crash the UI.
10. **No comments explaining what code does.** Only comment the WHY when it's non-obvious (hidden constraint, workaround, invariant).

---

## 9. Response Format When Implementing Features

When asked to implement a Scout feature, structure your response like this:

1. **Confirm understanding** — one sentence stating what you're building and which persona it serves.
2. **Files affected** — list the files you will create or modify, with their workspace path.
3. **Data flow** — briefly describe where data comes from (Supabase table, API route, context) and where it goes.
4. **UX decisions** — call out any non-obvious UX choice (empty states, loading states, error handling, toasts, modal sequencing).
5. **What you're NOT doing** — explicitly note any scope you're excluding and why, so the user can correct you before you write code.
6. **Implementation** — then write the code.

Do not summarize what you just did at the end. Do not add a "Summary" section after the diff.
