-- ═══════════════════════════════════════════════════════════
-- LIGMA — Database Schema
-- Run: psql -U postgres -d ligma_db -f schema.sql
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Rooms ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  yjs_state  BYTEA,          -- serialized Yjs document state
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Room Members ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,
  room_name TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'contributor', -- lead | contributor | viewer
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_name, room_name)
);

-- ── Canvas Nodes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS canvas_nodes (
  id         TEXT PRIMARY KEY,
  room_name  TEXT NOT NULL,
  type       TEXT DEFAULT 'sticky',
  data       JSONB,            -- { text, color, ... }
  position   JSONB,            -- { x, y }
  intent     TEXT DEFAULT 'none',
  author     TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_canvas_nodes_room ON canvas_nodes(room_name);

-- ── Node Permissions (per-node RBAC) ─────────────────────────
CREATE TABLE IF NOT EXISTS node_permissions (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id  TEXT REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  min_role TEXT NOT NULL DEFAULT 'contributor',
  UNIQUE(node_id)
);

-- ── Tasks (populated by AI classification) ───────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name  TEXT NOT NULL,
  node_id    TEXT,
  title      TEXT NOT NULL,
  intent     TEXT DEFAULT 'action_item',
  author     TEXT,
  status     TEXT DEFAULT 'TODO',  -- TODO | IN_PROGRESS | DONE
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_room ON tasks(room_name);

-- ── Event Log (append-only, immutable) ───────────────────────
-- NEVER UPDATE or DELETE rows from this table.
-- Every mutation to the canvas is stored as an event.
CREATE TABLE IF NOT EXISTS event_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq              BIGSERIAL,   -- monotonic sequence per-DB (not per-room)
  room_name        TEXT NOT NULL,
  user_name        TEXT,
  type             TEXT NOT NULL,
  node_id          TEXT,
  payload          JSONB,
  server_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_logs_room_seq ON event_logs(room_name, seq);
CREATE INDEX IF NOT EXISTS idx_event_logs_ts       ON event_logs(server_timestamp);
