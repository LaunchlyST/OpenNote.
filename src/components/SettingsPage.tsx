import { useEffect, useMemo, useRef, useState } from 'react'
import { Logo } from '../landing/components/primitives'
import { AccountMenu } from '../projects/MyProjects'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  Bell,
  BellRing,
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  Eye,
  Globe,
  ImageUp,
  KeyRound,
  LayoutGrid,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  Rocket,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Tags,
  Trash2,
  UserRound,
  ZoomIn,
} from 'lucide-react'
import { useApp } from '../store'
import type { SettingsSectionId } from '../store'
import { useAuth } from '../auth'
import { authClient } from '../lib/auth-client'
import { fileToAvatar } from '../lib/avatar'
import { COLORS, COLOR_IDS } from '../lib/colors'
import { cn } from '../lib/id'
import { ZOOM_LEVELS } from '../lib/slots'
import { ACCENTS, formatDate, usePreferences } from '../preferences'
import type { AccentId, Preferences } from '../preferences'
import { inQuietHours, notificationPermission } from '../hooks/reminders'
import { Avatar } from './Avatar'
import { DeployPanel } from './DeployPanel'
import {
  Badge,
  Button,
  ComingSoon,
  Field,
  SaveStatus,
  SegmentedControl,
  Select,
  SettingsCard,
  SettingsRow,
  Toggle,
} from './SettingsSection'

interface SectionDef {
  id: SettingsSectionId
  label: string
  icon: ReactNode
}

const ICON = 'h-4 w-4'
const SECTIONS: SectionDef[] = [
  { id: 'profile', label: 'Profile', icon: <UserRound className={ICON} /> },
  { id: 'account', label: 'Account', icon: <SettingsIcon className={ICON} /> },
  { id: 'general', label: 'General', icon: <Globe className={ICON} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className={ICON} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className={ICON} /> },
  { id: 'calendar', label: 'Calendar Preferences', icon: <CalendarDays className={ICON} /> },
  { id: 'security', label: 'Security', icon: <Shield className={ICON} /> },
  { id: 'billing', label: 'Billing', icon: <CreditCard className={ICON} /> },
  { id: 'deploy', label: 'Deploy', icon: <Rocket className={ICON} /> },
]

export const SECTION_KEY = 'opennote.settings-section'
const DEVICE_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'
  } catch {
    return 'Unknown'
  }
})()

function SectionShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#191919]">{title}</h2>
      <p className="mt-1 text-[13px] leading-snug text-[#8f8e8a]">{description}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  )
}

function useDateFormat() {
  const { dateFormat } = usePreferences().preferences
  return (iso: string | Date) => {
    const d = typeof iso === 'string' ? new Date(iso) : iso
    return Number.isNaN(d.getTime()) ? 'Unknown' : formatDate(d, dateFormat)
  }
}

/** The sign-in methods on this account, from Better Auth (credential = email & password). */
function useAccounts() {
  const [providers, setProviders] = useState<string[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    authClient
      .listAccounts()
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e || !data) setError(true)
        else setProviders(data.map((a) => a.providerId))
      })
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])
  return { providers, error }
}

const providerLabel = (id: string) => (id === 'credential' ? 'Email & password' : id === 'google' ? 'Google' : id)

/** Saves an account preference and reports the result inline. */
function usePrefSaver() {
  const { update } = usePreferences()
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<number | undefined>(undefined)
  const save = async (patch: Partial<Preferences>) => {
    setState('saving')
    const ok = await update(patch)
    setState(ok ? 'saved' : 'error')
    window.clearTimeout(timer.current)
    if (ok) timer.current = window.setTimeout(() => setState('idle'), 1600)
  }
  return { save, state }
}

