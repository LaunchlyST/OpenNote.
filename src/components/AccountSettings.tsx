import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../auth'
import { useScreen } from '../screens'
import { fileToAvatar } from '../lib/avatar'
import { Avatar } from './Avatar'

function formatJoined(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function LabeledInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-[#5f5e5b]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[#e3e3e0] bg-white px-3 py-2.5 text-[13px] outline-none transition placeholder:text-[#c4c3be] focus:border-[#bef264] focus:ring-2 focus:ring-[#eaf9bf]"
      />
    </label>
  )
}

export function AccountSettings() {
  const { user, updateProfile, changePassword, signOut } = useAuth()
  const { close } = useScreen()

  const [name, setName] = useState(user?.fullName ?? '')
  const [avatar, setAvatar] = useState<string | undefined>(user?.avatar)
  const [saved, setSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwDone, setPwDone] = useState(false)

  if (!user) {
    return (
      <div className="flex min-h-full w-full items-center justify-center bg-[#f7f7f5] p-4">
        <div className="w-full max-w-[360px] rounded-3xl border border-[#e9e9e7] bg-white p-6 text-center shadow-[0_16px_48px_rgba(16,24,40,0.10)]">
          <p className="text-[13px] text-[#5f5e5b]">You are not signed in.</p>
          <button
            type="button"
            onClick={close}
            className="mt-4 w-full rounded-xl px-4 py-2.5 text-[13px] font-semibold transition bg-[#191919] text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:bg-[#37352f]"
          >
            Back to calendar
          </button>
        </div>
      </div>
    )
  }

  const pickAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setAvatar(await fileToAvatar(file))
      setSaved(false)
    } catch {
      /* ignore invalid images */
    }
  }

  const saveProfile = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) return
    setProfileError(null)
    updateProfile({ fullName: trimmed, avatar: avatar ?? null })
      .then(() => {
        setSaved(true)
        window.setTimeout(() => setSaved(false), 2000)
      })
      .catch((err: unknown) =>
        setProfileError(err instanceof Error ? err.message : 'Could not save your profile.'),
      )
  }

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (pwBusy) return
    setPwError(null)
    setPwDone(false)
    if (next !== confirm) {
      setPwError('New passwords do not match.')
      return
    }
    setPwBusy(true)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setPwDone(true)
    } catch (err) {
      setPwError(
        err instanceof Error ? err.message : 'Could not update your password.',
      )
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="scroll-area min-h-full w-full bg-[#f7f7f5] p-4">
      <div className="mx-auto w-full max-w-[520px] py-4">
        <button
          type="button"
          onClick={close}
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-[#8f8e8a] transition hover:text-[#5f5e5b]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to calendar
        </button>

        <div className="rounded-3xl border border-[#e9e9e7] bg-white p-6 shadow-[0_16px_48px_rgba(16,24,40,0.10)]">
          <h1 className="text-[16px] font-semibold tracking-[-0.01em]">
            Account settings
          </h1>
          <p className="text-[11.5px] text-[#8f8e8a]">
            Manage your Desknoty profile.
          </p>

          <form onSubmit={saveProfile} className="mt-5">
            <div className="flex items-center gap-4">
              <Avatar size={64} name={name} src={avatar} />
              <div className="flex flex-col gap-1.5">
                <label className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-lg border border-[#e3e3e0] px-2.5 py-1.5 text-[12px] text-[#37352f] transition hover:bg-[#f7f7f5]">
                  <Camera className="h-3.5 w-3.5" />
                  Upload photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={pickAvatar}
                  />
                </label>
                {avatar && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatar(undefined)
                      updateProfile({ avatar: null }).catch((err: unknown) =>
                        setProfileError(err instanceof Error ? err.message : 'Could not remove your photo.'),
                      )
                    }}
                    className="inline-flex items-center gap-1.5 self-start rounded-lg px-1 py-0.5 text-[11.5px] text-[#8f8e8a] transition hover:text-[#c0392b]"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <LabeledInput
                label="Full name"
                value={name}
                onChange={setName}
                autoComplete="name"
                placeholder="Your name"
              />
            </div>

            <button
              type="submit"
              className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition bg-[#191919] text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:bg-[#37352f] active:scale-[0.99]"
            >
              {saved ? <Check className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
              {saved ? 'Saved' : 'Save changes'}
            </button>
            {profileError && (
              <p role="alert" className="mt-2 text-[12px] text-[#c0392b]">
                {profileError}
              </p>
            )}
          </form>

          <div className="my-5 h-px bg-[#f1f1ef]" />

          <h2 className="text-[12.5px] font-semibold text-[#191919]">
            Account details
          </h2>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 rounded-xl bg-[#fbfbfa] px-3 py-2.5 text-[12.5px] text-[#37352f]">
              <Mail className="h-4 w-4 shrink-0 text-[#8f8e8a]" />
              <span className="min-w-0 flex-1 truncate">{user.email}</span>
              <span className="shrink-0 text-[10.5px] text-[#b4b3ae]">
                Email
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-[#fbfbfa] px-3 py-2.5 text-[12.5px] text-[#37352f]">
              <CalendarDays className="h-4 w-4 shrink-0 text-[#8f8e8a]" />
              <span className="min-w-0 flex-1 truncate">
                Account created {formatJoined(user.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-[#fbfbfa] px-3 py-2.5 text-[12.5px] text-[#37352f]">
              <Sparkles className="h-4 w-4 shrink-0 text-[#8f8e8a]" />
              <span className="min-w-0 flex-1 truncate">
                {user.plan === 'pro' ? 'Desknoty Pro' : 'Desknoty Free'}
              </span>
              <span className="shrink-0 text-[10.5px] text-[#b4b3ae]">
                {user.plan === 'pro' ? 'Plan' : 'Plan · Pro coming soon'}
              </span>
            </div>
          </div>

          <div className="my-5 h-px bg-[#f1f1ef]" />

          <h2 className="text-[12.5px] font-semibold text-[#191919]">
            Change password
          </h2>
          {pwError && (
            <div className="mt-3 rounded-xl bg-[#fdf1f1] px-3 py-2 text-[12px] leading-snug text-[#c0392b]">
              {pwError}
            </div>
          )}
          {pwDone && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#f3fbe3] px-3 py-2 text-[12px] text-[#4b6410]">
              <Check className="h-3.5 w-3.5" />
              Your password has been updated.
            </div>
          )}
          <form onSubmit={submitPassword} className="mt-3 space-y-3">
            <LabeledInput
              label="Current password"
              type="password"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <LabeledInput
                label="New password"
                type="password"
                value={next}
                onChange={setNext}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
              <LabeledInput
                label="Confirm new password"
                type="password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={pwBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-[#e3e3e0] px-4 py-2.5 text-[13px] font-medium text-[#37352f] transition hover:bg-[#f7f7f5] active:scale-[0.99] disabled:opacity-60"
            >
              {pwBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Update password
            </button>
          </form>

          <div className="my-5 h-px bg-[#f1f1ef]" />

          <button
            type="button"
            onClick={() => {
              void signOut().then(close)
            }}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] text-[#c0392b] transition hover:bg-[#fdf1f1]"
          >
            <Trash2 className="h-4 w-4" />
            Log out of Desknoty
          </button>
        </div>
      </div>
    </div>
  )
}
