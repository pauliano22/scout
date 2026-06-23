/**
 * Error State Messages — Scout
 *
 * Maps error categories to user-facing copy.
 * Every error UI in the app draws from here so messages stay consistent.
 */

import { errorMessage } from './brand-voice';

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

export interface ErrorCopy {
  title: string;
  message: string;
  /** Optional call-to-action text and handler label */
  action?: string;
}

export function getErrorMessage(code: string, fallback?: string): string {
  return errorMessage(code) || fallback || 'Something went wrong. Please try again.';
}

// ---------------------------------------------------------------------------
// Domain-specific error pages
// ---------------------------------------------------------------------------

export const authErrors: Record<string, ErrorCopy> = {
  sign_in: {
    title: 'Sign-in failed',
    message: 'We couldn\'t sign you in. Check your email and password, then try again.',
    action: 'Try again',
  },
  sign_up: {
    title: 'Account creation failed',
    message: 'We couldn\'t create your account. This email may already be registered.',
    action: 'Go to sign in',
  },
  session_expired: {
    title: 'Session expired',
    message: 'Your session timed out. Sign in again to continue.',
    action: 'Sign in',
  },
  email_not_verified: {
    title: 'Email not verified',
    message: 'Please check your inbox and verify your email address before continuing.',
    action: 'Resend verification',
  },
  magic_link_failed: {
    title: 'Link expired or invalid',
    message: 'This magic link has expired or is no longer valid. Request a new one.',
    action: 'Request new link',
  },
};

export const apiErrors: Record<string, ErrorCopy> = {
  400: {
    title: 'Bad request',
    message: 'The request couldn\'t be processed. Please check your input.',
    action: 'Go back',
  },
  401: {
    title: 'Unauthorized',
    message: 'You need to sign in to access this.',
    action: 'Sign in',
  },
  403: {
    title: 'Access denied',
    message: 'You don\'t have permission to do that. Contact your admin if you think this is a mistake.',
    action: 'Contact support',
  },
  404: {
    title: 'Not found',
    message: 'We couldn\'t find what you\'re looking for. It may have been removed or the link is incorrect.',
    action: 'Go home',
  },
  409: {
    title: 'Conflict',
    message: 'This action conflicts with the current state. Try refreshing and trying again.',
    action: 'Refresh',
  },
  429: {
    title: 'Too many requests',
    message: 'You\'ve made too many requests. Take a breather and try again in a moment.',
    action: 'Try again',
  },
  500: {
    title: 'Server error',
    message: 'Something went wrong on our end. We\'ve been notified and are working on it.',
    action: 'Try again',
  },
  502: {
    title: 'Service unavailable',
    message: 'Scout is temporarily unavailable. We\'ll be back shortly.',
    action: 'Refresh',
  },
  503: {
    title: 'Under maintenance',
    message: 'Scout is down for maintenance. We\'ll be back before you know it.',
    action: 'Try again later',
  },
};

export const formErrors: Record<string, ErrorCopy> = {
  required: {
    title: 'Required field',
    message: 'Please fill in this field.',
  },
  email: {
    title: 'Invalid email',
    message: 'Please enter a valid email address.',
  },
  url: {
    title: 'Invalid URL',
    message: 'Please enter a valid URL starting with http:// or https://.',
  },
  phone: {
    title: 'Invalid phone number',
    message: 'Please enter a valid phone number.',
  },
  min_length: {
    title: 'Too short',
    message: 'The value is too short. Please add more detail.',
  },
  max_length: {
    title: 'Too long',
    message: 'The value is too long. Please shorten it.',
  },
  file_size: {
    title: 'File too large',
    message: 'That file is too large. Try a smaller file (max 10 MB).',
  },
  file_type: {
    title: 'Unsupported file type',
    message: 'That file type isn\'t supported. Try a different format.',
  },
};

export const uploadErrors: Record<string, ErrorCopy> = {
  failed: {
    title: 'Upload failed',
    message: 'We couldn\'t upload that file. Check your connection and try again.',
    action: 'Retry',
  },
  too_large: {
    title: 'File too large',
    message: 'That file exceeds the size limit. Choose a smaller file.',
  },
  virus_detected: {
    title: 'File rejected',
    message: 'This file couldn\'t be scanned for safety. Please try a different file.',
  },
};

// ---------------------------------------------------------------------------
// Utility: get an error copy by category and key
// ---------------------------------------------------------------------------

export function getErrorCopy(
  category: 'auth' | 'api' | 'form' | 'upload',
  key: string,
): ErrorCopy {
  const store: Record<string, Record<string, ErrorCopy>> = {
    auth: authErrors,
    api: apiErrors,
    form: formErrors,
    upload: uploadErrors,
  };
  return store[category]?.[key] ?? {
    title: 'Error',
    message: 'Something went wrong. Please try again.',
    action: 'OK',
  };
}
