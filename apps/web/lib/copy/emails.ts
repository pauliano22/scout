/**
 * Email Copy Templates — Scout
 *
 * All email-sending code should import from here rather than
 * inlining subject/body strings. Each template exports a function
 * that receives dynamic data and returns { subject, body }.
 *
 * Surfaces: transactional, marketing, nurture, system.
 */

import { welcomeMessage } from './brand-voice';

// ---------------------------------------------------------------------------
// Transactional
// ---------------------------------------------------------------------------

export function welcomeEmail(name: string) {
  return {
    subject: `Welcome to Scout${name ? `, ${name}` : ''}!`,
    body: [
      `Hi ${name || 'there'},`,
      '',
      welcomeMessage(name),
      '',
      'Here\'s what you can do next:',
      '- Complete your profile so alumni can find you.',
      '- Browse opportunities posted by fellow Cornellians.',
      '- Connect with alumni in your field of interest.',
      '',
      'If you have any questions, just reply to this email.',
      '',
      '— The Scout Team',
    ].join('\n'),
  } as const;
}

export function verifyEmailEmail(name: string, code: string) {
  return {
    subject: 'Verify your email address',
    body: [
      `Hi ${name || 'there'},`,
      '',
      'Please verify your email address by entering this code:',
      '',
      code,
      '',
      'This code expires in 24 hours.',
      '',
      'If you didn\'t request this, you can safely ignore this email.',
      '',
      '— The Scout Team',
    ].join('\n'),
  } as const;
}

export function passwordResetEmail(name: string, resetLink: string) {
  return {
    subject: 'Reset your Scout password',
    body: [
      `Hi ${name || 'there'},`,
      '',
      'We received a request to reset your password. Click the link below to set a new one:',
      '',
      resetLink,
      '',
      'This link expires in 1 hour.',
      '',
      'If you didn\'t request this, you can safely ignore this email.',
      '',
      '— The Scout Team',
    ].join('\n'),
  } as const;
}

// ---------------------------------------------------------------------------
// Alumni & Connections
// ---------------------------------------------------------------------------

export function connectionRequestReceived(senderName: string) {
  return {
    subject: `${senderName} wants to connect on Scout`,
    body: [
      `Hi there,`,
      '',
      `${senderName} would like to connect with you on Scout.`,
      '',
      'Accept their request to start sharing opportunities and growing your network.',
      '',
      '— The Scout Team',
    ].join('\n'),
  } as const;
}

export function connectionRequestAccepted(accepterName: string) {
  return {
    subject: `${accepterName} accepted your connection request`,
    body: [
      `Great news!`,
      '',
      `${accepterName} accepted your connection request on Scout.`,
      '',
      'Send them a message to start the conversation.',
      '',
      '— The Scout Team',
    ].join('\n'),
  } as const;
}

// ---------------------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------------------

export function newOpportunityAlert(title: string, posterName: string) {
  return {
    subject: `New opportunity: ${title}`,
    body: [
      `Hi there,`,
      '',
      `${posterName} posted a new opportunity: "${title}".`,
      '',
      'Check it out and apply if it interests you.',
      '',
      '— The Scout Team',
    ].join('\n'),
  } as const;
}

export function applicationReceived(opportunityTitle: string, applicantName: string) {
  return {
    subject: `New application for "${opportunityTitle}"`,
    body: [
      `Hi there,`,
      '',
      `${applicantName} applied for your opportunity "${opportunityTitle}".`,
      '',
      'Review their application and get back to them when you can.',
      '',
      '— The Scout Team',
    ].join('\n'),
  } as const;
}

export function applicationStatusChanged(
  applicantName: string,
  opportunityTitle: string,
  status: 'accepted' | 'rejected' | 'in_review',
) {
  const statusMessages: Record<string, string> = {
    accepted: 'Great news! Your application has been accepted.',
    rejected: 'Unfortunately, your application was not selected this time.',
    in_review: 'Your application is now being reviewed by the alumni.',
  };
  return {
    subject: `Application ${status}: "${opportunityTitle}"`,
    body: [
      `Hi ${applicantName || 'there'},`,
      '',
      statusMessages[status] ?? `Your application status has been updated to "${status}".`,
      '',
      `Opportunity: ${opportunityTitle}`,
      '',
      '— The Scout Team',
    ].join('\n'),
  } as const;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export function eventReminder(eventName: string, dateTime: string, location: string) {
  return {
    subject: `Reminder: ${eventName} starts ${dateTime}`,
    body: [
      `Hi there,`,
      '',
      `This is a reminder that "${eventName}" is coming up:`,
      '',
      `When: ${dateTime}`,
      `Where: ${location}`,
      '',
      'We hope to see you there!',
      '',
      '— The Scout Team',
    ].join('\n'),
  } as const;
}

export function eventInvite(eventName: string, hostName: string) {
  return {
    subject: `You're invited: ${eventName}`,
    body: [
      `Hi there,`,
      '',
      `${hostName} invited you to "${eventName}" on Scout.`,
      '',
      'RSVP to let them know if you can make it.',
      '',
      '— The Scout Team',
    ].join('\n'),
  } as const;
}

// ---------------------------------------------------------------------------
// Nurture / Engagement
// ---------------------------------------------------------------------------

export function weeklyDigest(
  name: string,
  newOpportunities: number,
  upcomingEvents: number,
  unreadMessages: number,
) {
  return {
    subject: `Your Scout weekly roundup${newOpportunities > 0 ? ` — ${newOpportunities} new opportunities` : ''}`,
    body: [
      `Hi ${name || 'there'},`,
      '',
      'Here\'s what happened this week on Scout:',
      '',
      `📌 New opportunities: ${newOpportunities}`,
      `📅 Upcoming events: ${upcomingEvents}`,
      `💬 Unread messages: ${unreadMessages}`,
      '',
      'Log in to catch up on everything.',
      '',
      '— The Scout Team',
    ].join('\n'),
  } as const;
}

export function dormantUserReEngagement(name: string, daysSinceLastVisit: number) {
  const friendlyDays = daysSinceLastVisit <= 7 ? 'a while' : `${Math.floor(daysSinceLastVisit / 7)} weeks`;
  return {
    subject: `We miss you${name ? `, ${name}` : ''}`,
    body: [
      `Hi ${name || 'there'},`,
      '',
      `It's been ${friendlyDays} since you last visited Scout.`,
      '',
      'New opportunities and events have been posted since then — come see what\'s new.',
      '',
      '— The Scout Team',
    ].join('\n'),
  } as const;
}
