# Security Monitoring

How Scout detects and surfaces suspicious activity. This exists to back the
DPA's 72-hour breach-notification commitment: we can only notify Cornell
within 72h of incidents we can actually see, and this page is honest about
what that is.

## Pipeline

```
server code ──logSecurityEvent()──▶ security_events ──hourly cron──▶ security_alerts ──▶ Telegram
                                     (migration 044)   rule engine     (new rows only)     admin channel
```

1. **Emit** — `apps/web/lib/security/events.ts` exposes `logSecurityEvent()`,
   a fire-and-forget writer to `security_events` (service role). It never
   blocks or fails the request it observes; a lost log line is acceptable, a
   broken request is not.
2. **Evaluate** — `/api/cron/check-security-alerts` (hourly, `vercel.json`,
   `CRON_SECRET`-protected) runs the rules in `lib/security/alerting.ts` and
   persists matches to `security_alerts`.
3. **Notify** — the same cron sends a Telegram message (via
   `lib/notify/telegram.ts`) for any alert with `notified_at IS NULL`, then
   stamps `notified_at` (migration 064) so alerts are announced once, not
   every hour. Messages are PII-free: rule name, event count, and a link to
   the admin API (`/api/admin/security?section=alerts`). Details stay in the
   database.

## What is detected

| Event type | Emitted from |
|---|---|
| `auth_failure` | `lib/auth.ts` — `requireAdmin()` 401/403 hits on admin routes (`details.gate = 'admin'`); `/api/forgot-password` + `/api/reset-password` — unknown account, invalid/expired token, token-verify probing (`details.gate = 'password_reset'`). One type so all of it feeds the brute-force rule. |
| `rate_limit_hit` | `lib/rate-limit.ts` — every 429 from `checkRateLimit()` |
| `data_export` | Admin report endpoints: `/api/admin/reports/monthly`, `/monthly.csv`, `/ad` |
| `password_reset_request` / `password_reset_success` | Password-reset flow audit trail (info severity, not rule-relevant) |
| `alumni_removal_request` | `/api/alumni/remove-request` (public opt-out) |

Alert rules (`lib/security/alerting.ts`): brute force (>10 `auth_failure` in
5 min), rate-limit burst (>100 `rate_limit_hit` in 1 min), anomalous export
(>50 `data_export` in 1 hour).

## What is NOT detected (known limitations)

- **Supabase login failures.** Web and mobile sign-in call Supabase Auth
  directly from the client, so failed password attempts never touch our
  servers and are invisible to this pipeline. Credential-stuffing against
  login would only show up indirectly (e.g. via password-reset activity).
  Supabase's own auth logs are the source of truth there.
- **Best-effort logging.** Emitters are fire-and-forget on serverless; an
  instance frozen immediately after responding can drop an event.
- **Per-instance rate limiting.** The rate limiter is in-memory per Vercel
  instance, so `rate_limit_hit` counts understate distributed traffic.
- **Hourly granularity.** Detection-to-notification latency is up to ~1 hour
  (well inside the 72h window, but not real-time). The 5-minute brute-force
  window is only sampled once an hour.
- **No RLS-bypass detection.** Server routes use the service role; a bug in
  a route's own scoping would not raise an event.

## Reviewing and acknowledging

`GET /api/admin/security` (admin session required) lists events and alerts;
`PATCH` acknowledges an alert. There is no admin UI page yet — the API is the
review surface.

## Retention

No automated purge exists yet: `security_events` and `security_alerts` are
retained indefinitely. `security_events.user_id` is set to NULL when the
account is deleted (FK `ON DELETE SET NULL`). Events may contain IPs and
rate-limit identifiers but no names or emails by convention — keep it that
way when adding emitters. `password_reset_audit_log` (email + IP, service-role
only since migration 065) is likewise unbounded; revisit both if a retention
policy is agreed with Cornell.

## Ops notes

- Requires `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (silently no-ops
  otherwise — unnotified alerts remain queued) and `CRON_SECRET`.
- Migrations 064 (alert dedupe column) and 065 (RLS on
  `password_reset_audit_log` / `activity_log`) must be applied before the
  cron's notification step works.
- A breach still requires a human: Telegram tells you something tripped;
  investigating and notifying Cornell within 72h is a manual process.
