#!/usr/bin/env node
/**
 * Scout Report — email build
 *
 *   node emails/build.js 01
 *
 * Reads emails/issues/<n>.md (YAML frontmatter + `# section` blocks),
 * combines with emails/template.html, base64-inlines the Scout logo,
 * and writes a self-contained file to emails/dist/issue-<n>.html.
 *
 * Pure Node — no dependencies. Minimal markdown subset: paragraphs,
 * `**bold**`, `*italic*`, `- bullet` lists, single newline → <br>.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REPO_ROOT = path.resolve(ROOT, '..');
const TEMPLATE = path.join(ROOT, 'template.html');
const ISSUES_DIR = path.join(ROOT, 'issues');
const DIST_DIR = path.join(ROOT, 'dist');
const LOGO_PATH = path.join(REPO_ROOT, 'apps/web/public/favicon.svg');

// ─── argv ─────────────────────────────────────────────────────────────────
const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node emails/build.js <issue-number>   e.g. node emails/build.js 01');
  process.exit(1);
}
const issueId = arg.padStart(2, '0');
const issueFile = path.join(ISSUES_DIR, `${issueId}.md`);
if (!fs.existsSync(issueFile)) {
  console.error(`Not found: ${issueFile}`);
  process.exit(1);
}

// ─── parse: frontmatter + sections ────────────────────────────────────────
function parseIssue(src) {
  // Strip frontmatter delimited by '---' on its own line at the top.
  const fmMatch = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fmMatch) throw new Error('Missing YAML frontmatter');
  const frontmatter = parseSimpleYaml(fmMatch[1]);
  const body = src.slice(fmMatch[0].length);

  // Split body into sections by `# section_name` headers.
  const sections = {};
  const lines = body.split(/\r?\n/);
  let current = null;
  let buf = [];
  const flush = () => {
    if (current) sections[current] = buf.join('\n').trim();
    buf = [];
  };
  for (const line of lines) {
    const m = line.match(/^#\s+([a-z][a-z0-9_]*)\s*$/i);
    if (m) {
      flush();
      current = m[1];
    } else if (current !== null) {
      buf.push(line);
    }
  }
  flush();

  return { frontmatter, sections };
}

// Tiny YAML — supports `key: value` (string), `key: "value"`, basic numbers.
function parseSimpleYaml(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (!line || /^\s*#/.test(line)) continue;
    const m = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

// ─── markdown → HTML (minimal, email-safe) ────────────────────────────────
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  // Order matters: bold before italic.
  let out = escapeHtml(s);
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, '<strong style="font-weight:600;color:inherit;">$1</strong>');
  out = out.replace(/\*([^*\n]+?)\*/g, '<em style="font-style:italic;">$1</em>');
  return out;
}

/** Render a markdown block to HTML paragraphs + lists.
 *  Variants tune surrounding styles for context (body, lede, dark card).
 */
