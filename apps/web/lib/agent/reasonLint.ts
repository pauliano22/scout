// Pure prose-integrity lint for sourcing reasons. The reasoner prompt is the
// first line of defense; THIS is the deterministic backstop so a manufactured
// connection or a non-literal job title can never ship under a student's name —
// even if the LLM slips. Used at runtime (sourceAlumni replaces a HARD-violating
// reason with a clean fact-based line) and asserted with fixtures in the eval.

export type ReasonViolation = 'manufactured-athlete' | 'non-literal-title' | 'filler'

// Claims an athlete-to-athlete bond. Only legitimate when the sport truly matches.
const ATHLETE_RE = /\b(fellow athlete|athlete experience|athletic|competitive spirit|student[- ]athlete|as an athlete|shared sport|you both play(?:ed)?)\b/i
// Empty filler that survives swapping in any other alum of the same title.
const FILLER_RE = /\b(aligns with your goal|valuable insights|could offer guidance|understands the industry|wealth of knowledge|provide valuable|great resource)\b/i
// Obvious joke / brand-y / scraped job-title fragments cited as a credential.
const NONLITERAL_RE = /\b(people whisperer|happiness ninja|growth guru|rock\s?star|wizard|guru|ninja|evangelist|jedi|sherpa|maven|whisperer)\b/i

export function lintReason(reason: string, ctx: { sportMatched: boolean }): ReasonViolation[] {
  const v: ReasonViolation[] = []
  if (!ctx.sportMatched && ATHLETE_RE.test(reason)) v.push('manufactured-athlete')
  if (NONLITERAL_RE.test(reason)) v.push('non-literal-title')
  if (FILLER_RE.test(reason)) v.push('filler')
  return v
}

// HARD violations assert something untrue or embarrassing — they must NEVER ship.
// (Filler is soft: ugly but not dishonest; the prompt handles it, we don't replace.)
const HARD: ReadonlySet<ReasonViolation> = new Set<ReasonViolation>(['manufactured-athlete', 'non-literal-title'])

export function hasHardViolation(reason: string, ctx: { sportMatched: boolean }): boolean {
  return lintReason(reason, ctx).some((x) => HARD.has(x))
}
