/**
 * Smart Links Utility
 * Generates URLs for Google Calendar events and mailto links
 * that allow AI-suggested actions to be executed with one click.
 */

// ============================================
// TYPES
// ============================================

export interface CalendarEventParams {
  title: string
  description?: string
  startTime: Date | string
  endTime: Date | string
  location?: string
  // Optional: Add guests (comma-separated emails)
  guests?: string[]
}

export interface EmailDraftParams {
  to: string | string[]
  subject: string
  body: string
  cc?: string | string[]
  bcc?: string | string[]
}

export interface SuggestedAction {
  id?: string
  type: 'calendar_event' | 'email_draft' | 'linkedin_message' | 'follow_up'
  payload: CalendarEventPayload | EmailDraftPayload | LinkedInPayload | FollowUpPayload
  reasoning?: string
  confidence?: number
}

export interface CalendarEventPayload {
  title: string
  description?: string
  startTime: string // ISO string
  endTime: string // ISO string
  location?: string
  guests?: string[]
}

export interface EmailDraftPayload {
  recipientEmail: string
  recipientName?: string
  subject: string
  body: string
  cc?: string
}

export interface LinkedInPayload {
  recipientName: string
  profileUrl: string
  message: string
}

export interface FollowUpPayload {
  type: 'email' | 'call' | 'meeting'
  targetDate: string
  notes: string
}

// ============================================
// GOOGLE CALENDAR LINK GENERATOR
// ============================================

/**
 * Generates a Google Calendar "Add Event" URL.
 * When clicked, opens Google Calendar with pre-filled event details.
 *
 * @param params - Event parameters
 * @returns Google Calendar URL string
 *
 * @example
 * const url = generateGoogleCalendarLink({
 *   title: 'Coffee Chat with John Smith',
 *   description: 'Discuss career in investment banking',
 *   startTime: new Date('2024-02-15T10:00:00'),
 *   endTime: new Date('2024-02-15T10:30:00'),
 *   location: 'Zoom'
 * })
 */
export function generateGoogleCalendarLink(params: CalendarEventParams): string {
  const baseUrl = 'https://calendar.google.com/calendar/render'

  // Format dates to Google Calendar format: YYYYMMDDTHHmmssZ
  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }

  const startFormatted = formatDate(params.startTime)
  const endFormatted = formatDate(params.endTime)

  const queryParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${startFormatted}/${endFormatted}`,
  })

  if (params.description) {
    queryParams.set('details', params.description)
  }

  if (params.location) {
    queryParams.set('location', params.location)
  }

  if (params.guests && params.guests.length > 0) {
    queryParams.set('add', params.guests.join(','))
  }

  return `${baseUrl}?${queryParams.toString()}`
}

/**
 * Creates a calendar event payload with smart defaults.
 * Defaults to a 30-minute meeting starting tomorrow at 10am.
 */
export function createCalendarEventPayload(
  title: string,
  options: Partial<CalendarEventParams> = {}
): CalendarEventPayload {
  // Default: tomorrow at 10am, 30 minutes
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)

  const defaultEnd = new Date(tomorrow)
  defaultEnd.setMinutes(defaultEnd.getMinutes() + 30)

  return {
    title,
    description: options.description,
    startTime: (options.startTime ? new Date(options.startTime) : tomorrow).toISOString(),
    endTime: (options.endTime ? new Date(options.endTime) : defaultEnd).toISOString(),
    location: options.location,
    guests: options.guests,
  }
}

// ============================================
// MAILTO LINK GENERATOR
// ============================================

/**
 * Generates a properly encoded mailto: URL.
 * When clicked, opens the user's default email client with pre-filled content.
 *
 * @param params - Email parameters
 * @returns mailto: URL string
 *
 * @example
 * const url = generateMailtoLink({
 *   to: 'john.smith@company.com',
 *   subject: 'Cornell Athlete Reaching Out',
 *   body: 'Hi John,\n\nI hope this email finds you well...'
 * })
 */
export function generateMailtoLink(params: EmailDraftParams): string {
  const toAddresses = Array.isArray(params.to) ? params.to.join(',') : params.to

  const queryParts: string[] = []

  // Subject
  if (params.subject) {
    queryParts.push(`subject=${encodeURIComponent(params.subject)}`)
  }

  // Body
  if (params.body) {
    queryParts.push(`body=${encodeURIComponent(params.body)}`)
  }

  // CC
  if (params.cc) {
    const ccAddresses = Array.isArray(params.cc) ? params.cc.join(',') : params.cc
    queryParts.push(`cc=${encodeURIComponent(ccAddresses)}`)
  }

  // BCC
  if (params.bcc) {
    const bccAddresses = Array.isArray(params.bcc) ? params.bcc.join(',') : params.bcc
    queryParts.push(`bcc=${encodeURIComponent(bccAddresses)}`)
  }

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''

  return `mailto:${encodeURIComponent(toAddresses)}${queryString}`
}

/**
 * Creates an email draft payload with smart formatting.
 */
export function createEmailDraftPayload(
  recipientEmail: string,
  recipientName: string,
  subject: string,
  body: string
): EmailDraftPayload {
  return {
    recipientEmail,
    recipientName,
    subject,
    body,
  }
}

// ============================================
// LINKEDIN MESSAGE LINK GENERATOR
// ============================================

/**
 * Generates a LinkedIn messaging URL.
 * Note: LinkedIn doesn't support pre-filled messages via URL,
 * so this just opens their profile or messaging page.
 *
 * @param profileUrl - LinkedIn profile URL
 * @returns LinkedIn messaging URL
 */
export function generateLinkedInLink(profileUrl: string): string {
  // Clean up the profile URL and ensure it's valid
  const cleanUrl = profileUrl.trim()

  // If it's already a full URL, return it
  if (cleanUrl.startsWith('https://')) {
    return cleanUrl
  }

  // If it's just a username/path, construct the full URL
  return `https://www.linkedin.com/in/${cleanUrl.replace(/^\/+/, '')}`
}

