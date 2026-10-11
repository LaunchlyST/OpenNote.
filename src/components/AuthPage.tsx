import { useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  Camera,
  Loader2,
  Lock,
  Mail,
  StickyNote,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../auth'
import { useScreen } from '../screens'
import { fileToAvatar } from '../lib/avatar'
import { Avatar } from './Avatar'

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
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-[#5b6172]">
        {label}
      </span>
      <span className="flex items-center gap-2 rounded-xl border border-[#e4e6ec] bg-white px-3 transition focus-within:border-[#bef264] focus-within:ring-2 focus-within:ring-[#eaf9bf]">
        <span className="text-[#b6bbc7]">{icon}</span>
        <input
          type={type}
          value={value}
          minLength={minLength}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent py-2.5 text-[13px] outline-none placeholder:text-[#c3c7d1]"
        />
      </span>
    </label>
  )
}

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
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scroll-area flex min-h-full w-full items-center justify-center bg-[#f6f7f9] p-4">
      <div className="w-full max-w-[400px]">
        <button
          type="button"
          onClick={close}
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-[#8b90a0] transition hover:text-[#5b6172]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to calendar
        </button>

        <div className="rounded-3xl border border-[#e8eaef] bg-white p-6 shadow-[0_16px_48px_rgba(16,24,40,0.10)]">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#bef264] text-[#3f4a14] shadow-[0_1px_2px_rgba(16,24,40,0.12)]">
              <StickyNote className="h-4 w-4" strokeWidth={2.3} />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold tracking-[-0.01em]">
                {isSignup ? 'Create your account' : 'Welcome back'}
              </h1>
              <p className="text-[11.5px] text-[#8b90a0]">
                {isSignup
                  ? 'Your calendar, notes and tasks — anywhere you sign in.'
                  : 'Sign in to OpenNote to continue.'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-3 rounded-xl bg-[#fdf1f1] px-3 py-2 text-[12px] leading-snug text-[#c0392b]">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {isSignup && (
              <div className="flex items-center gap-3 rounded-2xl border border-[#e8eaef] p-2.5">
                <Avatar size={44} name={fullName} src={avatar} />
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e4e6ec] px-2.5 py-1.5 text-[12px] text-[#3d4354] transition hover:bg-[#f6f7f9]">
                  <Camera className="h-3.5 w-3.5" />
                  {avatar ? 'Change photo' : 'Add photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={pickAvatar}
                  />
                </label>
                <span className="ml-auto text-[10.5px] text-[#b6bbc7]">
                  Optional
                </span>
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
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={isSignup ? 8 : undefined}
              icon={<Lock className="h-4 w-4" />}
            />

            {isSignup && (
              <Field
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={setConfirm}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                icon={<Lock className="h-4 w-4" />}
              />
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#a3d922] px-4 py-2.5 text-[13px] font-semibold text-[#2f3a08] transition hover:bg-[#96cc17] active:scale-[0.99] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center text-[12.5px] text-[#8b90a0]">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setError(null)
                goTo(isSignup ? 'signin' : 'signup')
              }}
              className="font-semibold text-[#5b7d0a] transition hover:underline"
            >
              {isSignup ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>

        <p className="mt-3 text-center text-[10.5px] leading-relaxed text-[#b6bbc7]">
          Passwords are hashed with PBKDF2 and never stored in plain text.
        </p>
      </div>
    </div>
  )
}
