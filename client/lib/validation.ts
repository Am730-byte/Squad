/**
 * Validates that a string is a properly formatted email address.
 * Requirement 9.1
 */
export function isValidEmail(email: string): boolean {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return EMAIL_REGEX.test(email)
}
