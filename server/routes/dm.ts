import { Router } from 'express'
import prisma from '../src/lib/prisma'
import { authMiddleware } from '../middleware/authMiddleware'

const router = Router()

/**
 * GET /api/dm/conversations
 * Returns all users the current user has exchanged DMs with,
 * along with the latest message and unread count.
 */
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!

    // Get all users this user has DMed or received DMs from
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, email: true, image: true } },
        receiver: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    // Build a map of unique conversation partners with latest message
    const conversationMap = new Map<string, {
      user: { id: string; name: string; email: string; image: string | null }
      lastMessage: { content: string; createdAt: Date; fromMe: boolean }
    }>()

    for (const msg of messages) {
      const partner = msg.senderId === userId ? msg.receiver : msg.sender
      if (!conversationMap.has(partner.id)) {
        conversationMap.set(partner.id, {
          user: partner,
          lastMessage: {
            content: msg.content,
            createdAt: msg.createdAt,
            fromMe: msg.senderId === userId,
          },
        })
      }
    }

    res.json(Array.from(conversationMap.values()))
  } catch (err) {
    console.error('Error fetching DM conversations:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/dm/users/search?q=query
 * Search users by name or email.
 * Must be defined BEFORE /:userId to avoid route conflict.
 */
router.get('/users/search', authMiddleware, async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim()
    const currentUserId = req.userId!

    if (!q || q.length < 2) {
      res.json([])
      return
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, name: true, email: true, image: true },
      take: 10,
    })

    res.json(users)
  } catch (err) {
    console.error('Error searching users:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/dm/:userId
 * Returns message history between current user and target user (last 50).
 */
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.userId!
    const targetUserId = req.params['userId'] as string

    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: currentUserId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: {
        sender: { select: { id: true, name: true, image: true } },
      },
    })

    res.json(messages)
  } catch (err) {
    console.error('Error fetching DM history:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
