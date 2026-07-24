import { createHash } from "node:crypto";
import type Database from "better-sqlite3";

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
}

export function applyMigrations(
  database: Database.Database,
  configuredMigrations: readonly Migration[] = migrations,
): readonly number[] {
  const existingTable = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations' LIMIT 1",
    )
    .get() as { readonly name: string } | undefined;
  const applied =
    existingTable === undefined
      ? new Map<number, string>()
      : new Map(
          (
            database
              .prepare(
                "SELECT version, checksum FROM schema_migrations ORDER BY version",
              )
              .all() as readonly {
              readonly version: number;
              readonly checksum: string;
            }[]
          ).map((row) => [row.version, row.checksum]),
        );

  for (const currentMigration of configuredMigrations) {
    const priorChecksum = applied.get(currentMigration.version);
    if (priorChecksum !== undefined) {
      if (priorChecksum !== currentMigration.checksum) {
        throw new Error(
          "Migration checksum mismatch at version " +
            currentMigration.version +
            ".",
        );
      }
      continue;
    }

    database.transaction(() => {
      database.exec(currentMigration.sql);
      database
        .prepare(
          "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
        )
        .run(
          currentMigration.version,
          currentMigration.name,
          currentMigration.checksum,
          new Date().toISOString(),
        );
    })();
  }

  return configuredMigrations.map(
    (currentMigration) => currentMigration.version,
  );
}

function migration(version: number, name: string, sql: string): Migration {
  return {
    version,
    name,
    sql,
    checksum: createHash("sha256").update(sql).digest("hex"),
  };
}

const bootstrapSql = [
  "CREATE TABLE IF NOT EXISTS schema_migrations (",
  "  version INTEGER PRIMARY KEY,",
  "  name TEXT NOT NULL,",
  "  checksum TEXT NOT NULL,",
  "  applied_at TEXT NOT NULL",
  ") STRICT;",
  "",
  "CREATE TABLE IF NOT EXISTS app_metadata (",
  "  key TEXT PRIMARY KEY,",
  "  value TEXT NOT NULL,",
  "  updated_at TEXT NOT NULL",
  ") STRICT;",
].join("\n");

const localChatSql = [
  "CREATE TABLE rooms (",
  "  id TEXT PRIMARY KEY,",
  "  title TEXT NOT NULL,",
  "  next_sequence INTEGER NOT NULL DEFAULT 1 CHECK (next_sequence >= 1),",
  "  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),",
  "  archived_at TEXT,",
  "  created_at TEXT NOT NULL,",
  "  updated_at TEXT NOT NULL",
  ") STRICT;",
  "",
  "CREATE TABLE participants (",
  "  id TEXT PRIMARY KEY,",
  "  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,",
  "  kind TEXT NOT NULL CHECK (kind IN ('human', 'agent', 'system')),",
  "  handle TEXT NOT NULL,",
  "  handle_normalized TEXT NOT NULL,",
  "  display_name TEXT NOT NULL,",
  "  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),",
  "  created_at TEXT NOT NULL,",
  "  updated_at TEXT NOT NULL,",
  "  UNIQUE (room_id, handle_normalized)",
  ") STRICT;",
  "",
  "CREATE TABLE messages (",
  "  id TEXT PRIMARY KEY,",
  "  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,",
  "  author_participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,",
  "  kind TEXT NOT NULL CHECK (kind IN ('human', 'agent', 'system')),",
  "  body_markdown TEXT NOT NULL,",
  "  incomplete INTEGER NOT NULL DEFAULT 0 CHECK (incomplete IN (0, 1)),",
  "  created_at TEXT NOT NULL",
  ") STRICT;",
  "",
  "CREATE TABLE room_events (",
  "  id TEXT PRIMARY KEY,",
  "  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,",
  "  room_sequence INTEGER NOT NULL CHECK (room_sequence >= 1),",
  "  event_type TEXT NOT NULL,",
  "  entity_id TEXT,",
  "  payload_json TEXT NOT NULL,",
  "  occurred_at TEXT NOT NULL,",
  "  UNIQUE (room_id, room_sequence)",
  ") STRICT;",
  "",
  "CREATE TABLE idempotency_records (",
  "  scope TEXT NOT NULL,",
  "  idempotency_key TEXT NOT NULL,",
  "  command_type TEXT NOT NULL,",
  "  request_hash TEXT NOT NULL,",
  "  response_json TEXT NOT NULL,",
  "  created_at TEXT NOT NULL,",
  "  expires_at TEXT NOT NULL,",
  "  PRIMARY KEY (scope, idempotency_key)",
  ") WITHOUT ROWID, STRICT;",
  "",
  "CREATE VIRTUAL TABLE message_search USING fts5(",
  "  message_id UNINDEXED,",
  "  room_id UNINDEXED,",
  "  body_markdown,",
  "  tokenize = 'unicode61'",
  ");",
  "",
  "CREATE TRIGGER message_search_insert AFTER INSERT ON messages",
  "BEGIN",
  "  INSERT INTO message_search(message_id, room_id, body_markdown)",
  "  VALUES (NEW.id, NEW.room_id, NEW.body_markdown);",
  "END;",
].join("\n");

