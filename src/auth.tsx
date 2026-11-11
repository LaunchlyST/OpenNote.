import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { acceptSession, authGeneration, beginSignOut, confirmRevocation, isSignedOut, tokenToRevoke } from './lib/session-state'
import type { ReactNode } from 'react'
import { authClient } from './lib/auth-client'
import { apiUrl } from './lib/api-base'
import { blockCacheWrites, clearAllUserCaches, clearOtherUserCaches } from './lib/local-cache'
import { flushPendingSave, stopSync } from './sync'

/** `AbortSignal.timeout` is missing in older browsers; never let that skip the request. */
function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms)
    }
  } catch {
    /* fall through */
  }
  return undefined
}

/** Retry revocation without allowing a network failure to restore the UI session. */
async function revokeSession(token = tokenToRevoke()) {
  const expected = authGeneration()
  const response = await fetch(apiUrl('/api/auth/sign-out'), {
    method: 'POST', credentials: token ? 'omit' : 'include', keepalive: true,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: timeoutSignal(5000),
  })
  if (!response.ok) throw new Error('Could not finish signing out. Please try again.')
  confirmRevocation(expected)
}

/**
 * Authentication for OpenNote, backed by Better Auth.
 *
 * Accounts, password hashes and sessions live on the server (see `server/`).
 * The browser only holds an httpOnly session cookie. This module keeps the
 * same `useAuth()` shape the UI already used, so screens did not change.
 */

/** The public shape of the signed-in user (never includes secrets). */
export interface AuthUser {
  id: string
  fullName: string
  email: string
  createdAt: string
  avatar?: string
  emailVerified: boolean
  /** 'admin' or 'user', assigned by the server. Display only — the API enforces it. */
  role: 'admin' | 'user'
  /** Subscription plan, set by the server only. Pro is not on sale yet. */
  plan: 'free' | 'pro'
}

export interface SignUpInput {
  fullName: string
  email: string
  password: string
  avatar?: string
}

export interface AuthConfig {
  /** Google sign-in is configured on the server. */
  google: boolean
  emailVerificationRequired: boolean
  emailEnabled: boolean
}

export interface SignUpResult {
  /** True when the account exists but the email must be verified first. */
  needsVerification: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  /** True while the session is first being checked. */
  loading: boolean
  config: AuthConfig
  signUp: (input: SignUpInput) => Promise<SignUpResult>
  /** `rememberMe: false` gives a session that ends when the browser closes. */
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  /** Sends the browser to Google's own sign-in page (account chooser). */
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (patch: { fullName?: string; avatar?: string | null }) => Promise<void>
  changePassword: (current: string, next: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  resetPassword: (token: string, password: string) => Promise<void>
  resendVerification: (email: string) => Promise<void>
}

const DEFAULT_CONFIG: AuthConfig = { google: false, emailVerificationRequired: false, emailEnabled: false }

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Incorrect email or password. Please try again.',
  USER_ALREADY_EXISTS: 'An account with that email already exists.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account with that email already exists.',
  EMAIL_NOT_VERIFIED: 'Please verify your email first. We have sent you a new verification link.',
  PASSWORD_TOO_SHORT: 'Your password must be at least 10 characters.',
  PASSWORD_TOO_LONG: 'Your password is too long.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  INVALID_PASSWORD: 'Your current password is incorrect.',
  INVALID_TOKEN: 'This reset link is invalid or has expired. Please request a new one.',
  SIGNUP_CLOSED: 'Sign-up is invite only for now. Join the waitlist instead.',
}

/** No auth server behind this page (the static site) or it is down. */
const NO_SERVER = 'Accounts aren’t open on this site yet. Join the waitlist and we’ll email you when they are.'

type ClientError = { code?: string; message?: string; status?: number } | null | undefined

function fail(error: ClientError, fallback = 'Something went wrong. Please try again.'): never {
  if (error?.status === 429) throw new Error('Too many attempts. Please wait a moment and try again.')
  // a static host answers auth routes with 404/405; a missing server with 5xx or nothing
  if (!error?.code && (!error?.status || [404, 405, 502, 503, 504].includes(error.status))) throw new Error(NO_SERVER)
  throw new Error((error?.code && MESSAGES[error.code]) || error?.message || fallback)
}

