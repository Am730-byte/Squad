"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebRTCOffer = handleWebRTCOffer;
exports.handleWebRTCAnswer = handleWebRTCAnswer;
exports.handleICECandidate = handleICECandidate;
const roomState_1 = require("../roomState");
const validation_1 = require("../utils/validation");
/**
 * Handles a WebRTC offer from the initiator.
 * Verifies target is in the same workspace room, then forwards the offer.
 */
function handleWebRTCOffer(socket, io, workspaceId, data) {
    try {
        // Validate payload contains required 'offer' field
        if (!data || !('offer' in data) || !data.offer) {
            socket.emit('webrtc:error', { message: 'Missing offer payload' });
            return;
        }
        const { targetUserId, offer } = data;
        // Validate UUID format for workspaceId and targetUserId (Requirement 9.7)
        if (!(0, validation_1.isValidUUID)(workspaceId)) {
            socket.emit('webrtc:error', { message: 'Invalid workspace ID format' });
            return;
        }
        if (!(0, validation_1.isValidUUID)(targetUserId)) {
            socket.emit('webrtc:error', { message: 'Invalid target user ID format' });
            return;
        }
        // Verify target is in the same room
        const targetParticipant = roomState_1.roomStateManager.getParticipants(workspaceId)
            .find(p => p.userId === targetUserId);
        if (!targetParticipant) {
            socket.emit('webrtc:error', { message: 'Target user not in room', targetUserId });
            return;
        }
        // Forward offer to target
        io.to(targetParticipant.socketId).emit('webrtc:offer', {
            fromUserId: socket.data.userId,
            offer
        });
    }
    catch (err) {
        console.error('Handler error:', err);
        socket.emit('error', { message: 'An unexpected error occurred' });
    }
}
/**
 * Handles a WebRTC answer from the responder.
 * Forwards the answer back to the initiator.
 */
function handleWebRTCAnswer(socket, io, workspaceId, data) {
    try {
        // Validate payload contains required 'answer' field
        if (!data || !('answer' in data) || !data.answer) {
            socket.emit('webrtc:error', { message: 'Missing answer payload' });
            return;
        }
        const { targetUserId, answer } = data;
        // Validate UUID format for workspaceId and targetUserId (Requirement 9.7)
        if (!(0, validation_1.isValidUUID)(workspaceId)) {
            socket.emit('webrtc:error', { message: 'Invalid workspace ID format' });
            return;
        }
        if (!(0, validation_1.isValidUUID)(targetUserId)) {
            socket.emit('webrtc:error', { message: 'Invalid target user ID format' });
            return;
        }
        const targetParticipant = roomState_1.roomStateManager.getParticipants(workspaceId)
            .find(p => p.userId === targetUserId);
        if (!targetParticipant) {
            socket.emit('webrtc:error', { message: 'Target user not in room', targetUserId });
            return;
        }
        io.to(targetParticipant.socketId).emit('webrtc:answer', {
            fromUserId: socket.data.userId,
            answer
        });
    }
    catch (err) {
        console.error('Handler error:', err);
        socket.emit('error', { message: 'An unexpected error occurred' });
    }
}
/**
 * Handles an ICE candidate from either peer.
 * Forwards the candidate to the target peer.
 */
function handleICECandidate(socket, io, workspaceId, data) {
    try {
        // Validate payload contains required 'candidate' field
        if (!data || !('candidate' in data) || !data.candidate) {
            socket.emit('webrtc:error', { message: 'Missing candidate payload' });
            return;
        }
        const { targetUserId, candidate } = data;
        // Validate UUID format for workspaceId and targetUserId (Requirement 9.7)
        if (!(0, validation_1.isValidUUID)(workspaceId)) {
            socket.emit('webrtc:error', { message: 'Invalid workspace ID format' });
            return;
        }
        if (!(0, validation_1.isValidUUID)(targetUserId)) {
            socket.emit('webrtc:error', { message: 'Invalid target user ID format' });
            return;
        }
        const targetParticipant = roomState_1.roomStateManager.getParticipants(workspaceId)
            .find(p => p.userId === targetUserId);
        if (!targetParticipant) {
            socket.emit('webrtc:error', { message: 'Target user not in room', targetUserId });
            return;
        }
        io.to(targetParticipant.socketId).emit('webrtc:ice-candidate', {
            fromUserId: socket.data.userId,
            candidate
        });
    }
    catch (err) {
        console.error('Handler error:', err);
        socket.emit('error', { message: 'An unexpected error occurred' });
    }
}
