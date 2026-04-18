"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UUID_REGEX = void 0;
exports.isValidUUID = isValidUUID;
/**
 * UUID v4 format regex.
 * Matches strings like: 550e8400-e29b-41d4-a716-446655440000
 * Requirements: 9.7
 */
exports.UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Returns true if the given value is a valid UUID string.
 * Requirement 9.7
 */
function isValidUUID(value) {
    return typeof value === 'string' && exports.UUID_REGEX.test(value);
}
