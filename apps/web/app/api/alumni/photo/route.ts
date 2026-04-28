import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Multipart photo upload for the alumni claim/edit flow. Stores at
 * `alumni-photos/<auth.uid>/photo.<ext>` and returns a public URL.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Photo must be 5 MB or smaller.' }, { status: 413 })
    }
    const mime = file.type
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: 'Photo must be a JPEG, PNG, or WebP.' },
        { status: 415 },
      )
    }

    const ext = EXT_BY_MIME[mime]
    const path = `${user.id}/photo.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('alumni-photos')
      .upload(path, file, { contentType: mime, upsert: true, cacheControl: '3600' })

    if (uploadErr) {
      console.error('alumni photo upload failed:', uploadErr)
      return NextResponse.json({ error: 'Upload failed.' }, { status: 500 })
    }

    const { data: pub } = supabase.storage.from('alumni-photos').getPublicUrl(path)
    // Cache-bust so the new photo replaces the old in the user's view.
    const url = `${pub.publicUrl}?v=${Date.now()}`

    return NextResponse.json({ url })
  } catch (err: any) {
    console.error('Alumni photo error:', err)
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 })
  }
}
