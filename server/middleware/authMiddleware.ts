import { Request, Response, NextFunction } from "express"
import { verifySocketToken } from "../src/utils/jwt"

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: no token provided" })
    return
  }

  const token = authHeader.slice(7) // Remove "Bearer " prefix

  try {
    const { userId } = verifySocketToken(token)
    req.userId = userId
    next()
  } catch {
    res.status(401).json({ error: "Unauthorized: invalid or expired token" })
  }
}
