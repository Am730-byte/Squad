import { Router } from "express"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library"
import prisma from "../src/lib/prisma"
import { authMiddleware } from "../middleware/authMiddleware"

const router = Router()

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Maps Prisma known error codes to HTTP responses.
 * P2003: Foreign key constraint violation → 400
 * P2025: Record not found → 404
 * P2002: Unique constraint violation → 409
 * Requirement 8.5
 */
function handlePrismaError(
  err: unknown,
  res: import("express").Response
): boolean {
  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === "P2003") {
      res.status(400).json({ error: "Invalid reference: related record not found" })
      return true
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Not found" })
      return true
    }
    if (err.code === "P2002") {
      res.status(409).json({ error: "Already exists" })
      return true
    }
  }
  return false
}

/**
 * Valid membership roles as defined in the data model.
 * Requirement 9.6
 */
export const VALID_ROLES = ["owner", "admin", "member"] as const
export type MembershipRole = (typeof VALID_ROLES)[number]

/**
 * Returns true if the given value is a valid membership role.
 * Requirement 9.6
 */
export function isValidRole(role: unknown): role is MembershipRole {
  return typeof role === "string" && (VALID_ROLES as readonly string[]).includes(role)
}

/**
 * GET /api/workspaces
 * Returns all workspaces where the authenticated user is a member.
 * Requirement 2.2
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const memberships = await prisma.membership.findMany({
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
    })

    res.json(memberships.map((m) => m.workspace))
  } catch (err) {
    console.error("Error listing workspaces:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

/**
 * POST /api/workspaces
 * Creates a new workspace and assigns the authenticated user as owner.
 * Requirements 2.1, 2.6, 2.7, 8.2, 8.3, 9.3, 9.4
 */
router.post("/", authMiddleware, async (req, res) => {
  const { name, description } = req.body

  // Validate name: required, 1-100 characters
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Workspace name is required" })
    return
  }

  if (name.trim().length > 100) {
    res
      .status(400)
      .json({ error: "Workspace name must be 100 characters or fewer" })
    return
  }

  // Validate description: null or max 500 characters
  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      res.status(400).json({ error: "Description must be a string or null" })
      return
    }
    if (description.length > 500) {
      res
        .status(400)
        .json({ error: "Workspace description must be 500 characters or fewer" })
      return
    }
  }

  try {
    const workspace = await prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: {
          name: name.trim(),
          description: description ?? null,
          ownerId: req.userId!,
        },
      })

      // Requirement 9.6: role is always "owner" for workspace creator — validated here
      const ownerRole: MembershipRole = "owner"
      if (!isValidRole(ownerRole)) {
        throw new Error(`Invalid role: ${ownerRole}`)
      }

      await tx.membership.create({
        data: {
          userId: req.userId!,
          workspaceId: created.id,
          role: ownerRole,
        },
      })

      return tx.workspace.findUnique({
        where: { id: created.id },
        include: {
          memberships: {
            include: { user: true },
          },
        },
      })
    })

    res.status(201).json(workspace)
  } catch (err) {
    if (handlePrismaError(err, res)) return
    console.error("Error creating workspace:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

/**
 * POST /api/workspaces/:id/join
 * Joins the authenticated user to the workspace as a member.
 * Requirement 2.4
 */
router.post("/:id/join", authMiddleware, async (req, res) => {
  const { id } = req.params

  if (!UUID_REGEX.test(id)) {
    res.status(400).json({ error: "Invalid workspace ID format" })
    return
  }

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id },
    })

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" })
      return
    }

    const membership = await prisma.membership.upsert({
      where: {
        userId_workspaceId: {
          userId: req.userId!,
          workspaceId: id,
        },
      },
      update: {}, // No-op if already a member
      create: {
        userId: req.userId!,
        workspaceId: id,
        role: "member" satisfies MembershipRole,
      },
    })

    res.status(200).json(membership)
  } catch (err) {
    if (handlePrismaError(err, res)) return
    console.error("Error joining workspace:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

/**
 * DELETE /api/workspaces/:id
 * Deletes a workspace. Only the owner can delete it.
 * Cascade deletes memberships and messages via Prisma schema.
 * Requirements 2.3, 8.6
 */
router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params

  if (!UUID_REGEX.test(id)) {
    res.status(400).json({ error: "Invalid workspace ID format" })
    return
  }

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id },
    })

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" })
      return
    }

    if (workspace.ownerId !== req.userId) {
      res
        .status(403)
        .json({ error: "Forbidden: only the workspace owner can delete it" })
      return
    }

    await prisma.workspace.delete({
      where: { id },
    })

    res.status(204).send()
  } catch (err) {
    if (handlePrismaError(err, res)) return
    console.error("Error deleting workspace:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
