import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { env } from './env.ts'

mkdirSync(dirname(env.databasePath), { recursive: true })

/** One SQLite file holds both Better Auth's tables and OpenNote's own data. */
export const db = new Database(env.databasePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

/**
 * Each user's calendar workspace (events, calendars, notes, settings) as one
 * JSON document, owned by exactly one Better Auth user. Deleting the user
 * deletes their workspace.
 */
export function ensureAppTables() {
  // better-sqlite3's exec() splits statements on ";" only, so every statement
  // here must be terminated — unlike sqlite3_exec, it does not infer them.
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace (
      userId TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deployment (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      requestedAt TEXT NOT NULL,
      provider TEXT NOT NULL,
      providerLabel TEXT NOT NULL,
      productionUrl TEXT,
      requestedBy TEXT,
      accepted INTEGER NOT NULL
    );
  `)
}
