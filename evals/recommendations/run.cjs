#!/usr/bin/env node
// Entry point for the recommendation eval.
//
//   node evals/recommendations/run.cjs [label]
//
// label defaults to "baseline". Any other label (e.g. run-20260521) writes to
// its own dir and is compared against baseline/summary.json with a regression
// gate. Exits non-zero if a working field regresses.

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const jiti = require(path.join(ROOT, 'node_modules/jiti'))(__filename, {
  alias: { '@scout/shared': path.join(ROOT, 'packages/shared') },
  interopDefault: true,
});

const { runEval } = jiti(path.join(__dirname, 'runEval.ts'));

const label = process.argv[2] || 'baseline';
const pct = (x) => (x === null || x === undefined ? ' n/a ' : `${(x * 100).toFixed(0)}%`);

function seekerTable(metrics) {
  const rows = metrics.map((m) => {
    const mix = Object.entries(m.industryHistogram)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`)
      .join(' ');
    return [
      m.field.padEnd(18),
      m.picksWereEmpty ? 'skip' : 'pick',
      m.fieldRelevance === null ? ' n/a' : pct(m.fieldRelevance).padStart(4),
      pct(m.financeLeakage).padStart(4),
      String(m.distinctIndustries).padStart(2),
      m.avgReasons.toFixed(1).padStart(3),
      pct(m.pctGenericOnly).padStart(4),
      mix,
    ].join('  ');
  });
  const header = [
    'field'.padEnd(18), 'pref', 'fld'.padStart(4), 'fin'.padStart(4),
    'di', 'rsn', 'gen'.padStart(4), 'industry mix (top10)',
  ].join('  ');
  return [header, '-'.repeat(header.length), ...rows].join('\n');
}

function aggBlock(a) {
  return [
    `label:                         ${a.label}`,
    `seekers:                       ${a.seekerCount} (${a.nonFinanceCount} non-finance)`,
    `NON-FINANCE avg field relevance: ${pct(a.avgFieldRelevance_nf)}`,
    `NON-FINANCE avg finance leakage: ${pct(a.avgFinanceLeakage_nf)}`,
    `NON-FINANCE worst finance leak:  ${pct(a.worstFinanceLeakage_nf)}`,
    `NON-FINANCE avg distinct inds:   ${a.avgDistinctIndustries_nf.toFixed(2)}`,
    `NON-FINANCE avg generic-only:    ${pct(a.avgGenericOnly_nf)}`,
    `FINANCE control field relevance: ${pct(a.financeFieldRelevance)}`,
    `FINANCE control finance share:   ${pct(a.financeFinanceLeakage)}`,
  ].join('\n');
}

function writeReport(outDir, label, metrics, agg) {
  const md = [
    `# Eval run: ${label}`,
    '',
    '```',
    aggBlock(agg),
    '```',
    '',
    '## Per-seeker',
    '',
    '`fld`=field relevance, `fin`=finance leakage, `di`=distinct industries, `rsn`=avg reasons/card, `gen`=cards with only generic reasons.',
    '',
    '```',
    seekerTable(metrics),
    '```',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'REPORT.md'), md);
}

console.log(`\nRunning eval: ${label}\n`);
const { aggregate, metrics } = runEval(label);
const outDir = path.join(__dirname, label);
writeReport(outDir, label, metrics, aggregate);

console.log(seekerTable(metrics));
console.log('\n' + aggBlock(aggregate) + '\n');

// Regression gate vs baseline.
const baselinePath = path.join(__dirname, 'baseline', 'summary.json');
if (label !== 'baseline' && fs.existsSync(baselinePath)) {
  const base = JSON.parse(fs.readFileSync(baselinePath, 'utf-8')).aggregate;
  const d = (cur, prev) => `${pct(prev)} -> ${pct(cur)}  (${cur - prev >= 0 ? '+' : ''}${((cur - prev) * 100).toFixed(0)}pt)`;
  console.log('=== vs baseline ===');
  console.log(`NON-FINANCE field relevance: ${d(aggregate.avgFieldRelevance_nf, base.avgFieldRelevance_nf)}`);
  console.log(`NON-FINANCE finance leakage: ${d(aggregate.avgFinanceLeakage_nf, base.avgFinanceLeakage_nf)}`);
  console.log(`FINANCE control relevance:   ${d(aggregate.financeFieldRelevance, base.financeFieldRelevance)}`);

  const regressions = [];
  // Finance control must not lose field relevance (allow 5pt noise).
  if (aggregate.financeFieldRelevance < base.financeFieldRelevance - 0.05) {
    regressions.push('Finance control field relevance dropped >5pt');
  }
  // Non-finance field relevance must not drop (allow 2pt noise).
  if (aggregate.avgFieldRelevance_nf < base.avgFieldRelevance_nf - 0.02) {
    regressions.push('Non-finance field relevance dropped >2pt');
  }
  // Non-finance finance leakage must not rise (allow 2pt noise).
  if (aggregate.avgFinanceLeakage_nf > base.avgFinanceLeakage_nf + 0.02) {
    regressions.push('Non-finance finance leakage rose >2pt');
  }
  if (regressions.length) {
    console.log('\nREGRESSIONS DETECTED:');
    regressions.forEach((r) => console.log('  - ' + r));
    process.exitCode = 1;
  } else {
    console.log('\nNo regressions vs baseline.');
  }
}
