# Scout Report emails

Reusable editorial email template for **The Scout Report**, sent every other Sunday.

## Add a new issue

1. Copy `issues/01.md` → `issues/02.md`, write new content.
2. Run: `node emails/build.js 02`
3. Open `dist/issue-02.html` in a browser to preview.
4. Paste the rendered HTML into MailerLite (or Mailchimp) → send.

## Notes

- `template.html` is the single source of truth for layout. All issues share it.
- The build script inlines `apps/web/public/favicon.svg` as a base64 data URI so `dist/` files render standalone (no internet required for the logo).
- Footer uses Mailchimp/MailerLite merge tags: `*|UNSUB|*` and `*|UPDATE_PROFILE|*`. The ESP replaces them at send time.
- Brand: Inter from Google Fonts, Cornell red `#B31B1B`, warm off-white `#FAF7F2` paper.
