"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDMHandlers = registerDMHandlers;
const prisma_1 = __importDefault(require("../lib/prisma"));
// Map of userId -> socketId for online users
const onlineUsers = new Map();
function registerDMHandlers(socket, io, userId) {
    // Track this user as online
    onlineUsers.set(userId, socket.id);
    // Handle sending a DM
    socket.on('dm:send', async (data) => {
        try {
            const { receiverId, content } = data;
            if (!content || !content.trim())
                return;
            if (!receiverId)
                return;
            // Persist to database
            const message = await prisma_1.default.directMessage.create({
                data: {
                    content: content.trim(),
                    senderId: userId,
                    receiverId,
                },
                include: {
                    sender: { select: { id: true, name: true, image: true } },
                },
            });
            // Send back to sender (confirmation)
            socket.emit('dm:message', message);
            // Deliver to receiver if online
            const receiverSocketId = onlineUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('dm:message', message);
            }
        }
        catch (err) {
            console.error('Error sending DM:', err);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });
    // Clean up on disconnect
    socket.on('disconnect', () => {
        onlineUsers.delete(userId);
    });
}
