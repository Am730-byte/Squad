'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

async function getAuthToken(): Promise<string | null> {
  const res = await fetch('/api/socket/token')
  if (!res.ok) return null
  const data = await res.json()
  return data.token ?? null
}

export default function JoinWorkspaceForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')
  const [idError, setIdError] = useState('')
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    if (!workspaceId.trim()) {
      setIdError('Workspace ID is required.')
      return false
    }
    setIdError('')
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')

    if (!validate()) return

    setLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) {
        setServerError('Unable to authenticate. Please refresh and try again.')
        return
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL}/api/workspaces/${workspaceId.trim()}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.status === 404) {
        setServerError('Workspace not found. Check the ID and try again.')
        return
      }

      if (res.status === 409) {
        setServerError('You are already a member of this workspace.')
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setServerError(data.error ?? `Request failed (${res.status}).`)
        return
      }

      // Success — close modal and refresh workspace list
      handleClose()
      router.refresh()
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setWorkspaceId('')
    setIdError('')
    setServerError('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        Join Workspace
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose()
          }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-semibold text-white mb-5">Join Workspace</h2>

            <form onSubmit={handleSubmit} noValidate>
              {/* Workspace ID */}
              <div className="mb-5">
                <label
                  htmlFor="jw-id"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Workspace ID <span className="text-red-400">*</span>
                </label>
                <input
                  id="jw-id"
                  type="text"
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  placeholder="e.g. 01234567-89ab-cdef-0123-456789abcdef"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono"
                />
                {idError && (
                  <p className="mt-1 text-xs text-red-400">{idError}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Ask a workspace member to share the workspace ID with you.
                </p>
              </div>

              {/* Server error */}
              {serverError && (
                <p className="mb-4 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                  {serverError}
                </p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                >
                  {loading ? 'Joining…' : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
