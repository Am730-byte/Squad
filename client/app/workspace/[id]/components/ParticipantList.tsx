'use client'

interface Participant {
  userId: string
  socketId: string
  name: string
  image: string
  joinedAt: Date
  isVideoEnabled: boolean
  isAudioEnabled: boolean
}

interface ParticipantListProps {
  participants: Participant[]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function ParticipantList({ participants }: ParticipantListProps) {
  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
          Participants
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {participants.length} online
        </p>
      </div>

      {/* Participant list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {participants.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-8">
            No participants yet.
          </p>
        )}
        {participants.map((participant) => (
          <div
            key={participant.userId}
            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center overflow-hidden">
                {participant.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={participant.image}
                    alt={participant.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold text-white">
                    {getInitials(participant.name)}
                  </span>
                )}
              </div>
              {/* Online indicator */}
              <span
                className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-gray-900"
                aria-label="Online"
              />
            </div>

            {/* Name and media state */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">
                {participant.name}
              </p>
            </div>

            {/* Video / Audio indicators */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Video indicator */}
              <span
                title={participant.isVideoEnabled ? 'Camera on' : 'Camera off'}
                aria-label={participant.isVideoEnabled ? 'Camera on' : 'Camera off'}
                className={
                  participant.isVideoEnabled
                    ? 'text-green-400'
                    : 'text-gray-600'
                }
              >
                {participant.isVideoEnabled ? (
                  /* Camera on icon */
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                    aria-hidden="true"
                  >
                    <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
                  </svg>
                ) : (
                  /* Camera off icon */
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                    aria-hidden="true"
                  >
                    <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.5 17.69c0 .471-.202.86-.504 1.124l-4.746-4.746V7.939l2.69-2.689c.944-.945 2.56-.276 2.56 1.06v11.38zM15.75 7.5v5.068L7.682 4.5h4.068a3 3 0 013 3zM1.5 7.5c0-1.036.84-1.875 1.875-1.875H4.5v.375a.75.75 0 001.5 0V5.625h.375a.75.75 0 000-1.5H3.375A3.375 3.375 0 000 7.5v9a3.375 3.375 0 003.375 3.375h8.25a3.375 3.375 0 003.375-3.375v-.375a.75.75 0 00-1.5 0v.375a1.875 1.875 0 01-1.875 1.875h-8.25A1.875 1.875 0 011.5 16.5v-9z" />
                  </svg>
                )}
              </span>

              {/* Audio indicator */}
              <span
                title={participant.isAudioEnabled ? 'Mic on' : 'Mic off'}
                aria-label={participant.isAudioEnabled ? 'Mic on' : 'Mic off'}
                className={
                  participant.isAudioEnabled
                    ? 'text-green-400'
                    : 'text-gray-600'
                }
              >
                {participant.isAudioEnabled ? (
                  /* Mic on icon */
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                    aria-hidden="true"
                  >
                    <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                    <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                  </svg>
                ) : (
                  /* Mic off icon */
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                    aria-hidden="true"
                  >
                    <path d="M8.25 4.5a3.75 3.75 0 117.5 0v.458l-7.5-7.5V4.5zM15.75 9.848V12.75a3.75 3.75 0 01-6.787 2.213L7.5 13.5v-1.652l8.25 8.25V9.848zM3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM6 10.5a.75.75 0 01.75.75v1.5c0 .68.103 1.336.294 1.953L5.5 13.16A6.716 6.716 0 015.25 12.75v-1.5A.75.75 0 016 10.5zM12 19.5a6.751 6.751 0 006-6.709v-1.5a.75.75 0 011.5 0v1.5a8.251 8.251 0 01-7.5 8.2v2.3h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.3a8.251 8.251 0 01-1.5-.491z" />
                  </svg>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
