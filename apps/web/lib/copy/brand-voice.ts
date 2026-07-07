/**
 * Brand Voice & Tone Guide — Scout
 *
 * Central definition of Scout's voice, tone, and copy patterns.
 * Every surface (email, error, empty-state, notification) draws from this.
 */

export const brandVoice = {
  /** Core brand personality descriptors */
  tone: {
    primary: 'confident but not arrogant',
    secondary: 'warm and encouraging',
    community: 'inclusive and respectful',
    urgency: 'clear and direct without alarmism',
  },
  /** Pronouns for Scout (the platform) and its users */
  pronouns: {
    platform: 'we' as const,
    user: 'you' as const,
    alumni: 'they' as const,
    student: 'they' as const,
  },
  /**
   * Formality scale: 1 (casual) → 5 (formal).
   * Scout sits at a 3 — professional enough for Cornell alumni,
   * warm enough for students.
   */
  formality: 3,
  /** Emoji policy — used sparingly for warmth, never in error states */
  emojis: {
    enabled: true,
    allowedContexts: ['success', 'welcome', 'confirmation', 'celebration'],
    disallowedContexts: ['error', 'warning', 'critical'],
  },
  /** Domain-specific terms and their official casing */
  lexicon: {
    platform: 'Scout',
    community: 'Scout Community',
    alumni: 'Alumni',
    'student-athlete': 'Student-Athlete',
    admin: 'Admin',
    opportunity: 'Opportunity',
    event: 'Event',
  },
} as const;

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

export function welcomeMessage(name: string): string {
  return `Welcome to Scout${name ? `, ${name}` : ''}. We're glad you're here.`;
}

export function errorMessage(context: string): string {
  const messages: Record<string, string> = {
    network: 'Something went wrong on our end. Please try again.',
    auth: 'We couldn\'t sign you in. Double-check your credentials and try again.',
    permission: 'You don\'t have access to that page. If you think this is a mistake, contact your admin.',
    notFound: 'We couldn\'t find what you\'re looking for.',
    validation: 'Please check your input and try again.',
    timeout: 'The request timed out. Please try again.',
    server: 'We\'re experiencing issues. Our team has been notified.',
    upload: 'We couldn\'t process that file. Try a different format or smaller size.',
  };
  return messages[context] ?? 'Something unexpected happened. Please try again.';
}

export function emptyState(title: string, context: string): { title: string; description: string } {
  const templates: Record<string, { description: string }> = {
    opportunities: {
      description: 'No opportunities match your filters. Check back soon — new ones are added regularly.',
    },
    events: {
      description: 'No upcoming events right now. We\'ll let you know when the next one is scheduled.',
    },
    messages: {
      description: 'No messages yet. Start a conversation with an alumnus or teammate.',
    },
    connections: {
      description: 'No connections yet. Reach out to fellow Cornell athletes to grow your network.',
    },
    notifications: {
      description: 'No new notifications. When something happens, you\'ll see it here.',
    },
    search: {
      description: 'No results found. Try adjusting your search terms or filters.',
    },
    default: {
      description: 'Nothing here yet.',
    },
  };
  return {
    title,
    description: templates[context]?.description ?? templates.default.description,
  };
}

export function confirmation(action: string): string {
  const templates: Record<string, string> = {
    save: 'Changes saved successfully.',
    delete: 'Item deleted successfully.',
    submit: 'Submitted successfully.',
    rsvp: 'You\'re confirmed. We\'ll send you a reminder before the event.',
    apply: 'Your application has been submitted. The alumni will review it shortly.',
    share: 'Shared successfully.',
    report: 'Thanks for letting us know. We\'ll review this content.',
  };
  return templates[action] ?? `${action} completed successfully.`;
}

export function notification(
  type: string,
  data: Record<string, string>,
): { title: string; body: string } {
  const templates: Record<string, (d: Record<string, string>) => { title: string; body: string }> = {
    new_message: (d) => ({
      title: `New message from ${d.name ?? 'a teammate'}`,
      body: d.preview ?? 'Tap to read the message.',
    }),
    new_opportunity: (d) => ({
      title: `New opportunity: ${d.title ?? 'something new'}`,
      body: `${d.by ?? 'An alumnus'} posted a new opportunity you might be interested in.`,
    }),
    event_reminder: (d) => ({
      title: `Reminder: ${d.event ?? 'Upcoming event'}`,
      body: `Starts ${d.time ?? 'soon'}. We'll see you there!`,
    }),
    application_update: (d) => ({
      title: `Application update`,
      body: d.status === 'accepted'
        ? `Great news! ${d.by ?? 'The alumni'} accepted your application.`
        : `Your application status has been updated to "${d.status ?? 'reviewed'}".`,
    }),
    connection_request: (d) => ({
      title: `Connection request from ${d.name ?? 'a fellow athlete'}`,
      body: `Accept or decline the request to connect.`,
    }),
    mention: (d) => ({
      title: `You were mentioned`,
      body: `${d.by ?? 'Someone'} mentioned you in a ${d.context ?? 'post'}.`,
    }),
    system: () => ({
      title: 'Scout update',
      body: 'There\'s a new update. Check it out.',
    }),
  };
  return templates[type]?.(data) ?? templates.system(data);
}
