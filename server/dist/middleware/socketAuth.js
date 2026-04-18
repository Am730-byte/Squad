"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuthMiddleware = socketAuthMiddleware;
const jwt_1 = require("../src/utils/jwt");
function socketAuthMiddleware(socket, next) {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error("Authentication error: no token provided"));
    }
    try {
        const { userId } = (0, jwt_1.verifySocketToken)(token);
        socket.data.userId = userId;
        next();
    }
    catch {
        next(new Error("Authentication error: invalid token"));
    }
}
