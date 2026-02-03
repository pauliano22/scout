/**
 * Action Resources Configuration
 * Maps action types to helpful guidance and resource links.
 */

export type ActionType =
  | 'career_center'
  | 'info_session'
  | 'resume'
  | 'alumni_outreach'
  | 'linkedin'
  | 'networking'
  | 'interview_prep'
  | 'application'
  | 'research'
  | 'general'

interface ActionResource {
  guidance: string
  resourceUrl?: string
  resourceLabel?: string
}

// Resource configurations for different action types
export const ACTION_RESOURCES: Record<ActionType, ActionResource> = {
  career_center: {
    guidance: 'Schedule a 1-on-1 with a career advisor to discuss your goals and get personalized feedback.',
    resourceUrl: 'https://career.cornell.edu/channels/make-an-appointment/',
    resourceLabel: 'Book Appointment',
  },
  info_session: {
    guidance: 'Info sessions help you learn about companies and make valuable connections with recruiters.',
    resourceUrl: 'https://cornell.joinhandshake.com/stu/events',
    resourceLabel: 'View Events on Handshake',
  },
  resume: {
    guidance: 'A strong resume is essential. Use Cornell-specific templates and get it reviewed.',
    resourceUrl: 'https://career.cornell.edu/channels/resumes-cover-letters/',
    resourceLabel: 'Resume Resources',
  },
  alumni_outreach: {
    guidance: 'Reaching out to alumni is one of the most effective ways to learn about careers and get referrals.',
  },
  linkedin: {
    guidance: 'A complete LinkedIn profile helps recruiters find you and validates your outreach.',
    resourceUrl: 'https://career.cornell.edu/channels/linkedin/',
    resourceLabel: 'LinkedIn Tips',
  },
  networking: {
    guidance: 'Build relationships before you need them. Coffee chats are low-pressure ways to learn.',
    resourceUrl: 'https://career.cornell.edu/channels/networking/',
    resourceLabel: 'Networking Guide',
  },
  interview_prep: {
    guidance: 'Practice makes perfect. Use Big Red Mock Interviews and case prep resources.',
    resourceUrl: 'https://career.cornell.edu/channels/interviewing/',
    resourceLabel: 'Interview Resources',
  },
  application: {
    guidance: 'Apply early! Many competitive programs have rolling admissions.',
    resourceUrl: 'https://cornell.joinhandshake.com/stu/jobs',
    resourceLabel: 'Browse Jobs',
  },
  research: {
    guidance: 'Understanding the industry helps you speak intelligently in interviews and networking.',
  },
  general: {
    guidance: 'Stay consistent with your career development - small steps add up!',
  },
}

// Keywords to detect action types from text
const ACTION_KEYWORDS: Record<ActionType, string[]> = {
  career_center: [
    'career center',
    'career services',
    'career advisor',
    'career counselor',
    'career office',
    'career appointment',
    'schedule a meeting with',
    'book an appointment',
  ],
  info_session: [
    'info session',
    'information session',
    'company presentation',
    'recruiting event',
    'career fair',
    'networking event',
    'employer event',
    'handshake event',
    'attend a',
    'attend an',
  ],
  resume: [
    'resume',
    'cv',
    'cover letter',
    'tailor your',
    'update your resume',
    'polish your',
  ],
  alumni_outreach: [
    'reach out to',
    'connect with',
    'message',
    'alumni',
    'informational interview',
    'coffee chat',
    'introduction',
    'contact',
    'network with',
  ],
  linkedin: [
    'linkedin',
    'profile',
    'connection request',
    'inmail',
  ],
  networking: [
    'network',
    'build relationships',
    'professional connections',
    'expand your network',
  ],
  interview_prep: [
    'interview',
    'practice',
    'mock interview',
    'case study',
    'behavioral',
    'technical interview',
    'prep for',
    'prepare for',
  ],
  application: [
    'apply',
    'application',
    'submit',
    'deadline',
    'job posting',
    'opening',
    'position',
  ],
  research: [
    'research',
    'learn about',
    'read about',
    'study',
    'understand',
    'industry trends',
    'market',
  ],
  general: [], // Fallback, no specific keywords
}

/**
 * Detects the action type from action item text.
 * Returns the most likely action type based on keyword matching.
 *
 * @param text - The action item text to analyze
 * @returns The detected action type
 */
export function detectActionType(text: string): ActionType {
  const textLower = text.toLowerCase()

  // Check each action type's keywords
  for (const [actionType, keywords] of Object.entries(ACTION_KEYWORDS)) {
    if (actionType === 'general') continue // Skip general as fallback

    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        return actionType as ActionType
      }
    }
  }

  return 'general'
}

/**
 * Gets the resource configuration for a given action type.
 *
 * @param actionType - The type of action
 * @returns The resource configuration
 */
export function getActionResource(actionType: ActionType): ActionResource {
  return ACTION_RESOURCES[actionType]
}

/**
 * Analyzes action item text and returns resource information.
 *
 * @param text - The action item text
 * @returns Object with actionType, guidance, and optional resource link
 */
export function analyzeActionItem(text: string): {
  actionType: ActionType
  guidance: string
  resourceUrl?: string
  resourceLabel?: string
} {
  const actionType = detectActionType(text)
  const resource = getActionResource(actionType)

  return {
    actionType,
    ...resource,
  }
}
