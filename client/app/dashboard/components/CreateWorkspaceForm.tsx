'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

async function getAuthToken(): Promise<string | null> {
  const res = await fetch('/api/socket/token')
  if (!res.ok) return null
  const data = await res.json()
  return data.token ?? null
}

export default function CreateWorkspaceForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState('')
  const [descError, setDescError] = useState('')
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    let valid = true

    if (!name.trim()) {
      setNameError('Workspace name is required.')
      valid = false
    } else if (name.trim().length > 100) {
      setNameError('Workspace name must be 100 characters or fewer.')
      valid = false
    } else {
      setNameError('')
    }

    if (description.length > 500) {
      setDescError('Description must be 500 characters or fewer.')
      valid = false
    } else {
      setDescError('')
    }

    return valid
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

      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      })

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
    setName('')
    setDescription('')
    setNameError('')
    setDescError('')
    setServerError('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        Create Workspace
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose()
          }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-semibold text-white mb-5">Create Workspace</h2>

            <form onSubmit={handleSubmit} noValidate>
              {/* Name */}
              <div className="mb-4">
                <label
                  htmlFor="cw-name"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="cw-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  placeholder="My Workspace"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
                {nameError && (
                  <p className="mt-1 text-xs text-red-400">{nameError}</p>
                )}
                <p className="mt-1 text-xs text-gray-500 text-right">
                  {name.length}/100
                </p>
              </div>

              {/* Description */}
              <div className="mb-5">
                <label
                  htmlFor="cw-description"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Description{' '}
                  <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  id="cw-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="What is this workspace for?"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none"
                />
                {descError && (
                  <p className="mt-1 text-xs text-red-400">{descError}</p>
                )}
                <p className="mt-1 text-xs text-gray-500 text-right">
                  {description.length}/500
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
                  {loading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
