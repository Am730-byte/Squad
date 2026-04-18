import { Socket } from "socket.io"
import { verifySocketToken } from "../src/utils/jwt"

export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): void {
  const token = socket.handshake.auth.token as string | undefined

  if (!token) {
    return next(new Error("Authentication error: no token provided"))
  }

  try {
    const { userId } = verifySocketToken(token)
    socket.data.userId = userId
    next()
  } catch {
    next(new Error("Authentication error: invalid token"))
  }
}
