import { cleanField } from '@/lib/cleanField'
import type { Person } from './types'

// "Alumni of Cornell University..." style headlines and location-strings
// scraped into the role field carry no destination information.
const JUNK_ROLE = /metropolitan area|united states$|^greater |alumni|student-athlete/i

const looksTruncated = (s: string) =>
  /\b(the|of|at|and|&)$/i.test(s) || s.length <= 2

/**
 * One line answering "what are they doing now" — the destination-beats-title
 * rule from the approved mockups: prefer "Role @ Company", drop the role when
 * it's junk or duplicates the company, fall back company → headline → city →
 * class year. Never emits scraped junk (cleanField strips captcha artifacts).
 */
export function nowLine(p: Person): string {
  let role = cleanField(p.ro)
  let company = cleanField(p.co)
  if (company && looksTruncated(company)) company = null
  if (role && (JUNK_ROLE.test(role) || (company && norm(role) === norm(company)))) role = null

  if (role && company) {
    const line = `${role} @ ${company}`
    return line.length <= 44 ? line : company
  }
  if (company) return company
  if (role) return role
  const headline = cleanField(p.hl)
  if (headline && !JUNK_ROLE.test(headline)) return headline.length <= 52 ? headline : headline.slice(0, 49) + '…'
  if (p.lo) return p.lo
  return p.y ? `Class of ${p.y}` : ''
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function initials(name: string): string {
  // Letters only — "(Jack) Tianyi Cen" should read TC, not "(C".
  const parts = name.trim().split(/\s+/).map(w => w.replace(/[^\p{L}]/gu, '')).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function shortYear(y: number | undefined): string {
  return y ? `’${String(y).slice(-2)}` : ''
}
