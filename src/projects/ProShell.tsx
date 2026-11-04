import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  ChartNoAxesCombined,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Settings,
  Sparkles,
  Users,
  Wand2,
  Workflow,
  Zap,
  BellRing,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  LayoutTemplate,
  Megaphone,
} from 'lucide-react'
import { useRouter } from '../router'
import { useAuth } from '../auth'
import { useApp } from '../store'
import { Avatar } from '../components/Avatar'
import { SettingsPage } from '../components/SettingsPage'
import { AppIcon } from '../landing/components/primitives'
import { cn } from '../lib/id'
import { paths } from './api'
import type { ProjectSummary } from './api'
import { PRO_THEMES, useProTheme } from './proTheme'

/**
 * The Pro workspace for a project. The tools themselves are not built yet:
 * the sidebar lays out where they will live, each item opens an empty page
 * with its name, and Settings is the same page as Free plus a dashboard
 * background theme.
 */

interface Item {
  id: string
  label: string
  icon: ReactNode
}

const I = 'h-[17px] w-[17px]'
const GROUPS: Array<{ title: string; items: Item[] }> = [
  {
    title: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', icon: <LayoutDashboard className={I} /> },
      { id: 'clients', label: 'Clients', icon: <Users className={I} /> },
      { id: 'projects', label: 'Projects', icon: <FolderKanban className={I} /> },
      { id: 'schedule', label: 'Schedule', icon: <CalendarClock className={I} /> },
    ],
  },
  {
    title: 'Automation',
    items: [
      { id: 'workflows', label: 'Workflows', icon: <Workflow className={I} /> },
      { id: 'triggers', label: 'Triggers', icon: <Zap className={I} /> },
      { id: 'reminders', label: 'Smart reminders', icon: <BellRing className={I} /> },
    ],
  },
  {
    title: 'Agents',
    items: [
      { id: 'assistant', label: 'AI assistant', icon: <Bot className={I} /> },
      { id: 'agent-builder', label: 'Agent builder', icon: <Wand2 className={I} /> },
    ],
  },
  {
    title: 'Creator',
    items: [
      { id: 'pages', label: 'Pages', icon: <FileText className={I} /> },
      { id: 'templates', label: 'Templates', icon: <LayoutTemplate className={I} /> },
      { id: 'brand', label: 'Brand kit', icon: <Palette className={I} /> },
      { id: 'campaigns', label: 'Campaigns', icon: <Megaphone className={I} /> },
    ],
  },
  {
    title: 'Other',
    items: [
      { id: 'analytics', label: 'Analytics', icon: <ChartNoAxesCombined className={I} /> },
      { id: 'integrations', label: 'Integrations', icon: <Plug className={I} /> },
    ],
  },
]

const ALL = GROUPS.flatMap((g) => g.items)
const COLLAPSE_KEY = 'desknoty.pro.rail-collapsed'
const GROUPS_KEY = 'desknoty.pro.closed-groups'

