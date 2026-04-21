'use client'

import { useEffect, useRef, useState } from 'react'
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
  role?: string
}

interface PageProps {
  params: { id: string }
}

function InviteButton({ workspaceId }: { workspaceId: string }) {
  const [copied, setCopied] = useState(false)
  function copyId() {
    navigator.clipboard.writeText(workspaceId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg">
      <span className="text-xs text-gray-400 font-mono">{workspaceId.slice(0, 8)}…</span>
      <button onClick={copyId} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
        {copied ? '✓ Copied!' : 'Copy ID'}
      </button>
    </div>
  )
}

export default function WorkspacePage({ params }: PageProps) {
  const { data: session, status } = useSession()
  const workspaceId = params.id
  const [socket, setSocket] = useState<Socket | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [connected, setConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [currentUserRole, setCurrentUserRole] = useState<string>('member')

  // Panel visibility
  const [showParticipants, setShowParticipants] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showWhiteboard, setShowWhiteboard] = useState(false)

  // Media state — default OFF
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isAudioEnabled, setIsAudioEnabled] = useState(false)

  // Ref to expose VideoPanel's toggle functions
  const videoPanelRef = useRef<{ toggleVideo: () => void; toggleAudio: () => void } | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user || !workspaceId) return

    let newSocket: Socket | null = null

    fetch('/api/socket/token')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch socket token')
        return res.json()
      })
      .then((data: { token: string }) => {
        newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
          auth: { token: data.token },
          query: { workspaceId },
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          timeout: 20000,
        })

        newSocket.on('connect', () => {
          setConnected(true)
          setConnectionError(null)
          setInitializing(false)
        })

        newSocket.on('connect_error', (err) => {
          setConnectionError(err.message)
          setConnected(false)
        })

        newSocket.on('disconnect', () => setConnected(false))

        newSocket.on('room:state', (data: { participants: Participant[]; currentUserRole?: string }) => {
          setParticipants(data.participants)
          if (data.currentUserRole) setCurrentUserRole(data.currentUserRole)
        })

        newSocket.on('user:joined', (data: { userId: string; name: string; image: string }) => {
          setParticipants((prev) => {
            if (prev.some((p) => p.userId === data.userId)) return prev
            return [...prev, {
              userId: data.userId, socketId: '', name: data.name,
              image: data.image, joinedAt: new Date(),
              isVideoEnabled: false, isAudioEnabled: false,
            }]
          })
        })

        newSocket.on('user:left', (data: { userId: string }) => {
          setParticipants((prev) => prev.filter((p) => p.userId !== data.userId))
        })

        newSocket.on('participant:media-state', (data: { userId: string; isVideoEnabled: boolean; isAudioEnabled: boolean }) => {
          setParticipants((prev) =>
            prev.map((p) => p.userId === data.userId
              ? { ...p, isVideoEnabled: data.isVideoEnabled, isAudioEnabled: data.isAudioEnabled }
              : p
            )
          )
        })

        // Admin forced mute
        newSocket.on('admin:force-mute', () => {
          if (isAudioEnabled) {
            videoPanelRef.current?.toggleAudio()
            setIsAudioEnabled(false)
          }
        })

        // Admin kicked
        newSocket.on('admin:kicked', () => {
          alert('You have been removed from this workspace.')
          newSocket?.disconnect()
          window.location.href = '/dashboard'
        })

        setSocket(newSocket)
      })
      .catch((err) => {
        setConnectionError(err instanceof Error ? err.message : 'Connection failed')
      })

    return () => {
      newSocket?.disconnect()
      setSocket(null)
      setConnected(false)
      setParticipants([])
    }
  }, [status, workspaceId])

  if (status === 'loading' || !workspaceId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400">
        <p>Loading workspace…</p>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400">
        <p>Please sign in to access this workspace.</p>
      </div>
    )
  }

  const currentUserId = session.user.id
  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin'

  function leaveWorkspace() {
    socket?.disconnect()
    window.location.href = '/dashboard'
  }

  function handleToggleVideo() {
    videoPanelRef.current?.toggleVideo()
    setIsVideoEnabled((v) => !v)
  }

  function handleToggleAudio() {
    videoPanelRef.current?.toggleAudio()
    setIsAudioEnabled((a) => !a)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0 z-10">
        <span className="text-sm font-medium text-white">Workspace</span>
        <div className="flex items-center gap-3">
          <InviteButton workspaceId={workspaceId} />
          <button
            onClick={leaveWorkspace}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Connection banners */}
      {connectionError && (
        <div className="px-4 py-2 bg-red-900/70 border-b border-red-700 text-sm text-red-300 shrink-0">
          Connection error: {connectionError}
        </div>
      )}
      {!connected && !connectionError && initializing && (
        <div className="px-4 py-2 bg-yellow-900/50 border-b border-yellow-700 text-sm text-yellow-300 shrink-0">
          Connecting to workspace…
        </div>
      )}
      {!connected && !connectionError && !initializing && (
        <div className="px-4 py-2 bg-yellow-900/50 border-b border-yellow-700 text-sm text-yellow-300 shrink-0">
          Reconnecting…
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Video — always full area */}
        <div className="flex-1 overflow-hidden">
          <VideoPanel
            ref={videoPanelRef}
            socket={socket}
            participants={participants}
            currentUserId={currentUserId}
            initialVideoEnabled={false}
            initialAudioEnabled={false}
            onVideoToggle={setIsVideoEnabled}
            onAudioToggle={setIsAudioEnabled}
          />
        </div>

        {/* Sliding panels — overlay on the right */}
        {showParticipants && (
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-gray-900 border-l border-gray-700 z-20 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
              <span className="text-sm font-semibold text-gray-200">Participants</span>
              <button onClick={() => setShowParticipants(false)} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ParticipantList
                participants={participants}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                socket={socket}
              />
            </div>
          </div>
        )}

        {showChat && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-700 z-20 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
              <span className="text-sm font-semibold text-gray-200">Chat</span>
              <button onClick={() => setShowChat(false)} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatPanel socket={socket} workspaceId={workspaceId} />
            </div>
          </div>
        )}

        {showWhiteboard && (
          <div className="absolute right-0 top-0 bottom-0 w-[600px] bg-gray-900 border-l border-gray-700 z-20 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
              <span className="text-sm font-semibold text-gray-200">Whiteboard</span>
              <button onClick={() => setShowWhiteboard(false)} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <WhiteboardPanel socket={socket} workspaceId={workspaceId} currentUserId={currentUserId} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom control bar */}
      <div className="shrink-0 bg-gray-900 border-t border-gray-800 px-6 py-3 flex items-center justify-between z-10">
        {/* Left — media controls */}
        <div className="flex items-center gap-3">
          {/* Mic */}
          <button
            onClick={handleToggleAudio}
            aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
              isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {isAudioEnabled ? <MicIcon className="w-5 h-5" /> : <MicOffIcon className="w-5 h-5" />}
            <span className="text-[10px]">{isAudioEnabled ? 'Mute' : 'Unmute'}</span>
          </button>

          {/* Camera */}
          <button
            onClick={handleToggleVideo}
            aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
              isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {isVideoEnabled ? <VideoIcon className="w-5 h-5" /> : <VideoOffIcon className="w-5 h-5" />}
            <span className="text-[10px]">{isVideoEnabled ? 'Stop Video' : 'Start Video'}</span>
          </button>
        </div>

        {/* Center — panel toggles */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowParticipants((v) => !v); setShowChat(false); setShowWhiteboard(false) }}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
              showParticipants ? 'bg-indigo-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            <PeopleIcon className="w-5 h-5" />
            <span className="text-[10px]">Participants</span>
          </button>

          <button
            onClick={() => { setShowChat((v) => !v); setShowParticipants(false); setShowWhiteboard(false) }}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
              showChat ? 'bg-indigo-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            <ChatIcon className="w-5 h-5" />
            <span className="text-[10px]">Chat</span>
          </button>

          <button
            onClick={() => { setShowWhiteboard((v) => !v); setShowParticipants(false); setShowChat(false) }}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
              showWhiteboard ? 'bg-indigo-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            <WhiteboardIcon className="w-5 h-5" />
            <span className="text-[10px]">Whiteboard</span>
          </button>
        </div>

        {/* Right — leave */}
        <div>
          <button
            onClick={leaveWorkspace}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors"
          >
            <LeaveIcon className="w-5 h-5" />
            <span className="text-[10px]">Leave</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function MicIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
      <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
    </svg>
  )
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM8.25 4.5a3.75 3.75 0 017.5 0v.75l-7.5-7.5V4.5zM15.75 9.75v3a3.75 3.75 0 01-6.99 1.875L6.53 12.396A6.75 6.75 0 0018 12.75v-1.5a.75.75 0 00-1.5 0v.75a5.25 5.25 0 01-5.25 5.25 5.207 5.207 0 01-1.875-.348l-1.11-1.11A6.713 6.713 0 006.75 12.75v-1.5a.75.75 0 00-1.5 0v1.5a8.25 8.25 0 006 7.956v1.794h-3a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-3v-1.794a8.25 8.25 0 006-7.956v-1.5a.75.75 0 00-1.5 0v1.5z" />
    </svg>
  )
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
    </svg>
  )
}

function VideoOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.5 17.69c0 .471-.202.902-.52 1.206l-5.98-5.98V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38zM15.75 7.5v5.068L7.682 4.5h5.068a3 3 0 013 3zM1.5 7.5c0-1.036.84-1.875 1.875-1.875H4.5v.375a.75.75 0 001.5 0V5.625h.375a.75.75 0 000-1.5H3.375A3.375 3.375 0 000 7.5v9a3.375 3.375 0 003.375 3.375h9a3.375 3.375 0 003.375-3.375v-.375a.75.75 0 00-1.5 0v.375a1.875 1.875 0 01-1.875 1.875h-9A1.875 1.875 0 011.5 16.5v-9z" />
    </svg>
  )
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" />
    </svg>
  )
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd" />
    </svg>
  )
}

function WhiteboardIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
      <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
    </svg>
  )
}

function LeaveIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
  )
}
