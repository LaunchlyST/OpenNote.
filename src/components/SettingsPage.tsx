import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Check,
  CreditCard,
  Globe,
  Loader2,
  Lock,
  LogOut,
  Palette,
  Rocket,
  Settings as SettingsIcon,
  Shield,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useApp } from '../store'
import type { SettingsSectionId } from '../store'
import { useAuth } from '../auth'
import { fileToAvatar } from '../lib/avatar'
import { planOf } from '../lib/plan'
import { PLANS } from '../lib/plan'
import { cn } from '../lib/id'
import { Avatar } from './Avatar'
import { DeployPanel } from './DeployPanel'
import {
  Button,
  ComingSoon,
  Field,
  SegmentedControl,
  SettingsCard,
  SettingsRow,
  Toggle,
} from './SettingsSection'

interface SectionDef {
  id: SettingsSectionId
  label: string
  icon: ReactNode
}

const SECTIONS: SectionDef[] = [
  { id: 'profile', label: 'Profile', icon: <UserRound className="h-4 w-4" /> },
  { id: 'account', label: 'Account', icon: <SettingsIcon className="h-4 w-4" /> },
  { id: 'general', label: 'General', icon: <Globe className="h-4 w-4" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="h-4 w-4" /> },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <Bell className="h-4 w-4" />,
  },
  {
    id: 'calendar',
    label: 'Calendar Preferences',
    icon: <CalendarDays className="h-4 w-4" />,
  },
  { id: 'security', label: 'Security', icon: <Shield className="h-4 w-4" /> },
  { id: 'billing', label: 'Billing', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'deploy', label: 'Deploy', icon: <Rocket className="h-4 w-4" /> },
]

function formatJoined(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function SectionShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="animate-fade">
      <h2 className="text-[17px] font-bold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <p className="mt-1 text-[12.5px] leading-snug text-muted">{description}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function ProfileSection() {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState(user?.fullName ?? '')
  const [avatar, setAvatar] = useState<string | undefined>(user?.avatar)
  const [saved, setSaved] = useState(false)

  if (!user) {
    return (
      <SectionShell
        title="Profile"
        description="Your name, photo and account details."
      >
        <SettingsCard>
          <div className="px-5 py-6 text-center">
            <p className="text-[12.5px] leading-snug text-muted">
              You are signed out, so there is no profile to edit yet. Sign in
              from the sidebar and your details will appear here.
            </p>
          </div>
        </SettingsCard>
      </SectionShell>
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

  const save = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) return
    updateProfile({ fullName: trimmed, avatar: avatar ?? null })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <SectionShell
      title="Profile"
      description="Your name, photo and the details tied to your account."
    >
      <SettingsCard title="Profile photo">
        <SettingsRow label="Photo" hint="Saved to your account, up to 2 MB.">
          <div className="flex items-center gap-3">
            <Avatar size={48} name={name} src={avatar} />
            <div className="flex flex-col gap-1.5">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-ink-soft transition hover:border-border-strong hover:text-ink">
                Change image
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
                    updateProfile({ avatar: null })
                    setSaved(false)
                  }}
                  className="inline-flex items-center gap-1.5 self-start rounded-lg px-1.5 py-0.5 text-[11px] text-muted transition hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </SettingsRow>
      </SettingsCard>

      <form onSubmit={save}>
        <SettingsCard title="Details">
          <div className="space-y-3 px-5 py-4">
            <Field
              label="Full name"
              value={name}
              onChange={(v) => {
                setName(v)
                setSaved(false)
              }}
              autoComplete="name"
              placeholder="Your name"
            />
            <Field
              label="Email"
              value={user.email}
              onChange={() => {}}
              autoComplete="email"
              disabled
            />
            <Button type="submit">
              {saved ? <Check className="h-4 w-4" /> : null}
              {saved ? 'Saved' : 'Save changes'}
            </Button>
          </div>
        </SettingsCard>
      </form>

      <SettingsCard title="Membership">
        <SettingsRow
          label="Member since"
          hint="The date this account was created."
        >
          <span className="text-[12.5px] font-medium text-ink">
            {formatJoined(user.createdAt)}
          </span>
        </SettingsRow>
      </SettingsCard>
    </SectionShell>
  )
}

