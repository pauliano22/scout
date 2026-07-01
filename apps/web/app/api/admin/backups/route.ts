// GET /api/admin/backups — list recent database backups
// DELETE /api/admin/backups?id=<id> — delete a specific backup

import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()

    const { data, error, count } = await db
      .from('backup_files')
      .select('id, filename, table_name, row_count, file_size_bytes, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw error

    return ok({
      backups: data ?? [],
      total: count ?? 0,
    })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return fail('Missing backup id query parameter', 400)
    }

    const { error } = await db.from('backup_files').delete().eq('id', id)

    if (error) throw error

    return ok({ deleted: id })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
