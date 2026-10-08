/**
 * Safe, environment-aware redirect URL resolver for Supabase authentication.
 * Resolves to the current origin if it matches allowed production or local domains,
 * preventing open redirect vulnerabilities and ensuring localhost is never used in production.
 */

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/penshift\.onrender\.com$/,
  /^https:\/\/penshift\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

export function getSafeAuthRedirectUrl() {
  if (typeof window === 'undefined') {
    return 'https://penshift.onrender.com';
  }

  const currentOrigin = window.location.origin;
  const isAllowed = ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(currentOrigin));

  if (isAllowed) {
    return currentOrigin;
  }

  return 'https://penshift.onrender.com';
}
