# LIGMA — Let's Integrate Groups, Manage Anything

> A real-time collaborative workspace that bridges ideation and execution — built for DevDay '26 Hackathon

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=flat-square&logo=socket.io&logoColor=white)
![Yjs](https://img.shields.io/badge/Yjs-CRDT-6B46C1?style=flat-square)
![MySQL](https://img.shields.io/badge/MySQL-8.0+-4479A1?style=flat-square&logo=mysql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript&logoColor=white)

</div>

---

## What is LIGMA?

Modern remote teams juggle fragmented toolchains — a whiteboard for ideas, a task manager for execution, a chat tool for decisions. LIGMA collapses all three into one real-time workspace.

Teams brainstorm on a **shared infinite canvas**. As they write, an **AI layer automatically classifies intent** — action item, decision, open question, or reference — and instantly populates a live **Task Board**, no copy-paste required.

---

## Features

### 🎨 Infinite Collaborative Canvas
- Sticky notes with drag-and-drop repositioning
- Double-click any node to edit text inline
- Right-click context menu to lock or delete nodes
- Color-coded nodes by AI-detected intent
- Click anywhere on the empty canvas to create a new node

### 🤖 AI Intent Extraction
- Every node is automatically classified as: `action_item`, `decision`, `question`, or `reference`
- Action items and decisions instantly appear on the Task Board
- Clicking a task scrolls and highlights the originating canvas node
- Classification runs client-side (zero latency) with an optional TypeScript microservice for higher accuracy

### 👥 Real-Time Presence
- Live cursor tracking for every connected user with name labels
- Presence chips show all active users and their roles in the sidebar
- Cursors update smoothly (50ms throttle)

### 🔒 Node-Level Access Control (RBAC)
- Three roles: **Lead** → **Contributor** → **Viewer**
- Individual nodes can be locked to a minimum role by a Lead
- Enforced **server-side** on every WebSocket mutation — not just in the UI
- Bypassing the UI with a raw WebSocket message is blocked at the server

### 📋 Append-Only Event Log
- Every canvas mutation is stored as an immutable, sequenced event in MySQL
- Viewable live in the Event Log sidebar panel
- Events are never updated or deleted — full audit trail preserved

### 🔌 Resilient WebSocket Management
- Socket.IO with WebSocket + polling fallback
- Automatic reconnection (up to 10 attempts)
- On reconnect, server replays only the **missed events** since the client's last known `seq` — no full re-sync needed

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser                              │
│                                                              │
│   ┌─────────────────┐  ┌───────────────┐  ┌──────────────┐  │
│   │  Infinite Canvas │  │  Task Board   │  │  Event Log   │  │
│   │  (Yjs Y.Map)    │  │  (AI results) │  │  (seq log)   │  │
│   └────────┬────────┘  └───────────────┘  └──────────────┘  │
└────────────│─────────────────────────────────────────────────┘
             │  Socket.IO  (WebSocket / polling fallback)
┌────────────▼─────────────────────────────────────────────────┐
│                   Backend  (Node.js)                         │
│                                                              │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  Socket.IO   │  │   Yjs Server    │  │   REST API     │  │
│  │  Event Bus   │  │  (CRDT Y.Doc)   │  │  /api/rooms/…  │  │
│  └──────┬───────┘  └────────┬────────┘  └───────┬────────┘  │
│         └──────────────────┬┴───────────────────┘           │
│                            │                                 │
│               ┌────────────▼──────────────┐                 │
│               │           MySQL            │                 │
│               │  rooms · canvas_nodes      │                 │
│               │  event_logs · tasks        │                 │
│               │  room_members · node_perms │                 │
│               └───────────────────────────┘                 │
└──────────────────────────────────────────────────────────────┘
             │  HTTP POST /classify
┌────────────▼─────────────────────────────────────────────────┐
│              AI Service  (TypeScript / Express)               │
│         Keyword + semantic intent classifier                  │
│         action_item │ decision │ question │ reference         │
└───────────────────────────────────────────────────────────────┘
```

---

## Key Technical Decisions

### 1. Conflict Resolution — Yjs CRDT
When two users edit the same canvas node simultaneously, **Yjs** (a Conflict-free Replicated Data Type library) ensures both changes are merged deterministically — no "last write wins". The server holds an authoritative `Y.Doc`; clients sync via a three-step handshake:

```
Client joins     →  server sends yjs:fullState
Client sends     →  yjs:sync (with its state vector)
Server replies   →  yjs:syncReply (delta only)
After this, local changes forward as incremental yjs:update deltas
```

Yjs state is also persisted to MySQL (`rooms.yjs_state`) so room content survives server restarts.

### 2. Node-Level RBAC
Most apps enforce permissions at the room level. LIGMA enforces permissions **per canvas node**. Each node can carry a `min_role` stored in `node_permissions`. The server validates every write operation (`NODE_UPDATE`, `NODE_DELETE`, `NODE_MOVE`) against this ACL before broadcasting — client-side guards are just a UX hint.

### 3. Append-Only Event Log
Every mutation is **inserted** into `event_logs` — never updated or deleted. Each event carries a monotonic `seq` counter. Clients store their last seen `seq` and send it on reconnect so the server can replay only the delta.

### 4. AI Intent Classification
The client-side classifier uses keyword + pattern matching for zero-latency results. The optional TypeScript microservice (`/ai-service`) exposes a `POST /classify` REST endpoint that can be swapped in for higher-accuracy classification without changing the frontend.

---

## Project Structure

```
ligma/
├── backend/
│   ├── server.js          ← Main server (Express + Socket.IO + Yjs + MySQL)
│   ├── package.json
│   └── .env.example       ← Copy to .env and fill in DB credentials
├── frontend/
│   └── index.html         ← Full SPA — no build step required
├── ai-service/
│   ├── src/
│   │   └── index.ts       ← TypeScript intent classification REST API
│   ├── package.json
│   └── tsconfig.json
├── schema.sql             ← MySQL schema (run once to set up tables)
├── render.yaml            ← One-click Render.com deployment config
└── README.md
```

---

## Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- [MySQL](https://dev.mysql.com/downloads/installer/) 8.0 or higher

### 1. Clone the repo

```bash
git clone https://github.com/your-username/ligma.git
cd ligma
```

### 2. Set up the database

```bash
mysql -u root -p -e "CREATE DATABASE ligma_db;"
mysql -u root -p ligma_db < schema.sql
```

### 3. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ligma_db
PORT=3000
```

### 4. Install & start the backend

```bash
npm install
npm run dev
```

You should see:
```
✅ MySQL database initialized
🚀 LIGMA → http://localhost:3000
```

### 5. Open the app

Go to **http://localhost:3000** — the backend serves the frontend automatically. No separate build step or dev server needed.

### 6. (Optional) Run the AI microservice

```bash
cd ../ai-service
npm install
npm run dev    # starts on port 3001
```

### Testing multi-user sync locally

Open **two browser tabs** at `http://localhost:3000`. Join the same room with different names and roles. You will see live cursors, CRDT conflict resolution, role-based permissions, and the task board updating in real time across both tabs.

---

## REST API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/rooms/:room/events?since=N` | Fetch all events after sequence N |
| `GET` | `/api/rooms/:room/presence` | Currently online users |
| `GET` | `/api/rooms/:room/state` | Base64-encoded Yjs document state |
| `GET` | `/api/rooms/:room/tasks` | All tasks for a room |
| `GET` | `/api/rooms/:room/nodes` | All canvas nodes for a room |

---

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `joinRoom` | C → S | Join a room with `userId`, `role`, `lastSeq` |
| `joinedRoom` | S → C | Acknowledgement with `currentSeq` |
| `yjs:fullState` | S → C | Full Yjs document state on join |
| `yjs:sync` | C → S | Client sends state vector for delta sync |
| `yjs:syncReply` | S → C | Delta since client's state vector |
| `yjs:update` | Both | Incremental CRDT update |
| `canvas:event` | C → S | `NODE_CREATE` / `UPDATE` / `DELETE` / `MOVE` |
| `canvas:ack` | S → C | Event acknowledgement with seq number |
| `cursor:move` | C → S | Cursor position (throttled 50ms) |
| `cursor:update` | S → C | Peer cursor position |
| `cursor:remove` | S → C | Peer disconnected — remove cursor |
| `presence:update` | S → C | Full presence list for the room |
| `ai:classification` | Both | Intent classification result |
| `node:setACL` | C → S | Lock node to `minRole` (lead only) |
| `node:aclUpdate` | S → C | Broadcast ACL change to room |
| `eventReplay` | S → C | Missed events replayed on reconnect |
| `error` | S → C | Permission denied or CRDT error |

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `rooms` | Room name + persisted Yjs binary state |
| `room_members` | User ↔ room ↔ role mapping |
| `canvas_nodes` | All sticky notes with position, intent, author |
| `node_permissions` | Per-node minimum role ACL |
| `tasks` | Auto-generated from AI-classified nodes |
| `event_logs` | **Append-only** audit log of every canvas mutation |

---

## Deployment on Render

This repo includes a `render.yaml` Blueprint that configures everything automatically.

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New → Blueprint**
3. Connect your GitHub repo — Render will create the backend service and database automatically
4. Set `NODE_ENV=production` in the environment variables panel

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| HTTP + WebSocket | Express 4 + Socket.IO 4 |
| CRDT sync | Yjs 13 |
| Database | MySQL 8 via `mysql2` |
| AI service | TypeScript + Express |
| Frontend | Vanilla JS + HTML Canvas (no framework, no build step) |
| Deployment | Render.com |

---

## Team

Built at **DevDay '26 Hackathon** — Dev & Design Society

---

## License

MIT
