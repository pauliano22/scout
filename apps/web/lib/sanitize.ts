import DOMPurify from 'dompurify';

/**
 * Create a DOMPurify instance using a minimal JSDOM window.
 * This is safe for server-side rendering in Next.js.
 */
function createPurify() {
  // Dynamic import to avoid issues on the client side
  if (typeof window !== 'undefined') {
    return DOMPurify;
  }
  // Server-side: use JSDOM
  const { JSDOM } = require('jsdom') as typeof import('jsdom');
  const domWindow = new JSDOM('').window;
  return DOMPurify(domWindow as any);
}

const purify = createPurify();

/**
 * Sanitize HTML content - strips script tags, event handlers, dangerous attributes.
 * Allows basic formatting tags (b, i, a, p, br, ul, ol, li, strong, em).
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return purify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'a', 'p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}

/**
 * Sanitize plain text - strips ALL HTML tags, returns safe plain text.
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return purify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Context-aware sanitization for user content.
 * - bio/description/listing: allows basic formatting
 * - message/display_name/headline: strips all HTML
 */
export function sanitizeUserContent(
  input: string,
  fieldType: string
): string {
  if (!input) return '';
  
  switch (fieldType) {
    case 'bio':
    case 'description':
    case 'listing':
      return sanitizeHtml(input);
    case 'message':
    case 'display_name':
    case 'headline':
    default:
      return sanitizeText(input);
  }
}

/**
 * Quick check if a string contains HTML tags.
 */
export function containsHtml(input: string): boolean {
  if (!input) return false;
  return /<[a-z][\s\S]*>/i.test(input);
}

/**
 * Sanitize with maximum length enforcement.
 */
export function sanitizeWithMaxLength(
  input: string,
  fieldType: string,
  maxLength: number
): string {
  const sanitized = sanitizeUserContent(input, fieldType);
  return sanitized.slice(0, maxLength);
}
