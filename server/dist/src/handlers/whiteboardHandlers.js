"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synchronizeWhiteboardDraw = synchronizeWhiteboardDraw;
const roomState_1 = require("../roomState");
// Debounce map: workspaceId -> timeout handle
const snapshotDebounceMap = new Map();
/**
 * Synchronizes a whiteboard draw event to all other participants in the room.
 * Validates the event type and path data, then broadcasts with userId + timestamp.
 * Updates the room's whiteboard snapshot at most once per 5 seconds (debounced).
 */
function synchronizeWhiteboardDraw(socket, workspaceId, userId, drawEvent) {
    try {
        // Validate event type
        if (!['path', 'clear', 'undo'].includes(drawEvent.type)) {
            socket.emit('error', { message: 'Invalid draw event type' });
            return;
        }
        // Validate path data
        if (drawEvent.type === 'path') {
            if (!drawEvent.data.points || drawEvent.data.points.length === 0) {
                socket.emit('error', { message: 'Path must have at least one point' });
                return;
            }
            for (const point of drawEvent.data.points) {
                if (typeof point.x !== 'number' || typeof point.y !== 'number') {
                    socket.emit('error', { message: 'Invalid point coordinates' });
                    return;
                }
            }
        }
        // Create whiteboard event with metadata
        const whiteboardEvent = {
            userId,
            timestamp: Date.now(),
            event: drawEvent,
        };
        // Broadcast to all participants except sender
        socket.to(workspaceId).emit('whiteboard:draw', whiteboardEvent);
        // Debounced snapshot update (max once per 5 seconds)
        const existingTimeout = snapshotDebounceMap.get(workspaceId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }
        const timeout = setTimeout(() => {
            const room = roomState_1.roomStateManager.getRoom(workspaceId);
            if (room) {
                room.whiteboardState = {
                    dataUrl: '', // Snapshot captured client-side; server stores placeholder
                    updatedAt: new Date(),
                };
            }
            snapshotDebounceMap.delete(workspaceId);
        }, 5000);
        snapshotDebounceMap.set(workspaceId, timeout);
    }
    catch (err) {
        console.error('Handler error:', err);
        socket.emit('error', { message: 'An unexpected error occurred' });
    }
}