function ProjectTag() {
  return <span className="ml-1 rounded bg-[#f1f1ef] px-1 py-[1px] text-[10px] font-medium text-[#8f8e8a]">this project</span>
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

function ProfileSection() {
  const { user, updateProfile } = useAuth()
  const fmt = useDateFormat()
  const [name, setName] = useState(user?.fullName ?? '')
  const [nameState, setNameState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [nameError, setNameError] = useState<string | null>(null)
  const [photoState, setPhotoState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [photoError, setPhotoError] = useState<string | null>(null)

  if (!user) return null
  const trimmed = name.trim()
  const invalid = trimmed.length < 2 ? 'Use at least 2 characters.' : trimmed.length > 60 ? 'Use at most 60 characters.' : null
  const dirty = trimmed !== user.fullName

  const savePhoto = async (avatar: string | null) => {
    setPhotoState('saving')
    setPhotoError(null)
    try {
      await updateProfile({ avatar })
      setPhotoState('saved')
    } catch (err) {
      setPhotoState('error')
      setPhotoError(err instanceof Error ? err.message : 'Your photo could not be saved.')
    }
  }

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await savePhoto(await fileToAvatar(file))
    } catch (err) {
      setPhotoState('error')
      setPhotoError(err instanceof Error ? err.message : 'That image could not be used.')
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (invalid) {
      setNameError(invalid)
      return
    }
    setNameError(null)
    setNameState('saving')
    try {
      await updateProfile({ fullName: trimmed })
      setNameState('saved')
    } catch (err) {
      setNameState('error')
      setNameError(err instanceof Error ? err.message : 'Your name could not be saved.')
    }
  }

  return (
    <SectionShell title="Profile" description="How you appear in OpenNote.">
      <div className="flex items-center gap-4 rounded-2xl border border-[#ececea] bg-gradient-to-br from-white to-[#f7f7f5] p-5">
        <Avatar size={64} name={user.fullName} src={user.avatar} />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold tracking-[-0.01em] text-[#191919]" data-testid="profile-preview-name">
            {user.fullName || 'Your name'}
          </p>
          <p className="truncate text-[13px] text-[#6b6a66]">{user.email}</p>
          <p className="mt-1 text-[11.5px] text-[#a3a29e]">Member since {fmt(user.createdAt)}</p>
        </div>
      </div>

      <SettingsCard title="Profile picture" description="A square image works best. It is resized and saved to your account." icon={<ImageUp className="h-3.5 w-3.5" />}>
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <Avatar size={52} name={user.fullName} src={user.avatar} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] bg-[#191919] px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-[#37352f]">
              {user.avatar ? 'Replace photo' : 'Upload photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={pick} aria-label="Upload profile photo" />
            </label>
            {user.avatar && (
              <Button variant="secondary" onClick={() => void savePhoto(null)}>
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            )}
            <SaveStatus state={photoState} error={photoError} />
          </div>
        </div>
      </SettingsCard>

      <form onSubmit={save}>
        <SettingsCard title="Personal details" icon={<UserRound className="h-3.5 w-3.5" />}>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field
              label="Display name"
              value={name}
              maxLength={60}
              onChange={(v) => {
                setName(v)
                setNameState('idle')
                setNameError(null)
              }}
              autoComplete="name"
              error={nameError}
            />
            <Field label="Email address" value={user.email} onChange={() => {}} disabled hint="Your sign-in email. See Account." />
            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-[#5f5e5b]">Time zone</span>
              <div className="flex h-10 items-center rounded-[10px] border border-[#e3e3e0] bg-[#f7f7f5] px-3 text-[13px] text-[#37352f]">
                {DEVICE_TZ}
              </div>
              <span className="mt-1 block text-[11.5px] text-[#8f8e8a]">From this device. Calendar times use it.</span>
            </div>
            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-[#5f5e5b]">Language</span>
              <Select ariaLabel="Language" value="en" onChange={() => {}} options={[{ value: 'en', label: 'English' }]} />
              <span className="mt-1 block text-[11.5px] text-[#8f8e8a]">More languages will come with translations.</span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-5 py-3">
            <SaveStatus state={nameState} error={nameState === 'error' ? nameError : null} />
            <Button type="submit" disabled={!dirty || nameState === 'saving'}>
              {nameState === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </SettingsCard>
      </form>
    </SectionShell>
  )
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const { error: e } = await authClient.deleteUser(hasPassword ? { password } : {})
      if (e) throw new Error(e.message || 'Your account could not be deleted.')
      window.location.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your account could not be deleted.')
      setBusy(false)
    }
  }

  if (!open)
    return (
      <SettingsRow label="Delete account" hint="Permanently deletes your account, every project, event and note. This cannot be undone.">
        <Button variant="danger" onClick={() => setOpen(true)}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete account
        </Button>
      </SettingsRow>
    )

  return (
    <div className="space-y-3 px-5 py-4" data-testid="delete-confirm">
      <p className="text-[12.5px] leading-snug text-[#6b3a35]">
        This permanently deletes your OpenNote account and all of its projects, events and notes. There is no undo.
      </p>
      <Field label='Type "DELETE" to confirm' value={typed} onChange={setTyped} autoComplete="off" />
      {hasPassword ? (
        <Field label="Your password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      ) : (
        <p className="text-[11.5px] text-[#8f8e8a]">For Google accounts you may be asked to sign in again first if your last sign-in was not recent.</p>
      )}
      {error && <p className="text-[12px] text-[#b4453c]">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger-solid" onClick={() => void confirm()} disabled={busy || typed !== 'DELETE' || (hasPassword && !password)}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Delete my account
        </Button>
      </div>
    </div>
  )
}

function AccountSection() {
  const { user, signOut } = useAuth()
  const fmt = useDateFormat()
  const { providers, error } = useAccounts()
  if (!user) return null
  const hasPassword = !!providers?.includes('credential')

  return (
    <SectionShell title="Account" description="Your sign-in details and account controls.">
      <SettingsCard title="Account information" icon={<Mail className="h-3.5 w-3.5" />}>
        <SettingsRow label="Email address">
          <span className="text-[13px] font-medium text-[#191919]">{user.email}</span>
        </SettingsRow>
        <SettingsRow label="Created">
          <span className="text-[13px] text-[#37352f]">{fmt(user.createdAt)}</span>
        </SettingsRow>
        <SettingsRow label="Sign-in method">
          {providers ? (
            <span className="flex flex-wrap gap-1.5" data-testid="providers">
              {providers.map((p) => (
                <Badge key={p}>{providerLabel(p)}</Badge>
              ))}
            </span>
          ) : error ? (
            <span className="text-[12px] text-[#b4453c]">Could not load</span>
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-[#a3a29e]" />
          )}
        </SettingsRow>
        <SettingsRow label="Status">
          {user.emailVerified ? <Badge tone="success">Active · Email verified</Badge> : <Badge tone="warning">Active · Email not verified</Badge>}
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Account management" icon={<Link2 className="h-3.5 w-3.5" />}>
        <SettingsRow label="Change email address" hint="Changing your sign-in email needs a confirmation email flow.">
          <Badge tone="soon">Coming soon</Badge>
        </SettingsRow>
        <SettingsRow label="Connected sign-in methods" hint="Linking or unlinking methods from here is not available yet.">
          <Badge tone="soon">Coming soon</Badge>
        </SettingsRow>
        <SettingsRow label="Log out" hint="Signs you out on this device.">
          <Button variant="secondary" onClick={() => void signOut()}>
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </Button>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Danger zone" tone="danger" icon={<Trash2 className="h-3.5 w-3.5" />}>
        {providers ? (
          <DeleteAccount hasPassword={hasPassword} />
        ) : (
          <div className="px-5 py-4 text-[12px] text-[#8f8e8a]">{error ? 'Could not load your sign-in methods.' : 'Loading…'}</div>
        )}
      </SettingsCard>
    </SectionShell>
  )
}

/* ------------------------------------------------------------------ */
/* General                                                             */
/* ------------------------------------------------------------------ */

function GeneralSection() {
  const { settings, updateSettings } = useApp()
  const { preferences } = usePreferences()
  const { save, state } = usePrefSaver()
  const today = new Date()

  return (
    <SectionShell title="General" description="Language, region and how OpenNote opens.">
      <SettingsCard title="Language & region" icon={<Globe className="h-3.5 w-3.5" />} action={<SaveStatus state={state} />}>
        <SettingsRow label="Language" hint="OpenNote is available in English. Other languages will appear here once translated.">
          <Select ariaLabel="Language" value="en" onChange={() => {}} options={[{ value: 'en', label: 'English' }]} />
        </SettingsRow>
        <SettingsRow label="Time zone" hint="Taken from this device. Calendar times are shown in it.">
          <span className="text-[13px] font-medium text-[#37352f]">{DEVICE_TZ}</span>
        </SettingsRow>
        <SettingsRow label="Date format" hint={`Today: ${formatDate(today, preferences.dateFormat)}`}>
          <Select
            ariaLabel="Date format"
            value={preferences.dateFormat}
            onChange={(v) => void save({ dateFormat: v })}
            options={[
              { value: 'DMY', label: 'DD/MM/YYYY' },
              { value: 'MDY', label: 'MM/DD/YYYY' },
              { value: 'YMD', label: 'YYYY-MM-DD' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Time format">
          <ProjectTag />
          <SegmentedControl
            ariaLabel="Time format"
            value={settings.hour12 ? '12' : '24'}
            onChange={(v) => updateSettings({ hour12: v === '12' })}
            options={[
              { value: '12', label: '12-hour' },
              { value: '24', label: '24-hour' },
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Workspace" icon={<LayoutGrid className="h-3.5 w-3.5" />}>
        <SettingsRow label="Default opening page" hint="What you see when you open a project.">
          <Select
            ariaLabel="Default opening page"
            value={preferences.openTo}
            onChange={(v) => void save({ openTo: v })}
            options={[
              { value: 'calendar', label: 'Calendar' },
              { value: 'today', label: 'Today' },
              { value: 'notes', label: 'Notes' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Start of week">
          <ProjectTag />
          <SegmentedControl
            ariaLabel="Start of week"
            value={settings.weekStartsOn}
            onChange={(v) => updateSettings({ weekStartsOn: v })}
            options={[
              { value: 1, label: 'Monday' },
              { value: 0, label: 'Sunday' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Save changes automatically" hint="Every change is saved to your account as you make it. This is always on.">
          <Badge tone="success">
            <Check className="h-3 w-3" />
            Always on
          </Badge>
        </SettingsRow>
        <SettingsRow label="Remember last calendar view" hint="Reopen each project in the view you used last (Day, Full Week or Month).">
          <Toggle label="Remember last calendar view" checked={preferences.rememberView} onChange={(v) => void save({ rememberView: v })} />
        </SettingsRow>
      </SettingsCard>
    </SectionShell>
  )
}

/* ------------------------------------------------------------------ */
/* Appearance                                                          */
/* ------------------------------------------------------------------ */

function ThemeCard({ id, label, icon, active, soon }: { id: string; label: string; icon: ReactNode; active: boolean; soon?: boolean }) {
  const dark = id === 'dark'
  return (
    <div
      aria-disabled={soon || undefined}
      data-theme-card={id}
      className={cn(
        'relative rounded-2xl border p-2.5 transition',
        active ? 'border-[var(--color-accent-deep)] ring-2 ring-[var(--color-accent-soft)]' : 'border-[#ececea]',
        soon && 'opacity-70',
      )}
    >
      <div
        className={cn(
          'h-[74px] overflow-hidden rounded-xl border',
          dark
            ? 'border-[#2a2a2a] bg-[#151515]'
            : id === 'system'
              ? 'border-[#ececea] bg-gradient-to-r from-white from-50% to-[#151515] to-50%'
              : 'border-[#ececea] bg-[#fafaf9]',
        )}
      >
        <div className="flex h-full gap-1.5 p-2">
          <div className={cn('w-1/4 rounded-md', dark ? 'bg-[#232323]' : 'bg-white ring-1 ring-black/5')} />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className={cn('h-2.5 w-2/3 rounded', dark ? 'bg-[#2e2e2e]' : 'bg-[#ececea]')} />
            <div className="h-2.5 w-1/2 rounded" style={{ background: 'var(--color-accent)' }} />
            <div className={cn('h-2.5 w-3/4 rounded', dark ? 'bg-[#2e2e2e]' : 'bg-[#ececea]')} />
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#191919]">
          {icon}
          {label}
        </span>
        {active ? (
          <Badge tone="accent">
            <Check className="h-3 w-3" />
            Active
          </Badge>
        ) : soon ? (
          <Badge tone="soon">Coming soon</Badge>
        ) : null}
      </div>
    </div>
  )
}

function AppearanceSection() {
  const { settings, updateSettings } = useApp()
  const { preferences } = usePreferences()
  const { save, state } = usePrefSaver()

  return (
    <SectionShell title="Appearance" description="Theme, accent colour and motion.">
      <SettingsCard title="Theme" icon={<Sun className="h-3.5 w-3.5" />} description="OpenNote currently ships in Light. Dark and System are being designed.">
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
          <ThemeCard id="light" label="Light" icon={<Sun className="h-3.5 w-3.5" />} active />
          <ThemeCard id="dark" label="Dark" icon={<Moon className="h-3.5 w-3.5" />} active={false} soon />
          <ThemeCard id="system" label="System" icon={<Monitor className="h-3.5 w-3.5" />} active={false} soon />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Accent colour"
        icon={<Palette className="h-3.5 w-3.5" />}
        description="Used for toggles, highlights and focus rings across OpenNote."
        action={<SaveStatus state={state} />}
      >
        <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-2.5 px-5 py-4">
          {(Object.keys(ACCENTS) as AccentId[]).map((id) => {
            const a = ACCENTS[id]
            const on = preferences.accent === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={a.name}
                onClick={() => void save({ accent: id })}
                className={cn(
                  'flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-[12px] font-medium transition',
                  on ? 'border-[#191919] bg-white text-[#191919]' : 'border-[#ececea] text-[#5f5e5b] hover:border-[#cfcfcb]',
                )}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: a.accent }}>
                  {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </span>
                {a.name}
              </button>
            )
          })}
        </div>
      </SettingsCard>

      <SettingsCard title="Display" icon={<Eye className="h-3.5 w-3.5" />}>
        <SettingsRow label="Layout density" hint="Compact layout is being designed.">
          <SegmentedControl
            ariaLabel="Layout density"
            value="comfortable"
            onChange={() => {}}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact', disabled: true },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Subtle animations" hint="Gentle fades when panels and cards appear.">
          <Toggle label="Subtle animations" checked={preferences.animations} onChange={(v) => void save({ animations: v })} />
        </SettingsRow>
        <SettingsRow
          label="Reduce motion"
          hint={
            <>
              Turns off all animation and transitions. <ProjectTag />
            </>
          }
        >
          <Toggle label="Reduce motion" checked={settings.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} />
        </SettingsRow>
      </SettingsCard>
    </SectionShell>
  )
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

function NotificationsSection() {
  const { preferences } = usePreferences()
  const { save, state } = usePrefSaver()
  const [permission, setPermission] = useState(notificationPermission())

  const ask = async () => {
    if (permission === 'unsupported') return
    try {
      setPermission(await Notification.requestPermission())
    } catch {
      setPermission(notificationPermission())
    }
  }

  const permBadge =
    permission === 'granted' ? (
      <Badge tone="success">Allowed</Badge>
    ) : permission === 'denied' ? (
      <Badge tone="danger">Blocked</Badge>
    ) : permission === 'unsupported' ? (
      <Badge>Not supported</Badge>
    ) : (
      <Badge tone="warning">Not allowed yet</Badge>
    )

  const quietNow = inQuietHours(new Date(), preferences)
  const timeInput =
    'h-9 rounded-[10px] border border-[#e3e3e0] px-2.5 text-[12.5px] disabled:bg-[#f7f7f5] disabled:text-[#a3a29e]'

  return (
    <SectionShell title="Notifications" description="Reminders for your events, delivered by this browser.">
      <SettingsCard title="Browser notifications" icon={<BellRing className="h-3.5 w-3.5" />} action={<SaveStatus state={state} />}>
        <SettingsRow
          label="Permission"
          hint={
            permission === 'denied'
              ? 'Notifications are blocked for this site. Allow them in your browser’s site settings.'
              : permission === 'unsupported'
                ? 'This browser does not support notifications.'
                : 'Reminders need this browser’s permission.'
          }
        >
          <span data-testid="notif-permission">{permBadge}</span>
          {permission === 'default' && (
            <Button variant="secondary" onClick={() => void ask()}>
              Allow notifications
            </Button>
          )}
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Event reminders" icon={<CalendarClock className="h-3.5 w-3.5" />}>
        <SettingsRow
          label="Remind me before events"
          hint={
            permission === 'granted'
              ? 'Shown while OpenNote is open in this browser. Nothing is sent by email.'
              : 'Saved, but reminders can only appear once notifications are allowed above.'
          }
        >
          <Toggle label="Remind me before events" checked={preferences.remindersEnabled} onChange={(v) => void save({ remindersEnabled: v })} />
        </SettingsRow>
        <SettingsRow label="Default reminder time">
          <Select
            ariaLabel="Default reminder time"
            value={preferences.reminderLead}
            disabled={!preferences.remindersEnabled}
            onChange={(v) => void save({ reminderLead: v })}
            options={[5, 10, 15, 30, 60].map((m) => ({ value: m as Preferences['reminderLead'], label: `${m} minutes before` }))}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Note reminders" icon={<Bell className="h-3.5 w-3.5" />}>
        <div className="px-5 py-4">
          <ComingSoon>Dated notes will be able to carry their own reminder. Notes never create reminders on their own.</ComingSoon>
        </div>
      </SettingsCard>

      <SettingsCard title="Quiet hours" icon={<Moon className="h-3.5 w-3.5" />}>
        <SettingsRow
          label="Pause reminders during quiet hours"
          hint={preferences.quietHours ? (quietNow ? 'Quiet hours are on right now.' : 'Reminders resume outside these hours.') : undefined}
        >
          <Toggle label="Quiet hours" checked={preferences.quietHours} onChange={(v) => void save({ quietHours: v })} />
        </SettingsRow>
        <SettingsRow label="From / until">
          <input
            type="time"
            aria-label="Quiet hours start"
            value={preferences.quietStart}
            disabled={!preferences.quietHours}
            onChange={(e) => e.target.value && void save({ quietStart: e.target.value })}
            className={timeInput}
          />
          <span className="text-[12px] text-[#8f8e8a]">to</span>
          <input
            type="time"
            aria-label="Quiet hours end"
            value={preferences.quietEnd}
            disabled={!preferences.quietHours}
            onChange={(e) => e.target.value && void save({ quietEnd: e.target.value })}
            className={timeInput}
          />
        </SettingsRow>
      </SettingsCard>
    </SectionShell>
  )
}

/* ------------------------------------------------------------------ */
/* Calendar Preferences                                                */
/* ------------------------------------------------------------------ */

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, h) => h)

function CalendarPreferencesSection() {
  const { settings, updateSettings, calendars, updateCalendar } = useApp()
  const label = (h: number) =>
    settings.hour12
      ? h === 0 || h === 24
        ? '12 AM'
        : h === 12
          ? '12 PM'
          : `${h % 12} ${h < 12 ? 'AM' : 'PM'}`
      : `${String(h).padStart(2, '0')}:00`
  const start = settings.dayStartHour ?? 7
  const end = settings.dayEndHour ?? 22

  return (
    <SectionShell title="Calendar Preferences" description="How this project’s calendar looks and opens. Changes apply straight away.">
      <SettingsCard title="Default view" icon={<CalendarDays className="h-3.5 w-3.5" />}>
        <SettingsRow label="Open the calendar in">
          <SegmentedControl
            ariaLabel="Default view"
            value={settings.defaultView}
            onChange={(v) => updateSettings({ defaultView: v })}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Full Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Time" icon={<Clock className="h-3.5 w-3.5" />}>
        <SettingsRow label="Start of week">
          <SegmentedControl
            ariaLabel="Week starts on"
            value={settings.weekStartsOn}
            onChange={(v) => updateSettings({ weekStartsOn: v })}
            options={[
              { value: 1, label: 'Monday' },
              { value: 0, label: 'Sunday' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Time format">
          <SegmentedControl
            ariaLabel="Clock format"
            value={settings.hour12 ? '12' : '24'}
            onChange={(v) => updateSettings({ hour12: v === '12' })}
            options={[
              { value: '12', label: '12-hour' },
              { value: '24', label: '24-hour' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Day starts at" hint="The calendar opens scrolled to this time. Earlier hours are softly shaded.">
          <Select
            ariaLabel="Day starts at"
            value={start}
            onChange={(v) => updateSettings({ dayStartHour: v, ...(v >= end ? { dayEndHour: Math.min(24, v + 1) } : {}) })}
            options={HOUR_OPTIONS.slice(0, 24).map((h) => ({ value: h, label: label(h) }))}
          />
        </SettingsRow>
        <SettingsRow label="Day ends at" hint="Later hours are softly shaded.">
          <Select
            ariaLabel="Day ends at"
            value={end}
            onChange={(v) => updateSettings({ dayEndHour: v })}
            options={HOUR_OPTIONS.slice(1).map((h) => ({ value: h, label: label(h), disabled: h <= start }))}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Zoom"
        icon={<ZoomIn className="h-3.5 w-3.5" />}
        description="Zoom from 1 hour down to 5 minutes with Ctrl + scroll, pinch, or the zoom square."
      >
        <SettingsRow label="Default zoom">
          <SegmentedControl
            ariaLabel="Default zoom"
            value={settings.defaultZoom ?? 0}
            onChange={(v) => updateSettings({ defaultZoom: v })}
            options={ZOOM_LEVELS.map((z, i) => ({ value: i, label: z.label }))}
          />
        </SettingsRow>
        <SettingsRow label="Remember last zoom level" hint="Reopen at the zoom you used last instead of the default.">
          <Toggle label="Remember last zoom level" checked={!!settings.rememberZoom} onChange={(v) => updateSettings({ rememberZoom: v })} />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Display" icon={<Eye className="h-3.5 w-3.5" />}>
        <SettingsRow label="Show weekends">
          <Toggle label="Show weekends" checked={settings.showWeekends} onChange={(v) => updateSettings({ showWeekends: v })} />
        </SettingsRow>
        <SettingsRow label="Highlight the current day">
          <Toggle label="Highlight the current day" checked={settings.highlightToday !== false} onChange={(v) => updateSettings({ highlightToday: v })} />
        </SettingsRow>
        <SettingsRow label="Current-time indicator" hint="The red line that marks the time now, in today’s column only.">
          <Toggle label="Current-time indicator" checked={settings.showNowLine !== false} onChange={(v) => updateSettings({ showNowLine: v })} />
        </SettingsRow>
        <SettingsRow label="Grid lines" hint="Lines between time slots and alternating slot shading. Hour lines always show.">
          <Toggle label="Grid lines" checked={settings.showGridLines !== false} onChange={(v) => updateSettings({ showGridLines: v })} />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Calendar categories" icon={<Tags className="h-3.5 w-3.5" />} description="Change a category’s colour. Its events keep everything else.">
        {calendars.map((c) => (
          <SettingsRow key={c.id} label={c.name}>
            <div role="radiogroup" aria-label={`${c.name} colour`} className="flex gap-1.5">
              {COLOR_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={c.color === id}
                  aria-label={`${c.name}: ${COLORS[id].name}`}
                  onClick={() => updateCalendar(c.id, { color: id })}
                  className={cn(
                    'h-6 w-6 rounded-full ring-offset-2 transition',
                    c.color === id ? 'ring-2 ring-[#191919]' : 'hover:ring-2 hover:ring-[#dcdbd7]',
                  )}
                  style={{ background: COLORS[id].dot }}
                />
              ))}
            </div>
          </SettingsRow>
        ))}
        {calendars.length === 0 && (
          <p className="px-5 py-4 text-[12px] text-[#8f8e8a]">This project has no categories yet. Add one from the sidebar.</p>
        )}
      </SettingsCard>
    </SectionShell>
  )
}

/* ------------------------------------------------------------------ */
/* Security                                                            */
/* ------------------------------------------------------------------ */

interface SessionRow {
  id: string
  token: string
  createdAt: string | Date
  updatedAt: string | Date
  userAgent?: string | null
}

function describeAgent(ua?: string | null) {
  if (!ua) return 'Unknown device'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser'
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  return os ? `${browser} on ${os}` : browser
}

function PasswordCard({ email }: { email: string }) {
  const { changePassword, requestPasswordReset } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [reset, setReset] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (next.length < 10) return setError('Use at least 10 characters.')
    if (next !== confirm) return setError('The new passwords do not match.')
    setBusy(true)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your password could not be changed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsCard title="Password" icon={<KeyRound className="h-3.5 w-3.5" />} description="Changing it signs out your other devices.">
      <form onSubmit={submit} className="space-y-3 px-5 py-4">
        <Field label="Current password" type="password" value={current} onChange={setCurrent} autoComplete="current-password" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="New password" type="password" value={next} onChange={setNext} autoComplete="new-password" hint="At least 10 characters." />
          <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>
        {error && <p className="text-[12px] text-[#b4453c]">{error}</p>}
        {done && <p className="text-[12px] font-medium text-[#2f6b35]">Your password has been changed.</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !current || !next}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
            Change password
          </Button>
        </div>
      </form>
      <SettingsRow
        label="Forgot your password?"
        hint={reset === 'sent' ? `A reset link is on its way to ${email}.` : `We’ll email a reset link to ${email}.`}
      >
        <Button
          variant="secondary"
          disabled={reset === 'sending' || reset === 'sent'}
          onClick={async () => {
            setReset('sending')
            try {
              await requestPasswordReset(email)
              setReset('sent')
            } catch {
              setReset('error')
            }
          }}
        >
          {reset === 'sent' ? 'Link sent' : reset === 'error' ? 'Try again' : 'Send reset link'}
        </Button>
      </SettingsRow>
    </SettingsCard>
  )
}

function SessionsCard() {
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const [current, setCurrent] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const fmt = useDateFormat()

  const load = async () => {
    setError(false)
    try {
      const [list, me] = await Promise.all([authClient.listSessions(), authClient.getSession()])
      if (list.error || !list.data) throw new Error('sessions')
      setRows(list.data as SessionRow[])
      setCurrent(me.data?.session?.id ?? null)
    } catch {
      setError(true)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const others = rows?.filter((r) => r.id !== current) ?? []

  return (
    <SettingsCard
      title="Active sessions"
      icon={<Smartphone className="h-3.5 w-3.5" />}
      description="Devices currently signed in to your account."
      action={
        others.length > 0 ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await authClient.revokeOtherSessions().catch(() => null)
              await load()
              setBusy(false)
            }}
          >
            Sign out other sessions
          </Button>
        ) : undefined
      }
    >
      {error && <p className="px-5 py-4 text-[12px] text-[#b4453c]">Your sessions could not be loaded.</p>}
      {!rows && !error && (
        <div className="px-5 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-[#a3a29e]" />
        </div>
      )}
      {rows?.map((r) => (
        <div key={r.id} data-testid="session-row" className="flex items-center gap-3 px-5 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f4f4f2] text-[#5f5e5b]">
            <Monitor className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-[#191919]">
              {describeAgent(r.userAgent)}
              {r.id === current && <Badge tone="success">This device</Badge>}
            </p>
            <p className="text-[11.5px] text-[#8f8e8a]">
              Signed in {fmt(new Date(r.createdAt))} · last active {fmt(new Date(r.updatedAt))}
            </p>
          </div>
          {r.id !== current && (
            <Button
              variant="secondary"
              onClick={async () => {
                await authClient.revokeSession({ token: r.token }).catch(() => null)
                await load()
              }}
            >
              Sign out
            </Button>
          )}
        </div>
      ))}
    </SettingsCard>
  )
}

function SecuritySection() {
  const { user } = useAuth()
  const { providers, error } = useAccounts()
  if (!user) return null
  const hasPassword = !!providers?.includes('credential')

  return (
    <SectionShell title="Security" description="Your password, sign-in method and devices.">
      <SettingsCard title="Sign-in method" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
        <SettingsRow
          label="Connected providers"
          hint={providers && !hasPassword ? 'You sign in with Google. Your password is managed by Google.' : undefined}
        >
          {providers ? (
            <span className="flex flex-wrap gap-1.5">
              {providers.map((p) => (
                <Badge key={p}>{providerLabel(p)}</Badge>
              ))}
            </span>
          ) : error ? (
            <span className="text-[12px] text-[#b4453c]">Could not load</span>
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-[#a3a29e]" />
          )}
        </SettingsRow>
      </SettingsCard>

      {hasPassword && <PasswordCard email={user.email} />}

      <SettingsCard title="Two-factor authentication" icon={<Lock className="h-3.5 w-3.5" />}>
        <div className="px-5 py-4">
          <ComingSoon>A second sign-in step (an authenticator app code) is not available yet.</ComingSoon>
        </div>
      </SettingsCard>

      <SessionsCard />

      <SettingsCard title="How your account is protected" icon={<Shield className="h-3.5 w-3.5" />}>
        <ul className="space-y-2 px-5 py-4 text-[12.5px] leading-snug text-[#5f5e5b]">
          {[
            'Passwords are stored only as salted hashes, never in plain text.',
            'Your session lives in an HttpOnly cookie that page scripts cannot read.',
            'Repeated sign-in attempts are rate-limited.',
            'Every project is private to your account; no one else can open it.',
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Check className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[#2f6b35]" />
              {t}
            </li>
          ))}
        </ul>
      </SettingsCard>
    </SectionShell>
  )
}

/* ------------------------------------------------------------------ */
/* Billing — Coming soon only                                          */
/* ------------------------------------------------------------------ */

const PLAN_CARDS = [
  {
    id: 'free',
    name: 'OpenNote Free',
    price: '£0',
    period: 'forever',
    blurb: 'Calendar, notes and personal planning.',
    features: ['Unlimited projects', 'Day, week and month views', 'Notes and time-slot notes', 'Autosave across devices'],
  },
  {
    id: 'pro',
    name: 'OpenNote Pro',
    price: '£9',
    period: 'per month · planned',
    blurb: 'Advanced productivity and business tools.',
    features: ['Everything in Free', 'Pro workspace', 'Advanced planning tools', 'Priority support'],
  },
  {
    id: 'business',
    name: 'OpenNote Business',
    price: 'TBA',
    period: 'pricing to be announced',
    blurb: 'Team collaboration and business management.',
    features: ['Everything in Pro', 'Shared team calendars', 'Roles and permissions', 'Team administration'],
  },
] as const

const COMPARISON: Array<[string, boolean, boolean, boolean]> = [
  ['Calendar & notes', true, true, true],
  ['Projects & autosave', true, true, true],
  ['Pro workspace & tools', false, true, true],
  ['Team calendars & roles', false, false, true],
]

function BillingSection() {
  const { user } = useAuth()
  const current = user?.plan === 'pro' ? 'pro' : 'free'
  return (
    <SectionShell title="Billing" description="Your plan.">
      <div
        className="flex items-center gap-2.5 rounded-2xl border border-[#f2e3a6] bg-[#fffbeb] px-4 py-3 text-[13px] text-[#6b5410]"
        data-testid="billing-message"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-[#c9a227]" />
        OpenNote Pro and Business are coming soon. Enjoy OpenNote Free while we build something better.
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {PLAN_CARDS.map((p) => {
          const isCurrent = p.id === current
          const soon = p.id !== 'free'
          return (
            <div
              key={p.id}
              data-plan={p.id}
              className={cn(
                'flex flex-col rounded-2xl border bg-white p-5',
                isCurrent ? 'border-[var(--color-accent-deep)] ring-2 ring-[var(--color-accent-soft)]' : 'border-[#ececea]',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[14px] font-semibold text-[#191919]">{p.name}</h3>
                {isCurrent ? <Badge tone="accent">Current plan</Badge> : soon ? <Badge tone="soon">Coming soon</Badge> : null}
              </div>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="text-[26px] font-semibold tracking-[-0.03em] text-[#191919]">{p.price}</span>
                <span className="text-[12px] text-[#8f8e8a]">{p.period}</span>
              </p>
              <p className="mt-1 text-[12.5px] text-[#6b6a66]">{p.blurb}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-[12.5px] text-[#37352f]">
                    <Check className={cn('mt-[2px] h-3.5 w-3.5 shrink-0', soon ? 'text-[#c4c3be]' : 'text-accent-deep')} />
                    {f}
                  </li>
                ))}
              </ul>
              <div
                className={cn(
                  'mt-5 flex h-9 items-center justify-center rounded-[10px] text-[12.5px] font-semibold',
                  isCurrent ? 'bg-accent-soft text-accent-text' : 'bg-[#f4f4f2] text-[#a3a29e]',
                )}
              >
                {isCurrent ? 'Your plan' : 'Coming soon'}
              </div>
            </div>
          )
        })}
      </div>

      <SettingsCard title="Planned features" icon={<LayoutGrid className="h-3.5 w-3.5" />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[12.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.06em] text-[#a3a29e]">
                <th className="px-5 py-2.5 font-semibold">Feature</th>
                <th className="px-3 py-2.5 text-center font-semibold">Free</th>
                <th className="px-3 py-2.5 text-center font-semibold">Pro</th>
                <th className="px-3 py-2.5 text-center font-semibold">Business</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f1ef]">
              {COMPARISON.map(([f, ...cols]) => (
                <tr key={f}>
                  <td className="px-5 py-2.5 text-[#37352f]">{f}</td>
                  {cols.map((on, i) => (
                    <td key={i} className="px-3 py-2.5 text-center">
                      {on ? <Check className="mx-auto h-4 w-4 text-[#2f6b35]" /> : <span className="text-[#cfcfcb]">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>
    </SectionShell>
  )
}

/* ------------------------------------------------------------------ */
/* Deploy (administrators only; the server re-checks the role)         */
/* ------------------------------------------------------------------ */

function DeploySection() {
  const [open, setOpen] = useState(false)
  return (
    <SectionShell title="Deploy" description="Publish the current version of OpenNote.">
      <SettingsCard title="Production" icon={<Rocket className="h-3.5 w-3.5" />}>
        <SettingsRow label="Deploy controls" hint="Publishing stays switched off unless the server allows it.">
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Rocket className="h-3.5 w-3.5" />
            Open
          </Button>
        </SettingsRow>
      </SettingsCard>
      {open && <DeployPanel onClose={() => setOpen(false)} />}
    </SectionShell>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function SettingsPage({ onBack }: { onBack?: () => void } = {}) {
  const { settingsSection, setSettingsSection } = useApp()
  const { user } = useAuth()
  const { status } = usePreferences()
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const sections = useMemo(() => SECTIONS.filter((s) => s.id !== 'deploy' || user?.role === 'admin'), [user?.role])
  const active = sections.find((s) => s.id === settingsSection) ?? sections[0]

  // Remember the section for next time, and start each section at the top.
  useEffect(() => {
    try {
      window.localStorage.setItem(SECTION_KEY, active.id)
    } catch {
      /* storage blocked */
    }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [active.id])

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#fafaf9]">
      {/* Soft background glow — same material as My Projects and the welcome page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            'radial-gradient(60% 55% at 30% 0%, rgba(190,242,100,0.20), transparent 70%), radial-gradient(45% 45% at 80% 10%, rgba(167,139,250,0.10), transparent 70%)',
        }}
      />
      <header className="relative z-10 shrink-0">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between px-4 sm:px-6">
          <a href="/" aria-label="OpenNote home">
            <Logo size="sm" />
          </a>
          <AccountMenu />
        </div>
        <div className="mx-auto max-w-[1080px] px-4 pb-2 pt-2 sm:px-6">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-[#5f5e5b] transition hover:bg-white hover:text-[#191919]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to calendar
            </button>
          )}
          <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.035em] text-[#191919] sm:text-[36px]">Settings</h1>
          <p className="mt-1 text-[14px] text-[#5f5e5b]">Manage your account, workspace and calendar preferences.</p>
        </div>
      </header>

      <div ref={scrollRef} className="scroll-area relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-10">
          <nav aria-label="Settings sections" className="shrink-0 lg:sticky lg:top-6 lg:w-[210px] lg:self-start">
            <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:rounded-[22px] lg:border lg:border-[#ececea] lg:bg-white lg:p-2 lg:shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              {sections.map((s) => {
                const isActive = s.id === active.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setSettingsSection(s.id)}
                    className={cn(
                      'flex shrink-0 items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[13px] transition-colors lg:w-full',
                      isActive
                        ? 'bg-[#ecfccb] font-semibold text-[#191919]'
                        : 'font-medium text-[#5f5e5b] hover:bg-[#f4f4f2] hover:text-[#191919]',
                    )}
                  >
                    <span className={cn('shrink-0', isActive ? 'text-[#3f6212]' : 'text-[#a3a29e]')}>{s.icon}</span>
                    <span className="whitespace-nowrap">{s.label}</span>
                  </button>
                )
              })}
            </div>
          </nav>

          <div className="min-w-0 flex-1 pb-8">
            {status === 'error' && (
              <p className="mb-4 rounded-xl border border-[#f0cfcc] bg-[#fdf3f2] px-4 py-2.5 text-[12.5px] text-[#9c3a32]">
                Your saved preferences could not be loaded. Changes may not save until you refresh.
              </p>
            )}
            {active.id === 'profile' && <ProfileSection key={user?.id ?? 'signed-out'} />}
            {active.id === 'account' && <AccountSection />}
            {active.id === 'general' && <GeneralSection />}
            {active.id === 'appearance' && <AppearanceSection />}
            {active.id === 'notifications' && <NotificationsSection />}
            {active.id === 'calendar' && <CalendarPreferencesSection />}
            {active.id === 'security' && <SecuritySection />}
            {active.id === 'billing' && <BillingSection />}
            {active.id === 'deploy' && <DeploySection />}
          </div>
        </div>
      </div>
    </div>
  )
}
