"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jwt_1 = require("../src/utils/jwt");
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized: no token provided" });
        return;
    }
    const token = authHeader.slice(7); // Remove "Bearer " prefix
    try {
        const { userId } = (0, jwt_1.verifySocketToken)(token);
        req.userId = userId;
        next();
    }
    catch {
        res.status(401).json({ error: "Unauthorized: invalid or expired token" });
    }
}
