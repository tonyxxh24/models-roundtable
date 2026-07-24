PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  canonical_path TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  trust_state TEXT NOT NULL CHECK (trust_state IN ('untrusted', 'trusted_read', 'trusted_write')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  next_sequence INTEGER NOT NULL DEFAULT 1 CHECK (next_sequence >= 1),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE agent_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  persona TEXT NOT NULL DEFAULT '',
  permission_profile TEXT NOT NULL CHECK (permission_profile IN ('chat_only', 'workspace_read', 'workspace_write')),
  provider_config_json TEXT NOT NULL DEFAULT '{}',
  context_policy_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('human', 'agent', 'system')),
  handle TEXT NOT NULL,
  handle_normalized TEXT NOT NULL,
  display_name TEXT NOT NULL,
  agent_profile_id TEXT REFERENCES agent_profiles(id) ON DELETE RESTRICT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (room_id, handle_normalized),
  CHECK ((kind = 'agent' AND agent_profile_id IS NOT NULL) OR (kind <> 'agent' AND agent_profile_id IS NULL))
) STRICT;

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  author_participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('human', 'agent', 'system')),
  body_markdown TEXT NOT NULL,
  reply_to_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  run_id TEXT,
  revision_of_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  incomplete INTEGER NOT NULL DEFAULT 0 CHECK (incomplete IN (0, 1)),
  tombstoned_at TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX messages_room_created_idx ON messages(room_id, created_at, id);
CREATE INDEX messages_reply_idx ON messages(reply_to_message_id);

CREATE TABLE mentions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  target_participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL,
  source_handle TEXT NOT NULL,
  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
  end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
  resolution TEXT NOT NULL CHECK (resolution IN ('resolved', 'unknown', 'disabled', 'group_expansion')),
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX mentions_message_idx ON mentions(message_id);

CREATE TABLE provider_sessions (
  id TEXT PRIMARY KEY,
  agent_profile_id TEXT NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  adapter_id TEXT NOT NULL,
  external_session_id TEXT NOT NULL,
  provider_version TEXT,
  capability_hash TEXT,
  state TEXT NOT NULL CHECK (state IN ('active', 'unavailable', 'closed')),
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  UNIQUE (adapter_id, external_session_id)
) STRICT;

CREATE TABLE context_snapshots (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  room_sequence INTEGER NOT NULL CHECK (room_sequence >= 0),
  mode TEXT NOT NULL CHECK (mode IN ('new', 'resume', 'fork')),
  manifest_json TEXT NOT NULL,
  prompt_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  trigger_message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,
  target_participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  provider_session_id TEXT REFERENCES provider_sessions(id) ON DELETE SET NULL,
  context_snapshot_id TEXT NOT NULL REFERENCES context_snapshots(id) ON DELETE RESTRICT,
  retry_of_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  state TEXT NOT NULL CHECK (state IN ('queued', 'starting', 'running', 'waiting_approval', 'cancelling', 'completed', 'failed', 'cancelled')),
  permission_profile TEXT NOT NULL CHECK (permission_profile IN ('chat_only', 'workspace_read', 'workspace_write')),
  input_room_sequence INTEGER NOT NULL CHECK (input_room_sequence >= 0),
  next_run_sequence INTEGER NOT NULL DEFAULT 1 CHECK (next_run_sequence >= 1),
  error_code TEXT,
  safe_error_message TEXT,
  diagnostic_ref TEXT,
  queued_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX runs_room_state_idx ON runs(room_id, state, queued_at);
CREATE INDEX runs_session_state_idx ON runs(provider_session_id, state);

CREATE TABLE run_start_attempts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  process_token TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('prepared', 'spawned', 'confirmed', 'failed', 'uncertain')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (run_id, attempt_number),
  UNIQUE (process_token)
) STRICT;

CREATE TABLE room_events (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  room_sequence INTEGER NOT NULL CHECK (room_sequence >= 1),
  event_type TEXT NOT NULL,
  entity_id TEXT,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  UNIQUE (room_id, room_sequence)
) STRICT;

CREATE TABLE run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  run_sequence INTEGER NOT NULL CHECK (run_sequence >= 1),
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  durable INTEGER NOT NULL DEFAULT 1 CHECK (durable IN (0, 1)),
  occurred_at TEXT NOT NULL,
  UNIQUE (run_id, run_sequence)
) STRICT;

CREATE TABLE idempotency_records (
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  command_type TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (scope, idempotency_key)
) WITHOUT ROWID, STRICT;

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  storage_mode TEXT NOT NULL CHECK (storage_mode IN ('managed', 'workspace_reference')),
  content_sha256 TEXT NOT NULL,
  media_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  storage_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE message_attachments (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (message_id, attachment_id)
) WITHOUT ROWID, STRICT;

CREATE TABLE workspace_leases (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode = 'write'),
  process_token TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('active', 'releasing', 'released', 'expired')),
  acquired_at TEXT NOT NULL,
  heartbeat_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  released_at TEXT
) STRICT;

CREATE UNIQUE INDEX one_active_write_lease_per_workspace
ON workspace_leases(workspace_id)
WHERE state IN ('active', 'releasing');

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  request_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  safe_details_json TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'approved', 'denied', 'expired', 'cancelled')),
  requested_at TEXT NOT NULL,
  resolved_at TEXT,
  UNIQUE (run_id, request_hash)
) STRICT;

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  canonical_path TEXT NOT NULL UNIQUE,
  source_checksum TEXT NOT NULL,
  validation_state TEXT NOT NULL CHECK (validation_state IN ('valid', 'invalid', 'warning')),
  validation_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE skill_projections (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  target_path TEXT NOT NULL,
  source_checksum TEXT NOT NULL,
  target_checksum TEXT,
  projector_version TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('unprojected', 'clean', 'source_changed', 'target_diverged', 'conflict')),
  updated_at TEXT NOT NULL,
  UNIQUE (skill_id, provider_id)
) STRICT;

CREATE VIRTUAL TABLE message_search USING fts5(
  message_id UNINDEXED,
  room_id UNINDEXED,
  body_markdown,
  tokenize = 'unicode61'
);

CREATE TRIGGER message_search_insert AFTER INSERT ON messages
WHEN NEW.tombstoned_at IS NULL
BEGIN
  INSERT INTO message_search(message_id, room_id, body_markdown)
  VALUES (NEW.id, NEW.room_id, NEW.body_markdown);
END;

CREATE TRIGGER message_search_delete AFTER DELETE ON messages
BEGIN
  DELETE FROM message_search WHERE message_id = OLD.id;
END;

CREATE TRIGGER message_search_tombstone AFTER UPDATE OF tombstoned_at ON messages
BEGIN
  DELETE FROM message_search WHERE message_id = NEW.id;
  INSERT INTO message_search(message_id, room_id, body_markdown)
  SELECT NEW.id, NEW.room_id, NEW.body_markdown
  WHERE NEW.tombstoned_at IS NULL;
END;
