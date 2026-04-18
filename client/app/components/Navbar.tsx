'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

export default function Navbar() {
  const { data: session } = useSession()

  if (!session) return null

  return (
    <nav className="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
      <Link href="/dashboard" className="text-white font-semibold text-sm hover:text-indigo-300 transition-colors">
        Collaboration Workspace
      </Link>
      <div className="flex items-center gap-3">
        {session.user?.image && (
          <img src={session.user.image} alt={session.user.name || ''} className="w-7 h-7 rounded-full" />
        )}
        <span className="text-gray-300 text-sm">{session.user?.name}</span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1 rounded border border-gray-600 hover:border-gray-400"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
