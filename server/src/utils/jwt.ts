import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret"

console.log('[JWT] JWT_SECRET configured:', JWT_SECRET ? 'yes (length: ' + JWT_SECRET.length + ')' : 'no')

/**
 * Generates a signed JWT containing the given userId.
 * Expires in 24 hours.
 */
export function generateSocketToken(userId: string): string {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "24h" })
  console.log('[JWT] Generated token for userId:', userId, '(first 20 chars):', token.substring(0, 20))
  return token
}

/**
 * Verifies a JWT and returns the decoded payload.
 * Throws if the token is invalid or expired.
 */
export function verifySocketToken(token: string): { userId: string } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    console.log('[JWT] Token verified successfully for userId:', decoded.userId)
    return { userId: decoded.userId }
  } catch (err) {
    console.error('[JWT] Token verification failed:', err instanceof Error ? err.message : err)
    throw err
  }
}
