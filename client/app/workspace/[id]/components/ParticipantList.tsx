'use client'

import { useState } from 'react'
import { Socket } from 'socket.io-client'

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

interface ParticipantListProps {
  participants: Participant[]
  currentUserId: string
  isAdmin: boolean
  socket: Socket | null
}

function getInitials(name: string): string {
  return name.split(' ').map((p) => p.charAt(0)).slice(0, 2).join('').toUpperCase()
}

export default function ParticipantList({ participants, currentUserId, isAdmin, socket }: ParticipantListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  function handleMute(userId: string) {
    socket?.emit('admin:mute', { targetUserId: userId })
    setOpenMenuId(null)
  }

  function handleKick(userId: string) {
    if (!confirm('Remove this participant from the workspace?')) return
    socket?.emit('admin:kick', { targetUserId: userId })
    setOpenMenuId(null)
  }

  function handleBan(userId: string) {
    if (!confirm('Ban this participant? They will not be able to rejoin.')) return
    socket?.emit('admin:ban', { targetUserId: userId })
    setOpenMenuId(null)
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      <div className="px-3 py-2 text-xs text-gray-500">{participants.length} online</div>

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {participants.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-8">No other participants.</p>
        )}
        {participants.map((p) => (
          <div key={p.userId} className="relative flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center overflow-hidden">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-white">{getInitials(p.name)}</span>
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-gray-900" />
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">
                {p.name}
                {p.userId === currentUserId && <span className="text-gray-500 text-xs ml-1">(you)</span>}
              </p>
            </div>

            {/* Media indicators */}
            <div className="flex items-center gap-1 shrink-0">
              <span title={p.isVideoEnabled ? 'Camera on' : 'Camera off'} className={p.isVideoEnabled ? 'text-green-400' : 'text-gray-600'}>
                <CameraIcon className="w-3.5 h-3.5" on={p.isVideoEnabled} />
              </span>
              <span title={p.isAudioEnabled ? 'Mic on' : 'Mic off'} className={p.isAudioEnabled ? 'text-green-400' : 'text-gray-600'}>
                <MicIndicator className="w-3.5 h-3.5" on={p.isAudioEnabled} />
              </span>
            </div>

            {/* Admin menu — only for other participants */}
            {isAdmin && p.userId !== currentUserId && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setOpenMenuId(openMenuId === p.userId ? null : p.userId)}
                  className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
                  aria-label="Admin actions"
                >
                  <DotsIcon className="w-4 h-4" />
                </button>

                {openMenuId === p.userId && (
                  <div className="absolute right-0 top-7 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-30 overflow-hidden">
                    <button
                      onClick={() => handleMute(p.userId)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                    >
                      <MuteIcon className="w-4 h-4 text-yellow-400" />
                      Mute
                    </button>
                    <button
                      onClick={() => handleKick(p.userId)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                    >
                      <KickIcon className="w-4 h-4 text-orange-400" />
                      Remove
                    </button>
                    <button
                      onClick={() => handleBan(p.userId)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                    >
                      <BanIcon className="w-4 h-4" />
                      Ban
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CameraIcon({ className, on }: { className?: string; on: boolean }) {
  return on ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.5 17.69c0 .471-.202.86-.504 1.124l-4.746-4.746V7.939l2.69-2.689c.944-.945 2.56-.276 2.56 1.06v11.38zM15.75 7.5v5.068L7.682 4.5h4.068a3 3 0 013 3zM1.5 7.5c0-1.036.84-1.875 1.875-1.875H4.5v.375a.75.75 0 001.5 0V5.625h.375a.75.75 0 000-1.5H3.375A3.375 3.375 0 000 7.5v9a3.375 3.375 0 003.375 3.375h8.25a3.375 3.375 0 003.375-3.375v-.375a.75.75 0 00-1.5 0v.375a1.875 1.875 0 01-1.875 1.875h-8.25A1.875 1.875 0 011.5 16.5v-9z" />
    </svg>
  )
}

function MicIndicator({ className, on }: { className?: string; on: boolean }) {
  return on ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
      <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM8.25 4.5a3.75 3.75 0 017.5 0v.458l-7.5-7.5V4.5zM15.75 9.848V12.75a3.75 3.75 0 01-6.787 2.213L7.5 13.5v-1.652l8.25 8.25V9.848zM6 10.5a.75.75 0 01.75.75v1.5c0 .68.103 1.336.294 1.953L5.5 13.16A6.716 6.716 0 015.25 12.75v-1.5A.75.75 0 016 10.5z" />
    </svg>
  )
}

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M4.5 12a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clipRule="evenodd" />
    </svg>
  )
}

function MuteIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM8.25 4.5a3.75 3.75 0 017.5 0v.458l-7.5-7.5V4.5z" />
    </svg>
  )
}

function KickIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
  )
}

function BanIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
    </svg>
  )
}
