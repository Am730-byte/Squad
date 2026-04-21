# Squad

A real-time collaboration platform with video calling, workspace chat, a shared whiteboard, and direct messaging.

**Live:** [squad-flame.vercel.app](https://squad-flame.vercel.app)

---

## Features

- **Google OAuth** — sign in with your Google account via NextAuth
- **Workspaces** — create or join workspaces using a workspace ID
- **Real-time chat** — persistent workspace chat with message history
- **Video calling** — peer-to-peer WebRTC video/audio with mic and camera controls
- **Participant list** — live presence with mic and camera status indicators
- **Shared whiteboard** — collaborative drawing synced in real time
- **Direct messages** — private 1:1 messaging with user search
- **Leave workspace** — cleanly disconnect and return to dashboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Auth | NextAuth v4 (Google OAuth) |
| Backend | Node.js, Express 5, Socket.IO 4 |
| Database | PostgreSQL (Neon) via Prisma ORM |
| Real-time | Socket.IO (WebSocket + polling fallback) |
| Video | WebRTC (peer-to-peer, STUN via Google) |
| Deployment | Vercel (client), Railway (server) |

---

## Project Structure

```
squad/
├── client/                  # Next.js frontend
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/        # NextAuth route handler
│   │   │   └── socket/token # Issues JWT for socket auth
│   │   ├── dashboard/       # Workspace list, create/join forms
│   │   ├── dm/              # Direct messages page
│   │   ├── login/           # Sign-in page
│   │   └── workspace/[id]/  # Workspace room
│   │       └── components/
│   │           ├── ChatPanel.tsx
│   │           ├── ParticipantList.tsx
│   │           ├── VideoPanel.tsx
│   │           └── WhiteboardPanel.tsx
│   ├── lib/
│   │   ├── auth.ts          # NextAuth config
│   │   ├── prisma.ts        # Prisma client singleton
│   │   └── validation.ts
│   └── prisma/
│       └── schema.prisma    # Shared schema (client-side Prisma)
│
└── server/                  # Express + Socket.IO backend
    ├── middleware/
    │   ├── authMiddleware.ts # REST route JWT auth
    │   └── socketAuth.ts    # Socket.IO JWT auth
    ├── routes/
    │   ├── workspaces.ts    # Workspace CRUD + membership
    │   └── dm.ts            # DM conversations, search, history
    └── src/
        ├── handlers/
        │   ├── chatHandlers.ts
        │   ├── dmHandlers.ts
        │   ├── roomHandlers.ts
        │   ├── webrtcHandlers.ts
        │   └── whiteboardHandlers.ts
        ├── roomState.ts     # In-memory participant state
        ├── server.ts        # Express app + Socket.IO setup
        └── utils/
            ├── jwt.ts
            └── validation.ts
```

---

## Data Model

```
User
 ├── ownedWorkspaces  → Workspace[]
 ├── memberships      → Membership[]
 ├── messages         → Message[]
 ├── sentDMs          → DirectMessage[]
 └── receivedDMs      → DirectMessage[]

Workspace
 ├── owner            → User
 ├── memberships      → Membership[]
 └── messages         → Message[]

Membership          (userId + workspaceId, unique)
Message             (workspace chat messages)
DirectMessage       (1:1 DMs between users)
```

---

## Local Development

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Neon free tier works)
- A Google OAuth app ([console.cloud.google.com](https://console.cloud.google.com))

### 1. Clone the repo

```bash
git clone https://github.com/your-username/squad.git
cd squad
```

### 2. Set up the server

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
DATABASE_URL="your-postgres-connection-string"
JWT_SECRET="any-random-secret-string"
PORT=3001
CLIENT_URL="http://localhost:3000"
```

Install dependencies and push the schema:

```bash
npm install
npx prisma db push
```

Start the server:

```bash
npm run dev
```

### 3. Set up the client

```bash
cd client
cp .env.example .env.local
```

Edit `client/.env.local`:

```env
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXTAUTH_SECRET="any-random-secret-string"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
JWT_SECRET="same-value-as-server-jwt-secret"
DATABASE_URL="same-postgres-connection-string-as-server"
```

Install dependencies:

```bash
npm install
```

Start the client:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Important:** `JWT_SECRET` must be identical in both `client/.env.local` and `server/.env`. The client mints a JWT for socket auth; the server verifies it.

---

## Environment Variables Reference

### Client (`client/.env.local`)

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | Random secret for NextAuth session encryption |
| `NEXTAUTH_URL` | Full URL of the client app |
| `NEXT_PUBLIC_SOCKET_URL` | URL of the backend server |
| `JWT_SECRET` | Secret for signing socket auth tokens (must match server) |
| `DATABASE_URL` | PostgreSQL connection string (used by NextAuth + Prisma) |

### Server (`server/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for verifying socket auth tokens (must match client) |
| `PORT` | Port to listen on (Railway injects this automatically) |
| `CLIENT_URL` | Full URL of the client app (used for CORS) |

---

## Deployment

### Client → Vercel

1. Push to GitHub
2. Import the repo in Vercel, set root directory to `client`
3. Add all environment variables from the client table above
4. Deploy

### Server → Railway

1. Import the repo in Railway, set root directory to `server`
2. Add all environment variables from the server table above (`PORT` is injected automatically — do not set it)
3. Railway uses `npm run build` then `npm run start`
4. After first deploy, run the database migration:

```bash
cd server
DATABASE_URL="your-production-db-url" npx prisma db push
```

---

## How It Works

### Authentication flow

1. User signs in with Google via NextAuth
2. NextAuth stores the user in the database and creates a session
3. When entering a workspace, the client fetches `/api/socket/token` which mints a short-lived JWT containing the user's ID
4. The JWT is passed as `auth.token` when connecting to Socket.IO
5. The server's `socketAuth` middleware verifies the JWT on every connection

### WebRTC flow

1. When a user joins a workspace, the server tells all existing participants to create an offer for the new user (`webrtc:create-offer`)
2. Each existing participant creates an `RTCPeerConnection`, generates an offer, and sends it via `webrtc:offer`
3. The new user receives each offer, creates an answer, and sends it back via `webrtc:answer`
4. ICE candidates are exchanged via `webrtc:ice-candidate`
5. Once ICE negotiation completes, audio/video streams flow peer-to-peer

### Socket events

| Event | Direction | Description |
|---|---|---|
| `room:state` | server → client | Current participants on join |
| `user:joined` | server → room | New participant joined |
| `user:left` | server → room | Participant disconnected |
| `chat:message` | client → server | Send a chat message |
| `chat:history` | server → client | Last 50 messages on join |
| `webrtc:create-offer` | server → client | Trigger offer creation |
| `webrtc:offer` | client → server → client | SDP offer |
| `webrtc:answer` | client → server → client | SDP answer |
| `webrtc:ice-candidate` | client → server → client | ICE candidate |
| `webrtc:peer-disconnected` | server → client | Peer left, close connection |
| `media:state` | client → server | Mic/camera toggle |
| `participant:media-state` | server → room | Broadcast media state change |
| `whiteboard:draw` | client → server → room | Whiteboard draw event |
| `dm:send` | client → server | Send a direct message |
| `dm:message` | server → client | Deliver a direct message |

---

## Known Limitations

- WebRTC uses only a STUN server (Google's public STUN). Connections behind symmetric NATs may fail. A TURN server would be needed for production reliability.
- Room state is in-memory on the server. Restarting the server clears all active participants.
- No end-to-end encryption on messages or DMs.
