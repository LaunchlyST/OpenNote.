import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authClient } from './lib/auth-client'

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
}

export interface SignUpInput {
  fullName: string
  email: string
  password: string
  avatar?: string
}

export interface AuthConfig {
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
  signIn: (email: string, password: string) => Promise<void>
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
  PASSWORD_TOO_SHORT: 'Your password must be at least 8 characters.',
  PASSWORD_TOO_LONG: 'Your password is too long.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  INVALID_PASSWORD: 'Your current password is incorrect.',
  INVALID_TOKEN: 'This reset link is invalid or has expired. Please request a new one.',
}

type ClientError = { code?: string; message?: string; status?: number } | null | undefined

function fail(error: ClientError, fallback = 'Something went wrong. Please try again.'): never {
  if (error?.status === 429) throw new Error('Too many attempts. Please wait a moment and try again.')
  throw new Error((error?.code && MESSAGES[error.code]) || error?.message || fallback)
}

function origin(): string {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending, refetch } = authClient.useSession()
  const [config, setConfig] = useState<AuthConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    let alive = true
    fetch('/api/auth-config')
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
    }
  }, [data])

  const signUp = useCallback(async ({ fullName, email, password, avatar }: SignUpInput) => {
    const name = fullName.trim()
    if (name.length < 2) throw new Error('Please enter your full name.')
    const { data: res, error } = await authClient.signUp.email({
      name,
      email: email.trim().toLowerCase(),
      password,
      image: avatar,
      callbackURL: `${origin()}/app`,
    })
    if (error) fail(error)
    await refetch()
    return { needsVerification: !res?.token }
  }, [refetch])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await authClient.signIn.email({
      email: email.trim().toLowerCase(),
      password,
      callbackURL: `${origin()}/app`,
    })
    if (error) fail(error)
    await refetch()
  }, [refetch])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${origin()}/app`,
      errorCallbackURL: `${origin()}/app/signin`,
    })
    if (error) fail(error)
  }, [])

  const signOut = useCallback(async () => {
    await authClient.signOut()
    await refetch()
  }, [refetch])

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
