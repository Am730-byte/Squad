"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_ROLES = void 0;
exports.isValidRole = isValidRole;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../src/lib/prisma"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Maps Prisma known error codes to HTTP responses.
 * P2003: Foreign key constraint violation → 400
 * P2025: Record not found → 404
 * P2002: Unique constraint violation → 409
 * Requirement 8.5
 */
function handlePrismaError(err, res) {
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2003") {
            res.status(400).json({ error: "Invalid reference: related record not found" });
            return true;
        }
        if (err.code === "P2025") {
            res.status(404).json({ error: "Not found" });
            return true;
        }
        if (err.code === "P2002") {
            res.status(409).json({ error: "Already exists" });
            return true;
        }
    }
    return false;
}
/**
 * Valid membership roles as defined in the data model.
 * Requirement 9.6
 */
exports.VALID_ROLES = ["owner", "admin", "member"];
function isValidRole(role) {
    return typeof role === "string" && exports.VALID_ROLES.includes(role);
}
/**
 * GET /api/workspaces
 */
router.get("/", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const memberships = await prisma_1.default.membership.findMany({
            where: { userId: req.userId },
            include: {
                workspace: {
                    include: {
                        memberships: {
                            include: { user: true },
                        },
                    },
                },
            },
        });
        res.json(memberships.map((m) => m.workspace));
    }
    catch (err) {
        console.error("Error listing workspaces:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * POST /api/workspaces
 */
router.post("/", authMiddleware_1.authMiddleware, async (req, res) => {
    const { name, description } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ error: "Workspace name is required" });
        return;
    }
    if (name.trim().length > 100) {
        res.status(400).json({ error: "Workspace name must be 100 characters or fewer" });
        return;
    }
    if (description !== undefined && description !== null) {
        if (typeof description !== "string") {
            res.status(400).json({ error: "Description must be a string or null" });
            return;
        }
        if (description.length > 500) {
            res.status(400).json({ error: "Workspace description must be 500 characters or fewer" });
            return;
        }
    }
    try {
        const workspace = await prisma_1.default.$transaction(async (tx) => {
            const created = await tx.workspace.create({
                data: {
                    name: name.trim(),
                    description: description ?? null,
                    ownerId: req.userId,
                },
            });
            await tx.membership.create({
                data: {
                    userId: req.userId,
                    workspaceId: created.id,
                    role: "owner",
                },
            });
            return tx.workspace.findUnique({
                where: { id: created.id },
                include: {
                    memberships: {
                        include: { user: true },
                    },
                },
            });
        });
        res.status(201).json(workspace);
    }
    catch (err) {
        if (handlePrismaError(err, res))
            return;
        console.error("Error creating workspace:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * POST /api/workspaces/:id/join
 */
router.post("/:id/join", authMiddleware_1.authMiddleware, async (req, res) => {
    const id = req.params["id"];
    if (!UUID_REGEX.test(id)) {
        res.status(400).json({ error: "Invalid workspace ID format" });
        return;
    }
    try {
        const workspace = await prisma_1.default.workspace.findUnique({ where: { id } });
        if (!workspace) {
            res.status(404).json({ error: "Workspace not found" });
            return;
        }
        const membership = await prisma_1.default.membership.upsert({
            where: {
                userId_workspaceId: {
                    userId: req.userId,
                    workspaceId: id,
                },
            },
            update: {},
            create: {
                userId: req.userId,
                workspaceId: id,
                role: "member",
            },
        });
        res.status(200).json(membership);
    }
    catch (err) {
        if (handlePrismaError(err, res))
            return;
        console.error("Error joining workspace:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * DELETE /api/workspaces/:id
 */
router.delete("/:id", authMiddleware_1.authMiddleware, async (req, res) => {
    const id = req.params["id"];
    if (!UUID_REGEX.test(id)) {
        res.status(400).json({ error: "Invalid workspace ID format" });
        return;
    }
    try {
        const workspace = await prisma_1.default.workspace.findUnique({ where: { id } });
        if (!workspace) {
            res.status(404).json({ error: "Workspace not found" });
            return;
        }
        if (workspace.ownerId !== req.userId) {
            res.status(403).json({ error: "Forbidden: only the workspace owner can delete it" });
            return;
        }
        await prisma_1.default.workspace.delete({ where: { id } });
        res.status(204).send();
    }
    catch (err) {
        if (handlePrismaError(err, res))
            return;
        console.error("Error deleting workspace:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