const fakeRunsSql = [
  "CREATE TABLE context_snapshots (",
  "  id TEXT PRIMARY KEY,",
  "  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,",
  "  room_sequence INTEGER NOT NULL CHECK (room_sequence >= 1),",
  "  manifest_json TEXT NOT NULL,",
  "  created_at TEXT NOT NULL",
  ") STRICT;",
  "",
  "CREATE TABLE runs (",
  "  id TEXT PRIMARY KEY,",
  "  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,",
  "  trigger_message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,",
  "  target_participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,",
  "  context_snapshot_id TEXT NOT NULL REFERENCES context_snapshots(id) ON DELETE RESTRICT,",
  "  state TEXT NOT NULL CHECK (state IN ('queued', 'starting', 'running', 'completed', 'failed', 'cancelled')),",
  "  input_room_sequence INTEGER NOT NULL CHECK (input_room_sequence >= 1),",
  "  queued_at TEXT NOT NULL,",
  "  updated_at TEXT NOT NULL",
  ") STRICT;",
  "CREATE INDEX runs_room_state_idx ON runs(room_id, state, queued_at);",
].join("\n");

const mentionsSql = [
  "CREATE TABLE mentions (",
  "  id TEXT PRIMARY KEY,",
  "  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,",
  "  target_participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL,",
  "  source_handle TEXT NOT NULL,",
  "  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),",
  "  end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),",
  "  resolution TEXT NOT NULL CHECK (resolution IN ('resolved', 'unknown', 'disabled', 'group_expansion')),",
  "  created_at TEXT NOT NULL",
  ") STRICT;",
  "CREATE INDEX mentions_message_idx ON mentions(message_id);",
].join("\n");

const runEventsSql = [
  "CREATE TABLE run_events (",
  "  id TEXT PRIMARY KEY,",
  "  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,",
  "  run_sequence INTEGER NOT NULL CHECK (run_sequence >= 1),",
  "  event_type TEXT NOT NULL,",
  "  payload_json TEXT NOT NULL,",
  "  occurred_at TEXT NOT NULL,",
  "  UNIQUE (run_id, run_sequence)",
  ") STRICT;",
  "ALTER TABLE messages ADD COLUMN run_id TEXT REFERENCES runs(id) ON DELETE SET NULL;",
].join("\n");

const messageOrderingSql = [
  "ALTER TABLE messages ADD COLUMN room_sequence INTEGER;",
  "UPDATE messages",
  "SET room_sequence = (",
  "  SELECT room_events.room_sequence",
  "  FROM room_events",
  "  WHERE room_events.room_id = messages.room_id",
  "    AND room_events.entity_id = messages.id",
  "    AND room_events.event_type = 'message.created'",
  ");",
  "CREATE UNIQUE INDEX messages_room_sequence_idx ON messages(room_id, room_sequence);",
].join("\n");

const providerSessionsSql = [
  "CREATE TABLE workspaces (",
  "  id TEXT PRIMARY KEY,",
  "  canonical_path TEXT NOT NULL UNIQUE,",
  "  display_name TEXT NOT NULL,",
  "  trust_state TEXT NOT NULL CHECK (trust_state IN ('untrusted', 'trusted_read', 'trusted_write')),",
  "  created_at TEXT NOT NULL,",
  "  updated_at TEXT NOT NULL",
  ") STRICT;",
  "CREATE TABLE agent_profiles (",
  "  id TEXT PRIMARY KEY,",
  "  name TEXT NOT NULL,",
  "  adapter_id TEXT NOT NULL,",
  "  persona TEXT NOT NULL DEFAULT '',",
  "  permission_profile TEXT NOT NULL CHECK (permission_profile IN ('chat_only', 'workspace_read', 'workspace_write')),",
  "  provider_config_json TEXT NOT NULL DEFAULT '{}',",
  "  context_policy_json TEXT NOT NULL DEFAULT '{}',",
  "  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),",
  "  created_at TEXT NOT NULL,",
  "  updated_at TEXT NOT NULL",
  ") STRICT;",
  "ALTER TABLE participants ADD COLUMN agent_profile_id TEXT REFERENCES agent_profiles(id) ON DELETE RESTRICT;",
  "INSERT INTO agent_profiles (id, name, adapter_id, permission_profile, created_at, updated_at)",
  "SELECT 'profile:' || id, display_name, 'fake', 'chat_only', created_at, updated_at",
  "FROM participants WHERE kind = 'agent';",
  "UPDATE participants SET agent_profile_id = 'profile:' || id WHERE kind = 'agent';",
  "CREATE TABLE provider_sessions (",
  "  id TEXT PRIMARY KEY,",
  "  agent_profile_id TEXT NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,",
  "  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,",
  "  adapter_id TEXT NOT NULL,",
  "  external_session_id TEXT NOT NULL,",
  "  provider_version TEXT,",
  "  capability_hash TEXT,",
  "  state TEXT NOT NULL CHECK (state IN ('active', 'unavailable', 'closed')),",
  "  created_at TEXT NOT NULL,",
  "  last_used_at TEXT NOT NULL,",
  "  UNIQUE (adapter_id, external_session_id)",
  ") STRICT;",
  "ALTER TABLE runs ADD COLUMN provider_session_id TEXT REFERENCES provider_sessions(id) ON DELETE SET NULL;",
  "ALTER TABLE runs ADD COLUMN retry_of_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL;",
].join("\n");

export const migrations: readonly Migration[] = [
  migration(1, "bootstrap", bootstrapSql),
  migration(2, "local_chat_core", localChatSql),
  migration(3, "fake_run_queue", fakeRunsSql),
  migration(4, "mention_snapshots", mentionsSql),
  migration(5, "normalized_run_events", runEventsSql),
  migration(6, "canonical_message_order", messageOrderingSql),
  migration(7, "provider_sessions_and_retries", providerSessionsSql),
];
