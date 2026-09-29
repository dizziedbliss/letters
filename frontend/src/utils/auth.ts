// Authentication helper for secret code validation and session management

const AUTH_STORAGE_KEY = 'the_goated_website_auth';

// Accepted secret codes (case-insensitive, trimmed)
const VALID_CODES = new Set([
  'dreams'
]);

/**
 * Check if the entered code is valid.
 * Also checks against import.meta.env.VITE_SECRET_CODE if defined.
 */
export function verifySecretCode(inputCode: string): boolean {
  const normalized = inputCode.trim().toLowerCase();
  if (!normalized) return false;

  // Custom environment variable if defined
  const envCode = import.meta.env.VITE_SECRET_CODE?.trim().toLowerCase();
  if (envCode && normalized === envCode) {
    return true;
  }

  return VALID_CODES.has(normalized);
}

/**
 * Attempt to log in with a secret code.
 * Stores auth flag in sessionStorage so it persists across reloads.
 */
export function loginWithCode(inputCode: string): boolean {
  if (verifySecretCode(inputCode)) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
    localStorage.setItem(AUTH_STORAGE_KEY, 'true');
    return true;
  }
  return false;
}

/**
 * Check if the user is currently authenticated.
 */
export function isAuthenticated(): boolean {
  return (
    sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true' ||
    localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
  );
}

/**
 * Log out the user.
 */
export function logout(): void {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
