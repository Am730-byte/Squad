import express, { NextFunction, Request, Response } from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { socketAuthMiddleware } from "../middleware/socketAuth"
import { joinWorkspaceRoom } from "./handlers/roomHandlers"
import { processChatMessage } from "./handlers/chatHandlers"
import { handleWebRTCOffer, handleWebRTCAnswer, handleICECandidate } from "./handlers/webrtcHandlers"
import { synchronizeWhiteboardDraw } from "./handlers/whiteboardHandlers"
import workspacesRouter from "../routes/workspaces"

const app = express()

const CLIENT_URL = process.env.CLIENT_URL?.replace(/\/$/, '') || "http://localhost:3000"

// CORS for all REST routes
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", CLIENT_URL)
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.setHeader("Access-Control-Allow-Credentials", "true")
  if (req.method === "OPTIONS") {
    res.sendStatus(204)
    return
  }
  next()
})

app.use(express.json())

app.use("/api/workspaces", workspacesRouter)

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
})

io.use(socketAuthMiddleware)

io.on('connection', (socket) => {
  joinWorkspaceRoom(socket, io).catch((err) => {
    console.error('Error joining workspace room:', err)
    socket.emit('error', { message: 'Failed to join workspace' })
    socket.disconnect()
  })

  socket.on('chat:message', (data: { content: string }) => {
    const workspaceId = socket.handshake.query.workspaceId as string
    const userId = socket.data.userId as string
    processChatMessage(socket, io, workspaceId, userId, data.content).catch((err) => {
      console.error('Error processing chat message:', err)
      socket.emit('error', { message: 'Failed to send message' })
    })
  })

  const workspaceId = socket.handshake.query.workspaceId as string
  const userId = socket.data.userId as string

  socket.on('webrtc:offer', (data) => {
    try {
      handleWebRTCOffer(socket, io, workspaceId, data)
    } catch (err) {
      console.error('Handler error:', err)
      socket.emit('error', { message: 'An unexpected error occurred' })
    }
  })

  socket.on('webrtc:answer', (data) => {
    try {
      handleWebRTCAnswer(socket, io, workspaceId, data)
    } catch (err) {
      console.error('Handler error:', err)
      socket.emit('error', { message: 'An unexpected error occurred' })
    }
  })

  socket.on('webrtc:ice-candidate', (data) => {
    try {
      handleICECandidate(socket, io, workspaceId, data)
    } catch (err) {
      console.error('Handler error:', err)
      socket.emit('error', { message: 'An unexpected error occurred' })
    }
  })

  socket.on('whiteboard:draw', (drawEvent) => {
    try {
      synchronizeWhiteboardDraw(socket, workspaceId, userId, drawEvent)
    } catch (err) {
      console.error('Handler error:', err)
      socket.emit('error', { message: 'An unexpected error occurred' })
    }
  })

  socket.on('disconnect', () => {
    // Notify peers to close WebRTC connections
    socket.to(workspaceId).emit('webrtc:peer-disconnected', { userId })
  })
})

app.get("/", (_req, res) => {
  res.status(200).json({ message: "server is running" })
})

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    port: PORT,
    clientUrl: CLIENT_URL,
    nodeEnv: process.env.NODE_ENV,
    hasDatabase: !!process.env.DATABASE_URL,
    hasJwtSecret: !!process.env.JWT_SECRET,
  })
})

app.get("/healthz", (_req, res) => {
  // Simple health check for Railway
  res.status(200).send("OK")
})

// Global error-handling middleware — must be registered after all routes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = parseInt(process.env.PORT || '3001', 10)

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`)
  console.log(`Binding to 0.0.0.0:${PORT}`)
  console.log(`CLIENT_URL: ${CLIENT_URL}`)
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`)
})

httpServer.on('error', (err) => {
  console.error('Server error:', err)
  process.exit(1)
})

export { app, io }
