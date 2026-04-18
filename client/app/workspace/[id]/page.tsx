'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { io, Socket } from 'socket.io-client'
import ChatPanel from './components/ChatPanel'
import ParticipantList from './components/ParticipantList'
import VideoPanel from './components/VideoPanel'
import WhiteboardPanel from './components/WhiteboardPanel'

interface Participant {
  userId: string
  socketId: string
  name: string
  image: string
  joinedAt: Date
  isVideoEnabled: boolean
  isAudioEnabled: boolean
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function WorkspacePage({ params }: PageProps) {
  const { data: session, status } = useSession()
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [connected, setConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Resolve params (Next.js 15 async params)
  useEffect(() => {
    params.then((resolved) => setWorkspaceId(resolved.id))
  }, [params])

  // Connect to Socket.IO once session and workspaceId are available
  useEffect(() => {
    if (!session?.user || !workspaceId) return

    let newSocket: Socket | null = null

    fetch('/api/socket/token')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch socket token')
        return res.json()
      })
      .then((data: { token: string }) => {
        // Connect to Socket.IO server with token auth and workspaceId query param
        newSocket = io(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5174', {
          auth: { token: data.token },
          query: { workspaceId },
        })

        newSocket.on('connect', () => {
          setConnected(true)
          setConnectionError(null)
        })

        newSocket.on('connect_error', (err) => {
          setConnectionError(err.message)
          setConnected(false)
        })

        newSocket.on('disconnect', () => {
          setConnected(false)
        })

        // Receive current room state (participants already in room)
        newSocket.on('room:state', (data: { participants: Participant[] }) => {
          setParticipants(data.participants)
        })

        // A new user joined — add them to participants
        newSocket.on(
          'user:joined',
          (data: { userId: string; name: string; image: string }) => {
            setParticipants((prev) => {
              // Avoid duplicates
              if (prev.some((p) => p.userId === data.userId)) return prev
              return [
                ...prev,
                {
                  userId: data.userId,
                  socketId: '',
                  name: data.name,
                  image: data.image,
                  joinedAt: new Date(),
                  isVideoEnabled: false,
                  isAudioEnabled: false,
                },
              ]
            })
          }
        )

        // A user left — remove them from participants
        newSocket.on('user:left', (data: { userId: string }) => {
          setParticipants((prev) =>
            prev.filter((p) => p.userId !== data.userId)
          )
        })

        setSocket(newSocket)
      })
      .catch((err) => {
        setConnectionError(
          err instanceof Error ? err.message : 'Connection failed'
        )
      })

    return () => {
      newSocket?.disconnect()
      setSocket(null)
      setConnected(false)
      setParticipants([])
    }
  }, [session, workspaceId])

  // Show loading while session is being fetched
  if (status === 'loading' || !workspaceId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400">
        <p>Loading workspace…</p>
      </div>
    )
  }

  // Unauthenticated — middleware should redirect, but guard here too
  if (!session?.user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400">
        <p>Please sign in to access this workspace.</p>
      </div>
    )
  }

  const currentUserId = session.user.id

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      {/* Connection status banner */}
      {connectionError && (
        <div className="px-4 py-2 bg-red-900/70 border-b border-red-700 text-sm text-red-300 flex-shrink-0">
          Connection error: {connectionError}
        </div>
      )}

      {!connected && !connectionError && (
        <div className="px-4 py-2 bg-yellow-900/50 border-b border-yellow-700 text-sm text-yellow-300 flex-shrink-0">
          Connecting to workspace…
        </div>
      )}

      {/* Main panel layout — Participants | Chat | Video | Whiteboard */}
      <div className="flex flex-1 overflow-hidden divide-x divide-gray-700">
        {/* Participant presence sidebar */}
        <div className="w-52 flex-shrink-0 overflow-hidden">
          <ParticipantList participants={participants} />
        </div>

        {/* Chat panel */}
        <div className="w-72 flex-shrink-0 overflow-hidden">
          <ChatPanel socket={socket} workspaceId={workspaceId} />
        </div>

        {/* Video panel */}
        <div className="w-80 flex-shrink-0 overflow-hidden">
          <VideoPanel
            socket={socket}
            participants={participants}
            currentUserId={currentUserId}
          />
        </div>

        {/* Whiteboard panel — takes remaining space */}
        <div className="flex-1 overflow-hidden">
          <WhiteboardPanel
            socket={socket}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </div>
  )
}