// ============================================
// ACTION URL GENERATOR (UNIFIED)
// ============================================

/**
 * Generates the appropriate action URL based on action type.
 *
 * @param action - The suggested action object
 * @returns URL string or null if action type doesn't support URL generation
 */
export function generateActionUrl(action: SuggestedAction): string | null {
  switch (action.type) {
    case 'calendar_event': {
      const payload = action.payload as CalendarEventPayload
      return generateGoogleCalendarLink({
        title: payload.title,
        description: payload.description,
        startTime: payload.startTime,
        endTime: payload.endTime,
        location: payload.location,
        guests: payload.guests,
      })
    }

    case 'email_draft': {
      const payload = action.payload as EmailDraftPayload
      return generateMailtoLink({
        to: payload.recipientEmail,
        subject: payload.subject,
        body: payload.body,
        cc: payload.cc,
      })
    }

    case 'linkedin_message': {
      const payload = action.payload as LinkedInPayload
      return generateLinkedInLink(payload.profileUrl)
    }

    case 'follow_up':
      // Follow-ups don't have direct URLs, they're reminders
      return null

    default:
      return null
  }
}

// ============================================
// AI PROMPT HELPERS
// ============================================

/**
 * Returns instructions for the AI to generate suggested actions.
 * Include this in your AI prompts.
 */
export const AI_ACTION_INSTRUCTIONS = `
When you detect that the user should schedule a meeting or send an email, include a "suggestedAction" in your response.

For MEETING suggestions, return:
{
  "suggestedAction": {
    "type": "calendar_event",
    "payload": {
      "title": "Meeting title",
      "description": "Brief description of meeting purpose",
      "startTime": "ISO date string (suggest a reasonable time)",
      "endTime": "ISO date string (typically 30 min later)",
      "location": "Zoom/Phone/In-person location"
    },
    "reasoning": "Why you're suggesting this meeting"
  }
}

For EMAIL suggestions, return:
{
  "suggestedAction": {
    "type": "email_draft",
    "payload": {
      "recipientEmail": "email@example.com (if known)",
      "recipientName": "Recipient's name",
      "subject": "Email subject line",
      "body": "Full email body text"
    },
    "reasoning": "Why you're suggesting this email"
  }
}

Only suggest actions when there's clear intent. Don't force actions.
`

/**
 * Parses AI response to extract suggested action if present.
 */
export function parseAiResponseForAction(response: any): SuggestedAction | null {
  if (!response) return null

  // Check for suggestedAction in response
  if (response.suggestedAction) {
    return response.suggestedAction as SuggestedAction
  }

  // Check for suggested_action (snake_case variant)
  if (response.suggested_action) {
    return response.suggested_action as SuggestedAction
  }

  return null
}
