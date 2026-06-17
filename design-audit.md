# Scout Design Audit — Radical Simplicity

**Lens:** Jony Ive-era Apple. Every element justifies its existence; clarity comes from what's removed.
**Scope:** Every screen, mobile + web. Audit only — no code changed.
**Tags:** `REMOVE` (delete it) · `MERGE` (two things doing one job) · `SIMPLIFY` (keep the job, shrink the form) · `KEEP` (already right)

The single biggest problem in this app is not any one screen. It's that **five different surfaces answer the same question — "who should I reach out to?"** — and the app never decides which one is the answer. Everything else is detail.

---

## Part 1 — The structural finding (read this first)

### 1.1 Web: five overlapping "find someone" surfaces — MERGE

| Surface | What it does | Verdict |
|---|---|---|
| `/campaign` (CampaignClient) | Agent picks alumni daily | The strongest candidate for *the* home |
| `/plan` (PlanClient) | AI generates a 10-person plan with talking points | Overlaps campaign almost entirely |
| `/plan` (SearchClient) | Conversational natural-language search | Overlaps discover |
| `/discover` (DiscoverClient) | Browse grid with 7+ filters | Overlaps search |
| `/agent` (AgentClient) | Scripted demo of the agent doing all of the above | Marketing artifact living inside the app |

Students currently land on `/campaign` *or* `/plan` depending on a feature flag (`postLoginPath.ts:19`, `campaignHome.ts`). The flag is the app admitting it hasn't chosen its own front door.

**Recommendation:** Finish the decision the flag started. One home: the agent's daily picks. One search affordance on it (the conversational one — it subsumes filters). `/plan` and `/discover` fold in or go. `/agent` moves to the logged-out marketing site. A stressed student should open Scout and see: *here are today's three people, here's the draft, send it.* Nothing else competes.

### 1.2 Mobile: Today and Campaign are the same tab twice — MERGE

`TabNavigator.tsx:72-99` ships five visible tabs: **Today, Campaign, Discover, Network, You.** Today ("Here's what to do next") and Campaign (goal progress + ready/proposed/waiting shelves) are both action queues fed by the same pipeline. A first-time user cannot tell which one is "the" place to act — which fails Test 2 at the navigation level, before any screen renders.

**Recommendation:** One home tab. Four tabs total: **Home · Discover · Network · You.** Campaign's goal-progress header becomes the top of Home; Today's action cards are the body.

### 1.3 Onboarding asks, then asks again — REMOVE / MERGE

- Mobile collects sport/industries/stage/locations in onboarding, then `CampaignScreen`'s empty state sends users to **GoalSetupScreen — a second form** (`CampaignScreen.tsx:48-156`). Product direction already says the agent auto-starts from onboarding with no second form. The audit confirms: GoalSetupScreen should not exist in the first-run path.
- Web onboarding (8 steps) asks for **major** (step 6), which the resume parse (step 8) extracts automatically. Resume upload also appears *again* on the Profile page, and Career Interests are asked in onboarding step 2 *and* as a Profile textarea (`OnboardingClient.tsx:546-580`, `ProfileClient.tsx:379-408`).

**Recommendation:** Each fact is asked for exactly once, by the surface best at extracting it. Resume moves to step 2 so it pre-fills everything after it.

---

## Part 2 — Mobile, screen by screen

### TabNavigator (`TabNavigator.tsx`)
Five tabs + hidden GoalSetup. Blur background, hairline border, two colors. Visually exemplary; structurally one tab too many (§1.2).
- **MERGE** Today + Campaign → Home (above).
- **KEEP** the visual treatment exactly as is — icon+label, 2 colors, hairline. This is the quietest surface in the app.

### TodayScreen (`TodayScreen.tsx`)
Header greeting, then sections DO NEXT / LATER / WAITING ON A REPLY, each card carrying avatar, name, role, a color-coded action chip, reason text, and **3–5 buttons** (Draft message, or "Set meeting:" + 3 date pills, plus Snooze and Dismiss on every card).

