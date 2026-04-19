"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSocketToken = generateSocketToken;
exports.verifySocketToken = verifySocketToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
console.log('[JWT] JWT_SECRET configured:', JWT_SECRET ? 'yes (length: ' + JWT_SECRET.length + ')' : 'no');
/**
 * Generates a signed JWT containing the given userId.
 * Expires in 24 hours.
 */
function generateSocketToken(userId) {
    const token = jsonwebtoken_1.default.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
    console.log('[JWT] Generated token for userId:', userId, '(first 20 chars):', token.substring(0, 20));
    return token;
}
/**
 * Verifies a JWT and returns the decoded payload.
 * Throws if the token is invalid or expired.
 */
function verifySocketToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        console.log('[JWT] Token verified successfully for userId:', decoded.userId);
        return { userId: decoded.userId };
    }
    catch (err) {
        console.error('[JWT] Token verification failed:', err instanceof Error ? err.message : err);
        throw err;
    }
}
