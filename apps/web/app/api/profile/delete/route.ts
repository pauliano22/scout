import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Verify the token and identify the caller.
  const { data: { user }, error: authError } = await serviceClient.auth.getUser(accessToken)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user.id

  try {
    // 1. Delete avatar storage files. Fail silently — missing files are fine.
    const { data: avatarFiles } = await serviceClient.storage
      .from('user-avatars')
      .list(userId)

    if (avatarFiles && avatarFiles.length > 0) {
      const paths = avatarFiles.map((f) => `${userId}/${f.name}`)
      await serviceClient.storage.from('user-avatars').remove(paths)
    }

    // 2. Delete user_preferences explicitly (no FK cascade guarantees).
    await serviceClient.from('user_preferences').delete().eq('user_id', userId)

    // 3. Delete the auth user. The profiles row has ON DELETE CASCADE from auth.users,
    //    and user_networks/plan_alumni cascade from profiles — so this cleans everything.
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[profile/delete] error:', err)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
