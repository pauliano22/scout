import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOptimizedImageUrls, DEFAULT_WIDTHS, type ImageFormat } from '@/lib/images/optimize'

interface OptimizeRequest {
  url: string
  widths?: number[]
  format?: ImageFormat
  quality?: number
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: OptimizeRequest = await request.json()

    if (!body.url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    const widths = body.widths ?? [...DEFAULT_WIDTHS]
    const format: ImageFormat = body.format ?? 'webp'
    const quality = body.quality ?? 80

    // Check cache first
    const { data: cached } = await supabase
      .from('image_cache')
      .select('optimized_urls')
      .eq('original_url', body.url)
      .maybeSingle()

    if (cached) {
      return NextResponse.json({
        original_url: body.url,
        optimized_urls: cached.optimized_urls,
        cached: true,
      })
    }

    // Generate optimized URLs
    const optimized = getOptimizedImageUrls(body.url, widths, format, quality)

    // Cache in the database
    const { error: insertError } = await supabase
      .from('image_cache')
      .insert({
        original_url: body.url,
        optimized_urls: optimized,
      })

    if (insertError) {
      console.warn('[images/optimize] Failed to cache result:', insertError.message)
      // Non-fatal — still return the generated URLs
    }

    return NextResponse.json({
      original_url: body.url,
      optimized_urls: optimized,
      cached: false,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[images/optimize] Unexpected error:', message)
    return NextResponse.json({ error: 'Failed to optimize image' }, { status: 500 })
  }
}
