const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Y = require("yjs");
const { Pool } = require("pg");
const path = require("path");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ─────────────────────────────────────────────────────────────
// DATABASE SETUP
// ─────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function dbQuery(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function initDB() {
  try {
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        yjs_state BYTEA,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS room_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_name TEXT NOT NULL,
        room_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'contributor',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_name, room_name)
      );

      CREATE TABLE IF NOT EXISTS canvas_nodes (
        id TEXT PRIMARY KEY,
        room_name TEXT NOT NULL,
        type TEXT DEFAULT 'sticky',
        data JSONB,
        position JSONB,
        intent TEXT DEFAULT 'none',
        author TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS node_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        node_id TEXT REFERENCES canvas_nodes(id) ON DELETE CASCADE,
        min_role TEXT NOT NULL DEFAULT 'contributor',
        UNIQUE(node_id)
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_name TEXT NOT NULL,
        node_id TEXT,
        title TEXT NOT NULL,
        intent TEXT DEFAULT 'action_item',
        author TEXT,
        status TEXT DEFAULT 'TODO',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS event_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seq SERIAL,
        room_name TEXT NOT NULL,
        user_name TEXT,
        type TEXT NOT NULL,
        node_id TEXT,
        payload JSONB,
        server_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_event_logs_room ON event_logs(room_name, seq);
      CREATE INDEX IF NOT EXISTS idx_canvas_nodes_room ON canvas_nodes(room_name);
    `);
    console.log("✅ Database initialized");
  } catch (err) {
    console.error("❌ DB init error:", err.message);
    console.log("⚠️  Running in in-memory only mode");
  }
}

// ─────────────────────────────────────────────────────────────
// IN-MEMORY STORES (fast runtime, DB is source of truth)
// ─────────────────────────────────────────────────────────────
const yjsDocs = new Map();       // roomName → Y.Doc
const seqCounters = new Map();   // roomName → number
const roomPresence = new Map();  // roomName → Map<socketId, user>
const socketRooms = new Map();   // socketId → Set<roomName>
const nodeACL = new Map();       // roomName → Map<nodeId, minRole>

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const ROLE = { viewer: 0, contributor: 1, lead: 2 };

function getDoc(roomName) {
  if (!yjsDocs.has(roomName)) yjsDocs.set(roomName, new Y.Doc());
  return yjsDocs.get(roomName);
}

function getPresence(roomName) {
  if (!roomPresence.has(roomName)) roomPresence.set(roomName, new Map());
  return roomPresence.get(roomName);
}

function getACL(roomName) {
  if (!nodeACL.has(roomName)) nodeACL.set(roomName, new Map());
  return nodeACL.get(roomName);
}

function canEdit(roomName, nodeId, role) {
  const acl = getACL(roomName);
  if (!acl.has(nodeId)) return true;
  return (ROLE[role] || 0) >= (ROLE[acl.get(nodeId)] || 0);
}

function broadcastPresence(roomName) {
  const users = Array.from(getPresence(roomName).values());
  io.to(roomName).emit("presence:update", { roomId: roomName, users });
}

async function appendEventDB(roomName, eventData) {
  try {
    const res = await dbQuery(
      `INSERT INTO event_logs (room_name, user_name, type, node_id, payload)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING seq, id, server_timestamp`,
      [roomName, eventData.userId || null, eventData.type, eventData.nodeId || null,
       JSON.stringify(eventData.payload || {})]
    );
    const row = res.rows[0];
    seqCounters.set(roomName, parseInt(row.seq));
    return { ...eventData, seq: parseInt(row.seq), serverTimestamp: row.server_timestamp };
  } catch {
    // Fallback to in-memory seq
    const seq = (seqCounters.get(roomName) || 0) + 1;
    seqCounters.set(roomName, seq);
    return { ...eventData, seq, serverTimestamp: Date.now() };
  }
}

async function getMissedEvents(roomName, lastSeq) {
  try {
    const res = await dbQuery(
      `SELECT *, EXTRACT(EPOCH FROM server_timestamp)*1000 AS ts_ms
       FROM event_logs WHERE room_name=$1 AND seq>$2 ORDER BY seq ASC`,
      [roomName, lastSeq]
    );
    return res.rows.map(r => ({
      type: r.type, seq: parseInt(r.seq), roomId: r.room_name,
      userId: r.user_name, nodeId: r.node_id, payload: r.payload,
      serverTimestamp: parseInt(r.ts_ms)
    }));
  } catch {
    return [];
  }
}

async function persistYjsState(roomName, doc) {
  const state = Buffer.from(Y.encodeStateAsUpdate(doc));
  try {
    await dbQuery(
      `INSERT INTO rooms (name, yjs_state) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET yjs_state = $2`,
      [roomName, state]
    );
  } catch { /* ignore */ }
}

async function loadYjsState(roomName) {
  try {
    const res = await dbQuery(
      `SELECT yjs_state FROM rooms WHERE name=$1`, [roomName]
    );
    if (res.rows.length && res.rows[0].yjs_state) {
      return new Uint8Array(res.rows[0].yjs_state);
    }
  } catch { /* ignore */ }
  return null;
}

async function upsertNode(nodeId, roomName, node) {
  try {
    await dbQuery(
      `INSERT INTO canvas_nodes (id, room_name, data, position, intent, author)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         data=$3, position=$4, intent=$5, updated_at=CURRENT_TIMESTAMP`,
      [nodeId, roomName, JSON.stringify({ text: node.text }),
       JSON.stringify({ x: node.x, y: node.y }), node.intent || 'none', node.author || null]
    );
  } catch { /* ignore */ }
}

async function upsertTask(roomName, nodeId, title, intent, author) {
  try {
    await dbQuery(
      `INSERT INTO tasks (room_name, node_id, title, intent, author)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [roomName, nodeId, title, intent, author]
    );
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));
// Serve bundled yjs.js and socket.io client from node_modules
app.get("/yjs.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "node_modules/yjs/dist/yjs.cjs"));
});

