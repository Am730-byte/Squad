'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import CreateWorkspaceForm from './components/CreateWorkspaceForm'
import JoinWorkspaceForm from './components/JoinWorkspaceForm'
import Link from 'next/link'

interface Member {
  id: string
  userId: string
  workspaceId: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
  user: {
    id: string
    name: string
    email: string
    image: string
  }
}

interface Workspace {
  id: string
  name: string
  description: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
  memberships: Member[]
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      fetchWorkspaces()
    }
  }, [status, router])

  async function fetchWorkspaces() {
    try {
      setLoading(true)
      setError(null)

      // Get token from API route
      const tokenRes = await fetch('/api/socket/token')
      if (!tokenRes.ok) {
        throw new Error('Failed to get authentication token')
      }
      const { token } = await tokenRes.json()

      // Fetch workspaces from Railway server
      const workspacesRes = await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL}/api/workspaces`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!workspacesRes.ok) {
        throw new Error(`Failed to fetch workspaces: ${workspacesRes.status}`)
      }

      const data = await workspacesRes.json()
      setWorkspaces(data)
    } catch (err) {
      console.error('Error fetching workspaces:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center py-24">
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Your Workspaces</h1>
          <div className="flex gap-3">
            <CreateWorkspaceForm />
            <JoinWorkspaceForm />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm">Error: {error}</p>
            <button
              onClick={fetchWorkspaces}
              className="mt-2 text-sm text-indigo-400 hover:text-indigo-300"
            >
              Try again
            </button>
          </div>
        )}

        {/* Workspace grid */}
        {workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-gray-400 text-lg mb-2">No workspaces yet.</p>
            <p className="text-gray-500 text-sm">
              Create a new workspace or join an existing one to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((ws) => (
              <WorkspaceCard key={ws.id} workspace={ws} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const memberCount = workspace.memberships?.length ?? 0

  return (
    <div className="bg-gray-900 rounded-xl p-6 flex flex-col gap-4 border border-gray-800 hover:border-gray-600 transition-colors">
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-white truncate">{workspace.name}</h2>
        {workspace.description && (
          <p className="text-gray-400 text-sm mt-1 line-clamp-2">{workspace.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-gray-500 text-xs">
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </span>
        <Link
          href={`/workspace/${workspace.id}`}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          Enter
        </Link>
      </div>
    </div>
  )
}
