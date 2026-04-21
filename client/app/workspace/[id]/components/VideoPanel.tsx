'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Socket } from 'socket.io-client'

interface Participant {
  userId: string
  name: string
  image: string
  isVideoEnabled: boolean
  isAudioEnabled: boolean
}

interface VideoPanelProps {
  socket: Socket | null
  participants: Participant[]
  currentUserId: string
  initialVideoEnabled?: boolean
  initialAudioEnabled?: boolean
  onVideoToggle?: (enabled: boolean) => void
  onAudioToggle?: (enabled: boolean) => void
}

export interface VideoPanelHandle {
  toggleVideo: () => void
  toggleAudio: () => void
}

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

const VideoPanel = forwardRef<VideoPanelHandle, VideoPanelProps>(function VideoPanel(
  { socket, participants, currentUserId, initialVideoEnabled = false, initialAudioEnabled = false, onVideoToggle, onAudioToggle },
  ref
) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialVideoEnabled)
  const [isAudioEnabled, setIsAudioEnabled] = useState(initialAudioEnabled)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioMeterRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Expose toggle functions to parent via ref
  useImperativeHandle(ref, () => ({
    toggleVideo,
    toggleAudio,
  }))

  // Attach local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // When localStream becomes available, add its tracks to any existing peer connections
  useEffect(() => {
    if (!localStream) return
    localStreamRef.current = localStream
    peerConnections.current.forEach((pc) => {
      const existingKinds = pc.getSenders().map((s) => s.track?.kind)
      localStream.getTracks().forEach((track) => {
        if (!existingKinds.includes(track.kind)) {
          pc.addTrack(track, localStream)
        }
      })
    })
  }, [localStream])

  // Create a peer connection for a remote user
  const createPeerConnection = useCallback(
    (remoteUserId: string): RTCPeerConnection => {
      const existing = peerConnections.current.get(remoteUserId)
      if (existing) return existing

      const pc = new RTCPeerConnection(ICE_SERVERS)

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('webrtc:ice-candidate', { targetUserId: remoteUserId, candidate: event.candidate })
        }
      }

      pc.ontrack = (event) => {
        const [stream] = event.streams
        console.log(`[WEBRTC] ontrack from ${remoteUserId} — kind: ${event.track.kind}`)
        if (stream) {
          setRemoteStreams((prev) => {
            const next = new Map(prev)
            next.set(remoteUserId, stream)
            return next
          })
        }
      }

      pc.onconnectionstatechange = () => {
        console.log(`[WEBRTC] Connection state with ${remoteUserId}: ${pc.connectionState}`)
      }

      pc.oniceconnectionstatechange = () => {
        console.log(`[WEBRTC] ICE state with ${remoteUserId}: ${pc.iceConnectionState}`)
      }

      const stream = localStreamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))
      }

      peerConnections.current.set(remoteUserId, pc)
      return pc
    },
    [socket]
  )

  const closePeerConnection = useCallback((remoteUserId: string) => {
    const pc = peerConnections.current.get(remoteUserId)
    if (pc) {
      pc.close()
      peerConnections.current.delete(remoteUserId)
    }
    setRemoteStreams((prev) => {
      const next = new Map(prev)
      next.delete(remoteUserId)
      return next
    })
  }, [])

  // Acquire local media on mount — default both tracks disabled
  useEffect(() => {
    let stream: MediaStream | null = null

    async function getMedia() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        // Apply initial state
        stream.getVideoTracks().forEach((t) => { t.enabled = initialVideoEnabled })
        stream.getAudioTracks().forEach((t) => { t.enabled = initialAudioEnabled })
        localStreamRef.current = stream
        setLocalStream(stream)
        setMediaError(null)
        console.log('[MEDIA] getUserMedia success — tracks:', stream.getTracks().map(t => ({
          kind: t.kind, enabled: t.enabled, readyState: t.readyState
        })))
      } catch (err) {
        const error = err as Error
        console.error('[MEDIA] getUserMedia failed:', error.name, error.message)
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setMediaError('Camera/microphone permission denied. Please allow access and reload.')
        } else {
          setMediaError('Could not access camera or microphone.')
        }
      }
    }

    getMedia()

    return () => {
      stream?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Audio loudness meter
  useEffect(() => {
    if (!localStream) return
    if (localStream.getAudioTracks().length === 0) return

    let audioCtx: AudioContext | null = null
    let analyser: AnalyserNode | null = null

    try {
      audioCtx = new AudioContext()
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      const source = audioCtx.createMediaStreamSource(localStream)
      source.connect(analyser)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      audioMeterRef.current = setInterval(() => {
        if (!analyser) return
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const score = Math.max(1, Math.min(10, Math.round((avg / 255) * 10) || 1))
        if (avg > 5) console.log(`[AUDIO METER] Loudness: ${score}/10 (avg: ${avg.toFixed(1)})`)
      }, 1000)
    } catch (err) {
      console.error('[AUDIO METER] Failed:', err)
    }

    return () => {
      if (audioMeterRef.current) clearInterval(audioMeterRef.current)
      audioCtx?.close()
    }
  }, [localStream])

  // WebRTC signaling
  useEffect(() => {
    if (!socket) return

    const handleCreateOffer = async ({ targetUserId }: { targetUserId: string }) => {
      console.log(`[WEBRTC] create-offer for ${targetUserId}, stream:`, localStreamRef.current?.getTracks().map(t => t.kind))
      const pc = createPeerConnection(targetUserId)
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('webrtc:offer', { targetUserId, offer })
      } catch (err) { console.error('[WEBRTC] Error creating offer:', err) }
    }

    const handleOffer = async ({ fromUserId, offer }: { fromUserId: string; offer: RTCSessionDescriptionInit }) => {
      console.log(`[WEBRTC] offer from ${fromUserId}`)
      const pc = createPeerConnection(fromUserId)
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('webrtc:answer', { targetUserId: fromUserId, answer })
      } catch (err) { console.error('[WEBRTC] Error handling offer:', err) }
    }

    const handleAnswer = async ({ fromUserId, answer }: { fromUserId: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current.get(fromUserId)
      if (!pc) { console.error(`[WEBRTC] No PC for ${fromUserId} on answer`); return }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
      } catch (err) { console.error('[WEBRTC] Error handling answer:', err) }
    }

    const handleIceCandidate = async ({ fromUserId, candidate }: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current.get(fromUserId)
      if (!pc) return
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) }
      catch (err) { console.error('[WEBRTC] ICE error:', err) }
    }

    const handlePeerDisconnected = ({ userId }: { userId: string }) => closePeerConnection(userId)

    socket.on('webrtc:create-offer', handleCreateOffer)
    socket.on('webrtc:offer', handleOffer)
    socket.on('webrtc:answer', handleAnswer)
    socket.on('webrtc:ice-candidate', handleIceCandidate)
    socket.on('webrtc:peer-disconnected', handlePeerDisconnected)

    return () => {
      socket.off('webrtc:create-offer', handleCreateOffer)
      socket.off('webrtc:offer', handleOffer)
      socket.off('webrtc:answer', handleAnswer)
      socket.off('webrtc:ice-candidate', handleIceCandidate)
      socket.off('webrtc:peer-disconnected', handlePeerDisconnected)
    }
  }, [socket, createPeerConnection, closePeerConnection])

  useEffect(() => {
    return () => {
      peerConnections.current.forEach((pc) => pc.close())
      peerConnections.current.clear()
    }
  }, [])

  // Toggle video
  async function toggleVideo() {
    const stream = localStreamRef.current
    if (!stream) return
    const newEnabled = !isVideoEnabled

    if (!newEnabled) {
      stream.getVideoTracks().forEach((t) => { t.enabled = false; t.stop() })
      setIsVideoEnabled(false)
      onVideoToggle?.(false)
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true })
        const newVideoTrack = newStream.getVideoTracks()[0]

        peerConnections.current.forEach((pc, userId) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
          if (sender) { sender.replaceTrack(newVideoTrack); console.log(`[VIDEO] replaceTrack for ${userId}`) }
        })

        stream.getVideoTracks().forEach((t) => stream.removeTrack(t))
        stream.addTrack(newVideoTrack)

        const updatedStream = new MediaStream(stream.getTracks())
        localStreamRef.current = updatedStream
        setLocalStream(updatedStream)
        setIsVideoEnabled(true)
        onVideoToggle?.(true)
      } catch (err) {
        console.error('[VIDEO] Failed to re-enable:', err)
      }
    }

    socket?.emit('media:state', { isVideoEnabled: newEnabled, isAudioEnabled })
  }

  // Toggle audio
  function toggleAudio() {
    const stream = localStreamRef.current
    if (!stream) return
    const audioTrack = stream.getAudioTracks()[0]
    if (!audioTrack) return
    const newEnabled = !isAudioEnabled
    audioTrack.enabled = newEnabled
    setIsAudioEnabled(newEnabled)
    onAudioToggle?.(newEnabled)
    socket?.emit('media:state', { isVideoEnabled, isAudioEnabled: newEnabled })
  }

  const getParticipantName = (userId: string) =>
    participants.find((p) => p.userId === userId)?.name ?? userId

  const currentUserName = participants.find((p) => p.userId === currentUserId)?.name ?? 'You'

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">
      {/* Permission error */}
      {mediaError && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-900/60 border border-red-700 rounded text-sm text-red-300">
          {mediaError}
        </div>
      )}

      {/* Video grid */}
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4 content-start auto-rows-max">
        {/* Local tile */}
        <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${!isVideoEnabled ? 'hidden' : ''}`}
            style={{ transform: 'scaleX(-1)' }}
          />
          {(!localStream || !isVideoEnabled) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center">
                <span className="text-xl font-bold text-white">
                  {currentUserName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-linear-to-t from-black/70 to-transparent">
            <span className="text-xs text-white font-medium truncate block">{currentUserName} (You)</span>
          </div>
          {!isAudioEnabled && (
            <div className="absolute top-2 right-2 bg-red-600 rounded-full p-1">
              <MicOffIcon className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Remote tiles */}
        {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
          <RemoteVideoTile key={userId} userId={userId} stream={stream} name={getParticipantName(userId)} />
        ))}
      </div>
    </div>
  )
})

export default VideoPanel

// ─── Remote Video Tile ────────────────────────────────────────────────────────

function RemoteVideoTile({ stream, name }: { userId: string; stream: MediaStream; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  return (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-linear-to-t from-black/70 to-transparent">
        <span className="text-xs text-white font-medium truncate block">{name}</span>
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM8.25 4.5a3.75 3.75 0 017.5 0v.75l-7.5-7.5V4.5zM15.75 9.75v3a3.75 3.75 0 01-6.99 1.875L6.53 12.396A6.75 6.75 0 0018 12.75v-1.5a.75.75 0 00-1.5 0v.75a5.25 5.25 0 01-5.25 5.25 5.207 5.207 0 01-1.875-.348l-1.11-1.11A6.713 6.713 0 006.75 12.75v-1.5a.75.75 0 00-1.5 0v1.5a8.25 8.25 0 006 7.956v1.794h-3a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-3v-1.794a8.25 8.25 0 006-7.956v-1.5a.75.75 0 00-1.5 0v1.5z" />
    </svg>
  )
}
