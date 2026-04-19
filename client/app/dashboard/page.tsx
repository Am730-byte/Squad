import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { authOptions } from '@/lib/auth'
import CreateWorkspaceForm from './components/CreateWorkspaceForm'
import JoinWorkspaceForm from './components/JoinWorkspaceForm'

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

async function getWorkspaces(token: string): Promise<Workspace[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL}/api/workspaces`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      // Opt out of Next.js caching so the list is always fresh
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error('Failed to fetch workspaces:', res.status, res.statusText)
      return []
    }

    return res.json()
  } catch (err) {
    console.error('Error fetching workspaces:', err)
    return []
  }
}

async function getSocketToken(): Promise<string | null> {
  try {
    // Call our own Next.js API route to mint a JWT using the current session
    const res = await fetch(
      `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/socket/token`,
      { cache: 'no-store' }
    )

    if (!res.ok) return null

    const data = await res.json()
    return data.token ?? null
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const token = await getSocketToken()
  const workspaces: Workspace[] = token ? await getWorkspaces(token) : []

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Your Workspaces</h1>
          <div className="flex gap-3">
            <Suspense fallback={null}>
              <CreateWorkspaceForm />
            </Suspense>
            <Suspense fallback={null}>
              <JoinWorkspaceForm />
            </Suspense>
          </div>
        </div>

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
