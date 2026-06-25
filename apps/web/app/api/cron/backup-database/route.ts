// GET /api/cron/backup-database — Automated daily database backup
// Protected by CRON_SECRET (authorization: Bearer <secret> or x-cron-secret header).
//
// Exports key tables (alumni, profiles, roster_entries, activity_log, company_aliases)
// as JSON snapshots stored in the backup_files table.
// Old backups (>7 days) are cleaned up automatically by a DB trigger.

import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/requestAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const TABLES = [
  'alumni',
  'profiles',
  'roster_entries',
  'activity_log',
  'company_aliases',
] as const

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (
    req.headers.get('authorization') === `Bearer ${secret}` ||
    req.headers.get('x-cron-secret') === secret
  )
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()
  const results: Array<{ table: string; rows: number; bytes: number }> = []
  let totalRows = 0

  for (const tableName of TABLES) {
    try {
      const { data, error } = await db.from(tableName).select('*')

      if (error) {
        console.error(`[backup-database] error querying ${tableName}: ${error.message}`)
        continue
      }

      const rows = (data ?? []) as Record<string, unknown>[]
      const rowCount = rows.length
      const jsonStr = JSON.stringify(rows)
      const bytes = Buffer.byteLength(jsonStr, 'utf-8')
      const filename = `${tableName}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`

      const { error: insertError } = await db.from('backup_files').insert({
        filename,
        table_name: tableName,
        row_count: rowCount,
        file_size_bytes: bytes,
        data: rows,
      })

      if (insertError) {
        console.error(`[backup-database] insert error for ${tableName}: ${insertError.message}`)
        continue
      }

      results.push({ table: tableName, rows: rowCount, bytes })
      totalRows += rowCount
    } catch (err) {
      console.error(`[backup-database] unexpected error for ${tableName}:`, err)
    }
  }

  // Count how many old backups were deleted (trigger handles cleanup)
  // The trigger deletes records older than 7 days on insert, so we report
  // remaining total as context.
  const { count: remainingBackups } = await db
    .from('backup_files')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    tables_backed_up: results.length,
    total_rows: totalRows,
    tables: results,
    remaining_backup_records: remainingBackups ?? 0,
  })
}
