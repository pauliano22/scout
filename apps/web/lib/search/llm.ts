// Chat-completion helper for the alumni-search LLM stages (parse + rerank).
//
// Uses OpenAI — the same account that powers embeddings (see embeddings.ts).
// The rest of the Scout codebase uses Anthropic for its LLM features, but this
// feature is self-contained on OpenAI so it runs on the credits actually
// provisioned. Both stages emit strict JSON, so we use OpenAI's json_object
// response format — more reliable than free-text-then-parse.
//
// Model is env-configurable (SEARCH_LLM_MODEL); default gpt-4o-mini is fast,
// cheap, and more than capable for structured extraction + ranking over a
// ≤12-row candidate pool.

const LLM_MODEL = process.env.SEARCH_LLM_MODEL ?? 'gpt-4o-mini'

export class LlmError extends Error {
  constructor(message: string) { super(message); this.name = 'LlmError' }
}

/**
 * Single-shot chat call that returns the raw assistant content string.
 * Caller is responsible for JSON.parse — both call sites already have robust
 * salvage + validation, and keeping parse at the call site means the same code
 * handles a provider swap or a model that wraps JSON in prose.
 *
 * NOTE: OpenAI's json_object mode requires the word "JSON" to appear in the
 * prompt. Both system prompts already say "Return STRICT JSON", so this holds.
 */
export async function chatJSON(system: string, user: string, maxTokens: number): Promise<string> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new LlmError('OPENAI_API_KEY missing — required for alumni-search parse/rerank')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      temperature: 0, // deterministic — this is extraction/ranking, not generation
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new LlmError(`OpenAI chat ${res.status}: ${detail.slice(0, 200)}`)
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return json.choices?.[0]?.message?.content ?? ''
}
