import assert from 'node:assert/strict'
import { SaveQueue } from '../src/projects/seller/save-queue.ts'

let release!: () => void
let active = 0
let maxActive = 0
const writes: Array<[string, number]> = []
let recovery: unknown
const q = new SaveQueue('original', 0, async (value, revision) => {
  active++; maxActive = Math.max(maxActive, active); writes.push([value, revision])
  if (writes.length === 1) await new Promise<void>(resolve => { release = resolve })
  active--; return revision + 1
}, (value, revision) => { recovery = { value, revision } }, () => { recovery = null })
q.edit('first')
const first = q.flush()
q.edit('newer')
const second = q.flush()
release()
await Promise.all([first, second])
assert.deepEqual(writes, [['first', 0], ['newer', 1]])
assert.equal(maxActive, 1)
assert.equal(recovery, null)
assert.equal(q.dirty, false)

let fail = true
const retry = new SaveQueue('old', 4, async () => {
  if (fail) throw new Error('network offline')
  return 5
}, value => { recovery = value }, () => { recovery = null })
retry.edit('recover me')
await assert.rejects(retry.flush(), /offline/)
assert.equal(recovery, 'recover me')
assert.equal(retry.dirty, true)
fail = false
await retry.flush()
assert.equal(recovery, null)
assert.equal(retry.revision, 5)
console.log('PASS serialized writes, newer edit during in-flight save, shared flush, durable failed save and retry')
