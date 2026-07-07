/**
 * Push Notification Sender Utility — Scout
 *
 * Formats a notification payload using the branded template system and
 * stubs the actual push delivery (push provider integration to be added).
 * In development, logs the payload to the server console.
 * In production, would dispatch via Firebase Cloud Messaging, APNs, or
 * a provider like OneSignal / Expo Push.
 */

import {
  NotificationType,
  TemplateVariables,
  buildNotificationPayload,
  getTemplate,
} from './templates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationRecipient {
  /** Unique user ID (UUID from the profiles table). */
  id: string;
  /** Optional device push tokens for the recipient. */
  pushTokens?: string[];
  /** Optional IANA timezone for quiet-hours checks (e.g. "America/New_York"). */
  timezone?: string;
  /** Optional locale for any future i18n of notification strings. */
  locale?: string;
}

export interface FormattedPushPayload {
  /** Notification type identifier. */
  type: NotificationType;
  /** Resolved push title. */
  title: string;
  /** Resolved push body. */
  body: string;
  /** Deep-link route the notification opens. */
  deepLink: string;
  /** Icon identifier. */
  icon: string;
  /** Brand accent colour (hex). */
  color: string;
  /** Notification channel category. */
  channel: string;
  /** Whether this send was blocked by quiet-hours timing rules. */
  blockedByTiming: boolean;
  /** ISO timestamp of when this payload was generated. */
  generatedAt: string;
  /** Recipient identifier (for traceability). */
  recipientId: string;
  /** Static category for OS-level notification grouping. */
  categoryId: string;
  /** Priority hint for the push provider. */
  priority: 'high' | 'normal' | 'low';
}

export interface SendResult {
  /** Whether the notification was actually dispatched (not blocked). */
  delivered: boolean;
  /** The formatted payload. */
  payload: FormattedPushPayload;
  /** Human-readable status message. */
  message: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Priority map — certain notification types are high-priority.
 * Used to inform the push provider's delivery urgency.
 */
const PRIORITY_MAP: Partial<Record<NotificationType, 'high' | 'normal' | 'low'>> = {
  [NotificationType.connection_request]: 'high',
  [NotificationType.new_message]: 'high',
  [NotificationType.alumni_nearby]: 'normal',
  [NotificationType.career_update]: 'low',
  [NotificationType.team_digest]: 'low',
};

// ---------------------------------------------------------------------------
// Send logic
// ---------------------------------------------------------------------------

/**
 * Format and "send" a push notification.
 *
 * In the current implementation this formats the payload and returns it.
 * The actual push delivery is stubbed — swap `stubDispatch` for a real
 * provider integration (e.g. Firebase Admin SDK, Expo Push API) when ready.
 *
 * @param type        - The notification type (maps to a branded template).
 * @param recipient   - Target user and optional device tokens / timezone.
 * @param variables   - Dynamic values to interpolate into the template.
 * @returns           - A SendResult with the formatted payload and delivery status.
 */
export async function sendNotification(
  type: NotificationType,
  recipient: NotificationRecipient,
  variables: TemplateVariables,
): Promise<SendResult> {
  // 1. Build the payload from the branded template
  const payload = buildNotificationPayload(type, variables, recipient.timezone);

  // 2. Assemble the full formatted payload
  const formatted: FormattedPushPayload = {
    type,
    title: payload.title,
    body: payload.body,
    deepLink: payload.deepLink,
    icon: payload.icon,
    color: payload.color,
    channel: payload.channel,
    blockedByTiming: payload.blockedByTiming,
    generatedAt: new Date().toISOString(),
    recipientId: recipient.id,
    categoryId: getTemplate(type).channel,
    priority: PRIORITY_MAP[type] ?? 'normal',
  };

  // 3. Respect timing rules — block if outside quiet hours
  if (payload.blockedByTiming) {
    const template = getTemplate(type);
    const msg =
      `[NOTIFICATIONS] Blocked "${type}" for user ${recipient.id}: ` +
      `outside quiet hours (${template.timing.startHour}:00–${template.timing.endHour}:00 ` +
      `${recipient.timezone ?? 'UTC'}). Payload queued for next window.`;

    if (IS_DEV) console.warn(msg);

    return {
      delivered: false,
      payload: formatted,
      message: msg,
    };
  }

  // 4. Stub the actual push dispatch
  // TODO: Replace with real provider integration
  await stubDispatch(formatted, recipient);

  return {
    delivered: true,
    payload: formatted,
    message: `Notification "${type}" formatted and dispatched to user ${recipient.id}.`,
  };
}

// ---------------------------------------------------------------------------
// Stub dispatch
// ---------------------------------------------------------------------------

/**
 * Stub that simulates sending a push notification.
 *
 * In development this logs the payload.
 * In production, replace with:
 *   - Firebase Admin SDK: admin.messaging().sendEachForMulticast(...)
 *   - Expo Push API:     fetch('https://exp.host/--/api/v2/push/send', ...)
 *   - OneSignal:          onesignal.notifications.create(...)
 */
async function stubDispatch(
  payload: FormattedPushPayload,
  recipient: NotificationRecipient,
): Promise<void> {
  if (IS_DEV) {
    console.log('[NOTIFICATIONS] === Push Dispatch (STUB) ===');
    console.log(JSON.stringify(payload, null, 2));
    if (recipient.pushTokens?.length) {
      console.log(`[NOTIFICATIONS] Would send to ${recipient.pushTokens.length} device(s):`);
      recipient.pushTokens.forEach((t, i) => console.log(`  [${i}] ${t.slice(0, 32)}...`));
    } else {
      console.log('[NOTIFICATIONS] No push tokens — notification not deliverable.');
    }
    console.log('[NOTIFICATIONS] ===============================');
    return;
  }

  // Production stub: would call push provider here
  // await firebaseMessaging.sendEachForMulticast({ ... });
  return;
}
