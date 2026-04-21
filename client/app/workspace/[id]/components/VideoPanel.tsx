'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
}

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

export default function VideoPanel({
  socket,
  participants,
  currentUserId,
}: VideoPanelProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  )
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
  const localVideoRef = useRef<HTMLVideoElement>(null)
  // Keep a ref to localStream so callbacks always have the latest value
  // without needing it as a useCallback/useEffect dependency
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioMeterRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Attach local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // When localStream becomes available, add its tracks to any existing peer connections
  // and renegotiate so the remote peer gets audio+video
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

      // Forward ICE candidates to the remote peer via signaling server
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('webrtc:ice-candidate', {
            targetUserId: remoteUserId,
            candidate: event.candidate,
          })
        }
      }

      // When a remote track arrives, add it to remoteStreams state
      pc.ontrack = (event) => {
        const [stream] = event.streams
        if (stream) {
          setRemoteStreams((prev) => {
            const next = new Map(prev)
            next.set(remoteUserId, stream)
            return next
          })
        }
      }

      // Add local tracks using the ref — always has the latest stream
      // even if getUserMedia hasn't resolved yet when this is first called
      const stream = localStreamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream)
        })
      }

      peerConnections.current.set(remoteUserId, pc)
      return pc
    },
    [socket] // no longer depends on localStream — uses ref instead
  )

  // Close and clean up a peer connection
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

  // Acquire local media on mount
  useEffect(() => {
    let stream: MediaStream | null = null

    async function getMedia() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        localStreamRef.current = stream
        setLocalStream(stream)
        setMediaError(null)
        console.log('[MEDIA] getUserMedia success — tracks:', stream.getTracks().map(t => ({
          kind: t.kind, label: t.label, enabled: t.enabled, readyState: t.readyState
        })))
      } catch (err) {
        const error = err as Error
        console.error('[MEDIA] getUserMedia failed:', error.name, error.message)
        if (
          error.name === 'NotAllowedError' ||
          error.name === 'PermissionDeniedError'
        ) {
          setMediaError(
            'Camera/microphone permission denied. Please allow access and reload.'
          )
        } else {
          setMediaError('Could not access camera or microphone.')
        }
      }
    }

    getMedia()

    return () => {
      stream?.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }
  }, [])

  // Audio loudness meter — logs score 1-10 every second
  useEffect(() => {
    if (!localStream) return

    const audioTracks = localStream.getAudioTracks()
    if (audioTracks.length === 0) {
      console.warn('[AUDIO METER] No audio tracks in stream')
      return
    }

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
        // avg is 0-255, map to 1-10
        const score = Math.max(1, Math.min(10, Math.round((avg / 255) * 10) || 1))
        if (avg > 5) {
          console.log(`[AUDIO METER] Loudness score: ${score}/10 (raw avg: ${avg.toFixed(1)})`)
        }
      }, 1000)

      console.log('[AUDIO METER] Started monitoring audio loudness')
    } catch (err) {
      console.error('[AUDIO METER] Failed to start audio meter:', err)
    }

    return () => {
      if (audioMeterRef.current) clearInterval(audioMeterRef.current)
      audioCtx?.close()
      console.log('[AUDIO METER] Stopped')
    }
  }, [localStream])

  // Register socket event handlers for WebRTC signaling
  useEffect(() => {
    if (!socket) return

    // Server asks this client to create an offer for a specific peer
    const handleCreateOffer = async ({
      targetUserId,
    }: {
      targetUserId: string
    }) => {
      const pc = createPeerConnection(targetUserId)
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('webrtc:offer', { targetUserId, offer })
      } catch (err) {
        console.error('Error creating offer:', err)
      }
    }

    // Received an offer from a remote peer — create answer
    const handleOffer = async ({
      fromUserId,
      offer,
    }: {
      fromUserId: string
      offer: RTCSessionDescriptionInit
    }) => {
      const pc = createPeerConnection(fromUserId)
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('webrtc:answer', { targetUserId: fromUserId, answer })
      } catch (err) {
        console.error('Error handling offer:', err)
      }
    }

    // Received an answer — set remote description on existing connection
    const handleAnswer = async ({
      fromUserId,
      answer,
    }: {
      fromUserId: string
      answer: RTCSessionDescriptionInit
    }) => {
      const pc = peerConnections.current.get(fromUserId)
      if (!pc) return
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
      } catch (err) {
        console.error('Error handling answer:', err)
      }
    }

    // Received an ICE candidate from a remote peer
    const handleIceCandidate = async ({
      fromUserId,
      candidate,
    }: {
      fromUserId: string
      candidate: RTCIceCandidateInit
    }) => {
      const pc = peerConnections.current.get(fromUserId)
      if (!pc) return
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (err) {
        console.error('Error adding ICE candidate:', err)
      }
    }

    // A peer disconnected — clean up their connection
    const handlePeerDisconnected = ({ userId }: { userId: string }) => {
      closePeerConnection(userId)
    }

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

  // Clean up all peer connections on unmount
  useEffect(() => {
    return () => {
      peerConnections.current.forEach((pc) => pc.close())
      peerConnections.current.clear()
    }
  }, [])

  // Toggle video track on/off
  const toggleVideo = async () => {
    const stream = localStreamRef.current
    if (!stream) return
    const newEnabled = !isVideoEnabled

    if (!newEnabled) {
      console.log('[VIDEO] Turning OFF camera')
      const tracks = stream.getVideoTracks()
      console.log(`[VIDEO] Found ${tracks.length} video track(s):`, tracks.map(t => ({
        id: t.id, label: t.label, enabled: t.enabled, readyState: t.readyState
      })))
      tracks.forEach((t) => {
        t.enabled = false
        t.stop()
        console.log(`[VIDEO] Track stopped — readyState: ${t.readyState}`)
      })
      setIsVideoEnabled(false)
      console.log('[VIDEO] Camera OFF complete')
    } else {
      console.log('[VIDEO] Turning ON camera — requesting new getUserMedia')
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true })
        const newVideoTrack = newStream.getVideoTracks()[0]
        console.log('[VIDEO] Got new video track:', {
          id: newVideoTrack.id,
          label: newVideoTrack.label,
          readyState: newVideoTrack.readyState,
          enabled: newVideoTrack.enabled,
        })

        // Replace track in all peer connections
        peerConnections.current.forEach((pc, userId) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
          if (sender) {
            sender.replaceTrack(newVideoTrack)
            console.log(`[VIDEO] replaceTrack called for peer: ${userId}`)
          } else {
            console.warn(`[VIDEO] No video sender found for peer: ${userId}`)
          }
        })

        // Replace track in local stream
        stream.getVideoTracks().forEach((t) => stream.removeTrack(t))
        stream.addTrack(newVideoTrack)

        // Re-attach to local video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
          console.log('[VIDEO] Re-attached stream to local video element')
        }

        setIsVideoEnabled(true)
        console.log('[VIDEO] Camera ON complete')
      } catch (err) {
        console.error('[VIDEO] Failed to re-enable video:', err)
      }
    }

    socket?.emit('media:state', { isVideoEnabled: newEnabled, isAudioEnabled })
  }

  // Toggle audio track on/off
  const toggleAudio = () => {
    const stream = localStreamRef.current
    if (!stream) return
    const audioTrack = stream.getAudioTracks()[0]
    if (!audioTrack) {
      console.warn('[AUDIO] No audio track found in stream')
      return
    }
    const newEnabled = !isAudioEnabled
    audioTrack.enabled = newEnabled
    console.log(`[AUDIO] Mic ${newEnabled ? 'UNMUTED' : 'MUTED'} — track:`, {
      id: audioTrack.id,
      label: audioTrack.label,
      enabled: audioTrack.enabled,
      readyState: audioTrack.readyState,
      muted: audioTrack.muted,
    })
    setIsAudioEnabled(newEnabled)
    socket?.emit('media:state', { isVideoEnabled, isAudioEnabled: newEnabled })
  }

  // Find participant name for a given userId
  const getParticipantName = (userId: string): string => {
    const p = participants.find((p) => p.userId === userId)
    return p?.name ?? userId
  }

  // Current user's own name
  const currentUserName =
    participants.find((p) => p.userId === currentUserId)?.name ?? 'You'

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
          Video
        </h2>
      </div>

      {/* Permission error banner */}
      {mediaError && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-900/60 border border-red-700 rounded text-sm text-red-300">
          {mediaError}
        </div>
      )}

      {/* Video grid */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-3 content-start">
        {/* Local video tile */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
          {localStream && isVideoEnabled ? (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center">
                <span className="text-lg font-bold text-white">
                  {currentUserName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
          {/* Name overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent">
            <span className="text-xs text-white font-medium truncate block">
              {currentUserName} (You)
            </span>
          </div>
          {/* Muted indicator */}
          {!isAudioEnabled && (
            <div className="absolute top-2 right-2 bg-red-600 rounded-full p-1">
              <MicOffIcon className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Remote video tiles */}
        {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
          <RemoteVideoTile
            key={userId}
            userId={userId}
            stream={stream}
            name={getParticipantName(userId)}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t border-gray-700 flex-shrink-0 flex items-center justify-center gap-4">
        {/* Audio toggle */}
        <button
          onClick={toggleAudio}
          aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          className={`p-3 rounded-full transition-colors ${
            isAudioEnabled
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
        >
          {isAudioEnabled ? (
            <MicIcon className="w-5 h-5" />
          ) : (
            <MicOffIcon className="w-5 h-5" />
          )}
        </button>

        {/* Video toggle */}
        <button
          onClick={toggleVideo}
          aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          className={`p-3 rounded-full transition-colors ${
            isVideoEnabled
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
        >
          {isVideoEnabled ? (
            <VideoIcon className="w-5 h-5" />
          ) : (
            <VideoOffIcon className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Remote Video Tile ────────────────────────────────────────────────────────

interface RemoteVideoTileProps {
  userId: string
  stream: MediaStream
  name: string
}

function RemoteVideoTile({ stream, name }: RemoteVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      {/* Name overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent">
        <span className="text-xs text-white font-medium truncate block">
          {name}
        </span>
      </div>
    </div>
  )
}

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
      <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
    </svg>
  )
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M8.25 4.5a3.75 3.75 0 117.5 0v.75l-7.5-7.5V4.5zM15.75 9.75v3a3.75 3.75 0 01-6.99 1.875L6.53 12.396A6.75 6.75 0 0018 12.75v-1.5a.75.75 0 00-1.5 0v.75a5.25 5.25 0 01-5.25 5.25 5.207 5.207 0 01-1.875-.348l-1.11-1.11A6.713 6.713 0 006.75 12.75v-1.5a.75.75 0 00-1.5 0v1.5a8.25 8.25 0 006 7.956v1.794h-3a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-3v-1.794a8.25 8.25 0 006-7.956v-1.5a.75.75 0 00-1.5 0v1.5zM3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18z" />
    </svg>
  )
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
    </svg>
  )
}

function VideoOffIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.5 17.69c0 .471-.202.902-.52 1.206l-5.98-5.98V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38zM15.75 7.5v5.068L7.682 4.5h5.068a3 3 0 013 3zM1.5 7.5c0-1.036.84-1.875 1.875-1.875H4.5v.375a.75.75 0 001.5 0V5.625h.375a.75.75 0 000-1.5H3.375A3.375 3.375 0 000 7.5v9a3.375 3.375 0 003.375 3.375h9a3.375 3.375 0 003.375-3.375v-.375a.75.75 0 00-1.5 0v.375a1.875 1.875 0 01-1.875 1.875h-9A1.875 1.875 0 011.5 16.5v-9z" />
    </svg>
  )
}
