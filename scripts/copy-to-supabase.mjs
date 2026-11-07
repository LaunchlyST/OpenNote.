// Copies a Desknoty SQLite database and its files into a Supabase project.
// Additive only: rows that already exist (same primary key) are left alone,
// and the SQLite file is opened read-only. Sessions, one-time tokens and the
// email queue are not copied (users simply sign in again).
//
// Usage: node scripts/copy-to-supabase.mjs <project-ref> <opennote.db> [files-dir] [media-dir]
// Needs a Supabase personal access token sent to api.supabase.com
// (SUPABASE_ACCESS_TOKEN, or injected by a proxy).
import Database from 'better-sqlite3'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const [ref, dbPath, filesDir, mediaDir] = process.argv.slice(2)
if (!ref || !dbPath) throw new Error('usage: copy-to-supabase.mjs <project-ref> <opennote.db> [files-dir] [media-dir]')
const mgmt = `https://api.supabase.com/v1/projects/${ref}`
const auth = process.env.SUPABASE_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` } : {}
async function query(sqlText) {
  const r = await fetch(`${mgmt}/database/query`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sqlText }) })
  const body = await r.json()
  if (!r.ok) throw new Error(`query failed (${r.status}): ${JSON.stringify(body).slice(0, 300)}`)
  return body
}
const TABLES = ['user', 'account', 'project', 'project_import', 'workspace', 'user_preferences', 'site_settings', 'waitlist', 'seller_store', 'seller_product', 'seller_media', 'seller_order', 'stripe_event']
const db = new Database(dbPath, { readonly: true, fileMustExist: true })
if (db.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('source database failed its integrity check')

const tag = `$cp${Date.now().toString(36)}$`
for (const t of TABLES) {
  if (!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(t)) continue
  const cols = await query(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='${t}'`)
  const types = Object.fromEntries(cols.map((c) => [c.column_name, c.data_type]))
  const rows = db.prepare(`SELECT * FROM "${t}"`).all().map((row) => {
    const out = {}
    for (const [k, v] of Object.entries(row)) {
      if (!(k in types)) continue
      const ty = types[k]
      if (v === null) out[k] = null
      else if (ty === 'boolean') out[k] = Boolean(v)
      else if (ty.startsWith('timestamp')) out[k] = typeof v === 'number' ? new Date(v).toISOString() : v
      else out[k] = v
    }
    return out
  })
  const before = (await query(`select count(*)::int n from "${t}"`))[0].n
  for (let i = 0; i < rows.length; i += 200) {
    const json = JSON.stringify(rows.slice(i, i + 200))
    if (json.includes(tag)) throw new Error('quoting tag collision')
    await query(`insert into "${t}" select * from json_populate_recordset(null::"${t}", ${tag}${json}${tag}) on conflict do nothing`)
  }
  const after = (await query(`select count(*)::int n from "${t}"`))[0].n
  console.log(`${t.padEnd(18)} source ${String(rows.length).padStart(4)}  added ${String(after - before).padStart(4)}  now ${after}`)
}
// Keep auto-increment sequences ahead of copied ids.
await query(`select setval(pg_get_serial_sequence('email_outbox','id'), greatest((select coalesce(max(id),0) from email_outbox), 1))`)

// Files: private product files and public images go to Supabase Storage.
const keys = await (await fetch(`${mgmt}/api-keys?reveal=true`, { headers: auth })).json()
const service = keys.find((k) => k.name === 'service_role')?.api_key
if (!service) throw new Error('could not read the project service key')
const storage = `https://${ref}.supabase.co/storage/v1/object`
for (const [dir, bucket] of [[filesDir, 'seller-files'], [mediaDir, 'seller-media']]) {
  if (!dir || !existsSync(dir)) continue
  for (const name of readdirSync(dir)) {
    if (!/^(fil|med)_[a-f0-9]+$/.test(name)) continue
    const body = readFileSync(join(dir, name))
    const r = await fetch(`${storage}/${bucket}/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${service}`, apikey: service, 'Content-Type': 'application/octet-stream' }, body })
    const state = r.ok ? 'uploaded' : r.status === 409 || r.status === 400 ? 'already there' : `FAILED ${r.status}`
    console.log(`${bucket}/${name} (${body.length} bytes): ${state}`)
  }
}