function origin(): string {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: liveData, isPending: livePending, refetch } = authClient.useSession()

  // A previous sign-out that the server never confirmed (offline, server
  // down): finish it before showing anything, so the old session cannot
  // quietly bring the workspace back.
  const [signedOutHere, setSignedOutHere] = useState(isSignedOut)
  useEffect(() => {
    const update = () => setSignedOutHere(isSignedOut())
    window.addEventListener('storage', update)
    if (isSignedOut()) {
      clearAllUserCaches()
      void revokeSession().catch(() => {})
    }
    return () => window.removeEventListener('storage', update)
  }, [])
  const data = signedOutHere || isSignedOut() ? null : liveData
  const isPending = !isSignedOut() && livePending

  // Whoever is signed in now, no other account's cached copy stays in this browser.
  const currentId = data?.user?.id
  useEffect(() => {
    if (currentId) clearOtherUserCaches(currentId)
  }, [currentId])
  const [config, setConfig] = useState<AuthConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    let alive = true
    fetch(apiUrl('/api/auth-config'))
      .then((r) => (r.ok ? r.json() : DEFAULT_CONFIG))
      .then((c: AuthConfig) => alive && setConfig(c))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const user = useMemo<AuthUser | null>(() => {
    const u = data?.user
    if (!u) return null
    return {
      id: u.id,
      fullName: u.name,
      email: u.email,
      createdAt: new Date(u.createdAt).toISOString(),
      avatar: u.image ?? undefined,
      emailVerified: u.emailVerified,
      role: (u as { role?: string | null }).role === 'admin' ? 'admin' : 'user',
      plan: (u as { plan?: string | null }).plan === 'pro' ? 'pro' : 'free',
    }
  }, [data])

  const signUp = useCallback(async ({ fullName, email, password, avatar }: SignUpInput) => {
    const name = fullName.trim()
    if (name.length < 2) throw new Error('Please enter your full name.')
    const expected = authGeneration()
    const { data: res, error } = await authClient.signUp.email({
      name,
      email: email.trim().toLowerCase(),
      password,
      image: avatar,
      callbackURL: `${origin()}/app`,
    })
    if (error) fail(error)
    if (acceptSession(res?.token ?? null, expected, true)) setSignedOutHere(false)
    await refetch()
    return { needsVerification: !res?.token }
  }, [refetch])

  const signIn = useCallback(async (email: string, password: string, rememberMe = true) => {
    const expected = authGeneration()
    const { data: res, error } = await authClient.signIn.email({
      email: email.trim().toLowerCase(),
      password,
      rememberMe,
      callbackURL: `${origin()}/app`,
    })
    if (error) fail(error)
    if (!acceptSession(res?.token ?? null, expected, true)) return
    setSignedOutHere(false)
    await refetch()
  }, [refetch])

  const signInWithGoogle = useCallback(async () => {
    const expected = authGeneration()
    if (isSignedOut()) {
      await revokeSession()
      if (!acceptSession(null, expected, true)) return
      setSignedOutHere(false)
    }
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${origin()}/app`,
      // Cancelled or failed Google sign-ins come back here with ?error=...
      errorCallbackURL: `${origin()}/app/signin`,
      newUserCallbackURL: `${origin()}/app`,
    })
    if (error) fail(error, 'Google sign-in could not start. Please try again.')
  }, [])

  /**
   * Sign-out, in an order that keeps the UI signed out no matter what:
   * 1. drop the stored bearer token first, so nothing can restore the session,
   * 2. stop syncing and block cache writes, so a late save cannot bring data back,
   * 3. wipe this browser's cached workspaces,
   * 4. tell the server to end the session in the background (keepalive lets it
   *    finish after the page has gone; if it fails, the pending flag makes the
   *    next page load retry it),
   * 5. leave for the sign-in page straight away — no network call can stall it.
   */
  const signOut = useCallback(async () => {
    try {
      // Set the guard before removing the token: late responses cannot restore it.
      const token = beginSignOut()
      setSignedOutHere(true)
      stopSync()
      blockCacheWrites()
      clearAllUserCaches()
      void flushPendingSave().catch(() => {})
      void revokeSession(token).catch(() => {})
    } catch {
      /* even if a helper fails, the click must still leave the page */
    } finally {
      window.location.replace('/app/signin')
    }
  }, [])

  const updateProfile = useCallback(async (patch: { fullName?: string; avatar?: string | null }) => {
    const body: { name?: string; image?: string | null } = {}
    if (patch.fullName !== undefined) body.name = patch.fullName.trim()
    if (patch.avatar !== undefined) body.image = patch.avatar
    const { error } = await authClient.updateUser(body)
    if (error) fail(error)
    await refetch()
  }, [refetch])

  const changePassword = useCallback(async (current: string, next: string) => {
    if (next.length < 8) throw new Error('Your new password must be at least 8 characters.')
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    })
    if (error) fail(error)
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await authClient.requestPasswordReset({
      email: email.trim().toLowerCase(),
      redirectTo: `${origin()}/app/reset-password`,
    })
    if (error) fail(error)
  }, [])

  const resetPassword = useCallback(async (token: string, password: string) => {
    const { error } = await authClient.resetPassword({ token, newPassword: password })
    if (error) fail(error)
  }, [])

  const resendVerification = useCallback(async (email: string) => {
    const { error } = await authClient.sendVerificationEmail({
      email: email.trim().toLowerCase(),
      callbackURL: `${origin()}/app`,
    })
    if (error) fail(error)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading: isPending,
      config,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      updateProfile,
      changePassword,
      requestPasswordReset,
      resetPassword,
      resendVerification,
    }),
    [user, isPending, config, signUp, signIn, signInWithGoogle, signOut, updateProfile, changePassword, requestPasswordReset, resetPassword, resendVerification],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Supplies a fixed auth state without a server. Used by the SSR smoke test to
 * render signed-in and signed-out screens.
 */
export function StaticAuthProvider({ user, children }: { user: AuthUser | null; children: ReactNode }) {
  const value = useMemo<AuthContextValue>(() => {
    const noop = async () => {}
    return {
      user,
      loading: false,
      config: DEFAULT_CONFIG,
      signUp: async () => ({ needsVerification: false }),
      signIn: noop,
      signInWithGoogle: noop,
      signOut: noop,
      updateProfile: noop,
      changePassword: noop,
      requestPasswordReset: noop,
      resetPassword: noop,
      resendVerification: noop,
    }
  }, [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
