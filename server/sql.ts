/**
 * One async database interface for both stores Desknoty runs on:
 *
 *   - SQLite (better-sqlite3) for local development and the existing data
 *   - Postgres (Supabase) when DATABASE_URL is set, for hosting
 *
 * Queries are written once in the portable subset both understand: `?`
 * placeholders, double-quoted camelCase identifiers, `ON CONFLICT … DO …`,
 * `RETURNING`, and `CAST(COUNT(*) AS INTEGER)`. JavaScript booleans are stored
 * as 1/0 on SQLite and as real booleans on Postgres. Schema DDL that differs
 * (auto-increment ids, 64-bit integers) uses the `ddl` helpers below.
 */
import type BetterSqlite from 'better-sqlite3'
import type { Pool, PoolClient } from 'pg'

export type Param = string | number | boolean | null | undefined | Buffer
export interface Sql {
  dialect: 'sqlite' | 'postgres'
  get<T = Record<string, unknown>>(q: string, ...params: Param[]): Promise<T | undefined>
  all<T = Record<string, unknown>>(q: string, ...params: Param[]): Promise<T[]>
  run(q: string, ...params: Param[]): Promise<{ changes: number }>
  /** Several statements separated by `;` (schema only, no parameters). */
  exec(statements: string): Promise<void>
  /** Runs `fn` in one transaction; everything inside must use the `tx` it is given. */
  tx<T>(fn: (tx: Sql) => Promise<T>): Promise<T>
}

/** `?` → `$1, $2 …`, leaving `?` inside quoted strings and identifiers alone. */
export function toPositional(q: string): string {
  let out = ''
  let n = 0
  let quote: string | null = null
  for (const ch of q) {
    if (quote) {
      if (ch === quote) quote = null
      out += ch
    } else if (ch === "'" || ch === '"') {
      quote = ch
      out += ch
    } else if (ch === '?') out += `$${++n}`
    else out += ch
  }
  return out
}

const sqliteParam = (p: Param) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p)

export function sqliteSql(db: BetterSqlite.Database): Sql {
  let lock: Promise<unknown> = Promise.resolve()
  const cache = new Map<string, BetterSqlite.Statement>()
  const stmt = (q: string) => {
    let s = cache.get(q)
    if (!s) cache.set(q, (s = db.prepare(q)))
    return s
  }
  const self: Sql = {
    dialect: 'sqlite',
    async get<T>(q: string, ...p: Param[]) {
      return stmt(q).get(...p.map(sqliteParam)) as T | undefined
    },
    async all<T>(q: string, ...p: Param[]) {
      return stmt(q).all(...p.map(sqliteParam)) as T[]
    },
    async run(q: string, ...p: Param[]) {
      const s = stmt(q)
      // RETURNING turns an INSERT/UPDATE into a reader in better-sqlite3.
      if (s.reader) return { changes: s.all(...p.map(sqliteParam)).length }
      return { changes: s.run(...p.map(sqliteParam)).changes }
    },
    async exec(statements: string) {
      db.exec(statements)
    },
    tx<T>(fn: (tx: Sql) => Promise<T>) {
      // One connection, so transactions are queued: a second one waits for
      // the first to commit or roll back instead of nesting inside it.
      const run = async () => {
        db.exec('BEGIN IMMEDIATE')
        try {
          const r = await fn(self)
          db.exec('COMMIT')
          return r
        } catch (e) {
          db.exec('ROLLBACK')
          throw e
        }
      }
      const next = lock.then(run, run)
      lock = next.then(() => undefined, () => undefined)
      return next
    },
  }
  return self
}

export function postgresSql(pool: Pool, client?: PoolClient): Sql {
  const q = (text: string, p: Param[]) => (client ?? pool).query(toPositional(text), p.map((x) => (x === undefined ? null : x)))
  return {
    dialect: 'postgres',
    async get<T>(text: string, ...p: Param[]) {
      return (await q(text, p)).rows[0] as T | undefined
    },
    async all<T>(text: string, ...p: Param[]) {
      return (await q(text, p)).rows as T[]
    },
    async run(text: string, ...p: Param[]) {
      return { changes: (await q(text, p)).rowCount ?? 0 }
    },
    async exec(statements: string) {
      await (client ?? pool).query(statements)
    },
    async tx<T>(fn: (tx: Sql) => Promise<T>) {
      if (client) return fn(postgresSql(pool, client))
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        const r = await fn(postgresSql(pool, c))
        await c.query('COMMIT')
        return r
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {})
        throw e
      } finally {
        c.release()
      }
    },
  }
}

/** Column types that differ between the two dialects. */
export const ddl = (dialect: Sql['dialect']) => ({
  /** auto-incrementing integer primary key */
  id: dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT',
  /** 64-bit integer, e.g. millisecond timestamps */
  big: dialect === 'postgres' ? 'BIGINT' : 'INTEGER',
  /** binary data */
  blob: dialect === 'postgres' ? 'BYTEA' : 'BLOB',
})