// ─────────────────────────────────────────────────────────────
// REST API
// ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "LIGMA OK", ts: Date.now() }));

app.get("/api/rooms/:roomName/events", async (req, res) => {
  const since = parseInt(req.query.since) || 0;
  const events = await getMissedEvents(req.params.roomName, since);
  res.json({ events, currentSeq: seqCounters.get(req.params.roomName) || 0 });
});

app.get("/api/rooms/:roomName/presence", (req, res) => {
  res.json({ users: Array.from(getPresence(req.params.roomName).values()) });
});

app.get("/api/rooms/:roomName/state", async (req, res) => {
  const doc = await ensureRoomDoc(req.params.roomName);
  res.json({
    state: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
    seq: seqCounters.get(req.params.roomName) || 0,
  });
});

app.get("/api/rooms/:roomName/tasks", async (req, res) => {
  try {
    const result = await dbQuery(
      `SELECT * FROM tasks WHERE room_name=$1 ORDER BY created_at DESC`,
      [req.params.roomName]
    );
    res.json({ tasks: result.rows });
  } catch {
    res.json({ tasks: [] });
  }
});

app.get("/api/rooms/:roomName/nodes", async (req, res) => {
  try {
    const result = await dbQuery(
      `SELECT * FROM canvas_nodes WHERE room_name=$1 ORDER BY created_at ASC`,
      [req.params.roomName]
    );
    res.json({ nodes: result.rows });
  } catch {
    res.json({ nodes: [] });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ─────────────────────────────────────────────────────────────
// ROOM INIT HELPER
// ─────────────────────────────────────────────────────────────
async function ensureRoomDoc(roomName) {
  if (!yjsDocs.has(roomName)) {
    const doc = new Y.Doc();
    const saved = await loadYjsState(roomName);
    if (saved && saved.length > 0) {
      Y.applyUpdate(doc, saved);
      console.log(`[DB] Loaded Yjs state for room "${roomName}"`);
    }
    yjsDocs.set(roomName, doc);
  }
  return yjsDocs.get(roomName);
}

// ─────────────────────────────────────────────────────────────
// WEBSOCKET
// ─────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[+] ${socket.id} connected`);
  socketRooms.set(socket.id, new Set());

  socket.data = { userId: socket.id, userName: "Anonymous", role: "viewer", roomId: null };

  // ── Join Room ──────────────────────────────────────────────
  socket.on("joinRoom", async ({ roomId, userId, userName, role, lastSeq = 0 }) => {
    const roomName = roomId || "default";
    socket.join(roomName);
    socketRooms.get(socket.id).add(roomName);

    socket.data.userId = userId || socket.id;
    socket.data.userName = userName || "Anonymous";
    socket.data.role = role || "contributor";
    socket.data.roomId = roomName;

    // Persist member to DB
    try {
      await dbQuery(
        `INSERT INTO room_members (user_name, room_name, role)
         VALUES ($1, $2, $3) ON CONFLICT (user_name, room_name) DO UPDATE SET role=$3`,
        [socket.data.userName, roomName, socket.data.role]
      );
    } catch { /* ignore */ }

    getPresence(roomName).set(socket.id, {
      socketId: socket.id,
      userId: socket.data.userId,
      userName: socket.data.userName,
      role: socket.data.role,
      cursor: null,
      joinedAt: Date.now(),
    });

    const doc = await ensureRoomDoc(roomName);
    const fullState = Y.encodeStateAsUpdate(doc);
    const currentSeq = seqCounters.get(roomName) || 0;

    socket.emit("joinedRoom", {
      roomId: roomName,
      userId: socket.data.userId,
      userName: socket.data.userName,
      role: socket.data.role,
      currentSeq,
    });

    socket.emit("yjs:fullState", {
      roomId: roomName,
      update: Array.from(fullState),
      seq: currentSeq,
      syncId: Date.now(),
    });

    const missed = await getMissedEvents(roomName, lastSeq);
    if (missed.length > 0) {
      socket.emit("eventReplay", { roomId: roomName, events: missed });
    }

    broadcastPresence(roomName);
    console.log(`[Room] ${socket.data.userName}(${socket.data.role}) → ${roomName}`);
  });

  // ── Yjs CRDT Sync ──────────────────────────────────────────
  socket.on("yjs:update", async ({ roomId, update, origin }) => {
    if (!roomId || !update) return;
    try {
      const doc = await ensureRoomDoc(roomId);
      Y.applyUpdate(doc, new Uint8Array(update), socket.id);
      socket.to(roomId).emit("yjs:update", { roomId, update, origin: socket.id });
      // Persist Yjs state every 20 updates (throttle DB writes)
      const seq = seqCounters.get(roomId) || 0;
      if (seq % 20 === 0) persistYjsState(roomId, doc);
    } catch (err) {
      console.error("YJS apply error:", err.message);
      socket.emit("error", { code: "YJS_ERROR", message: err.message });
    }
  });

  socket.on("yjs:sync", async ({ roomId, stateVector }) => {
    if (!roomId) return;
    const doc = await ensureRoomDoc(roomId);
    let updates;
    try {
      updates = stateVector?.length > 0
        ? Y.encodeStateAsUpdate(doc, new Uint8Array(stateVector))
        : Y.encodeStateAsUpdate(doc);
    } catch {
      updates = Y.encodeStateAsUpdate(doc);
    }
    socket.emit("yjs:syncReply", {
      roomId, update: Array.from(updates), seq: seqCounters.get(roomId) || 0
    });
  });

  // ── Canvas Events ──────────────────────────────────────────
  socket.on("canvas:event", async (event) => {
    const { roomId, type, nodeId, payload } = event;
    if (!roomId || !type) return;

    const WRITE_OPS = ["NODE_UPDATE", "NODE_DELETE", "NODE_MOVE", "NODE_LOCK"];
    if (nodeId && WRITE_OPS.includes(type) && !canEdit(roomId, nodeId, socket.data.role)) {
      socket.emit("error", {
        code: "PERMISSION_DENIED",
        message: `Role '${socket.data.role}' cannot modify locked node ${nodeId}`,
        nodeId,
      });
      return;
    }

    const stored = await appendEventDB(roomId, {
      type, roomId, nodeId,
      userId: socket.data.userName,
      payload: payload || {},
      timestamp: Date.now(),
    });

    // Persist node to DB
    if ((type === "NODE_CREATE" || type === "NODE_UPDATE") && payload) {
      await upsertNode(nodeId, roomId, payload);
    }
    if (type === "NODE_DELETE" && nodeId) {
      try {
        await dbQuery(`DELETE FROM canvas_nodes WHERE id=$1`, [nodeId]);
      } catch { /* ignore */ }
    }

    socket.to(roomId).emit("canvas:event", stored);
    socket.emit("canvas:ack", { seq: stored.seq, nodeId, type });
  });

  // ── Cursor Presence ────────────────────────────────────────
  socket.on("cursor:move", ({ roomId, x, y }) => {
    if (!roomId) return;
    const p = getPresence(roomId).get(socket.id);
    if (p) p.cursor = { x, y };
    socket.to(roomId).emit("cursor:update", {
      socketId: socket.id,
      userId: socket.data.userId,
      userName: socket.data.userName,
      x, y,
    });
  });

  // ── Node-Level ACL ─────────────────────────────────────────
  socket.on("node:setACL", async ({ roomId, nodeId, minRole }) => {
    if (!roomId || !nodeId) return;
    if (socket.data.role !== "lead") {
      socket.emit("error", { code: "PERMISSION_DENIED", message: "Only leads can set ACL" });
      return;
    }
    getACL(roomId).set(nodeId, minRole || "contributor");
    try {
      await dbQuery(
        `INSERT INTO node_permissions (node_id, min_role) VALUES ($1, $2)
         ON CONFLICT (node_id) DO UPDATE SET min_role=$2`,
        [nodeId, minRole || "contributor"]
      );
    } catch { /* ignore */ }
    const stored = await appendEventDB(roomId, {
      type: "NODE_ACL_SET", roomId, nodeId,
      userId: socket.data.userName, payload: { minRole },
    });
    io.to(roomId).emit("node:aclUpdate", stored);
  });

  // ── AI Classification ──────────────────────────────────────
  socket.on("ai:classification", async ({ roomId, nodeId, intent, text, author }) => {
    if (!roomId || !nodeId) return;
    const stored = await appendEventDB(roomId, {
      type: "AI_CLASSIFICATION", roomId, nodeId,
      userId: author || socket.data.userName,
      payload: { intent, text },
    });
    // Update node intent in DB
    try {
      await dbQuery(
        `UPDATE canvas_nodes SET intent=$1 WHERE id=$2`, [intent, nodeId]
      );
    } catch { /* ignore */ }
    // Auto-create task for action items
    if (intent === "action_item" || intent === "decision") {
      await upsertTask(roomId, nodeId, text, intent, author || socket.data.userName);
    }
    io.to(roomId).emit("ai:classification", stored);
  });

  // ── Disconnect ─────────────────────────────────────────────
  socket.on("disconnect", async (reason) => {
    console.log(`[-] ${socket.id} disconnected (${reason})`);
    const rooms = socketRooms.get(socket.id) || [];
    for (const roomId of rooms) {
      getPresence(roomId).delete(socket.id);
      broadcastPresence(roomId);
      io.to(roomId).emit("cursor:remove", { socketId: socket.id, userId: socket.data?.userId });
      // Persist final Yjs state on disconnect
      if (yjsDocs.has(roomId)) persistYjsState(roomId, yjsDocs.get(roomId));
    }
    socketRooms.delete(socket.id);
  });
});

// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

(async () => {
  await initDB();
  server.listen(PORT, () => console.log(`🚀 LIGMA → http://localhost:${PORT}`));
})();
