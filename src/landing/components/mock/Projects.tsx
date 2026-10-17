import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Search,
} from 'lucide-react'
import { COLORS } from '../../../lib/colors'
import { cn } from '../../../lib/id'
import { AppIcon } from '../primitives'

/**
 * A read-only miniature of the My Projects screen (`MyProjects` in
 * `src/projects/`), drawn at full size and scaled down by `AppWindow`.
 *
 * Every colour, radius and control is copied from the live component so the
 * landing page shows the actual product rather than a stylised invention. It
 * reads and writes no user data, and nothing here is interactive.
 */

const LINE = '#ececea'

const COMING_SOON = ['Coming Soon', 'Coming Soon', 'Coming Soon']

const PROJECTS = [
  { name: 'Studio Website', color: 'lime' as const, created: '17 October 2026' },
  { name: 'Client — Northbank', color: 'blue' as const, created: '14 October 2026' },
  { name: 'Thesis notes', color: 'purple' as const, created: '2 October 2026' },
  { name: 'Marathon training', color: 'pink' as const, created: '28 September 2026' },
  { name: 'Team retro', color: 'orange' as const, created: '21 September 2026' },
  { name: 'Flat move', color: 'yellow' as const, created: '9 September 2026' },
  { name: 'Reading list', color: 'blue' as const, created: '1 September 2026' },
  { name: 'Tax year', color: 'lime' as const, created: '6 April 2026' },
]

/** The new header: brand left, links dead centre, account right. No background. */
function Header() {
  return (
    <header className="shrink-0 px-6">
      <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="flex items-center gap-2">
          <AppIcon day="17" className="h-7 w-7 text-[28px]" />
          <span className="text-[17px] font-semibold tracking-[-0.025em] text-[#191919]">OpenNote</span>
        </span>

        <nav className="flex items-center gap-0.5">
          {COMING_SOON.map((label) => (
            <span
              key={label}
              className="inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-[#5f5e5b]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#d6d5cf]" />
              {label}
            </span>
          ))}
        </nav>

        <span className="flex h-11 items-center justify-self-end gap-2 rounded-full border border-[#ebebe9] bg-white pl-1 pr-3.5">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#191919] text-[13px] font-semibold text-white">
            A
          </span>
          <span className="text-[13.5px] font-medium tracking-[-0.01em] text-[#191919]">Alex</span>
          <ChevronDown className="h-3.5 w-3.5 text-[#8f8e8a]" />
        </span>
      </div>
    </header>
  )
}

function ProjectCard({ project }: { project: (typeof PROJECTS)[number] }) {
  return (
    <span className="flex min-h-[150px] flex-col rounded-2xl border border-[#ececea] bg-white p-4 text-left">
      <span className="flex items-start justify-between">
        <span
          className="grid h-9 w-9 place-items-center rounded-xl"
          style={{ background: COLORS[project.color].bg, color: COLORS[project.color].text }}
        >
          <CalendarDays className="h-[18px] w-[18px]" />
        </span>
        <span className="text-[15px] leading-none text-[#a3a29e]">···</span>
      </span>

      <span className="mt-3 block truncate text-[14.5px] font-semibold tracking-[-0.015em] text-[#191919]">
        {project.name}
      </span>

      <span className="mt-auto pt-3 text-[11.5px] text-[#8f8e8a]">Created: {project.created}</span>
      <span className="mt-1 flex items-center gap-1 text-[12.5px] font-semibold text-[#191919]">
        Open Project
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </span>
  )
}

/** Bottom centre, with the middle page highlighted and the rest disabled. */
function Pager() {
  const idle = 'text-[#5f5e5b] disabled:opacity-35'
  return (
    <div className="flex shrink-0 justify-center pb-6 pt-4">
      <nav className="flex items-center gap-1">
        <span className={cn('inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium', idle)}>
          <ChevronsLeft className="h-3.5 w-3.5" />
          First
        </span>
        <span className={cn('inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium', idle)}>
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </span>
        <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-[#191919] px-2 text-[12.5px] font-semibold text-white">
          1
        </span>
        <span className={cn('inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium', idle)}>
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
        <span className={cn('inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium', idle)}>
          Last
          <ChevronsRight className="h-3.5 w-3.5" />
        </span>
      </nav>
    </div>
  )
}

export function MockProjects() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#fafaf9] text-left">
      <Header />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pt-7">
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-[24px] font-semibold tracking-[-0.03em] text-[#191919]">My Projects</span>
            <span className="mt-1 block text-[13.5px] text-[#8f8e8a]">
              Organise your projects, calendars and notes in one place.
            </span>
          </span>

          <span className="inline-flex h-12 items-center gap-2 rounded-lg bg-gradient-to-b from-[#2c2c68] to-[#171740] px-5 text-[14px] font-semibold text-white shadow-[0_12px_26px_-12px_rgba(27,27,70,0.85)]">
            <Plus className="h-[18px] w-[18px]" />
            Create Project
          </span>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <span className="relative block w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a29e]" />
            <span
              className="flex h-10 w-full items-center rounded-xl border bg-white pl-9 pr-3 text-[13.5px] text-[#a3a29e]"
              style={{ borderColor: LINE }}
            >
              Search your projects...
            </span>
          </span>
          <span
            className="relative inline-flex h-10 items-center rounded-xl border bg-white pl-3 pr-9 text-[13px] font-medium text-[#37352f]"
            style={{ borderColor: LINE }}
          >
            Recently Created
            <ChevronDown className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8f8e8a]" />
          </span>
        </div>

        <span className="mt-5 text-[12.5px] text-[#8f8e8a]">Showing 1–8 of 8 projects</span>

        <div className="mt-3 grid grid-cols-4 gap-4">
          {PROJECTS.map((p) => (
            <ProjectCard key={p.name} project={p} />
          ))}
        </div>

        <div className="flex-1" />

        <Pager />
      </div>
    </div>
  )
}