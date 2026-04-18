"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSocketToken = generateSocketToken;
exports.verifySocketToken = verifySocketToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
/**
 * Generates a signed JWT containing the given userId.
 * Expires in 24 hours.
 */
function generateSocketToken(userId) {
    return jsonwebtoken_1.default.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
}
/**
 * Verifies a JWT and returns the decoded payload.
 * Throws if the token is invalid or expired.
 */
function verifySocketToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
    return { userId: decoded.userId };
}
