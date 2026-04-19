"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const socketAuth_1 = require("../middleware/socketAuth");
const roomHandlers_1 = require("./handlers/roomHandlers");
const chatHandlers_1 = require("./handlers/chatHandlers");
const webrtcHandlers_1 = require("./handlers/webrtcHandlers");
const whiteboardHandlers_1 = require("./handlers/whiteboardHandlers");
const workspaces_1 = __importDefault(require("../routes/workspaces"));
const app = (0, express_1.default)();
exports.app = app;
const CLIENT_URL = process.env.CLIENT_URL?.replace(/\/$/, '') || "http://localhost:3000";
// CORS for all REST routes
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", CLIENT_URL);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
    }
    next();
});
app.use(express_1.default.json());
app.use("/api/workspaces", workspaces_1.default);
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: CLIENT_URL,
        methods: ["GET", "POST"],
        credentials: true,
    },
});
exports.io = io;
io.use(socketAuth_1.socketAuthMiddleware);
io.on('connection', (socket) => {
    (0, roomHandlers_1.joinWorkspaceRoom)(socket, io).catch((err) => {
        console.error('Error joining workspace room:', err);
        socket.emit('error', { message: 'Failed to join workspace' });
        socket.disconnect();
    });
    socket.on('chat:message', (data) => {
        const workspaceId = socket.handshake.query.workspaceId;
        const userId = socket.data.userId;
        (0, chatHandlers_1.processChatMessage)(socket, io, workspaceId, userId, data.content).catch((err) => {
            console.error('Error processing chat message:', err);
            socket.emit('error', { message: 'Failed to send message' });
        });
    });
    const workspaceId = socket.handshake.query.workspaceId;
    const userId = socket.data.userId;
    socket.on('webrtc:offer', (data) => {
        try {
            (0, webrtcHandlers_1.handleWebRTCOffer)(socket, io, workspaceId, data);
        }
        catch (err) {
            console.error('Handler error:', err);
            socket.emit('error', { message: 'An unexpected error occurred' });
        }
    });
    socket.on('webrtc:answer', (data) => {
        try {
            (0, webrtcHandlers_1.handleWebRTCAnswer)(socket, io, workspaceId, data);
        }
        catch (err) {
            console.error('Handler error:', err);
            socket.emit('error', { message: 'An unexpected error occurred' });
        }
    });
    socket.on('webrtc:ice-candidate', (data) => {
        try {
            (0, webrtcHandlers_1.handleICECandidate)(socket, io, workspaceId, data);
        }
        catch (err) {
            console.error('Handler error:', err);
            socket.emit('error', { message: 'An unexpected error occurred' });
        }
    });
    socket.on('whiteboard:draw', (drawEvent) => {
        try {
            (0, whiteboardHandlers_1.synchronizeWhiteboardDraw)(socket, workspaceId, userId, drawEvent);
        }
        catch (err) {
            console.error('Handler error:', err);
            socket.emit('error', { message: 'An unexpected error occurred' });
        }
    });
    socket.on('disconnect', () => {
        // Notify peers to close WebRTC connections
        socket.to(workspaceId).emit('webrtc:peer-disconnected', { userId });
    });
});
app.get("/", (_req, res) => {
    res.status(200).json({ message: "server is running" });
});
// Global error-handling middleware — must be registered after all routes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
