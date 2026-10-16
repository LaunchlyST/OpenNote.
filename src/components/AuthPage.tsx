import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  LogIn,
  Lock,
  Mail,
  MailCheck,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
} from 'lucide-react'
import { useAuth } from '../auth'
import { useScreen } from '../screens'
import { takeOAuthErrorFromUrl } from '../lib/oauth-error'
import { cn } from '../lib/id'
import { AppIcon } from '../landing/components/primitives'

/* ------------------------------------------------------------------ */
/* Atmosphere                                                          */
/* ------------------------------------------------------------------ */

/**
 * Soft morning-sky backdrop: a vertical blue-to-white gradient, a few blurred
 * cloud banks low on the page and two faint orbit arcs behind the card. Pure
 * CSS, decorative only.
 */
function SkyBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#9fd0f2_0%,#bfe0f7_32%,#e3f1fb_62%,#f7fbfe_100%)]" />
      {/* sun glow */}
      <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.75),transparent)]" />
      {/* orbit arcs */}
      <div className="absolute top-[18%] left-1/2 h-[1100px] w-[1100px] -translate-x-1/2 rounded-full border border-white/45" />
      <div className="absolute top-[30%] left-1/2 h-[1400px] w-[1400px] -translate-x-1/2 rounded-full border border-white/30" />
      {/* clouds */}
      <div className="absolute -bottom-24 -left-24 h-[340px] w-[560px] rounded-full bg-white/80 blur-3xl" />
      <div className="absolute -bottom-32 left-[28%] h-[300px] w-[620px] rounded-full bg-white/90 blur-3xl" />
      <div className="absolute -right-24 -bottom-20 h-[360px] w-[560px] rounded-full bg-white/85 blur-3xl" />
      <div className="absolute bottom-[22%] -left-40 h-[180px] w-[420px] rounded-full bg-white/50 blur-2xl" />
      <div className="absolute right-[-120px] bottom-[30%] h-[160px] w-[380px] rounded-full bg-white/45 blur-2xl" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