function AccountSection() {
  const { user, signOut } = useAuth()

  return (
    <SectionShell
      title="Account"
      description="The plan on this account and the session you are using."
    >
      <SettingsCard title="Session">
        <SettingsRow
          label="Signed in as"
          hint="The account you are signed in with."
        >
          <span className="text-[12.5px] font-medium text-ink">
            {user ? user.email : 'Signed out'}
          </span>
        </SettingsRow>
        <div className="px-5 py-4">
          <Button variant="secondary" onClick={signOut} disabled={!user}>
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Danger zone">
        <div className="px-5 py-4">
          <ComingSoon>
            Account deletion is not available yet, so this action stays
            switched off rather than pretending to work.
          </ComingSoon>
          <Button variant="danger" className="mt-3" disabled>
            <Trash2 className="h-4 w-4" />
            Delete account
          </Button>
        </div>
      </SettingsCard>
    </SectionShell>
  )
}

function GeneralSection() {
  const { settings, updateSettings } = useApp()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <SectionShell
      title="General"
      description="Regional details and how the workspace opens."
    >
      <SettingsCard title="Region">
        <SettingsRow
          label="Language"
          hint="OpenNote ships in English for now."
        >
          <span className="text-[12.5px] font-medium text-ink">English</span>
        </SettingsRow>
        <SettingsRow label="Time zone" hint="Read from this browser.">
          <span className="text-[12.5px] font-medium text-ink">
            {timezone || 'Unknown'}
          </span>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Workspace">
        <SettingsRow
          label="Open with the sidebar collapsed"
          hint="Gives the calendar more room on wide screens."
        >
          <Toggle
            label="Open with the sidebar collapsed"
            checked={settings.sidebarCollapsed}
            onChange={(v) => updateSettings({ sidebarCollapsed: v })}
          />
        </SettingsRow>
      </SettingsCard>
    </SectionShell>
  )
}

function AppearanceSection() {
  const { settings, updateSettings } = useApp()

  return (
    <SectionShell
      title="Appearance"
      description="What OpenNote looks like when you open it."
    >
      <SettingsCard title="Layout">
        <SettingsRow
          label="Default view"
          hint="The view the calendar opens on. You can still switch views at any time."
        >
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

      <SettingsCard title="Motion">
        <SettingsRow
          label="Reduce motion"
          hint="Shortens the interface's entry animations. Nothing else changes."
        >
          <Toggle
            label="Reduce motion"
            checked={settings.reduceMotion}
            onChange={(v) => updateSettings({ reduceMotion: v })}
          />
        </SettingsRow>
      </SettingsCard>
    </SectionShell>
  )
}

function NotificationsSection() {
  const { user } = useAuth()

  return (
    <SectionShell
      title="Notifications"
      description="Reminders about upcoming events and notes."
    >
      <SettingsCard title="Email reminders">
        <div className="space-y-3 px-5 py-4">
          <Field
            label="Send reminders to"
            value={user?.email ?? ''}
            onChange={() => {}}
            autoComplete="email"
            disabled
          />
          <ComingSoon>
            OpenNote has no reminder service yet, so nothing can be scheduled
            or delivered. This section will switch on when it does.
          </ComingSoon>
        </div>
      </SettingsCard>
    </SectionShell>
  )
}

