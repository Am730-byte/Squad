'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import Link from 'next/link'

interface DMUser {
  id: string
  name: string
  email: string
  image: string | null
}

interface DMMessage {
  id: string
  content: string
  senderId: string
  receiverId: string
  createdAt: string
  sender: { id: string; name: string; image: string | null }
}

interface Conversation {
  user: DMUser
  lastMessage: { content: string; createdAt: string; fromMe: boolean }
}

export default function DMPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [socket, setSocket] = useState<Socket | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedUser, setSelectedUser] = useState<DMUser | null>(null)
  const [messages, setMessages] = useState<DMMessage[]>([])
  const [input, setInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DMUser[]>([])
  const [searching, setSearching] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  // Get token and connect socket
  useEffect(() => {
    if (status !== 'authenticated') return

    fetch('/api/socket/token')
      .then(r => r.json())
      .then(({ token: t }) => {
        setToken(t)
        const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
          auth: { token: t },
          // No workspaceId - this is a DM-only connection
        })
        setSocket(s)
        return t
      })
      .catch(console.error)

    return () => {
      setSocket(prev => { prev?.disconnect(); return null })
    }
  }, [status])

  // Listen for incoming DMs
  useEffect(() => {
    if (!socket) return

    socket.on('dm:message', (msg: DMMessage) => {
      // If this message is part of the current conversation, add it
      if (
        selectedUser &&
        (msg.senderId === selectedUser.id || msg.receiverId === selectedUser.id)
      ) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      }

      // Update conversations list
      setConversations(prev => {
        const partnerId = msg.senderId === session?.user?.id ? msg.receiverId : msg.senderId
        const partnerName = msg.senderId === session?.user?.id
          ? (selectedUser?.name ?? 'Unknown')
          : msg.sender.name

        const existing = prev.find(c => c.user.id === partnerId)
        if (existing) {
          return prev.map(c =>
            c.user.id === partnerId
              ? { ...c, lastMessage: { content: msg.content, createdAt: msg.createdAt, fromMe: msg.senderId === session?.user?.id } }
              : c
          )
        }
        return [{
          user: { id: partnerId, name: partnerName, email: '', image: msg.sender.image },
          lastMessage: { content: msg.content, createdAt: msg.createdAt, fromMe: msg.senderId === session?.user?.id },
        }, ...prev]
      })
    })

    return () => { socket.off('dm:message') }
  }, [socket, selectedUser, session])

  // Fetch conversations on load
  useEffect(() => {
    if (!token) return
    fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL}/api/dm/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setConversations)
      .catch(console.error)
  }, [token])

  // Fetch messages when selecting a user
  useEffect(() => {
    if (!token || !selectedUser) return
    fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL}/api/dm/${selectedUser.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setMessages)
      .catch(console.error)
  }, [token, selectedUser])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Search users with debounce
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    searchTimeout.current = setTimeout(() => {
      fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL}/api/dm/users/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(setSearchResults)
        .catch(console.error)
        .finally(() => setSearching(false))
    }, 300)
  }, [searchQuery, token])

  function sendMessage() {
    if (!input.trim() || !selectedUser || !socket) return
    socket.emit('dm:send', { receiverId: selectedUser.id, content: input.trim() })
    setInput('')
  }

  function selectUser(user: DMUser) {
    setSelectedUser(user)
    setMessages([])
    setSearchQuery('')
    setSearchResults([])
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400">
        Loading…
      </div>
    )
  }

  const currentUserId = session?.user?.id

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Direct Messages</h1>
            <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              ← Dashboard
            </Link>
          </div>
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Find or start a conversation"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {/* Search results dropdown */}
            {(searchResults.length > 0 || searching) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 overflow-hidden">
                {searching && (
                  <div className="px-3 py-2 text-xs text-gray-500">Searching…</div>
                )}
                {searchResults.map(user => (
                  <button
                    key={user.id}
                    onClick={() => selectUser(user)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 transition-colors text-left"
                  >
                    <Avatar name={user.name} image={user.image} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <p className="px-4 py-6 text-xs text-gray-600 text-center">
              No conversations yet.<br />Search for someone to start chatting.
            </p>
          ) : (
            conversations.map(({ user, lastMessage }) => (
              <button
                key={user.id}
                onClick={() => selectUser(user)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 transition-colors text-left ${
                  selectedUser?.id === user.id ? 'bg-gray-800' : ''
                }`}
              >
                <Avatar name={user.name} image={user.image} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {lastMessage.fromMe ? 'You: ' : ''}{lastMessage.content}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            {/* Chat header */}
            <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3 bg-gray-900 flex-shrink-0">
              <Avatar name={selectedUser.name} image={selectedUser.image} size="md" />
              <div>
                <p className="font-semibold text-white">{selectedUser.name}</p>
                {selectedUser.email && (
                  <p className="text-xs text-gray-500">{selectedUser.email}</p>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Avatar name={selectedUser.name} image={selectedUser.image} size="lg" />
                  <p className="mt-3 font-semibold text-white">{selectedUser.name}</p>
                  <p className="text-sm text-gray-500 mt-1">This is the beginning of your conversation.</p>
                </div>
              )}
              {messages.map(msg => {
                const isMe = msg.senderId === currentUserId
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isMe && (
                      <Avatar name={msg.sender.name} image={msg.sender.image} size="sm" />
                    )}
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-gray-800 bg-gray-900 flex-shrink-0">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder={`Message ${selectedUser.name}`}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">Your Messages</h2>
            <p className="text-sm text-gray-500">Search for someone above to start a conversation.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Avatar({ name, image, size }: { name: string; image: string | null | undefined; size: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-9 h-9 text-sm'
  if (image) {
    return <img src={image} alt={name} className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />
  }
  return (
    <div className={`${sizeClass} rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}
