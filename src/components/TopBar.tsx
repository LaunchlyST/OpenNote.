import { ArrowLeft, ChevronLeft, ChevronRight, Cloud, CloudOff, PanelLeft, StickyNote } from 'lucide-react'
import { useRouter } from '../router'
import { useCurrentProject } from '../projects/context'
import { colorOf } from '../lib/colors'
import { paths } from '../projects/api'
import { useApp } from '../store'
import type { ViewMode } from '../lib/types'
import { formatHeader } from '../lib/date'
import { cn } from '../lib/id'
import { SettingsMenu } from './SettingsMenu'
import { SearchMenu } from './SearchMenu'

const VIEWS: Array<{ value: ViewMode; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Full Week' },
  { value: 'month', label: 'Month' },
]

/** Splits "October 12 – 18, 2026" into a bold range and a quieter year. */
function splitYear(label: string): [string, string] {
  const m = label.match(/^(.*?),?\s(\d{4})$/)
  return m ? [m[1], m[2]] : [label, '']
}

export function TopBar({
  onToggleLeft,
  onToggleNotes,
  notesOpen,
}: {
  onToggleLeft: () => void
  onToggleNotes: () => void
  notesOpen: boolean
}) {
  const { view, setView, selectedDate, navigate, goToToday, settings, saveStatus } = useApp()
  const project = useCurrentProject()
  const router = useRouter()
  const [range, year] = splitYear(formatHeader(view, selectedDate, settings.weekStartsOn))
  const active = Math.max(0, VIEWS.findIndex((v) => v.value === view))

  return (
    <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-[#ececea] bg-white px-3 sm:px-5">
      <button
        type="button"
        onClick={onToggleLeft}
        aria-label="Open sidebar"
        className="grid h-9 w-9 place-items-center rounded-lg text-[#6b6a66] transition hover:bg-[#f3f3f1] hover:text-[#191919] lg:hidden"
      >
        <PanelLeft className="h-[18px] w-[18px]" />
      </button>

      {project && (
        <div className="flex min-w-0 shrink items-center gap-2 border-r border-[#ececea] pr-3">
          <button
            type="button"
            onClick={() => router.navigate(paths.dashboard(project.workspace))}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-[#37352f] transition hover:bg-[#f3f3f1]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Projects</span>
            <span className="sr-only sm:hidden">Back to Projects</span>
          </button>
          <span className="hidden min-w-0 items-center gap-1.5 2xl:flex" title={project.name}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(project.color).dot }} />
            <span className="max-w-[160px] truncate text-[12.5px] font-semibold text-[#191919]">{project.name}</span>
          </span>
          <span
            role="status"
            title={saveStatus === 'error' ? 'Not saved — will retry on your next change' : saveStatus === 'saving' ? 'Saving…' : 'All changes saved'}
            className={cn('hidden shrink-0 items-center gap-1 text-[11px] lg:inline-flex', saveStatus === 'error' ? 'text-[#dc2626]' : 'text-[#a3a29e]')}
          >
            {saveStatus === 'error' ? <CloudOff className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
            <span className="hidden 2xl:inline">
              {saveStatus === 'error' ? 'Not saved' : saveStatus === 'saving' ? 'Saving…' : 'Saved'}
            </span>
          </span>
        </div>
      )}

      <h1 className="min-w-0 truncate text-[20px] font-semibold tracking-[-0.03em] text-[#191919] sm:text-[22px]">
        {range}
        {year && <span className="ml-2 font-normal text-[#a3a29e]">{year}</span>}
      </h1>

      <div className="flex shrink-0 items-center rounded-[10px] border border-[#e3e3e0] bg-white p-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <button
          type="button"
          aria-label="Previous"
          onClick={() => navigate(-1)}
          className="grid h-7 w-7 place-items-center rounded-[7px] text-[#6b6a66] transition hover:bg-[#f3f3f1] hover:text-[#191919]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={goToToday}
          className="h-7 rounded-[7px] px-2.5 text-[12.5px] font-medium text-[#37352f] transition hover:bg-[#f3f3f1]"
        >
          Today
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => navigate(1)}
          className="grid h-7 w-7 place-items-center rounded-[7px] text-[#6b6a66] transition hover:bg-[#f3f3f1] hover:text-[#191919]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {/* View switcher with a sliding indicator */}
        <div role="group" aria-label="Calendar view" className="relative grid grid-cols-3 rounded-[10px] bg-[#f1f1ef] p-[3px]">
          <span
            aria-hidden="true"
            className="absolute inset-y-[3px] left-[3px] w-[calc((100%-6px)/3)] rounded-[7px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateX(${active * 100}%)` }}
          />
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setView(v.value)}
              aria-pressed={view === v.value}
              className={cn(
                'relative z-10 px-3 py-[5px] text-[12.5px] font-medium transition-colors sm:px-4',
                view === v.value ? 'text-[#191919]' : 'text-[#6b6a66] hover:text-[#191919]',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <SearchMenu />
        <button
          type="button"
          onClick={onToggleNotes}
          aria-pressed={notesOpen}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition',
            notesOpen ? 'bg-[#191919] text-white' : 'text-[#6b6a66] hover:bg-[#f3f3f1] hover:text-[#191919]',
          )}
        >
          <StickyNote className="h-4 w-4" />
          <span className="hidden md:inline">Notes</span>
        </button>
        <SettingsMenu />
      </div>
    </header>
  )
}
