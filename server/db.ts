import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import pg from 'pg'
import { env } from './env.ts'
import { ddl, postgresSql, sqliteSql } from './sql.ts'
import type { Sql } from './sql.ts'

/**
 * Where Desknoty keeps its data.
 *
 * - DATABASE_URL set (e.g. Supabase Postgres): everything goes to Postgres.
 * - Otherwise: one SQLite file at DATABASE_PATH, as before. Existing local
 *   data keeps working unchanged.
 */
const databaseUrl = (process.env.DATABASE_URL ?? '').trim()

// Postgres returns BIGINT as a string by default; Desknoty stores millisecond
// timestamps in BIGINT columns and wants numbers back.
pg.types.setTypeParser(20, (v) => Number(v))

function open(): { sql: Sql; authDatabase: unknown } {
  if (databaseUrl) {
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false },
    })
    return { sql: postgresSql(pool), authDatabase: pool }
  }
  mkdirSync(dirname(env.databasePath), { recursive: true })
  const file = new Database(env.databasePath)
  file.pragma('journal_mode = WAL')
  file.pragma('foreign_keys = ON')
  return { sql: sqliteSql(file), authDatabase: file }
}

const opened = open()
/** The app's data. Every query goes through this. */
export const sql = opened.sql
/** The same store, in the form Better Auth accepts (pg Pool or SQLite handle). */
export const authDatabase = opened.authDatabase as never

/**
 * Each user's calendar workspace (events, calendars, notes, settings) as one
 * JSON document, owned by exactly one Better Auth user. Deleting the user
 * deletes their workspace.
 */
export async function ensureAppTables() {
  const t = ddl(sql.dialect)
  // Every statement ends with ";"; identifiers are quoted so Postgres keeps their case.
  await sql.exec(`
    CREATE TABLE IF NOT EXISTS workspace (
      "userId" TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deployment (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      "requestedAt" TEXT NOT NULL,
      provider TEXT NOT NULL,
      "providerLabel" TEXT NOT NULL,
      "productionUrl" TEXT,
      "requestedBy" TEXT,
      accepted INTEGER NOT NULL
    );

    -- OpenNote's own email outbox: a durable queue and delivery log. Message
    -- bodies (which hold one-time links) are erased once a message is sent or
    -- given up on; the row stays as the log entry.
    CREATE TABLE IF NOT EXISTS email_outbox (
      id ${t.id},
      kind TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      html TEXT,
      text TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0,
      "nextAttemptAt" ${t.big} NOT NULL,
      "lastError" TEXT,
      "createdAt" ${t.big} NOT NULL,
      "sentAt" ${t.big}
    );
    CREATE INDEX IF NOT EXISTS email_outbox_due ON email_outbox (status, "nextAttemptAt");
    CREATE INDEX IF NOT EXISTS email_outbox_recipient ON email_outbox (recipient, "createdAt");

    CREATE TABLE IF NOT EXISTS waitlist (
      email TEXT PRIMARY KEY,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
  `)
}
