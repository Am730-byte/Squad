import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '../../auth/[...nextauth]/route'
import jwt from 'jsonwebtoken'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = jwt.sign(
    { userId: session.user.id },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '24h' }
  )

  return NextResponse.json({ token })
}
