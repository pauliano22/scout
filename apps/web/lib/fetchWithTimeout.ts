// fetch() with a hard deadline. Instagram's in-app browser on a weak
// connection can hold a request open for 60s+ — every user-facing fetch
// should fail fast into a visible error instead of an endless spinner.
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 12_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
