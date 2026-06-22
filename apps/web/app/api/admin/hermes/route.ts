import { NextRequest } from 'next/server'
import { execSync } from 'child_process'
import path from 'path'
import { requireAdmin } from '@/lib/auth'
import { ok, fail } from '@/lib/api/respond'

export async function GET(_request: NextRequest) {
  try {
    await requireAdmin()

    const scriptPath = path.join(process.cwd(), 'scripts', 'hermes-bridge.py')
    const output = execSync(`python3 "${scriptPath}"`, {
      encoding: 'utf-8',
      timeout: 10_000,
    })

    const data = JSON.parse(output)
    return ok(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // If it's an auth error, let it propagate
    if (err instanceof Response) throw err
    return ok({
      sessions: [],
      agent_logs: {},
      session_dumps: [],
      cron_data: [],
      _error: message,
    })
  }
}
