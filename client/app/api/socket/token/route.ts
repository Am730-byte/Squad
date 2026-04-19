import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import jwt from 'jsonwebtoken'

export async function GET() {
  const session = await getServerSession(authOptions)

  console.log('[TOKEN API] Session:', session ? 'present' : 'missing')
  console.log('[TOKEN API] User ID:', session?.user?.id)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jwtSecret = process.env.JWT_SECRET || 'dev-secret'
  console.log('[TOKEN API] JWT_SECRET configured:', jwtSecret ? 'yes (length: ' + jwtSecret.length + ')' : 'no')

  const token = jwt.sign(
    { userId: session.user.id },
    jwtSecret,
    { expiresIn: '24h' }
  )

  console.log('[TOKEN API] Generated token (first 20 chars):', token.substring(0, 20))

  return NextResponse.json({ token })
}
