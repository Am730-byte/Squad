/**
 * UUID v4 format regex.
 * Matches strings like: 550e8400-e29b-41d4-a716-446655440000
 * Requirements: 9.7
 */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Returns true if the given value is a valid UUID string.
 * Requirement 9.7
 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
}