export function ProShell({ project }: { project: ProjectSummary }) {
  const { navigate } = useRouter()
  const { user } = useAuth()
  const { settingsOpen, openSettings, closeSettings } = useApp()
  const [theme] = useProTheme()
  const [active, setActive] = useState('overview')
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* storage blocked */
    }
  }, [collapsed])

  // sections whose items are hidden; only the section name shows
  const [closed, setClosed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '[]')
    } catch {
      return []
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(closed))
    } catch {
      /* storage blocked */
    }
  }, [closed])
  const toggleGroup = (t: string) => setClosed((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]))
  const allClosed = closed.length === GROUPS.length

  const item = ALL.find((i) => i.id === active) ?? ALL[0]
  const ink = theme.dark ? 'text-white' : 'text-[#191919]'
  const muted = theme.dark ? 'text-white/55' : 'text-[#8f8e8a]'

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: theme.canvas }}>
      {/* ---- the Pro rail ---- */}
      <aside
        className={cn(
          'relative m-3 hidden shrink-0 flex-col overflow-hidden rounded-[22px] border transition-[width] duration-300 lg:flex',
          theme.dark ? 'border-white/10' : 'border-[#ececea]',
          collapsed ? 'w-[76px]' : 'w-[264px]',
        )}
        style={{ background: theme.rail, boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 20px 40px -28px rgba(16,24,40,0.25)' }}
      >
        <div className={cn('flex items-center px-4 pt-4 pb-3', collapsed ? 'flex-col gap-3' : 'justify-between')}>
          <span className="inline-flex items-center gap-2">
            <AppIcon className="h-8 w-8 text-[32px]" />
            {!collapsed && (
              <span className={cn('text-[15.5px] font-semibold tracking-[-0.02em]', ink)}>
                Desknoty <span className="pro-badge ml-1 align-[2px]">PRO</span>
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn('grid h-8 w-8 place-items-center rounded-[10px] transition', theme.dark ? 'text-white/70 hover:bg-white/10' : 'text-[#6b6a66] hover:bg-black/[0.04]')}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

 {!collapsed && (
          <div className="flex justify-end px-4 pb-1">
            <button
              type="button"
              onClick={() => setClosed(allClosed ? [] : GROUPS.map((g) => g.title))}
              className={cn('inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-[11.5px] font-medium transition', theme.dark ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-[#8f8e8a] hover:bg-black/[0.04] hover:text-[#191919]')}
            >
              {allClosed ? <ChevronsUpDown className="h-3.5 w-3.5" /> : <ChevronsDownUp className="h-3.5 w-3.5" />}
              {allClosed ? 'Show all' : 'Hide all'}
            </button>
          </div>
        )}
        <nav aria-label="Pro" className="pro-rail-nav scroll-area min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {GROUPS.map((g) => (
            <div key={g.title} className="mt-3 first:mt-1">
              {collapsed ? (
                <div className={cn('mx-auto my-2 h-px w-6', theme.dark ? 'bg-white/10' : 'bg-[#ececea]')} />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGroup(g.title)}
                  aria-expanded={!closed.includes(g.title)}
                  className={cn('flex w-full items-center gap-1 rounded-[8px] px-3 pb-1.5 pt-0.5 text-[11.5px] font-medium transition', muted, theme.dark ? 'hover:text-white' : 'hover:text-[#191919]')}
                >
                  {g.title}
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', closed.includes(g.title) && '-rotate-90')} />
                </button>
              )}
              {(collapsed || !closed.includes(g.title)) && g.items.map((it) => {
                const on = it.id === active && !settingsOpen
                return (
                  <button
                    key={it.id}
                    type="button"
                    title={collapsed ? it.label : undefined}
                    aria-current={on ? 'page' : undefined}
                    onClick={() => {
                      closeSettings()
                      setActive(it.id)
                    }}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-[12px] px-3 py-[7px] text-left text-[13.5px] transition',
                      collapsed && 'justify-center px-0',
                      on
                        ? theme.dark
                          ? 'bg-white/12 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
                          : 'bg-white font-semibold text-[#191919] shadow-[0_1px_2px_rgba(16,24,40,0.06),inset_0_0_0_1px_#ececea]'
                        : theme.dark
                          ? 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                          : 'text-[#4a4a46] hover:bg-black/[0.035] hover:text-[#191919]',
                    )}
                  >
                    <span className={cn('shrink-0 transition', on ? (theme.dark ? 'text-[#c4f27a]' : 'text-[#3f7d20]') : 'opacity-75 group-hover:opacity-100')}>
                      {it.icon}
                    </span>
                    {!collapsed && <span className="truncate">{it.label}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* the wow: a live aurora card that breathes with the Pro accent */}
        {!collapsed && (
          <div className="pro-aurora mx-3 mb-3 overflow-hidden rounded-[18px] p-4 text-white">
            <span aria-hidden="true" className="pro-aurora-glow" />
            <p className="relative flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/80">
              <Sparkles className="h-3.5 w-3.5" /> Pro unlocked
            </p>
            <p className="relative mt-1.5 text-[15px] font-semibold leading-snug">Your Pro tools are rolling out here first.</p>
            <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
              <span className="pro-aurora-bar block h-full rounded-full bg-white" />
            </div>
          </div>
        )}

        <div className={cn('border-t px-3 py-3', theme.dark ? 'border-white/10' : 'border-[#ececea]')}>
          <button
            type="button"
            onClick={() => openSettings()}
            title={collapsed ? 'Settings' : undefined}
            className={cn(
              'flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-[13.5px] transition',
              collapsed && 'justify-center px-0',
              settingsOpen
                ? theme.dark
                  ? 'bg-white/12 font-semibold text-white'
                  : 'bg-white font-semibold text-[#191919] shadow-[inset_0_0_0_1px_#ececea]'
                : theme.dark
                  ? 'text-white/70 hover:bg-white/[0.06]'
                  : 'text-[#4a4a46] hover:bg-black/[0.035]',
            )}
          >
            <Settings className={I} />
            {!collapsed && 'Settings'}
          </button>
          <div className={cn('mt-2 flex items-center gap-3 px-2', collapsed && 'justify-center px-0')}>
            <Avatar name={user?.fullName ?? 'You'} src={user?.avatar} size={34} />
            {!collapsed && (
              <span className="min-w-0">
                <span className={cn('block truncate text-[13.5px] font-semibold', ink)}>{user?.fullName}</span>
                <span className={cn('block text-[12px]', muted)}>Pro member</span>
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* ---- main ---- */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        {settingsOpen ? (
          <div className="absolute inset-3 left-0 z-20 flex flex-col overflow-hidden rounded-[22px] bg-[#fafaf9] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <SettingsPage onBack={closeSettings} backLabel="Back to Pro" embedded extraAppearance={<ProThemePicker />} />
          </div>
        ) : (
          <>
            <header className="flex h-16 shrink-0 items-center gap-3 px-6">
              <button
                type="button"
                onClick={() => navigate(paths.dashboard('pro'))}
                className={cn('inline-flex items-center gap-1.5 text-[13.5px] transition', theme.dark ? 'text-white/70 hover:text-white' : 'text-[#5f5e5b] hover:text-[#191919]')}
              >
                <ArrowLeft className="h-4 w-4" /> Back to Projects
              </button>
              <span className={cn('text-[13.5px]', muted)}>/</span>
              <span className={cn('text-[13.5px] font-semibold', ink)}>{project.name}</span>
            </header>
            <div className="grid flex-1 place-items-center px-6">
              <div className="text-center">
                <span className={cn('mx-auto grid h-12 w-12 place-items-center rounded-[14px]', theme.dark ? 'bg-white/10 text-white' : 'bg-white text-[#191919] shadow-[0_1px_2px_rgba(16,24,40,0.06),inset_0_0_0_1px_#ececea]')}>
                  {item.icon}
                </span>
                <h1 className={cn('mt-4 text-[22px] font-semibold tracking-[-0.02em]', ink)}>{item.label}</h1>
                <p className={cn('mt-1 text-[14px]', muted)}>This Pro tool is on the way.</p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

/** Settings → Appearance, Pro only: the dashboard background. */
export function ProThemePicker() {
  const [theme, choose] = useProTheme()
  return (
    <div className="mb-6 rounded-[22px] border border-[#ececea] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <p className="text-[14px] font-semibold text-[#191919]">Pro dashboard theme</p>
      <p className="mt-0.5 text-[12.5px] text-[#6b6a66]">Colours the Pro sidebar and page. Saved in this browser.</p>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {PRO_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => choose(t.id)}
            aria-pressed={t.id === theme.id}
            className="group text-left"
          >
            <span
              className={cn(
                'block h-16 rounded-[14px] border transition',
                t.id === theme.id ? 'border-[#191919] ring-2 ring-[#191919]/15' : 'border-[#ececea] group-hover:border-[#c9c8c4]',
              )}
              style={{ background: t.rail }}
            />
            <span className="mt-1.5 block text-[12.5px] font-medium text-[#3a3a37]">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
