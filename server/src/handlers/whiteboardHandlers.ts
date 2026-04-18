import { Socket } from 'socket.io'
import { roomStateManager } from '../roomState'

interface Point {
  x: number
  y: number
}

interface DrawEvent {
  type: 'path' | 'clear' | 'undo'
  data: {
    points?: Point[]
    color?: string
    width?: number
  }
}

interface WhiteboardEvent {
  userId: string
  timestamp: number
  event: DrawEvent
}

// Debounce map: workspaceId -> timeout handle
const snapshotDebounceMap = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Synchronizes a whiteboard draw event to all other participants in the room.
 * Validates the event type and path data, then broadcasts with userId + timestamp.
 * Updates the room's whiteboard snapshot at most once per 5 seconds (debounced).
 */
export function synchronizeWhiteboardDraw(
  socket: Socket,
  workspaceId: string,
  userId: string,
  drawEvent: DrawEvent
): void {
  try {
    // Validate event type
    if (!['path', 'clear', 'undo'].includes(drawEvent.type)) {
      socket.emit('error', { message: 'Invalid draw event type' })
      return
    }

    // Validate path data
    if (drawEvent.type === 'path') {
      if (!drawEvent.data.points || drawEvent.data.points.length === 0) {
        socket.emit('error', { message: 'Path must have at least one point' })
        return
      }

      for (const point of drawEvent.data.points) {
        if (typeof point.x !== 'number' || typeof point.y !== 'number') {
          socket.emit('error', { message: 'Invalid point coordinates' })
          return
        }
      }
    }

    // Create whiteboard event with metadata
    const whiteboardEvent: WhiteboardEvent = {
      userId,
      timestamp: Date.now(),
      event: drawEvent,
    }

    // Broadcast to all participants except sender
    socket.to(workspaceId).emit('whiteboard:draw', whiteboardEvent)

    // Debounced snapshot update (max once per 5 seconds)
    const existingTimeout = snapshotDebounceMap.get(workspaceId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    const timeout = setTimeout(() => {
      const room = roomStateManager.getRoom(workspaceId)
      if (room) {
        room.whiteboardState = {
          dataUrl: '', // Snapshot captured client-side; server stores placeholder
          updatedAt: new Date(),
        }
      }
      snapshotDebounceMap.delete(workspaceId)
    }, 5000)

    snapshotDebounceMap.set(workspaceId, timeout)
  } catch (err) {
    console.error('Handler error:', err)
    socket.emit('error', { message: 'An unexpected error occurred' })
  }
}