function CalendarPreferencesSection() {
  const { settings, updateSettings } = useApp()
  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) =>
    updateSettings({ [key]: value } as Partial<typeof settings>)

  return (
    <SectionShell
      title="Calendar Preferences"
      description="How days and times are laid out. Changes apply to the calendar straight away."
    >
      <SettingsCard title="Week">
        <SettingsRow label="Week starts on">
          <SegmentedControl
            ariaLabel="Week starts on"
            value={settings.weekStartsOn}
            onChange={(v) => set('weekStartsOn', v)}
            options={[
              { value: 1, label: 'Mon' },
              { value: 0, label: 'Sun' },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label="Show weekends"
          hint="Hides Saturday and Sunday from the week grid."
        >
          <Toggle
            label="Show weekends"
            checked={settings.showWeekends}
            onChange={(v) => set('showWeekends', v)}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Time">
        <SettingsRow label="Time format">
          <SegmentedControl
            ariaLabel="Time format"
            value={settings.hour12 ? '12' : '24'}
            onChange={(v) => set('hour12', v === '12')}
            options={[
              { value: '24', label: '24h' },
              { value: '12', label: '12h' },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label="Row height"
          hint="How tall one hour is in the grid."
        >
          <SegmentedControl
            ariaLabel="Row height"
            value={settings.hourHeight}
            onChange={(v) => set('hourHeight', v)}
            options={[
              { value: 44, label: 'S' },
              { value: 56, label: 'M' },
              { value: 72, label: 'L' },
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <div className="rounded-2xl border border-line bg-white px-5 py-4">
        <p className="text-[11.5px] leading-snug text-muted">
          Everything here is saved to this project automatically.
        </p>
      </div>
    </SectionShell>
  )
}

function SecuritySection() {
  const { user, changePassword } = useAuth()
  const { settings, updateSettings } = useApp()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const twoFactorRef = useRef(false)

  useEffect(() => {
    // Read once per mount so an unset preference is not written back on save.
    twoFactorRef.current = Boolean(settings.twoFactor)
  }, [settings.twoFactor])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    setDone(false)
    if (next !== confirm) {
      setError('New passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setDone(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update your password.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <SectionShell
        title="Security"
        description="Password and sign-in protection."
      >
        <SettingsCard>
          <div className="px-5 py-6 text-center">
            <p className="text-[12.5px] leading-snug text-muted">
              Sign in to manage your password.
            </p>
          </div>
        </SettingsCard>
      </SectionShell>
    )
  }

  return (
    <SectionShell title="Security" description="Password and sign-in protection.">
      <form onSubmit={submit}>
        <SettingsCard title="Password">
          <div className="space-y-3 px-5 py-4">
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-[11.5px] leading-snug text-red-500">
                {error}
              </p>
            )}
            {done && (
              <p className="flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-[11.5px] text-accent-text">
                <Check className="h-3.5 w-3.5" />
                Your password has been updated.
              </p>
            )}
            <Field
              label="Current password"
              type="password"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="New password"
                type="password"
                value={next}
                onChange={setNext}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
              <Field
                label="Confirm new password"
                type="password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Update password
            </Button>
          </div>
        </SettingsCard>
      </form>

      <SettingsCard title="Extra protection">
        <SettingsRow
          label="Two-step verification"
          hint="Adds a second step at sign-in."
        >
          <Toggle
            label="Two-step verification"
            checked={Boolean(settings.twoFactor)}
            onChange={(v) => updateSettings({ twoFactor: v })}
          />
        </SettingsRow>
        <div className="px-5 py-4">
          <ComingSoon>
            A second sign-in step is not switched on yet. Your choice is
            remembered for when it is.
          </ComingSoon>
        </div>
      </SettingsCard>

      <SettingsCard title="Devices">
        <div className="px-5 py-4">
          <ComingSoon>
            Signing out of other devices is not available yet.
          </ComingSoon>
          <Button variant="secondary" className="mt-3" disabled>
            <LogOut className="h-4 w-4" />
            Log out of all devices
          </Button>
        </div>
      </SettingsCard>
    </SectionShell>
  )
}

function BillingSection() {
  const { user } = useAuth()
  const plan = planOf(user?.plan)

  return (
    <SectionShell
      title="Billing"
      description="The plan on this account."
    >
      <SettingsCard title="Current plan">
        <SettingsRow
          label={plan.label}
          hint={plan.blurb}
        >
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-accent-text">
            {plan.shortLabel}
          </span>
        </SettingsRow>
        <div className="px-5 py-4">
          <ComingSoon>
            Checkout is not switched on yet, so paid plans cannot be bought.
            Your account keeps whatever plan it was given.
          </ComingSoon>
        </div>
      </SettingsCard>

      <SettingsCard title="Available plans">
        <div className="divide-y divide-line-soft">
          {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((id) => {
            const p = PLANS[id]
            const current = p.id === plan.id
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-ink">{p.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {p.price} · {p.blurb}
                  </p>
                </div>
                <Button variant="secondary" disabled={!p.purchasable}>
                  {current ? 'Current plan' : 'Choose'}
                </Button>
              </div>
            )
          })}
        </div>
      </SettingsCard>
    </SectionShell>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/** Deployment controls (administrators only; the server re-checks the role). */
function DeploySection() {
  const [open, setOpen] = useState(false)
  return (
    <SectionShell
      title="Deploy"
      description="Publish the current version of OpenNote."
    >
      <SettingsCard title="Production">
        <SettingsRow
          label="Deploy controls"
          hint="Publishing stays switched off unless the server allows it."
        >
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Rocket className="h-4 w-4" />
            Open
          </Button>
        </SettingsRow>
      </SettingsCard>
      {open && <DeployPanel onClose={() => setOpen(false)} />}
    </SectionShell>
  )
}

export function SettingsPage({ onBack }: { onBack?: () => void } = {}) {
  const { settingsSection, setSettingsSection } = useApp()
  const { user } = useAuth()
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Switching sections starts the content at the top, the way a route change
  // would, instead of leaving the previous section's scroll position behind.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [settingsSection])

  // Deploy is for administrators only.
  const sections = SECTIONS.filter((s) => s.id !== 'deploy' || user?.role === 'admin')
  const active = sections.find((s) => s.id === settingsSection) ?? sections[0]

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas-warm">
      {/* Page header */}
      <div className="shrink-0 border-b border-line bg-white px-6 py-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 mb-1.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-ink-soft transition hover:bg-line-soft hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to calendar
          </button>
        )}
        <h1 className="text-[17px] font-bold tracking-[-0.025em] text-ink">
          Settings
        </h1>
        <p className="mt-0.5 text-[12px] text-muted">
          Account, workspace and calendar preferences.
        </p>
      </div>

      {/* Section nav + content */}
      <div className="scroll-area min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-6 py-6 lg:flex-row lg:gap-8">
          {/* Nav — a column on wide screens, a scrolling strip on narrow ones */}
          <nav
            aria-label="Settings sections"
            className="shrink-0 lg:w-[196px]"
          >
            <div className="no-scrollbar -mx-6 flex gap-1 overflow-x-auto px-6 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
              {sections.map((s) => {
                const isActive = s.id === active.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setSettingsSection(s.id)}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-[12.5px] transition-all duration-150 lg:w-full',
                      isActive
                        ? 'bg-white font-semibold text-ink shadow-[0_1px_3px_rgba(16,24,40,0.08)] ring-1 ring-black/[0.04]'
                        : 'font-medium text-ink-soft hover:bg-white/70 hover:text-ink',
                    )}
                  >
                    <span
                      className={cn(
                        'shrink-0 transition-colors',
                        isActive ? 'text-accent-text' : 'text-faint',
                      )}
                    >
                      {s.icon}
                    </span>
                    <span className="whitespace-nowrap lg:whitespace-normal">
                      {s.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Content */}
          <div ref={scrollRef} className="min-w-0 flex-1 pb-4">
            {active.id === 'profile' && (
              // Keyed by account so signing in as someone else starts this
              // form from their details rather than the previous values.
              <ProfileSection key={user?.id ?? 'signed-out'} />
            )}
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