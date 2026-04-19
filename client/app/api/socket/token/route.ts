import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import jwt from 'jsonwebtoken'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  // Try to get userId from session first, then from header (for server-side calls)
  const userId = session?.user?.id || request.headers.get('x-user-id')

  console.log('[TOKEN API] Session:', session ? 'present' : 'missing')
  console.log('[TOKEN API] User ID:', userId)

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jwtSecret = process.env.JWT_SECRET || 'dev-secret'
  console.log('[TOKEN API] JWT_SECRET configured:', jwtSecret ? 'yes (length: ' + jwtSecret.length + ')' : 'no')

  const token = jwt.sign(
    { userId },
    jwtSecret,
    { expiresIn: '24h' }
  )

  console.log('[TOKEN API] Generated token (first 20 chars):', token.substring(0, 20))

  return NextResponse.json({ token })
}
