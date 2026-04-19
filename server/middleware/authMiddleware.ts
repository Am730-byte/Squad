import { Request, Response, NextFunction } from "express"
import { verifySocketToken } from "../src/utils/jwt"

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization

  console.log('[AUTH] Request to:', req.method, req.path)
  console.log('[AUTH] Authorization header:', authHeader ? 'present' : 'missing')

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log('[AUTH] No valid authorization header')
    res.status(401).json({ error: "Unauthorized: no token provided" })
    return
  }

  const token = authHeader.slice(7) // Remove "Bearer " prefix
  console.log('[AUTH] Token (first 20 chars):', token.substring(0, 20))

  try {
    const { userId } = verifySocketToken(token)
    console.log('[AUTH] Token verified successfully, userId:', userId)
    req.userId = userId
    next()
  } catch (err) {
    console.error('[AUTH] Token verification failed:', err)
    res.status(401).json({ error: "Unauthorized: invalid or expired token" })
  }
}
