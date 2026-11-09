import assert from 'node:assert/strict'
class Storage {
  private values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}
Object.assign(globalThis, { localStorage: new Storage(), sessionStorage: new Storage() })
const s = await import('../src/lib/session-state.ts')
assert.equal(s.acceptSession('old-session', s.authGeneration(), true), true)
const requestBeforeLogout = s.authGeneration()
assert.equal(s.beginSignOut(), 'old-session')
assert.equal(s.sessionToken(), null)
assert.equal(s.isSignedOut(), true)
assert.equal(s.tokenToRevoke(), 'old-session')
assert.equal(s.acceptSession('late-renewal', requestBeforeLogout), false)
assert.equal(s.acceptSession('late-login', requestBeforeLogout, true), false)
assert.equal(s.acceptSession('cookie-renewal', s.authGeneration()), false)
const logoutGeneration = s.authGeneration()
s.confirmRevocation(logoutGeneration)
assert.equal(s.tokenToRevoke(), null)
assert.equal(s.isSignedOut(), true)
assert.equal(s.acceptSession('new-session', s.authGeneration(), true), true)
assert.equal(s.sessionToken(), 'new-session')
assert.equal(s.isSignedOut(), false)
s.confirmRevocation(logoutGeneration)
assert.equal(s.sessionToken(), 'new-session')
assert.equal(s.acceptSession('stale-token', requestBeforeLogout), false)
assert.equal(s.sessionToken(), 'new-session')
console.log('PASS logout guard, late response rejection, revocation retry, explicit re-login and old logout response isolation')
