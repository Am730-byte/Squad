"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinWorkspaceRoom = joinWorkspaceRoom;
const prisma_1 = __importDefault(require("../lib/prisma"));
const roomState_1 = require("../roomState");
const validation_1 = require("../utils/validation");
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
async function joinWorkspaceRoom(socket, io) {
    try {
        const workspaceId = socket.handshake.query.workspaceId;
        const userId = socket.data.userId;
        // Validate workspaceId UUID format (Requirement 9.7)
        if (!(0, validation_1.isValidUUID)(workspaceId)) {
            socket.emit('error', { message: 'Invalid workspace ID format' });
            socket.disconnect();
            return;
        }
        // Fetch user from database
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            socket.emit('error', { message: 'User not found' });
            socket.disconnect();
            return;
        }
        // Verify workspace membership
        const membership = await prisma_1.default.membership.findUnique({
            where: {
                userId_workspaceId: { userId, workspaceId },
            },
        });
        if (!membership) {
            socket.emit('error', { message: 'Not authorized for this workspace' });
            socket.disconnect();
            return;
        }
        // Join the Socket.IO room
        await socket.join(workspaceId);
        // Add participant to room state
        roomState_1.roomStateManager.addParticipant(workspaceId, {
            userId,
            socketId: socket.id,
            name: user.name,
            image: user.image || '',
            joinedAt: new Date(),
            isVideoEnabled: false,
            isAudioEnabled: false,
        });
        // Send current room state (other participants) to the joining socket
        const participants = roomState_1.roomStateManager.getParticipants(workspaceId);
        socket.emit('room:state', {
            participants: participants.filter((p) => p.userId !== userId),
        });
        // Broadcast user:joined to all other participants in the room
        socket.to(workspaceId).emit('user:joined', {
            userId,
            name: user.name,
            image: user.image,
        });
        // Tell existing participants to initiate WebRTC offers to the new user
        const existingParticipants = roomState_1.roomStateManager.getParticipants(workspaceId)
            .filter(p => p.userId !== userId);
        for (const participant of existingParticipants) {
            io.to(participant.socketId).emit('webrtc:create-offer', {
                targetUserId: userId,
            });
        }
        // Fetch last 50 messages and send chat history to the joining socket
        const messages = await prisma_1.default.message.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'asc' },
            take: 50,
            include: {
                user: {
                    select: { id: true, name: true, image: true },
                },
            },
        });
        socket.emit('chat:history', messages);
        // Handle disconnect: remove participant and notify others
        socket.on('disconnect', () => {
            roomState_1.roomStateManager.removeParticipant(workspaceId, userId);
            socket.to(workspaceId).emit('user:left', { userId });
        });
        // Handle media state updates from the participant
        socket.on('media:state', (data) => {
            try {
                const room = roomState_1.roomStateManager.getRoom(workspaceId);
                if (!room)
                    return;
                const participant = room.participants.get(userId);
                if (!participant)
                    return;
                // Update participant's media state
                participant.isVideoEnabled = data.isVideoEnabled;
                participant.isAudioEnabled = data.isAudioEnabled;
                // Broadcast the change to all other participants in the room
                socket.to(workspaceId).emit('participant:media-state', {
                    userId,
                    isVideoEnabled: data.isVideoEnabled,
                    isAudioEnabled: data.isAudioEnabled,
                });
            }
            catch (err) {
                console.error('Handler error:', err);
                socket.emit('error', { message: 'An unexpected error occurred' });
            }
        });
    }
    catch (err) {
        console.error('Handler error:', err);
        socket.emit('error', { message: 'An unexpected error occurred' });
    }
}
