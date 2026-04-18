import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center flex flex-col items-center gap-8">
        {/* Logo / Title */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-3xl">
            💬
          </div>
          <h1 className="text-5xl font-bold tracking-tight">ChatApp</h1>
          <p className="text-gray-400 text-lg max-w-md">
            Real-time collaboration with chat, video, and a shared whiteboard — all in one workspace.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 w-full text-sm text-gray-400">
          <div className="bg-gray-900 rounded-xl p-4 flex flex-col items-center gap-2 border border-gray-800">
            <span className="text-2xl">💬</span>
            <span className="font-medium text-white">Real-time Chat</span>
            <span>Instant messaging with history</span>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 flex flex-col items-center gap-2 border border-gray-800">
            <span className="text-2xl">🎥</span>
            <span className="font-medium text-white">Video Calls</span>
            <span>Peer-to-peer video & audio</span>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 flex flex-col items-center gap-2 border border-gray-800">
            <span className="text-2xl">🎨</span>
            <span className="font-medium text-white">Whiteboard</span>
            <span>Collaborative drawing canvas</span>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Link
            href="/login"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-center"
          >
            Get Started
          </Link>
          <Link
            href="/dashboard"
            className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-center border border-gray-700"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
