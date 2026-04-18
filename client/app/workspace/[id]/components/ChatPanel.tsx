'use client'

import { useEffect, useRef, useState } from 'react'
import { Socket } from 'socket.io-client'

interface ChatMessage {
  id: string
  content: string
  userId: string
  createdAt: string | Date
  user: { id: string; name: string; image: string | null }
}

interface ChatPanelProps {
  socket: Socket | null
  workspaceId: string
}

export default function ChatPanel({ socket, workspaceId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!socket) return

    const handleHistory = (history: ChatMessage[]) => {
      setMessages(history)
    }

    const handleMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev, message])
    }

    socket.on('chat:history', handleHistory)
    socket.on('chat:message', handleMessage)

    return () => {
      socket.off('chat:history', handleHistory)
      socket.off('chat:message', handleMessage)
    }
  }, [socket])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    const trimmed = inputValue.trim()
    if (!trimmed || !socket) return
    socket.emit('chat:message', { content: trimmed })
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
          # chat
        </h2>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-8">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start gap-3 group">
            {/* Avatar */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center overflow-hidden">
              {msg.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={msg.user.image}
                  alt={msg.user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-white">
                  {msg.user.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Message body */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-indigo-300">
                  {msg.user.name}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-200 break-words mt-0.5">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message…"
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || !socket}
            className="flex-shrink-0 text-indigo-400 hover:text-indigo-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-1 ml-1">
          Press Enter to send
        </p>
      </div>
    </div>
  )
}
