/**
 * Branded Push Notification Templates — Scout
 *
 * Design system for every push notification type that the mobile app can send.
 * Each template defines the title, body, deep-link route, icon/color,
 * and timing rules (e.g. no sends after 9 PM recipient-local time).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum NotificationType {
  connection_request = 'connection_request',
  new_message = 'new_message',
  alumni_nearby = 'alumni_nearby',
  career_update = 'career_update',
  team_digest = 'team_digest',
}

/** Dynamic variables that get interpolated into a template's title/body. */
export interface TemplateVariables {
  senderName?: string;
  senderRole?: string;
  preview?: string;
  alumniName?: string;
  company?: string;
  role?: string;
  industry?: string;
  teamName?: string;
  digestCount?: number;
  [key: string]: string | number | undefined;
}

export interface TimingRule {
  /** Earliest hour (0-23, recipient local time) allowed for sends. */
  startHour: number;
  /** Latest hour (0-23, recipient local time) — must be < startHour for overnight spans. */
  endHour: number;
  /** Timezone source: 'recipient_local' requires a known tz on the profile. */
  timezoneSource: 'recipient_local' | 'utc';
}

export interface NotificationTemplate {
  /** The notification type key. */
  type: NotificationType;

  /** Human-readable template description (for internal reference). */
  description: string;

  /** Title template. Accepts {{variable}} placeholders. */
  titleTemplate: string;

  /** Body template. Accepts {{variable}} placeholders. */
  bodyTemplate: string;

  /** Deep-link route the push opens when tapped. Accepts {{variable}} placeholders. */
  deepLink: string;

  /** Icon identifier (maps to a drawable in mobile assets or a URL). */
  icon: string;

  /** Brand accent color (hex) shown on the push notification. */
  color: string;

  /** Which channel category this belongs to (for user opt-in/out). */
  channel: 'social' | 'discovery' | 'career' | 'team';

  /** Timing constraints for this template. */
  timing: TimingRule;
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  // ── Connection Request ──────────────────────────────────────────────
  [NotificationType.connection_request]: {
    type: NotificationType.connection_request,
    description: 'Sent when another user sends a connection request.',
    titleTemplate: 'New connection request from {{senderName}}',
    bodyTemplate: '{{senderName}}{{#senderRole}}, {{senderRole}}{{/senderRole}} wants to connect with you on Scout.',
    deepLink: '/network/connections',
    icon: 'icon_connections',
    color: '#6366F1', // indigo-500 — Scout primary
    channel: 'social',
    timing: {
      startHour: 8,
      endHour: 21, // no sends after 9pm
      timezoneSource: 'recipient_local',
    },
  },

  // ── New Message ─────────────────────────────────────────────────────
  [NotificationType.new_message]: {
    type: NotificationType.new_message,
    description: 'Sent when the recipient receives a new direct message.',
    titleTemplate: 'New message from {{senderName}}',
    bodyTemplate: '{{senderName}}: {{preview}}',
    deepLink: '/messages',
    icon: 'icon_messages',
    color: '#6366F1',
    channel: 'social',
    timing: {
      startHour: 7,
      endHour: 22,
      timezoneSource: 'recipient_local',
    },
  },

  // ── Alumni Nearby ───────────────────────────────────────────────────
  [NotificationType.alumni_nearby]: {
    type: NotificationType.alumni_nearby,
    description: 'Sent when a verified alumnus is geographically near the student-athlete.',
    titleTemplate: '{{alumniName}} is nearby!',
    bodyTemplate: '{{alumniName}}{{#role}}, {{role}}{{/role}} — a fellow Cornellian {{#company}}at {{company}}{{/company}} — is in your area. Tap to connect.',
    deepLink: '/discover',
    icon: 'icon_nearby',
    color: '#10B981', // emerald-500
    channel: 'discovery',
    timing: {
      startHour: 9,
      endHour: 20,
      timezoneSource: 'recipient_local',
    },
  },

