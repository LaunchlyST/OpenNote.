import { useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  Camera,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
} from 'lucide-react'
import { useAuth } from '../auth'
import { useScreen } from '../screens'
import { fileToAvatar } from '../lib/avatar'
import { cn } from '../lib/id'
import { AppIcon } from '../landing/components/primitives'
import { Avatar } from './Avatar'

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

export function AuthPage() {
  const { screen, goTo, close } = useScreen()
  const { signIn, signUp } = useAuth()
  const isSignup = screen === 'signup'

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [avatar, setAvatar] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const pickAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setAvatar(await fileToAvatar(file))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that image.')
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)

    if (isSignup && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      if (isSignup) {
        await signUp({ fullName, email, password, avatar })
      } else {
        await signIn(email, password)
      }
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

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
          <button
            type="button"
            onClick={close}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/55 px-3.5 py-1.5 text-[12.5px] font-medium text-[#3b4558] shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-white/70 backdrop-blur-md transition hover:bg-white/80"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to calendar
          </button>
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
                    {isSignup ? <UserRoundPlus className="h-6 w-6" strokeWidth={1.8} /> : <LogIn className="h-6 w-6" strokeWidth={1.8} />}
                  </span>
                  <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.03em] text-[#141a26]">
                    {isSignup ? 'Create your account' : 'Welcome back'}
                  </h1>
                  <p className="mt-1.5 max-w-[32ch] text-[14px] leading-relaxed text-[#5e687b]">
                    {isSignup
                      ? 'Your calendar, notes and tasks together in one calm place. Free to start.'
                      : 'Sign in to OpenNote to pick up where you left off.'}
                  </p>
                </div>

                {error && (
                  <div role="alert" className="mt-5 rounded-[12px] border border-[#f6caca] bg-[#fff4f4]/90 px-3.5 py-2.5 text-[13px] leading-snug text-[#b4342a]">
                    {error}
                  </div>
                )}

                <form onSubmit={submit} className="mt-6 space-y-4">
                  {isSignup && (
                    <div className="flex items-center gap-4 rounded-[16px] border border-white bg-white/60 p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                      <label className="group relative shrink-0 cursor-pointer" aria-label={avatar ? 'Change photo' : 'Add photo'}>
                        <span className="block rounded-full ring-4 ring-white transition group-hover:ring-[#d6ebfa]">
                          <Avatar size={56} name={fullName} src={avatar} />
                        </span>
                        <span className="absolute -right-0.5 -bottom-0.5 grid h-6 w-6 place-items-center rounded-full bg-[#141a26] text-white shadow-md ring-2 ring-white">
                          <Camera className="h-3 w-3" />
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
                      </label>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold text-[#1b2232]">Profile photo</p>
                        <p className="text-[12px] text-[#7a8599]">Optional · JPG or PNG</p>
                      </div>
                      <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] max-sm:hidden border border-[#dfe7f0] bg-white px-3 py-2 text-[12.5px] font-medium text-[#2c3547] shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:border-[#c6d6e6] hover:bg-[#f7fafd]">
                        <Camera className="h-3.5 w-3.5" />
                        {avatar ? 'Change photo' : 'Add photo'}
                        <input type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
                      </label>
                    </div>
                  )}

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

                  <Field
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={setPassword}
                    placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    minLength={isSignup ? 8 : undefined}
                    icon={<Lock className="h-4 w-4" />}
                    trailing={<RevealToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
                  />

                  {isSignup && (
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
                    disabled={busy}
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
                    {isSignup ? 'Create account' : 'Sign in'}
                  </button>
                </form>

                {/* Switch */}
                <div className="mt-6 flex items-center gap-3 text-[12px] text-[#8a94a7]">
                  <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,#d5dee8)]" />
                  {isSignup ? 'Already have an account?' : "Don't have an account?"}
                  <span className="h-px flex-1 bg-[linear-gradient(90deg,#d5dee8,transparent)]" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    goTo(isSignup ? 'signin' : 'signup')
                  }}
                  className="mt-3 flex h-11 w-full items-center justify-center rounded-[12px] border border-[#dfe7f0] bg-white/80 text-[14px] font-semibold text-[#1b2232] shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:border-[#c6d6e6] hover:bg-white"
                >
                  {isSignup ? 'Sign in' : 'Create one'}
                </button>
              </div>
            </div>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-[#5e6f86]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Passwords are hashed with PBKDF2 and never stored in plain text.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
