/**
 * Safe snapshot of everything the backend stores, before any hosting move:
 * a consistent copy of the SQLite database (online backup API, safe while the
 * server runs) plus the seller files and store images.
 *
 *   npx tsx scripts/backup-data.ts [outDir]
 *
 * Reads the same settings as the server (DATABASE_PATH, SELLER_FILES_DIR,
 * SELLER_MEDIA_DIR). Never modifies the source data. The output contains
 * private files and account data: keep it out of Git (data/ is ignored).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'

const dbPath = resolve(process.env.DATABASE_PATH ?? 'data/opennote.db')
const files = resolve(process.env.SELLER_FILES_DIR ?? 'data/seller-files')
const media = resolve(process.env.SELLER_MEDIA_DIR ?? 'data/seller-media')
const out = resolve(process.argv[2] ?? `data/backups/${new Date().toISOString().replace(/[:.]/g, '-')}`)

mkdirSync(out, { recursive: true })
if (!existsSync(dbPath)) throw new Error(`No database at ${dbPath}`)
const src = new Database(dbPath, { readonly: true, fileMustExist: true })
await src.backup(join(out, 'opennote.db'))
src.close()

const count = (d: string) => (existsSync(d) ? readdirSync(d).filter((f) => statSync(join(d, f)).isFile()).length : 0)
for (const [d, name] of [[files, 'seller-files'], [media, 'seller-media']] as const) {
  if (existsSync(d)) cpSync(d, join(out, name), { recursive: true })
}
const check = new Database(join(out, 'opennote.db'), { readonly: true })
const ok = (check.pragma('integrity_check', { simple: true }) as string) === 'ok'
const tables = (check.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table'").get() as { n: number }).n
check.close()
console.log(`Backup written to ${out}`)
console.log(`  database: integrity ${ok ? 'ok' : 'FAILED'}, ${tables} tables`)
console.log(`  seller files: ${count(join(out, 'seller-files'))}, store images: ${count(join(out, 'seller-media'))}`)
if (!ok) process.exit(1)
