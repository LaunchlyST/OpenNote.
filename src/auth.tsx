import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { uid } from './lib/id'
import { useLocalStorage } from './hooks'

/**
 * Local, self-contained authentication for OpenNote.
 *
 * Accounts are stored in this browser. Passwords are never persisted in
 * plain text — each is hashed with PBKDF2 (SHA-256) using a per-account
 * random salt, so only a one-way digest is ever written to storage.
 */

interface Account {
  id: string
  fullName: string
  email: string
  /** ISO timestamp of when the account was first created. */
  createdAt: string
  avatar?: string
  passwordHash: string
  salt: string
  iterations: number
}

/** The public shape of the signed-in user (never includes secrets). */
export interface AuthUser {
  id: string
  fullName: string
  email: string
  createdAt: string
  avatar?: string
}

const ACCOUNTS_KEY = 'opennote.accounts.v1'
const SESSION_KEY = 'opennote.session.v1'
const PBKDF2_ITERATIONS = 150_000

const encoder = new TextEncoder()

function randomSalt(): Uint8Array<ArrayBuffer> {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  return salt
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function deriveHash(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return bytesToBase64(new Uint8Array(bits))
}

/** Length-constant comparison so a wrong password can't be timed. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

function toUser(account: Account): AuthUser {
  return {
    id: account.id,
    fullName: account.fullName,
    email: account.email,
    createdAt: account.createdAt,
    avatar: account.avatar,
  }
}

export interface SignUpInput {
  fullName: string
  email: string
  password: string
  avatar?: string
}

interface AuthContextValue {
  user: AuthUser | null
  signUp: (input: SignUpInput) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  updateProfile: (patch: { fullName?: string; avatar?: string | null }) => void
  changePassword: (current: string, next: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useLocalStorage<Account[]>(ACCOUNTS_KEY, [])
  const [sessionId, setSessionId] = useLocalStorage<string | null>(
    SESSION_KEY,
    null,
  )

  const user = useMemo<AuthUser | null>(() => {
    if (!sessionId) return null
    const account = accounts.find((a) => a.id === sessionId)
    return account ? toUser(account) : null
  }, [accounts, sessionId])

  const signUp = useCallback(
    async ({ fullName, email, password, avatar }: SignUpInput) => {
      const name = fullName.trim()
      const mail = normalizeEmail(email)

      if (name.length < 2) throw new Error('Please enter your full name.')
      if (!isValidEmail(mail)) {
        throw new Error('Please enter a valid email address.')
      }
      if (password.length < 8) {
        throw new Error('Your password must be at least 8 characters.')
      }
      if (accounts.some((a) => a.email === mail)) {
        throw new Error('An account with that email already exists.')
      }

      const salt = randomSalt()
      const passwordHash = await deriveHash(
        password,
        salt,
        PBKDF2_ITERATIONS,
      )
      const account: Account = {
        id: uid('usr'),
        fullName: name,
        email: mail,
        createdAt: new Date().toISOString(),
        avatar,
        passwordHash,
        salt: bytesToBase64(salt),
        iterations: PBKDF2_ITERATIONS,
      }
      setAccounts((list) => [...list, account])
      setSessionId(account.id)
    },
    [accounts, setAccounts, setSessionId],
  )

  const signIn = useCallback(
    async (email: string, password: string) => {
      const mail = normalizeEmail(email)
      const account = accounts.find((a) => a.email === mail)
      if (!account) throw new Error('No account matches that email address.')

      const hash = await deriveHash(
        password,
        base64ToBytes(account.salt),
        account.iterations,
      )
      if (!safeEqual(hash, account.passwordHash)) {
        throw new Error('Incorrect password. Please try again.')
      }
      setSessionId(account.id)
    },
    [accounts, setSessionId],
  )

  const signOut = useCallback(() => setSessionId(null), [setSessionId])

  const updateProfile = useCallback(
    (patch: { fullName?: string; avatar?: string | null }) => {
      if (!sessionId) return
      setAccounts((list) =>
        list.map((account) => {
          if (account.id !== sessionId) return account
          const next: Account = { ...account }
          if (patch.fullName !== undefined) next.fullName = patch.fullName.trim()
          if (patch.avatar !== undefined) next.avatar = patch.avatar ?? undefined
          return next
        }),
      )
    },
    [sessionId, setAccounts],
  )

  const changePassword = useCallback(
    async (current: string, next: string) => {
      if (!sessionId) throw new Error('You are not signed in.')
      const account = accounts.find((a) => a.id === sessionId)
      if (!account) throw new Error('Account not found.')

      const currentHash = await deriveHash(
        current,
        base64ToBytes(account.salt),
        account.iterations,
      )
      if (!safeEqual(currentHash, account.passwordHash)) {
        throw new Error('Your current password is incorrect.')
      }
      if (next.length < 8) {
        throw new Error('Your new password must be at least 8 characters.')
      }

      const salt = randomSalt()
      const passwordHash = await deriveHash(next, salt, PBKDF2_ITERATIONS)
      setAccounts((list) =>
        list.map((a) =>
          a.id === account.id
            ? {
                ...a,
                passwordHash,
                salt: bytesToBase64(salt),
                iterations: PBKDF2_ITERATIONS,
              }
            : a,
        ),
      )
    },
    [accounts, sessionId, setAccounts],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ user, signUp, signIn, signOut, updateProfile, changePassword }),
    [user, signUp, signIn, signOut, updateProfile, changePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