function Field({
  label,
  icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
  minLength,
  trailing,
}: {
  label: string
  icon: ReactNode
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  autoFocus?: boolean
  minLength?: number
  trailing?: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-[#4a5265]">{label}</span>
      <span className="group flex items-center gap-2.5 rounded-[12px] border border-transparent bg-[#eef3f8] px-3.5 transition-[background-color,border-color,box-shadow] duration-200 hover:bg-[#e8eff6] focus-within:border-[#9cc9ec] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(125,185,235,0.18)]">
        <span className="text-[#8f9bb0] transition-colors group-focus-within:text-[#3d84c6]">{icon}</span>
        <input
          type={type}
          value={value}
          minLength={minLength}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          // The field's own glow is the focus indicator; drop the app-wide outline.
          style={{ outline: 'none' }}
          className="w-full bg-transparent py-3 text-[14px] text-[#1b2232] outline-none placeholder:text-[#9aa5b8]"
        />
        {trailing}
      </span>
    </label>
  )
}

function RevealToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Hide password' : 'Show password'}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#8f9bb0] transition hover:bg-black/[0.04] hover:text-[#4a5265]"
    >
      {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type Mode = 'signin' | 'signup' | 'forgot' | 'reset'

const HEADINGS: Record<Mode, { title: string; body: string }> = {
  signup: {
    title: 'Create your account',
    body: 'Your calendar, notes and tasks together in one calm place. Free to start.',
  },
  signin: { title: 'Welcome back', body: 'Sign in to OpenNote to pick up where you left off.' },
  forgot: {
    title: 'Reset your password',
    body: 'Enter your account email and we will send you a link to choose a new password.',
  },
  reset: { title: 'Choose a new password', body: 'Pick a new password for your OpenNote account.' },
}

function readResetToken(): { token: string | null; invalid: boolean } {
  if (typeof window === 'undefined') return { token: null, invalid: false }
  const params = new URLSearchParams(window.location.search)
  return { token: params.get('token'), invalid: params.get('error') === 'INVALID_TOKEN' }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  )
}

export function AuthPage() {
  const { screen, goTo, close } = useScreen()
  const { user, config, signIn, signUp, signInWithGoogle, requestPasswordReset, resetPassword, resendVerification } =
    useAuth()
  const mode: Mode = screen === 'signup' || screen === 'forgot' || screen === 'reset' ? screen : 'signin'
  const isSignup = mode === 'signup'
  const [reset] = useState(readResetToken)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(
    mode === 'reset' && (reset.invalid || !reset.token)
      ? 'This reset link is invalid or has expired. Please request a new one.'
      : null,
  )
  /** Success message that replaces the form, e.g. "check your email". */
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  /** A cancelled or failed Google round trip returns here with ?error=… */
  useEffect(() => {
    const fromGoogle = takeOAuthErrorFromUrl()
    if (fromGoogle) setError(fromGoogle)
  }, [])
  const [googleBusy, setGoogleBusy] = useState(false)

  /** Checked: stay signed in for 30 days. Unchecked: until the browser closes. */
  const [rememberMe, setRememberMe] = useState(true)

  const switchTo = (next: Mode) => {
    setError(null)
    setNotice(null)
    setPassword('')
    setConfirm('')
    goTo(next)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)

    if ((mode === 'signup' || mode === 'reset') && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signup') {
        const { needsVerification } = await signUp({ fullName, email, password })
        if (needsVerification) {
          setNotice({
            title: 'Check your email',
            body: `We sent a verification link to ${email.trim()}. Open it to finish creating your account.`,
          })
          return
        }
        close()
      } else if (mode === 'signin') {
        await signIn(email, password, rememberMe)
        close()
      } else if (mode === 'forgot') {
        await requestPasswordReset(email)
        setNotice({
          title: 'Check your email',
          body: `If an account exists for ${email.trim()}, you will get a link to reset your password. It expires in one hour.`,
        })
      } else {
        if (!reset.token) throw new Error('This reset link is invalid or has expired. Please request a new one.')
        await resetPassword(reset.token, password)
        // Drop the used token from the address bar.
        window.history.replaceState(null, '', '/app/signin')
        setPassword('')
        setConfirm('')
        goTo('signin')
        setNotice({ title: 'Password updated', body: 'You can now sign in with your new password.' })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const heading = notice ?? HEADINGS[mode]
  const HeaderIcon = mode === 'signup' ? UserRoundPlus : mode === 'signin' ? LogIn : KeyRound
  const showForm = !notice || (mode === 'signin' && notice.title === 'Password updated')
  const primaryLabel = { signup: 'Create account', signin: 'Sign in', forgot: 'Send reset link', reset: 'Update password' }[mode]

  return (
    <div className="scroll-area relative min-h-full w-full overflow-x-hidden">
      <SkyBackdrop />

      <div className="relative flex min-h-full flex-col px-4 py-5 sm:px-8 sm:py-7">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <AppIcon className="h-7 w-7 text-[28px]" />
            <span className="text-[15.5px] font-semibold tracking-[-0.02em] text-[#141a26]">OpenNote</span>
          </span>
          {user ? (
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/55 px-3.5 py-1.5 text-[12.5px] font-medium text-[#3b4558] shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-white/70 backdrop-blur-md transition hover:bg-white/80"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to calendar
            </button>
          ) : (
            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/55 px-3.5 py-1.5 text-[12.5px] font-medium text-[#3b4558] shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-white/70 backdrop-blur-md transition hover:bg-white/80"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </a>
          )}
        </div>

        {/* Card */}
        <div className="flex flex-1 items-center justify-center py-8 sm:py-10">
          <div className="animate-sheet w-full max-w-[440px]">
            <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/70 p-6 shadow-[0_30px_80px_-24px_rgba(30,80,130,0.35),0_8px_24px_-12px_rgba(30,80,130,0.18)] backdrop-blur-2xl sm:p-8">
              {/* glass sheen */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#d6f0fb]/80 to-transparent" />

              <div className="relative">
                {/* Header */}
                <div className="flex flex-col items-center text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-white text-[#1b2232] shadow-[0_10px_24px_-10px_rgba(30,80,130,0.45),inset_0_-1px_0_rgba(16,24,40,0.06)] ring-1 ring-black/[0.04]">
                    {notice ? <MailCheck className="h-6 w-6" strokeWidth={1.8} /> : <HeaderIcon className="h-6 w-6" strokeWidth={1.8} />}
                  </span>
                  <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.03em] text-[#141a26]">{heading.title}</h1>
                  <p className="mt-1.5 max-w-[34ch] text-[14px] leading-relaxed text-[#5e687b]">{heading.body}</p>
                </div>

                {error && (
                  <div role="alert" className="mt-5 rounded-[12px] border border-[#f6caca] bg-[#fff4f4]/90 px-3.5 py-2.5 text-[13px] leading-snug text-[#b4342a]">
                    {error}
                  </div>
                )}

                {showForm && (
                  <form onSubmit={submit} className="mt-6 space-y-4">
                    {isSignup && (
                      <Field
                        label="Full name"
                        value={fullName}
                        onChange={setFullName}
                        placeholder="Ada Lovelace"
                        autoComplete="name"
                        autoFocus
                        icon={<UserRound className="h-4 w-4" />}
                      />
                    )}

                    {mode !== 'reset' && (
                      <Field
                        label="Email address"
                        type="email"
                        value={email}
                        onChange={setEmail}
                        placeholder="you@example.com"
                        autoComplete="email"
                        autoFocus={!isSignup}
                        icon={<Mail className="h-4 w-4" />}
                      />
                    )}

                    {mode !== 'forgot' && (
                      <div>
                        <Field
                          label={mode === 'reset' ? 'New password' : 'Password'}
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={setPassword}
                          placeholder={mode === 'signin' ? 'Your OpenNote password' : 'At least 10 characters'}
                          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                          minLength={mode === 'signin' ? undefined : 10}
                          autoFocus={mode === 'reset'}
                          icon={<Lock className="h-4 w-4" />}
                          trailing={<RevealToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
                        />
                        {mode === 'signin' && (
                          <div className="mt-2.5 flex items-center justify-between">
                            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-[#4a5265] select-none">
                              <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 cursor-pointer rounded-[5px] accent-[#141a26]"
                              />
                              Remember me
                            </label>
                            <button
                              type="button"
                              onClick={() => switchTo('forgot')}
                              className="text-[12.5px] font-medium text-[#2f6fae] transition hover:text-[#1d4f82] hover:underline"
                            >
                              Forgot password?
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {(isSignup || mode === 'reset') && (
                      <Field
                        label="Confirm password"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirm}
                        onChange={setConfirm}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        icon={<Lock className="h-4 w-4" />}
                        trailing={<RevealToggle shown={showConfirm} onToggle={() => setShowConfirm((s) => !s)} />}
                      />
                    )}

                    <button
                      type="submit"
                      disabled={busy || (mode === 'reset' && !reset.token)}
                      className={cn(
                        'group relative mt-2 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[12px] text-[14.5px] font-semibold text-white',
                        'bg-[linear-gradient(180deg,#2b3242_0%,#141a26_100%)] shadow-[0_12px_24px_-10px_rgba(20,26,38,0.65),inset_0_1px_0_rgba(255,255,255,0.14)]',
                        'transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_16px_30px_-10px_rgba(20,26,38,0.7),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-0 disabled:opacity-60',
                      )}
                    >
                      {/* moving gloss */}
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/15 transition-transform duration-700 ease-out group-hover:translate-x-[420%]"
                      />
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      {primaryLabel}
                    </button>

                    {(mode === 'signin' || mode === 'signup') && (
                      <>
                        <div className="flex items-center gap-3 pt-1 text-[11.5px] font-medium text-[#8a94a7]">
                          <span className="h-px flex-1 bg-[#e3e9f0]" />
                          or continue with
                          <span className="h-px flex-1 bg-[#e3e9f0]" />
                        </div>
                        <button
                          type="button"
                          disabled={!config.google || googleBusy}
                          onClick={() => {
                            setError(null)
                            setGoogleBusy(true)
                            // Leaves OpenNote for Google's own page; the Google
                            // password is only ever typed there.
                            signInWithGoogle().catch((err: unknown) => {
                              setGoogleBusy(false)
                              setError(err instanceof Error ? err.message : 'Google sign-in could not start.')
                            })
                          }}
                          className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[12px] border border-[#dfe7f0] bg-white/80 text-[14px] font-semibold text-[#1b2232] shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:border-[#c6d6e6] hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {googleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                          Continue with Google
                        </button>
                        {!config.google && (
                          <p className="-mt-2 text-center text-[11.5px] text-[#8a94a7]">
                            Google sign-in is not set up on this server yet.
                          </p>
                        )}
                      </>
                    )}

                  </form>
                )}

                {notice && notice.title === 'Check your email' && mode === 'signup' && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      resendVerification(email).catch((err: unknown) =>
                        setError(err instanceof Error ? err.message : 'Could not resend the email.'),
                      )
                    }}
                    className="mt-6 flex h-11 w-full items-center justify-center rounded-[12px] border border-[#dfe7f0] bg-white/80 text-[14px] font-semibold text-[#1b2232] transition hover:bg-white"
                  >
                    Resend verification email
                  </button>
                )}

                {/* Switch */}
                <div className="mt-6 flex items-center gap-3 text-[12px] text-[#8a94a7]">
                  <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,#d5dee8)]" />
                  {isSignup ? 'Already have an account?' : mode === 'signin' ? "Don't have an account?" : 'Remembered it?'}
                  <span className="h-px flex-1 bg-[linear-gradient(90deg,#d5dee8,transparent)]" />
                </div>
                <button
                  type="button"
                  onClick={() => switchTo(mode === 'signin' ? 'signup' : 'signin')}
                  className="mt-3 flex h-11 w-full items-center justify-center rounded-[12px] border border-[#dfe7f0] bg-white/80 text-[14px] font-semibold text-[#1b2232] shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:border-[#c6d6e6] hover:bg-white"
                >
                  {mode === 'signin' ? 'Create one' : 'Sign in'}
                </button>
              </div>
            </div>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-[#5e6f86]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Passwords are securely hashed and never stored in plain text.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
