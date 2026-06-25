// Session Token Rotation & Hardening
// Shared auth utilities for session management, token hashing, and rotation.

import { createHash, randomBytes } from 'crypto'
import type { Session } from '@scout/shared/types/database'

/**
 * Hash a session token using SHA-256 for secure storage.
 * We never store raw tokens — only hashes.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Generate a cryptographically secure random session token.
 * Returns a hex string suitable for use as a Bearer token.
 */
export function generateSessionToken(): string {
  return randomBytes(48).toString('hex')
}

/**
 * Create the full authorization header value from a session token.
 */
export function formatBearerToken(token: string): string {
  return `Bearer ${token}`
}

/**
 * Extract a bearer token from an Authorization header.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null
  return parts[1]
}

/**
 * Check if a session is still valid (not revoked and not expired).
 */
export function isSessionActive(session: Session): boolean {
  if (session.revoked_at) return false
  return new Date(session.expires_at) > new Date()
}

/**
 * Check if a session token should be rotated.
 * Rotate on each use to limit the window for token theft.
 * Returns true if the token is still valid and has been used before.
 */
export function shouldRotate(session: Session): boolean {
  if (!isSessionActive(session)) return false
  // Rotate every time the session is used (not the first use —
  // creation doesn't count). We check by seeing if created_at != updated_at,
  // but since we don't have updated_at, we rotate every use.
  return true
}

/**
 * Compute the expiry timestamp for a new session (30 days from now).
 */
export function getSessionExpiry(): Date {
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + 30)
  return expiry
}
