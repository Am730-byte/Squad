export interface WhiteboardSnapshot {
  dataUrl: string
  updatedAt: Date
}

export interface Participant {
  userId: string
  socketId: string
  name: string
  image: string
  joinedAt: Date
  isVideoEnabled: boolean
  isAudioEnabled: boolean
}

export interface Room {
  id: string
  workspaceId: string
  participants: Map<string, Participant>
  createdAt: Date
  whiteboardState: WhiteboardSnapshot | null
}

export interface RoomStateManager {
  createRoom(workspaceId: string): Room
  getRoom(roomId: string): Room | null
  deleteRoom(roomId: string): void
  addParticipant(roomId: string, participant: Participant): void
  removeParticipant(roomId: string, userId: string): void
  getParticipants(roomId: string): Participant[]
  isUserInRoom(roomId: string, userId: string): boolean
  getRoomCount(): number
  getActiveRooms(): Room[]
}

class RoomStateManagerImpl implements RoomStateManager {
  private rooms: Map<string, Room> = new Map()

  /**
   * Creates a new room for the given workspaceId.
   * The room id is set to the workspaceId (one room per workspace).
   * If a room already exists for that workspaceId, returns the existing room.
   */
  createRoom(workspaceId: string): Room {
    const existing = this.rooms.get(workspaceId)
    if (existing) {
      return existing
    }

    const room: Room = {
      id: workspaceId,
      workspaceId,
      participants: new Map(),
      createdAt: new Date(),
      whiteboardState: null,
    }

    this.rooms.set(workspaceId, room)
    return room
  }

  /**
   * Returns the room with the given roomId, or null if not found.
   */
  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) ?? null
  }

  /**
   * Removes the room with the given roomId from the map.
   */
  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId)
  }

  /**
   * Adds a participant to the specified room.
   * Creates the room first if it does not exist.
   * Participant is keyed by userId in the room's participants map.
   */
  addParticipant(roomId: string, participant: Participant): void {
    let room = this.rooms.get(roomId)
    if (!room) {
      room = this.createRoom(roomId)
    }
    room.participants.set(participant.userId, participant)
  }

  /**
   * Removes a participant from the specified room.
   * If the room becomes empty after removal, the room is deleted (requirement 7.7).
   */
  removeParticipant(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) {
      return
    }

    room.participants.delete(userId)

    if (room.participants.size === 0) {
      this.rooms.delete(roomId)
    }
  }

  /**
   * Returns an array of all participants in the specified room.
   * Returns an empty array if the room does not exist.
   */
  getParticipants(roomId: string): Participant[] {
    const room = this.rooms.get(roomId)
    if (!room) {
      return []
    }
    return Array.from(room.participants.values())
  }

  /**
   * Returns true if a participant with the given userId exists in the room.
   */
  isUserInRoom(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) {
      return false
    }
    return room.participants.has(userId)
  }

  /**
   * Returns the total number of active rooms.
   */
  getRoomCount(): number {
    return this.rooms.size
  }

  /**
   * Returns an array of all active rooms.
   */
  getActiveRooms(): Room[] {
    return Array.from(this.rooms.values())
  }
}

export const roomStateManager = new RoomStateManagerImpl()
