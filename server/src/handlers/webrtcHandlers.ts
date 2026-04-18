import { Socket, Server } from 'socket.io'
import { roomStateManager } from '../roomState'
import { isValidUUID } from '../utils/validation'

/**
 * Handles a WebRTC offer from the initiator.
 * Verifies target is in the same workspace room, then forwards the offer.
 */
export function handleWebRTCOffer(
  socket: Socket,
  io: Server,
  workspaceId: string,
  data: { targetUserId: string; offer: RTCSessionDescriptionInit }
): void {
  try {
    // Validate payload contains required 'offer' field
    if (!data || !('offer' in data) || !data.offer) {
      socket.emit('webrtc:error', { message: 'Missing offer payload' })
      return
    }

    const { targetUserId, offer } = data

    // Validate UUID format for workspaceId and targetUserId (Requirement 9.7)
    if (!isValidUUID(workspaceId)) {
      socket.emit('webrtc:error', { message: 'Invalid workspace ID format' })
      return
    }

    if (!isValidUUID(targetUserId)) {
      socket.emit('webrtc:error', { message: 'Invalid target user ID format' })
      return
    }

    // Verify target is in the same room
    const targetParticipant = roomStateManager.getParticipants(workspaceId)
      .find(p => p.userId === targetUserId)

    if (!targetParticipant) {
      socket.emit('webrtc:error', { message: 'Target user not in room', targetUserId })
      return
    }

    // Forward offer to target
    io.to(targetParticipant.socketId).emit('webrtc:offer', {
      fromUserId: socket.data.userId,
      offer
    })
  } catch (err) {
    console.error('Handler error:', err)
    socket.emit('error', { message: 'An unexpected error occurred' })
  }
}

/**
 * Handles a WebRTC answer from the responder.
 * Forwards the answer back to the initiator.
 */
export function handleWebRTCAnswer(
  socket: Socket,
  io: Server,
  workspaceId: string,
  data: { targetUserId: string; answer: RTCSessionDescriptionInit }
): void {
  try {
    // Validate payload contains required 'answer' field
    if (!data || !('answer' in data) || !data.answer) {
      socket.emit('webrtc:error', { message: 'Missing answer payload' })
      return
    }

    const { targetUserId, answer } = data

    // Validate UUID format for workspaceId and targetUserId (Requirement 9.7)
    if (!isValidUUID(workspaceId)) {
      socket.emit('webrtc:error', { message: 'Invalid workspace ID format' })
      return
    }

    if (!isValidUUID(targetUserId)) {
      socket.emit('webrtc:error', { message: 'Invalid target user ID format' })
      return
    }

    const targetParticipant = roomStateManager.getParticipants(workspaceId)
      .find(p => p.userId === targetUserId)

    if (!targetParticipant) {
      socket.emit('webrtc:error', { message: 'Target user not in room', targetUserId })
      return
    }

    io.to(targetParticipant.socketId).emit('webrtc:answer', {
      fromUserId: socket.data.userId,
      answer
    })
  } catch (err) {
    console.error('Handler error:', err)
    socket.emit('error', { message: 'An unexpected error occurred' })
  }
}

/**
 * Handles an ICE candidate from either peer.
 * Forwards the candidate to the target peer.
 */
export function handleICECandidate(
  socket: Socket,
  io: Server,
  workspaceId: string,
  data: { targetUserId: string; candidate: RTCIceCandidateInit }
): void {
  try {
    // Validate payload contains required 'candidate' field
    if (!data || !('candidate' in data) || !data.candidate) {
      socket.emit('webrtc:error', { message: 'Missing candidate payload' })
      return
    }

    const { targetUserId, candidate } = data

    // Validate UUID format for workspaceId and targetUserId (Requirement 9.7)
    if (!isValidUUID(workspaceId)) {
      socket.emit('webrtc:error', { message: 'Invalid workspace ID format' })
      return
    }

    if (!isValidUUID(targetUserId)) {
      socket.emit('webrtc:error', { message: 'Invalid target user ID format' })
      return
    }

    const targetParticipant = roomStateManager.getParticipants(workspaceId)
      .find(p => p.userId === targetUserId)

    if (!targetParticipant) {
      socket.emit('webrtc:error', { message: 'Target user not in room', targetUserId })
      return
    }

    io.to(targetParticipant.socketId).emit('webrtc:ice-candidate', {
      fromUserId: socket.data.userId,
      candidate
    })
  } catch (err) {
    console.error('Handler error:', err)
    socket.emit('error', { message: 'An unexpected error occurred' })
  }
}