- **SIMPLIFY** `TodayScreen.tsx:206-228` — One visible action per card. "Draft message" is the action; Snooze/Dismiss move behind a swipe or long-press. *Rationale: a to-do list where every item asks three questions isn't a to-do list, it's a quiz.*
- **REMOVE** `TodayScreen.tsx:200` — the action-type chip next to the name. The section header ("DO NEXT") already says what kind of action this is. *Label-on-a-label.*
- **SIMPLIFY** `TodayScreen.tsx:48-55` — chip/section color system uses 5+ semantic colors with no discernible code. Two states are real: *act now* and *waiting*. Two colors.
- **REMOVE** `TodayScreen.tsx:134` — the `muted` (opacity 0.6) "Waiting on a reply" section. If nothing can be done, it doesn't belong on a screen named Today. Move the count to a single quiet line ("3 waiting on replies").
- **KEEP** the personalized greeting, the empty state's instructive copy, and the one-tap "Draft message" path.

### DiscoverScreen + AlumniCard (`DiscoverScreen.tsx`, `AlumniCard.tsx`)
Deck of swipeable cards; header has logo, title, swipe count ("20/20 today"), rewind, count pill, settings icon. Below deck: Pass / View / Save buttons.

- **KEEP** the core: swipe-to-decide, one card dominating the viewport, red reserved for Save, SkeletonCard loading, "You're caught up" empty state. This is the best screen in the app.
- **MERGE** `DiscoverScreen.tsx:215-225` — the View button duplicates tapping the card (`AlumniCard.tsx:193` already opens detail on press). One affordance: tap card to view; buttons become Pass / Save. ⚠️ *Touches a documented product rule ("three actions only: Pass / Save / View") — flagging for joint decision, but the rule describes three intents, and "view" survives as card-tap.*
- **SIMPLIFY** `AlumniCard.tsx:177-189` — SAVE/PASS swipe overlays. The pre-commit feedback is real (it tells you what releasing will do, and a pass costs a scarce daily swipe) — keep the feedback, lose the costume: no rotation, no white badge box; a quiet edge tint or icon is enough.
- **REMOVE** `AlumniCard.tsx:216-218` — the 196px sport emoji watermark at opacity 0.09. Invisible decoration is still decoration.
- **SIMPLIFY** header: title + count pill + swipe counter is three numbers' worth of chrome for one fact ("how many left"). Pick one (the pill), drop the "20/20 today" subtitle into it.
- **KEEP** rewind, settings icon (single, top-right, per product rule), count pill behavior (hidden while loading).

### NetworkScreen (`NetworkScreen.tsx`)
Header + count, search bar, 3 filter chips (All / To Contact / In Progress), grouped list with avatar, follow-up dot, name, StatusBadge, role, chevron.

- **REMOVE** `NetworkScreen.tsx:325` — the chevron. The whole row is tappable; the chevron is the row apologizing for itself.
- **SIMPLIFY** `NetworkScreen.tsx:187-206` — filter chips. With a young network (most users: <30 contacts) search + the status badge already answer every question the chips answer. Defer chips until lists are long enough to need them. ⚠️ *Documented rule says chips map to the status set — flagging for joint decision.*
- **SIMPLIFY** status colors 5 → 3 (see StatusBadge below).
- **KEEP** search (fast, useMemo-filtered), the 11px follow-up dot (quietest high-value signal in the app), pull-to-refresh, grouped-list layout, empty states.

### YouScreen (`YouScreen.tsx`)
Profile card (inline edit), Career Interests, Discovery preferences (tags + 3 toggles), autosave indicator, Account info rows, Sign Out, Delete Account.

