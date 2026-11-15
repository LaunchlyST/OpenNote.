import assert from 'node:assert/strict'
import { SaveQueue } from '../src/projects/seller/save-queue.ts'

let release!: () => void
let active = 0
let maxActive = 0
const writes: Array<[string, number, string]> = []
let recovery: unknown
const q = new SaveQueue('original', 0, 'tok_original_0000000000000000', async (value, revision, token) => {
  active++; maxActive = Math.max(maxActive, active); writes.push([value, revision, token])
  if (writes.length === 1) await new Promise<void>(resolve => { release = resolve })
  active--; return revision + 1
}, (value, revision, token) => { recovery = { value, revision, token } }, () => { recovery = null })
q.edit('first')
const first = q.flush()
q.edit('newer')
const second = q.flush()
release()
await Promise.all([first, second])
assert.deepEqual(writes, [['first', 0, 'tok_original_0000000000000000'], ['newer', 1, 'tok_original_0000000000000000']])
assert.equal(maxActive, 1)
assert.equal(recovery, null)
assert.equal(q.dirty, false)

let fail = true
const retry = new SaveQueue('old', 4, 'tok_retry_00000000000000000', async () => {
  if (fail) throw new Error('network offline')
  return 5
}, (value, revision, token) => { recovery = { value, revision, token } }, () => { recovery = null })
retry.edit('recover me')
await assert.rejects(retry.flush(), /offline/)
assert.deepEqual(recovery, { value: 'recover me', revision: 4, token: 'tok_retry_00000000000000000' })
assert.equal(retry.dirty, true)
fail = false
await retry.flush()
assert.equal(recovery, null)
assert.equal(retry.revision, 5)

// The writer token travels with the recovery data, so a save whose reply was
// lost is still recognised as this editor's own after a refresh.
const kept = new SaveQueue('old', 7, 'tok_kept_00000000000000000', async () => { throw new Error('offline') }, (value, revision, token) => { recovery = { value, revision, token } }, () => { recovery = null })
kept.edit('typed before the refresh')
await assert.rejects(kept.flush(), /offline/)
const recovered = JSON.parse(JSON.stringify(recovery)) as { value: string; revision: number; token: string }
assert.equal(recovered.revision, 7)
assert.equal(recovered.token, 'tok_kept_00000000000000000')

// A new editor that starts from the server's own revision keeps it.
const fresh = new SaveQueue('server', 9, 'tok_fresh_0000000000000000', async (_v, revision) => revision + 1, () => {}, () => {})
assert.equal(fresh.revision, 9)
assert.equal(fresh.token, 'tok_fresh_0000000000000000')

// Discarding the pending edits takes the server's version and stops saving.
const dropped = new SaveQueue('mine', 3, 'tok_dropped_00000000000000', async (_v, revision) => revision + 1, (value, revision, token) => { recovery = { value, revision, token } }, () => { recovery = null })
dropped.edit('mine')
assert.equal(dropped.dirty, true)
dropped.reset('theirs', 11)
assert.equal(dropped.dirty, false)
assert.equal(dropped.value, 'theirs')
assert.equal(dropped.revision, 11)
assert.equal(recovery, null)

console.log('PASS serialized writes, newer edit during in-flight save, shared flush, durable failed save and retry, writer token kept with the recovery data, discard')