function renderMarkdown(md, variant = 'body') {
  if (!md) return '';

  // Color/spacing per variant
  const styles = {
    body: {
      p:  'margin:0 0 18px 0;',
      ul: 'margin:0 0 18px 0;padding:0 0 0 22px;',
      li: 'margin:0 0 8px 0;padding-left:4px;color:inherit;',
    },
    lede: {
      p:  'margin:0 0 14px 0;',
      ul: 'margin:0 0 14px 0;padding:0 0 0 22px;',
      li: 'margin:0 0 6px 0;color:inherit;',
    },
    darkBullets: {
      p:  'margin:0 0 12px 0;color:#a1a1aa;',
      // For the bulleted update card: tighter, light text, custom marker.
      ul: 'margin:0;padding:0;list-style:none;',
      li: 'margin:0 0 10px 0;padding:0 0 0 22px;color:#fafafa;font-size:16px;line-height:1.55;position:relative;',
    },
  }[variant] || {};

  // Split into blocks by blank line.
  const blocks = md.replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  const html = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Bullet list block: every non-empty line begins with '- '.
    const blockLines = trimmed.split('\n');
    if (blockLines.every(l => /^\s*-\s+/.test(l))) {
      const items = blockLines.map(l => l.replace(/^\s*-\s+/, '').trim());
      if (variant === 'darkBullets') {
        // Hand-rolled marker so dark-card bullets read crisply across clients.
        const lis = items.map(item =>
          `<li style="${styles.li}">` +
          `<span style="position:absolute;left:0;top:0;color:#B31B1B;font-weight:700;">&bull;</span>` +
          inline(item) +
          `</li>`
        ).join('\n        ');
        html.push(`<ul style="${styles.ul}">\n        ${lis}\n      </ul>`);
      } else {
        const lis = items.map(item => `<li style="${styles.li}">${inline(item)}</li>`).join('\n      ');
        html.push(`<ul style="${styles.ul}">\n      ${lis}\n    </ul>`);
      }
      continue;
    }

    // Paragraph — single newlines inside become <br>.
    const inner = blockLines.map(l => inline(l)).join('<br>');
    html.push(`<p style="${styles.p}">${inner}</p>`);
  }

  // Trim trailing margin on last block so spacing reads cleaner.
  return html.join('\n      ').replace(/(margin:0 0 \d+px 0;)(["'])(?![\s\S]*<\/p>|[\s\S]*<\/ul>)/, 'margin:0;$2');
}

// ─── date formatting ──────────────────────────────────────────────────────
function formatDate(yyyyMmDd) {
  if (!yyyyMmDd) return '';
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  if (!y || !m || !d) return yyyyMmDd;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

// ─── logo: inline as base64 data URI ──────────────────────────────────────
function logoDataUri() {
  if (!fs.existsSync(LOGO_PATH)) {
    console.warn(`Warning: logo not found at ${LOGO_PATH} — using fallback`);
    return '';
  }
  // The site favicon is 32×32 with a transparent background. Upscale by
  // rewriting only the viewBox-rendered SVG; clients honor inline width/height.
  const svg = fs.readFileSync(LOGO_PATH, 'utf8');
  const b64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

// ─── substitute ───────────────────────────────────────────────────────────
function render(template, vars) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key) => {
    if (key in vars) return vars[key];
    console.warn(`Warning: unmapped token {{${key}}}`);
    return '';
  });
}

// ─── go ───────────────────────────────────────────────────────────────────
function main() {
  const src = fs.readFileSync(issueFile, 'utf8');
  const tpl = fs.readFileSync(TEMPLATE, 'utf8');
  const { frontmatter: fm, sections: s } = parseIssue(src);

  const vars = {
    subject:                  fm.subject || '',
    preheader:                fm.preheader || '',
    issue_number:             fm.issue_number || '',
    issue_date:               formatDate(fm.date),
    from_name:                fm.from_name || '',
    year:                     String(new Date().getUTCFullYear()),

    headline:                 escapeHtml(s.headline || ''),
    pull_quote:               escapeHtml(s.pull_quote || ''),
    pull_quote_attribution:   escapeHtml(s.pull_quote_attribution || ''),

    welcome_html:             renderMarkdown(s.welcome, 'lede'),
    story_headline:           escapeHtml(s.story_headline || ''),
    story_html:               renderMarkdown(s.story_body, 'body'),
    idea_html:                renderMarkdown(s.idea_body, 'body'),

    update_headline:          escapeHtml(s.update_headline || ''),
    update_bullets_html:      renderMarkdown(s.update_bullets, 'darkBullets'),
    update_cta_text:          escapeHtml(s.update_cta_text || 'Open Scout →'),
    update_cta_url:           s.update_cta_url || 'https://www.scoutcornell.com',

    closing_ask_html:         renderMarkdown(s.closing_ask, 'body'),

    logo_data_uri:            logoDataUri(),
  };

  const out = render(tpl, vars);

  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });
  const outPath = path.join(DIST_DIR, `issue-${issueId}.html`);
  fs.writeFileSync(outPath, out, 'utf8');

  console.log(`✓ Built issue ${issueId}`);
  console.log(`  → ${path.relative(REPO_ROOT, outPath)}`);
  console.log(`  Subject: ${vars.subject}`);
  console.log(`  Preheader: ${vars.preheader}`);
  console.log(`  Date: ${vars.issue_date}`);
}

main();