- **REMOVE** `YouScreen.tsx:531-542` — Account section (Email / Platform / Version). Three read-only rows that change nothing. Version belongs in an About row at most.
- **KEEP (relocate)** Delete Account — App Store policy requires discoverable account deletion, so it cannot vanish; current text-only treatment is appropriately quiet. Optionally move behind an "Account" detail row with the email.
- **SIMPLIFY** `YouScreen.tsx:419-443` — TagInputs read as static lists; add a visible "+ Add" affordance or placeholder so editability is self-evident (this is the fix for needing to *know* they're editable).
- **KEEP** inline profile edit, the three priority toggles, and especially the autosave indicator ("Saving… / Saved / Changes save automatically") — this is the correct alternative to a Save button.

### AlumniDetailModal (`AlumniDetailModal.tsx`)
Hero photo/fallback, summary pills, Tracking (5 status chips + notes, gated to network entries), Experience timeline, Athletic background, Cornell Circle, Contact rows, sticky Pass/Save/Message bar.

- **KEEP** almost everything: the conditional gating (`networkEntryId`) is exactly right, the sticky action bar is exactly right, sections are scannable.
- **SIMPLIFY** `AlumniDetailModal.tsx:244-275` — five status chips in five colors. Reduce the palette to 3 (see below); keep the five stages if the pipeline needs them, but they no longer need five hues.

### CornellCircleSection (`CornellCircleSection.tsx`)
Warm paths ("ask them for the intro") + teammate list + footer count.

- **SIMPLIFY** `CornellCircleSection.tsx:80-103` — warm paths are the single most actionable fact in the app and they are **not tappable**. The user is told "ask them for the intro" and then left to memorize a name and go hunting. Make the row tap → that contact's detail (or pre-filled intro request). *This is the one place the audit recommends adding power rather than removing weight.*
- **REMOVE** `CornellCircleSection.tsx:116` — teammate company names in the passive list. Context, not action; clutter.
- **KEEP** the soft-green single-accent styling.

### StatusBadge / Toast / SkeletonCard
- **SIMPLIFY** `StatusBadge.tsx` + `scoutTheme` — 5 status colors → 3: gray (saved/drafted), amber (contacted/replied — ball in motion), green (meeting set). A list of 20 rows currently renders as a color mosaic; this one change quiets Network, the detail modal, and web's status dots at once.
- **KEEP** Toast (1800ms, semantic colors, spring) and SkeletonCard verbatim.

---

## Part 3 — Mobile onboarding & auth

**Current first-run path: 7 screens, ~20 taps, ~2.5 min before the first alumni card.**
Welcome → SignUp → OnboardingIntro → Onboarding (4 steps) → OnboardingComplete → tabs.

- **KEEP** WelcomeScreen verbatim — one accent, two CTAs, eight-word value prop. The bar the rest of the app should meet.
- **KEEP** SignIn/SignUp — clean cards, keyboard-flow submit. Minor: `SignUpScreen.tsx:125-127` legal text could shrink to one line with linked Terms.
- **REMOVE** OnboardingIntroScreen (`OnboardingIntroScreen.tsx`, `App.tsx:68-69`) — a screen that previews the four questions you're about to be asked. *A table of contents for a one-minute form.*
- **REMOVE** OnboardingCompleteScreen (`OnboardingCompleteScreen.tsx`, `App.tsx:62-78`) — celebrates a submission that already happened; repeats the intro's copy. Land in the app; let the populated home *be* the celebration.
- **SIMPLIFY** OnboardingScreen step 2 (`OnboardingScreen.tsx:38-44`) — five career-stage options with overlapping descriptions ("Just exploring" vs "Preparing for interviews"). Three options, or defer and infer from behavior.
- **SIMPLIFY** the skip ambiguity — every field is skippable but nothing says so; sport feels required and isn't (`OnboardingScreen.tsx:394-405`). Decide per field and say it once.
- **REMOVE** GoalSetupScreen from the first-run path (§1.3) — onboarding already triggered `autostartCampaign()` (`OnboardingScreen.tsx:422`); a second goal form contradicts both the code and the stated product direction. Keep it only as a post-hoc "edit campaign" surface, if at all.

**Proposed path: 4 screens (Welcome → SignUp → Onboarding ×3 → home), ~12 taps, value in ~1 min.**

---

## Part 4 — Web, screen by screen

### Marketing home (`page.tsx`)
- **KEEP** hero: eyebrow/H1/two CTAs, generous space.
- **REMOVE** `page.tsx:139-156` Stats section ("55 Years", "40+ Sports") — vanity numbers between the visitor and the CTA.
- **REMOVE** `page.tsx:158-174` Industries pill-grid — nine pills to say "all industries"; one sentence says it better.
- **SIMPLIFY** `page.tsx:66` — drop the eyebrow "CORNELL ATHLETICS ALUMNI NETWORK"; the H1 and wordmark carry it.

### Campaign home (`CampaignClient.tsx`)
The right idea — daily picks, one primary action ("Draft intro"), "Nothing sends without your approval."
- **KEEP** pick card hierarchy: Draft intro primary, Skip/Save secondary; the approval footer line.
- **REMOVE** `CampaignClient.tsx:246-251` — the standalone "Save" on pick cards. Drafting an intro should save to Network as a side effect; two buttons that both mean "I'm interested" is one too many.
- **SIMPLIFY** `CampaignClient.tsx:179-216` — the Preferences panel (Field grid + Location input + Pause) is a settings page squatting inside the home. Collapse to one row or move to Profile.
- **SIMPLIFY** empty state `CampaignClient.tsx:261-269` — "All caught up." doesn't need its own card; one line under the heading.

### Plan (`PlanClient.tsx`)
- **MERGE** into the home (§1.1). Within it regardless:
- **SIMPLIFY** `PlanClient.tsx:506-551` — **five buttons per expanded card** (Write Message / Save / LinkedIn / Research / Skip). Two earn the row: Write Message and Save. LinkedIn/Research/Skip go to an overflow.
- **SIMPLIFY** `PlanClient.tsx:400-444` — three clickable zones on a collapsed card; the whole row should toggle.
- **KEEP** one-card-expanded-at-a-time, talking points content, the delete-plan confirm (genuinely destructive — earns its interruption).

### Search (`SearchClient.tsx`)
- **KEEP** the conversational pattern itself — landing prompt, four example chips, auto-growing input, reasoning shown per match. This is the search worth keeping (§1.1).
- **SIMPLIFY** `SearchClient.tsx:371-375` — drop the "WHY THIS MATCH" eyebrow label; the reasoning sentence is self-evidently the why.
- **SIMPLIFY** match-card actions to one button + quiet icons.

### Discover (`DiscoverClient.tsx`)
- **MERGE** into the surviving search surface (§1.1). Within it regardless:
- **SIMPLIFY** `DiscoverClient.tsx:265-346` — search + industry pills + divider + My Sport + sport dropdown + location input + Clear = seven competing controls. Search dominates; everything else is one quiet filter row.
- **SIMPLIFY** `DiscoverClient.tsx:360-365` — results line says count *and* restates active filters the user just set. Count only.
- **KEEP** AlumniCard grid layout and one-click Add to Network.

### Network (`NetworkClient.tsx`)
- **KEEP** the board: status tabs with counts, "· 2 need your reply" in red (the one justified red on the page), status-dependent CTA per row, one-click into MessageModal.
- **SIMPLIFY** `NetworkClient.tsx:317-326` — status dot + status label + status-named button say the same thing three ways per row. Dot + button.
- **SIMPLIFY** `NetworkClient.tsx:334-394` — Custom Contacts is a second mini-CRM stitched below the first, with a 5-field always-rendered form. One "Add contact" button in the header → modal with Name + LinkedIn.
- **REMOVE** `NetworkClient.tsx:306-314` — hover-revealed "Circle →" link; an invisible affordance to a destination already in the nav.

### Circles (`CirclesClient.tsx` + `_components`)
- **KEEP** the concept and the NetworkWeb SVG — the only surface showing *relationships*, and the most "frameable" screen in the product. Solid/dashed edge distinction, hover cards, restrained palette: right.
- **SIMPLIFY** `NetworkWeb.tsx:59-69` — two variant empty-state messages → one: "Save two contacts and your web appears here."
- **SIMPLIFY** `PersonCircle.tsx:46-68` — four stacked text layers in the identity block; tighten to two lines.
- **KEEP** TeamTimeline; **SIMPLIFY** its "your way in" status tags to a single "can introduce you" phrasing.

### Agent demo (`AgentClient.tsx`)
- **MERGE/RELOCATE** — it's a beautifully built demo of features the app already has, reachable inside the app. Move to the logged-out marketing funnel; inside the product it's a hall of mirrors.
- If kept: **REMOVE** non-editable goal pills/meta tags (`AgentClient.tsx:577-604`) — controls that don't control anything.

### Navbar (`Navbar.tsx`)
- **SIMPLIFY** `Navbar.tsx:92-131` — students see Home + Discover + Network + Circles + Profile + theme + logout. After §1.1: **Home · Network · Circles** + avatar menu (Profile, theme, feedback, log out). The nav is the app's table of contents; right now it lists chapters the book repeats.

### Mascot (`MascotFeedback.tsx`)
- **REMOVE** — a fixed 64px character whose entire function is hover → reveal an email address. Replace with a "Feedback" item in the avatar menu or footer. *It exists to seem friendly; the product being effortless is what friendly is.* (Also retires the last two commits' worth of PNG-transparency upkeep.)

### Auth (login / signup / join / forgot / reset)
- **KEEP** the flows — single-purpose, one CTA each, clean states. Keep "Forgot password?" where it is (pre-failure visibility is standard, not anxiety).
- **REMOVE** `signup/page.tsx:100-104` — "Pick one — you can always reach out to us if you need to switch later." Hedging copy that plants the doubt it tries to soothe.
- **REMOVE** `signup/page.tsx:173-178` — "Joining as Alumni ✓" badge on the form the user just chose to be on.
- **REMOVE** `join/page.tsx:250-323` — all five optional career fields on the no-account join form. The promise is "no account needed"; the form should be name, sport, year, optional email. Career data comes when they claim the profile.
- **SIMPLIFY** — input-field icons (Mail, Lock, User) across auth forms decorate without informing; labels suffice.

### Student onboarding, web (`OnboardingClient.tsx`)
8 steps. 
- **REMOVE** step 3 Networking Intensity ("20/week…") — a settings knob asked as an exam question, before the user has sent a single message.
- **REMOVE** step 5 Existing Network ("Have you been networking?") — analytics, not onboarding.
- **MERGE** step 6 Major into resume parsing; **move resume to step 2** so it pre-fills everything downstream (`OnboardingClient.tsx:51, 546-580, 657-679`).
- **SIMPLIFY** progress indicator `OnboardingClient.tsx:276-287` — shows "Step X of 8" *and* a percentage *and* a bar. The bar alone.
- **Result: 5 steps**, with the parser doing the typing.

### Profile, student (`ProfileClient.tsx`)
- **SIMPLIFY** — 11 fields across 6 cards. Core: photo, name, sport, year, location. 
- **REMOVE** `ProfileClient.tsx:394-408` Career Interests textarea — onboarding already collected structured interests; a free-text duplicate forks the truth.
- **SIMPLIFY** `ProfileClient.tsx:379-392` resume card — if already uploaded, show "Resume on file · replace," not a fresh drop zone.
- **REMOVE** `ProfileClient.tsx:389-391` — resume parse silently overwriting the Interests field while the user looks at the form. Never auto-fill a visible field without consent.

### Profile, alumni (`AlumniProfileClient.tsx`, `AlumniProfileForm.tsx`)
- **KEEP** view/edit separation, optimistic email-visibility toggle, the trust footer.
- **REMOVE** `AlumniProfileClient.tsx:199-203` — "Not set" placeholders in the meta grid. An empty field shown is a reproach; hide it.
- **SIMPLIFY** the email-visibility toggle from an xs text link to a real switch — it's the most important privacy control alumni have.

### Alumni onboarding (`AlumniOnboardingClient.tsx`)
- **KEEP** the 3-step shape (Welcome → Identify → Review) — the leanest flow in the product, and the match-lookup that pre-fills the profile is the app at its best.
- **MERGE** `AlumniOnboardingClient.tsx:415-435` — "This isn't me" and "Create new profile instead" both lead to the same blank form. One button: "This isn't me."

### About (`about/page.tsx`)
- **SIMPLIFY** — four CTAs on one page → two (hero + footer); hero background's gradient-layers-plus-clip-path → one gradient.

### Admin
- **Side-finding (broken, not design):** `postLoginPath.ts` routes admins to `/admin`, and no `/admin` page exists — admins land on a 404. The persona currently has no UI at all.

---

## Part 5 — Top 10, ranked by clarity gained per unit of effort

1. **Pick the web home and delete the rivals.** Converge /campaign, /plan, /discover, /search, /agent into one picks-first home with one conversational search. The feature flag already half-made this decision — finish it. *(Largest change; largest payoff; everything below gets easier after it.)*
2. **Merge mobile Today + Campaign into one Home tab** (5 tabs → 4). Two action queues is zero clear next actions.
3. **Delete OnboardingIntro + OnboardingComplete (mobile).** Two screens, two taps, zero information. Twenty minutes of work.
4. **Kill the second goal form.** GoalSetupScreen leaves the first-run path; onboarding's `autostartCampaign()` already does the job (and product direction already says so).
5. **Cut web onboarding 8 → 5 steps, resume first.** Remove Intensity + Existing Network; let the parser pre-fill major/roles/industry; stop re-asking on Profile.
6. **One status palette: 5 colors → 3** (gray / amber / green) across mobile StatusBadge, detail-modal chips, and web dots. One token change quiets four screens.
7. **Remove the mascot;** "Feedback" goes in the avatar menu. One deletion, instant quiet on every page.
8. **One action per card:** Today cards show Draft only (Snooze/Dismiss behind swipe); Plan cards show Write Message + Save (rest behind ⋯); pick cards lose the redundant Save.
9. **Navbar to 3 items + avatar menu** (falls out of #1).
10. **Make warm paths tappable** (mobile CornellCircleSection, web "Your way in"). The app's most valuable sentence — "ask them for the intro" — finally becomes a button. *(The one addition; it removes a five-step memory exercise.)*

## Decisions that touch documented product rules (flagging, not deciding)

- Removing Discover's **View button** in favor of card-tap (rule: "three actions only: Pass / Save / View").
- Deferring Network **filter chips** (rule: chips map to the status set).
- Reducing **status colors** to 3 while keeping the 5-stage pipeline (rule: 5 statuses; the *stages* stay, only hues consolidate).

## Do not touch — already right

- **WelcomeScreen (mobile)** — the standard everything else should meet.
- **The Discover deck core** — swipe mechanics, red-only-for-Save, SkeletonCard, "You're caught up" empty state, count-pill behavior.
- **Autosave on You screen** — "Changes save automatically" instead of a Save button is exactly this audit's philosophy, already shipped.
- **GenerateMessageModal (mobile) & MessageModal (web)** — one draft, one Copy, done.
- **Toast (1800ms) & SkeletonCard** — quiet feedback, no spinners in content areas.
- **NetworkWeb SVG (Circles)** — the most beautiful thing in the product; solid/dashed edges, restrained palette.
- **Alumni 3-step onboarding & match lookup** — leanest flow in the app; pre-filling from existing data is the pattern to copy elsewhere.
- **Avatar components (both platforms)** — silhouette detection + initials fallback; never a broken image.
- **AlumniDetailModal's conditional sections** — tracking/notes only when the person is in your network.
- **The theme system itself** — token discipline, hairline borders, type scale, spacing rhythm. The bones are excellent; this audit is about removing what's hung on them.

---

*Method note: four parallel read-only audits (mobile core, mobile onboarding/auth, web student, web alumni/admin/auth) ran every element through the four tests; findings were then cross-checked against the codebase (tab registry, post-login routing, feature flags) and curated — a handful of agent suggestions were overruled where they fought convention (e.g., hiding "Forgot password?", removing Delete Account, which App Store policy requires).*
