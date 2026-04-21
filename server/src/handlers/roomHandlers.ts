import { Socket, Server } from 'socket.io'
import prisma from '../lib/prisma'
import { roomStateManager } from '../roomState'
import { isValidUUID } from '../utils/validation'

/**
 * Handles a socket joining a workspace room.
 *
 * Reads workspaceId from socket.handshake.query and userId from socket.data
 * (set by auth middleware). Verifies the user exists and has a membership
 * record for the workspace, then:
 *  - Joins the Socket.IO room
 *  - Adds the participant to RoomStateManager
 *  - Emits room:state (existing participants) to the joining socket
 *  - Broadcasts user:joined to all other participants
 *  - Emits chat:history (last 50 messages) to the joining socket
 *  - Registers a disconnect handler to clean up state and broadcast user:left
 */
export async function joinWorkspaceRoom(socket: Socket, io: Server): Promise<void> {
  try {
    const workspaceId = socket.handshake.query.workspaceId as string

    // Skip workspace join for DM-only connections
    if (!workspaceId || workspaceId === 'dm') return
    const userId = socket.data.userId as string

    // Validate workspaceId UUID format (Requirement 9.7)
    if (!isValidUUID(workspaceId)) {
      socket.emit('error', { message: 'Invalid workspace ID format' })
      socket.disconnect()
      return
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      socket.emit('error', { message: 'User not found' })
      socket.disconnect()
      return
    }

    // Verify workspace membership
    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
    })

    if (!membership) {
      socket.emit('error', { message: 'Not authorized for this workspace' })
      socket.disconnect()
      return
    }

    // Join the Socket.IO room
    await socket.join(workspaceId)

    // Add participant to room state
    roomStateManager.addParticipant(workspaceId, {
      userId,
      socketId: socket.id,
      name: user.name,
      image: user.image || '',
      joinedAt: new Date(),
      isVideoEnabled: false,
      isAudioEnabled: false,
    })

    // Send current room state (other participants) to the joining socket
    const participants = roomStateManager.getParticipants(workspaceId)
    socket.emit('room:state', {
      participants: participants.filter((p) => p.userId !== userId),
      currentUserRole: membership.role,
    })

    // Broadcast user:joined to all other participants in the room
    socket.to(workspaceId).emit('user:joined', {
      userId,
      name: user.name,
      image: user.image,
    })

    // Tell existing participants to initiate WebRTC offers to the new user
    const existingParticipants = roomStateManager.getParticipants(workspaceId)
      .filter(p => p.userId !== userId)

    for (const participant of existingParticipants) {
      io.to(participant.socketId).emit('webrtc:create-offer', {
        targetUserId: userId,
      })
    }

    // Fetch last 50 messages and send chat history to the joining socket
    const messages = await prisma.message.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
    })

    socket.emit('chat:history', messages)

    // Handle disconnect: remove participant and notify others
    socket.on('disconnect', () => {
      roomStateManager.removeParticipant(workspaceId, userId)
      socket.to(workspaceId).emit('user:left', { userId })
    })

    // Handle media state updates from the participant
    socket.on('media:state', (data: { isVideoEnabled: boolean; isAudioEnabled: boolean }) => {
      try {
        const room = roomStateManager.getRoom(workspaceId)
        if (!room) return

        const participant = room.participants.get(userId)
        if (!participant) return

        // Update participant's media state
        participant.isVideoEnabled = data.isVideoEnabled
        participant.isAudioEnabled = data.isAudioEnabled

        // Broadcast the change to all other participants in the room
        socket.to(workspaceId).emit('participant:media-state', {
          userId,
          isVideoEnabled: data.isVideoEnabled,
          isAudioEnabled: data.isAudioEnabled,
        })
      } catch (err) {
        console.error('Handler error:', err)
        socket.emit('error', { message: 'An unexpected error occurred' })
      }
    })

    // Admin: force-mute a participant
    socket.on('admin:mute', async (data: { targetUserId: string }) => {
      try {
        const requesterMembership = await prisma.membership.findUnique({
          where: { userId_workspaceId: { userId, workspaceId } },
        })
        if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
          socket.emit('error', { message: 'Not authorized' })
          return
        }
        const target = roomStateManager.getParticipants(workspaceId).find(p => p.userId === data.targetUserId)
        if (!target) return
        io.to(target.socketId).emit('admin:force-mute')
        console.log(`[ADMIN] ${userId} muted ${data.targetUserId}`)
      } catch (err) {
        console.error('admin:mute error:', err)
      }
    })

    // Admin: kick a participant
    socket.on('admin:kick', async (data: { targetUserId: string }) => {
      try {
        const requesterMembership = await prisma.membership.findUnique({
          where: { userId_workspaceId: { userId, workspaceId } },
        })
        if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
          socket.emit('error', { message: 'Not authorized' })
          return
        }
        const target = roomStateManager.getParticipants(workspaceId).find(p => p.userId === data.targetUserId)
        if (!target) return
        io.to(target.socketId).emit('admin:kicked')
        setTimeout(() => {
          const targetSocket = io.sockets.sockets.get(target.socketId)
          targetSocket?.disconnect(true)
        }, 500)
        console.log(`[ADMIN] ${userId} kicked ${data.targetUserId}`)
      } catch (err) {
        console.error('admin:kick error:', err)
      }
    })

    // Admin: ban a participant (kick + remove membership)
    socket.on('admin:ban', async (data: { targetUserId: string }) => {
      try {
        const requesterMembership = await prisma.membership.findUnique({
          where: { userId_workspaceId: { userId, workspaceId } },
        })
        if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
          socket.emit('error', { message: 'Not authorized' })
          return
        }
        await prisma.membership.delete({
          where: { userId_workspaceId: { userId: data.targetUserId, workspaceId } },
        }).catch(() => { /* already removed */ })
        const target = roomStateManager.getParticipants(workspaceId).find(p => p.userId === data.targetUserId)
        if (target) {
          io.to(target.socketId).emit('admin:kicked')
          setTimeout(() => {
            const targetSocket = io.sockets.sockets.get(target.socketId)
            targetSocket?.disconnect(true)
          }, 500)
        }
        console.log(`[ADMIN] ${userId} banned ${data.targetUserId} from ${workspaceId}`)
      } catch (err) {
        console.error('admin:ban error:', err)
      }
    })
  } catch (err) {
    console.error('Handler error:', err)
    socket.emit('error', { message: 'An unexpected error occurred' })
  }
}
