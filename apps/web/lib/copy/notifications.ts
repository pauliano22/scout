/**
 * Push / In-App Notification Copy — Scout
 *
 * Templates for push notifications and in-app notification toasts.
 * Each function returns { title, body } matching what mobile
 * push providers and the web notification system expect.
 */

import { notification } from './brand-voice';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationCopy {
  title: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Message notifications
// ---------------------------------------------------------------------------

export function newMessage(
  senderName: string,
  preview?: string,
): NotificationCopy {
  return notification('new_message', {
    name: senderName,
    preview: preview ?? 'Tap to read the message.',
  });
}

// ---------------------------------------------------------------------------
// Opportunity notifications
// ---------------------------------------------------------------------------

export function newOpportunity(
  title: string,
  posterName?: string,
): NotificationCopy {
  return notification('new_opportunity', {
    title,
    by: posterName ?? 'An alumnus',
  });
}

export function opportunityDeadlineApproaching(
  opportunityTitle: string,
  daysLeft: number,
): NotificationCopy {
  return {
    title: `Closing soon: ${opportunityTitle}`,
    body: daysLeft === 1
      ? 'This opportunity closes tomorrow. Submit your application today!'
      : `This opportunity closes in ${daysLeft} days. Don't miss out!`,
  };
}

// ---------------------------------------------------------------------------
// Event notifications
// ---------------------------------------------------------------------------

export function eventReminder(
  eventName: string,
  when: string,
): NotificationCopy {
  return notification('event_reminder', {
    event: eventName,
    time: when,
  });
}

export function eventStartingNow(eventName: string): NotificationCopy {
  return {
    title: `${eventName} starts now!`,
    body: 'Join the event and connect with fellow Cornellians.',
  };
}

export function newEventInvite(
  eventName: string,
  hostName: string,
): NotificationCopy {
  return {
    title: `You're invited to ${eventName}`,
    body: `${hostName} invited you to an event. Tap to RSVP.`,
  };
}

// ---------------------------------------------------------------------------
// Application / opportunity-flow notifications
// ---------------------------------------------------------------------------

export function applicationAccepted(
  opportunityTitle: string,
  posterName?: string,
): NotificationCopy {
  return notification('application_update', {
    status: 'accepted',
    by: posterName ?? 'The alumni',
  });
}

export function applicationRejected(opportunityTitle: string): NotificationCopy {
  return {
    title: 'Application update',
    body: `Your application for "${opportunityTitle}" was not selected this time.`,
  };
}

export function applicationInReview(opportunityTitle: string): NotificationCopy {
  return notification('application_update', {
    status: 'in_review',
  });
}

export function newApplicant(
  opportunityTitle: string,
  applicantName: string,
): NotificationCopy {
  return {
    title: `New applicant: ${applicantName}`,
    body: `${applicantName} applied for "${opportunityTitle}". Review their application.`,
  };
}

// ---------------------------------------------------------------------------
// Connection notifications
// ---------------------------------------------------------------------------

export function connectionRequest(
  name: string,
): NotificationCopy {
  return notification('connection_request', { name });
}

export function connectionAccepted(name: string): NotificationCopy {
  return {
    title: `${name} accepted your request`,
    body: 'You\'re now connected on Scout. Send them a welcome message!',
  };
}

// ---------------------------------------------------------------------------
// Social / mention notifications
// ---------------------------------------------------------------------------

export function youWereMentioned(
  by: string,
  context: string,
): NotificationCopy {
  return notification('mention', { by, context });
}

// ---------------------------------------------------------------------------
// System / admin notifications
// ---------------------------------------------------------------------------

export function systemUpdate(message?: string): NotificationCopy {
  return {
    title: 'Scout update',
    body: message ?? 'There\'s a new update. Check it out.',
  };
}

export function profileCompletionReminder(pendingFields: number): NotificationCopy {
  return {
    title: 'Complete your profile',
    body: pendingFields === 1
      ? 'You have 1 field left to fill in your profile.'
      : `You have ${pendingFields} fields left to fill in your profile.`,
  };
}

export function accountFlagged(reason: string): NotificationCopy {
  return {
    title: 'Account notice',
    body: `Your account has been flagged: ${reason}. Contact support if you have questions.`,
  };
}
