# Phase 2 — Gmail "send-as-self" OAuth verification checklist

Gates Phase 2 (real sending) **only**. Phases 0–1 don't need any of this.
Start it early because of review lead time, but it's lighter than expected.

## Headline finding (verified 2026-06-03 against Google's docs)

**`https://www.googleapis.com/auth/gmail.send` is a SENSITIVE scope, not a
RESTRICTED one.** Consequences:

- **No CASA / security assessment.** CASA + the annual recertification (and its
  per-year cost) apply only to *restricted* Gmail scopes (`gmail.readonly`,
  `gmail.modify`, `gmail.compose`, `mail.google.com`). Send-only is sensitive.
- **Review timeline: typically 3–5 business days** after submission (Google's
  stated figure). Budget ~1–2 weeks wall-clock to absorb a rejection/resubmit.
- **No assessment fee.**

⚠️ **Do NOT add a Gmail *read* scope.** Reply auto-detection (deferred from
Phase 0) would need `gmail.readonly` = **restricted → triggers CASA**, an annual
paid security assessment, and weeks of lead time. Keep reply status **manual**
(or detect replies another way) to stay entirely on the sensitive-scope path.
`gmail.send` can send but cannot read — which is exactly the approval-gated,
send-as-self design we chose.

## What Google requires for sensitive-scope verification

1. **OAuth consent screen** (Google Cloud console) accurately set:
   - App name, support email, **home page URI**, **privacy policy URI**, (terms optional).
   - Add only the `.../auth/gmail.send` scope. Justify it in the form.
2. **Public app homepage** — publicly accessible (NOT login-gated), describes
   Scout, links to the privacy policy + terms. A Play/App Store link does **not**
   count as the homepage.
3. **Privacy policy** — hosted on the **same domain** as the homepage; must
   disclose how Scout accesses/uses/stores/shares Google user data (i.e. "we use
   Gmail send to deliver outreach emails you approve, from your account; we do
   not read your mailbox").
4. **Domain verification** — verify ownership of the app's domain in **Google
   Search Console**, using an account on the same Google Cloud project.
5. **Demo video** — unlisted YouTube video showing:
   - the OAuth consent/grant flow **in English**,
   - the correct **app name** on the consent screen,
   - the **OAuth client ID** visible in the browser address bar,
   - **functional use of the `gmail.send` scope** (i.e. actually sending an email).
6. Submit for verification → ~3–5 business days.

## Scout-specific prerequisites (some you already need)

- A **public marketing/home page** on Scout's own domain. (Tie-in: the iOS App
  Store submission already needs a Support URL + hosted privacy policy — same
  artifacts, do once.)
- A **hosted privacy policy** on that domain (App Store needs this too).
- A Google Cloud project for the OAuth client (separate from Supabase/OpenAI).
- The sending feature itself (Phase 2 build): Google OAuth connect flow on the
  student's account + a server route that calls `users.messages.send` with the
  approved draft. Build behind the verification, but the *video* must show it
  working — so the feature has to exist before final submission (a test/staging
  build is fine for the video).

## Recommended sequence
1. Stand up the public homepage + privacy policy on Scout's domain (also unblocks App Store). 
2. Create the Google Cloud project + OAuth consent screen (sensitive, `gmail.send` only); verify the domain in Search Console.
3. Build the Phase 2 send flow against a test account.
4. Record the demo video; submit; expect ~3–5 business days.

## Sources
- https://developers.google.com/workspace/gmail/api/auth/scopes (gmail.send = sensitive)
- https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification (requirements + 3–5 business day timeline)
- https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification (restricted scopes → CASA, for contrast)

## Sequencing lesson — migrate AFTER deploy (carry into Phase 2)

In Phase 0, migration 025 (which added the canonical `status` CHECK) was applied
to **prod before** the code that depends on it (the PATCH normalization) was
deployed. For the window in between, the live mobile PATCH wrote legacy values
that the new CHECK rejected — i.e. mobile status updates **silently failed**.

It cost nothing this time only because there were **no mobile users yet** (the
table was effectively empty). That cushion will NOT exist in Phase 2, where the
equivalent ordering mistake would land on **real Gmail sends**.

**Rule for Phase 2 (and any schema-gated feature):**
> Deploy the *tolerant* code first, **then** migrate — or gate both behind one
> release. Never tighten a DB constraint (or add a required column / table the
> code reads) ahead of the code that satisfies it. If a migration and the code
> that depends on it must both ship, treat them as one atomic release, and write
> migrations to tolerate the *old* code path until the new code is fully rolled
> out (expand-then-contract).
