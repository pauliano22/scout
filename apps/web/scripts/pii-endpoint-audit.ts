/**
 * PII Endpoint Audit Script
 *
 * Scans all Next.js 14 App Router route handlers under app/api/ for auth guards.
 * Reports endpoints that may be missing authentication, flagging PII exposure risk.
 *
 * Usage: npx tsx scripts/pii-endpoint-audit.ts
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'
type RiskLevel = 'none' | 'low' | 'medium' | 'high'

interface Endpoint {
  path: string
  method: HttpMethod
  hasAuth: boolean
  authPattern: string
  risk: RiskLevel
  notes: string
}

/* -------------------------------------------------------------------------- */
/*  Auth guard patterns to detect                                             */
/* -------------------------------------------------------------------------- */

interface AuthRule {
  regex: RegExp
  label: string
  isStrong: boolean
  /** If true, the pattern itself sets the auth guard — caller must also check
   *  the result against null/false and return an unauthorized response.
   *  We validate this by also scanning for 'Unauthorized' nearby. */
  needsResponseCheck?: boolean
}

const AUTH_PATTERNS: AuthRule[] = [
  // ── From @/lib/auth: requireUser, requireAdmin, requireAlumniOrAdmin ──
  { regex: /\brequire(?:User|Admin|AlumniOrAdmin)\s*\(/, label: 'requireUser/Admin/AlumniOrAdmin', isStrong: true },

  // ── getAuthContext — is called and checked for null ──
  { regex: /\bgetAuthContext\s*\(/, label: 'getAuthContext', isStrong: true },

  // ── resolveRequestUser from @/lib/requestAuth (used by picks, campaign, alumni/circle, alumni/warm-paths, network) ──
  { regex: /\bresolveRequestUser\s*\(/, label: 'resolveRequestUser', isStrong: true },

  // ── supabase.auth.getUser() with a null/undefined check ──
  { regex: /supabase\.auth\.getUser\s*\([^)]*\)/, label: 'supabase.auth.getUser()', isStrong: true },

  // ── CRON_SECRET / custom authorization header check ──
  { regex: /\b(?:authorized|verifyToken|verifyAuthToken|verifyRequest|authCheck)\s*\(/, label: 'custom authorized()', isStrong: true },

  // ── Authorization header pattern: Bearer token check ──
  { regex: /headers\.get\s*\(\s*['"]authorization['"]\s*\)/i, label: 'Authorization header', isStrong: true },

  // ── Generic "Unauthorized" response guard (return pattern) ──
  { regex: /['"]Unauthorized['"]\s*,\s*\{\s*status\s*:\s*40[13]\s*\}/, label: 'Unauthorized response', isStrong: true },

  // ── getToken or getUser helper ──
  { regex: /\bgetUser\s*\(/, label: 'getUser() call', isStrong: true },

  // ── Check for any local function that checks auth and returns Unauthorized ──
  { regex: /\bif\s*\(\s*!\s*(?:auth|user|token|session|result)\s*\)\s*\n?\s*return\s+.*(?:401|['\"]Unauthorized['\"])/s, label: 'auth guard with 401', isStrong: true },

  // ── Admin API token / query param key check (e.g. admin/fix-industries & admin/enrich) ──
  { regex: /(?:adminKey|apiKey|secret)\s*(?:!==|!==)\s*(?:token|process\.env\.\w+)/, label: 'admin key param check', isStrong: true },
]

/* -------------------------------------------------------------------------- */
/*  Helper: scan a single file                                                */
/* -------------------------------------------------------------------------- */

const HTTP_METHOD_RE = /^export\s+async\s+function\s+(GET|POST|PATCH|DELETE)\s*\(/

function scanFile(filePath: string, apiRoot: string): Endpoint[] {
  const content = readFileSync(filePath, 'utf-8')
  const methods: HttpMethod[] = []

  // Find all exported async HTTP method handlers
  for (const line of content.split('\n')) {
    const match = line.match(HTTP_METHOD_RE)
    if (match) {
      methods.push(match[1] as HttpMethod)
    }
  }

  if (methods.length === 0) return []

  // Detect auth patterns across the whole file
  const matchedPatterns: string[] = []
  let hasAuth = false
  let strongestLabel = 'none'

  for (const pattern of AUTH_PATTERNS) {
    if (pattern.regex.test(content)) {
      matchedPatterns.push(pattern.label)
      if (pattern.isStrong) {
        hasAuth = true
        strongestLabel = pattern.label
      }
    }
  }

  // Compute relative path from apiRoot
  const relPath = relative(apiRoot, filePath)
    .replace(/\/route\.ts$/, '')               // remove /route.ts
    .replace(/\/route\.tsx$/, '')              // or /route.tsx
    .replace(/\[\.\.\.(\w+)\]/, '*')            // [...param] -> *
    .replace(/\[(\w+)\]/, ':$1')                // [id] -> :id

  // Determine risk level
  const risk: RiskLevel = hasAuth ? 'low' : 'high'

  const endpoints: Endpoint[] = methods.map((method) => ({
    path: `/api/${relPath}`,
    method,
    hasAuth,
    authPattern: strongestLabel,
    risk,
    notes: hasAuth
      ? `Auth: ${matchedPatterns.join(', ')}`
      : '⚠️ No auth guard detected',
  }))

  return endpoints
}

/* -------------------------------------------------------------------------- */
/*  Helper: recursively find route.ts files                                   */
/* -------------------------------------------------------------------------- */

function findRouteFiles(dir: string): string[] {
  const results: string[] = []
  let entries: string[]

  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      results.push(...findRouteFiles(fullPath))
    } else if (entry === 'route.ts' || entry === 'route.tsx') {
      results.push(fullPath)
    }
  }

  return results
}

/* -------------------------------------------------------------------------- */
/*  Table formatter                                                           */
/* -------------------------------------------------------------------------- */

function pad(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length))
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                      */
/* -------------------------------------------------------------------------- */

function main() {
  const webRoot = resolve(import.meta.dirname ?? __dirname, '..')
  const apiRoot = join(webRoot, 'app', 'api')

  if (!statSync(apiRoot, { throwIfNoEntry: false })) {
    console.error(`API directory not found: ${apiRoot}`)
    process.exit(1)
  }

  const routeFiles = findRouteFiles(apiRoot)
  const allEndpoints: Endpoint[] = []

  for (const file of routeFiles.sort()) {
    const endpoints = scanFile(file, apiRoot)
    allEndpoints.push(...endpoints)
  }

  /* -- Summary header -- */
  const total = allEndpoints.length
  const unguarded = allEndpoints.filter((e) => !e.hasAuth)
  const guarded = allEndpoints.filter((e) => e.hasAuth)
  const highRisk = unguarded.length

  const separator = '─'.repeat(100)

  console.log('\n' + separator)
  console.log('  🔍 PII Endpoint Audit Report')
  console.log(separator)
  console.log(`  Scanned:   ${routeFiles.length} route files`)
  console.log(`  Endpoints: ${total} total (${guarded.length} guarded, ${highRisk} unguarded)`)
  if (highRisk > 0) {
    console.log(`  ⚠️  ${highRisk} endpoint(s) MAY LACK AUTHENTICATION — review carefully`)
  }
  console.log(separator)

  /* -- Per-endpoint table -- */
  if (allEndpoints.length === 0) {
    console.log('\n  No API route handlers found.\n')
    return
  }

  const methodWidth = 7
  const pathWidth = Math.min(Math.max(...allEndpoints.map((e) => e.path.length)) + 2, 62)
  const authWidth = 12
  const riskWidth = 7

  // Header row
  const hdr =
    pad('Method', methodWidth) +
    ' │ ' +
    pad('Path', pathWidth) +
    ' │ ' +
    pad('Auth', authWidth) +
    ' │ ' +
    pad('Risk', riskWidth) +
    ' │ Notes'
  console.log('\n' + hdr)
  console.log('─'.repeat(methodWidth + pathWidth + authWidth + riskWidth + 16))

  for (const ep of allEndpoints) {
    const riskColor = ep.risk === 'high' ? '⚠️  ' : '✓ '
    const methodStr = pad(ep.method, methodWidth)
    const pathStr = pad(ep.path, pathWidth)
    const authStr = pad(ep.hasAuth ? 'YES' : 'NO', authWidth)
    const riskStr = pad(riskColor + ep.risk.toUpperCase(), riskWidth + 3)

    // Truncate notes if path is wide
    let notes = ep.notes
    if (ep.notes.length > 65) {
      notes = ep.notes.slice(0, 62) + '...'
    }

    console.log(`${methodStr} │ ${pathStr} │ ${authStr} │ ${riskStr} │ ${notes}`)
  }

  console.log(separator)

  /* -- Risk breakdown -- */
  if (unguarded.length > 0) {
    console.log('\n  📋 Unguarded Endpoints (review these):')
    console.log(separator)
    for (const ep of unguarded) {
      console.log(`    ${ep.method} ${ep.path}  — ${ep.notes}`)
    }
    console.log()
  }

  console.log('')
}

main()