  // ── Career Update ───────────────────────────────────────────────────
  [NotificationType.career_update]: {
    type: NotificationType.career_update,
    description: 'Sent when an alumnus in the user\'s network updates their role, company, or industry.',
    titleTemplate: '{{alumniName}} has a new role',
    bodyTemplate: '{{alumniName}} is now {{role}} at {{company}} — check out their updated profile.',
    deepLink: '/network',
    icon: 'icon_career',
    color: '#F59E0B', // amber-500
    channel: 'career',
    timing: {
      startHour: 8,
      endHour: 21,
      timezoneSource: 'recipient_local',
    },
  },

  // ── Team Digest ─────────────────────────────────────────────────────
  [NotificationType.team_digest]: {
    type: NotificationType.team_digest,
    description: 'Periodic digest of activity from the user\'s team or sport cohort.',
    titleTemplate: 'Your {{teamName}} weekly digest',
    bodyTemplate: '{{digestCount}} new updates from your {{teamName}} community this week. See what\'s new.',
    deepLink: '/team',
    icon: 'icon_team',
    color: '#8B5CF6', // violet-500
    channel: 'team',
    timing: {
      startHour: 10,
      endHour: 20,
      timezoneSource: 'recipient_local',
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the template definition for a given notification type.
 * Throws if an unknown type is provided (catch at config-time, not runtime).
 */
export function getTemplate(type: NotificationType): NotificationTemplate {
  const tpl = NOTIFICATION_TEMPLATES[type];
  if (!tpl) {
    throw new Error(`Unknown notification type: "${type}". Available types: ${Object.keys(NOTIFICATION_TEMPLATES).join(', ')}`);
  }
  return tpl;
}

/**
 * Check whether it is currently allowed to send a notification of the given
 * type, based on its timing rules. Defaults to UTC if no timezone is passed.
 *
 * Business rules:
 *  - If current hour (in `tz`) is outside [startHour, endHour), the send is blocked.
 *  - Non-inclusive on endHour: 21 means 21:00 is blocked, 20:59 is OK.
 */
export function isWithinQuietHours(
  template: NotificationTemplate,
  /** IANA timezone string, e.g. "America/New_York". Falls back to UTC. */
  timezone?: string,
): boolean {
  const now = new Date();
  let currentHour: number;

  try {
    const tz = timezone ?? 'UTC';
    currentHour = parseInt(
      now.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }),
      10,
    );
  } catch {
    currentHour = now.getUTCHours();
  }

  const { startHour, endHour } = template.timing;

  // Handle overnight ranges (e.g. 22 → 6 means allow 22-23, 0-5)
  if (endHour < startHour) {
    return currentHour >= startHour || currentHour < endHour;
  }

  // Standard daytime range
  return currentHour >= startHour && currentHour < endHour;
}

/**
 * Interpolate a template string with the provided variables.
 * Supports {{variable}} for simple substitution and
 * {{#key}}...{{/key}} for conditional blocks (renders content only when key is truthy).
 */
export function interpolate(template: string, vars: TemplateVariables): string {
  // Simple variable replacement: {{variableName}}
  let result = template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const val = vars[key];
    return val !== undefined && val !== null ? String(val) : '';
  });

  // Conditional blocks: {{#key}}content{{/key}}
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key: string, content: string) => {
    const val = vars[key];
    return val !== undefined && val !== null && val !== '' && val !== 0 ? content : '';
  });

  // Collapse multiple spaces left by empty conditionals
  result = result.replace(/  +/g, ' ').trim();

  return result;
}

/**
 * Build the final notification payload from a template + variables.
 */
export function buildNotificationPayload(
  type: NotificationType,
  vars: TemplateVariables,
  timezone?: string,
): {
  title: string;
  body: string;
  deepLink: string;
  icon: string;
  color: string;
  channel: string;
  blockedByTiming: boolean;
} {
  const template = getTemplate(type);
  const blockedByTiming = !isWithinQuietHours(template, timezone);

  return {
    title: interpolate(template.titleTemplate, vars),
    body: interpolate(template.bodyTemplate, vars),
    deepLink: interpolate(template.deepLink, vars),
    icon: template.icon,
    color: template.color,
    channel: template.channel,
    blockedByTiming,
  };
}
