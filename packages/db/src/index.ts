import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { applyMigrations } from "./migrations.js";
import { createRoomRepository, type RoomRepository } from "./rooms.js";
export * from "./rooms.js";

export interface OpenDatabaseOptions {
  readonly dataDirectory: string;
  readonly fileName?: string;
}

export interface DatabaseHandle {
  readonly dataDirectory: string;
  readonly path: string;
  health(): "ready";
  close(): void;
  appliedMigrationVersions(): readonly number[];
  readonly rooms: RoomRepository;
}

export function openDatabase(options: OpenDatabaseOptions): DatabaseHandle {
  const dataDirectory = options.dataDirectory;
  const fileName = options.fileName ?? "roundtable.sqlite";
  mkdirSync(dataDirectory, { recursive: true });
  const databasePath = join(dataDirectory, fileName);
  const database = new Database(databasePath);

  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  database.pragma("synchronous = NORMAL");
  database.pragma("busy_timeout = 5000");
  const appliedVersions = applyMigrations(database);
  const rooms = createRoomRepository(database);
  rooms.recoverInterruptedRuns();

  return {
    dataDirectory,
    path: databasePath,
    health: () => "ready",
    close: () => database.close(),
    appliedMigrationVersions: () => appliedVersions,
    rooms,
  };
}
