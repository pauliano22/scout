/**
 * Empty State Copy — Scout
 *
 * Maps every major surface/context to its empty-state copy.
 * Each entry includes a title, description, and an optional action CTA.
 */

import { emptyState } from './brand-voice';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmptyStateCopy {
  /** Short title shown in the empty state */
  title: string;
  /** Longer description explaining what to do */
  description: string;
  /** Optional call-to-action label */
  action?: string;
}

// ---------------------------------------------------------------------------
// Surface-level empty states
// ---------------------------------------------------------------------------

export const dashboard: Record<string, EmptyStateCopy> = {
  feed: {
    ...emptyState('Your feed is quiet', 'default'),
    description: 'When alumni post opportunities and events, they\'ll show up here. Check back soon.',
  },
  saved: {
    title: 'Nothing saved yet',
    description: 'Save opportunities and events to revisit them later. Tap the bookmark icon on anything you like.',
    action: 'Browse opportunities',
  },
  activity: {
    title: 'No recent activity',
    description: 'Your recent activity — applications, RSVPs, and messages — will appear here.',
  },
};

export const opportunities: Record<string, EmptyStateCopy> = {
  list: {
    ...emptyState('No opportunities found', 'opportunities'),
    action: 'Clear filters',
  },
  posted: {
    title: 'No opportunities posted yet',
    description: 'Post your first opportunity to help student-athletes find internships, jobs, and mentorship.',
    action: 'Post an opportunity',
  },
  applied: {
    title: 'No applications yet',
    description: 'You haven\'t applied to any opportunities yet. Browse and apply to get started.',
    action: 'Browse opportunities',
  },
  bookmarked: {
    title: 'No bookmarked opportunities',
    description: 'Bookmark opportunities to save them for later.',
    action: 'Browse opportunities',
  },
};

export const events: Record<string, EmptyStateCopy> = {
  list: {
    ...emptyState('No upcoming events', 'events'),
    action: 'Browse past events',
  },
  hosted: {
    title: 'No events hosted yet',
    description: 'Create an event to bring the community together — networking nights, panels, and more.',
    action: 'Create an event',
  },
  rsvped: {
    title: 'No RSVPs yet',
    description: 'RSVP to events to see them here.',
    action: 'Browse events',
  },
  past: {
    title: 'No past events',
    description: 'Past events you attended will show up here.',
  },
};

export const messages: Record<string, EmptyStateCopy> = {
  inbox: {
    ...emptyState('No messages yet', 'messages'),
    action: 'Find alumni to connect with',
  },
  sent: {
    title: 'No sent messages',
    description: 'Messages you send will appear here.',
  },
};

export const connections: Record<string, EmptyStateCopy> = {
  list: {
    ...emptyState('No connections yet', 'connections'),
    action: 'Browse alumni directory',
  },
  pending: {
    title: 'No pending requests',
    description: 'Connection requests you\'ve sent or received will show up here.',
  },
  suggestions: {
    title: 'No suggestions right now',
    description: 'We\'ll suggest Cornell athletes to connect with as the community grows.',
  },
};

export const notifications: Record<string, EmptyStateCopy> = {
  list: {
    ...emptyState('All caught up!', 'notifications'),
    description: 'You\'re all caught up. We\'ll let you know when something new happens.',
  },
};

export const profile: Record<string, EmptyStateCopy> = {
  experience: {
    title: 'No experience listed yet',
    description: 'Add your work experience — internships, jobs, athletics — so alumni can learn about you.',
    action: 'Add experience',
  },
  education: {
    title: 'No education listed',
    description: 'Your Cornell information will be added automatically. Add other schools if applicable.',
    action: 'Add education',
  },
  skills: {
    title: 'No skills added yet',
    description: 'Add skills to help alumni find you for relevant opportunities.',
    action: 'Add skills',
  },
};

export const search: EmptyStateCopy = {
  ...emptyState('No results found', 'search'),
  action: 'Clear search',
};

export const admin: Record<string, EmptyStateCopy> = {
  reports: {
    title: 'No reports to review',
    description: 'When users report content, it will appear here for review.',
  },
  users: {
    title: 'No users match the filter',
    description: 'Try adjusting your search or filter criteria.',
    action: 'Clear filters',
  },
  moderation_queue: {
    title: 'Queue is clear',
    description: 'No content currently needs moderation.',
  },
};

// ---------------------------------------------------------------------------
// Utility: look up empty-state copy by context
// ---------------------------------------------------------------------------

const allSurfaces: Record<string, Record<string, EmptyStateCopy>> = {
  dashboard,
  opportunities,
  events,
  messages,
  connections,
  notifications,
  profile,
  admin,
};

export function getEmptyStateCopy(
  context: string,
  subContext?: string,
): EmptyStateCopy {
  const surface = allSurfaces[context];
  if (!subContext) {
    return surface?.list ?? allSurfaces.dashboard.feed;
  }
  return surface?.[subContext] ?? search;
}
