import { NextRequest, NextResponse } from 'next/server'

// LinkedIn ghost/silhouette avatars are tiny PNGs (~2-5KB).
// Real headshots are typically 15-100KB. 8KB is a safe threshold.
const PLACEHOLDER_SIZE_THRESHOLD = 8000

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ isPlaceholder: false })
  }

  try {
    // Try HEAD first — no need to download the full image
    const head = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(4000),
    })

    const contentLength = parseInt(head.headers.get('content-length') || '0', 10)

    if (contentLength > 0) {
      return NextResponse.json(
        { isPlaceholder: contentLength < PLACEHOLDER_SIZE_THRESHOLD },
        { headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } }
      )
    }

    // HEAD didn't return content-length — download and measure
    const get = await fetch(url, { signal: AbortSignal.timeout(6000) })
    const buffer = await get.arrayBuffer()

    return NextResponse.json(
      { isPlaceholder: buffer.byteLength < PLACEHOLDER_SIZE_THRESHOLD },
      { headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } }
    )
  } catch {
    // Network error / timeout — assume real, don't hide the image
    return NextResponse.json({ isPlaceholder: false })
  }
}
