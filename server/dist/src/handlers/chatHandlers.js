"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processChatMessage = processChatMessage;
const prisma_1 = __importDefault(require("../lib/prisma"));
const validation_1 = require("../utils/validation");
/**
 * Processes an incoming chat message from a socket client.
 *
 * Validates the message content (non-empty after trim, max 2000 characters),
 * persists it to the database with user metadata, then broadcasts it to all
 * participants in the workspace room (including the sender).
 *
 * @param socket      - The Socket.IO socket of the sending client
 * @param io          - The Socket.IO server instance (used for room broadcast)
 * @param workspaceId - The workspace/room ID to broadcast the message to
 * @param userId      - The authenticated user's ID
 * @param content     - The raw message content from the client
 */
async function processChatMessage(socket, io, workspaceId, userId, content) {
    try {
        // Validate: non-empty after trim
        if (!content || content.trim().length === 0) {
            socket.emit('error', { message: 'Message content cannot be empty' });
            return;
        }
        // Validate: max 2000 characters
        if (content.length > 2000) {
            socket.emit('error', { message: 'Message too long (max 2000 characters)' });
            return;
        }
        // Validate UUID format for workspaceId and userId (Requirement 9.7)
        if (!(0, validation_1.isValidUUID)(workspaceId)) {
            socket.emit('error', { message: 'Invalid workspace ID format' });
            return;
        }
        if (!(0, validation_1.isValidUUID)(userId)) {
            socket.emit('error', { message: 'Invalid user ID format' });
            return;
        }
        // Persist message to database with user metadata
        const message = await prisma_1.default.message.create({
            data: {
                content: content.trim(),
                userId,
                workspaceId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
        });
        // Broadcast to all participants in the room (including sender)
        io.to(workspaceId).emit('chat:message', {
            id: message.id,
            content: message.content,
            userId: message.userId,
            createdAt: message.createdAt,
            user: message.user,
        });
    }
    catch (err) {
        console.error('Handler error:', err);
        socket.emit('error', { message: 'An unexpected error occurred' });
    }
}
