import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../store'
import type { ViewMode } from '../lib/types'
import { formatHeader } from '../lib/date'
import { cn } from '../lib/id'
import { PanelToggles, SettingsMenu } from './SettingsMenu'
import { SearchMenu } from './SearchMenu'

const VIEWS: Array<{ value: ViewMode; short: string; long: string }> = [
  { value: 'day', short: 'Day', long: 'Day' },
  { value: 'week', short: 'Week', long: 'Full Week' },
  { value: 'month', short: 'Month', long: 'Month' },
]

/** Square nav control with a hairline border, matching the toolbar rhythm. */
function NavButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-ink-soft transition-all duration-150 hover:border-border-strong hover:bg-white hover:text-ink hover:shadow-sm active:scale-95"
    >
      {children}
    </button>
  )
}

export function TopBar({
  onToggleLeft,
  onToggleRight,
  onToggleSettings,
  settingsOpen,
}: {
  onToggleLeft: () => void
  onToggleRight: () => void
  onToggleSettings: () => void
  settingsOpen: boolean
}) {
  const { view, setView, selectedDate, navigate, goToToday, settings } = useApp()
  const headerLabel = formatHeader(view, selectedDate, settings.weekStartsOn)

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white px-4">
      <PanelToggles
        onToggleLeft={onToggleLeft}
        onToggleRight={onToggleRight}
      />

      {/* Date navigation */}
      <div className="flex items-center gap-1.5">
        <NavButton label="Previous" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-[18px] w-[18px]" />
        </NavButton>
        <NavButton label="Next" onClick={() => navigate(1)}>
          <ChevronRight className="h-[18px] w-[18px]" />
        </NavButton>
        <button
          type="button"
          onClick={goToToday}
          className="ml-0.5 rounded-xl border border-line bg-white px-4 py-2 text-[12.5px] font-semibold text-ink shadow-sm transition-all duration-150 hover:-translate-y-px hover:border-border-strong hover:shadow-md active:scale-[0.97]"
        >
          Today
        </button>
      </div>

      {/* Heading */}
      <div className="ml-1 flex min-w-0 items-center gap-2.5">
        <span className="hidden h-7 w-[3px] shrink-0 rounded-full bg-accent-deep sm:block" />
        <h1 className="min-w-0 truncate text-[17px] font-bold tracking-[-0.025em] text-ink md:text-[19px]">
          {headerLabel}
        </h1>
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        {/* Segmented view switcher — selected state uses a soft lime wash with
            a lime ring rather than a heavy dark fill: still unmistakable
            against the muted track, but light enough to sit comfortably
            beside the date heading. */}
        <div
          role="group"
          aria-label="Calendar view"
          className="flex rounded-xl border border-line bg-surface p-1 shadow-sm"
        >
          {VIEWS.map((v) => {
            const active = view === v.value
            return (
              <button
                key={v.value}
                type="button"
                aria-pressed={active}
                onClick={() => setView(v.value)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12.5px] transition-all duration-200 ease-out',
                  active
                    ? 'bg-accent-soft font-semibold text-accent-text shadow-[0_1px_3px_rgba(16,24,40,0.08)] ring-1 ring-accent/60'
                    : 'font-medium text-ink-soft hover:bg-white hover:text-ink',
                )}
              >
                <CalendarRange
                  className={cn(
                    'h-3.5 w-3.5 transition-colors duration-200',
                    active ? 'text-accent-text/80' : 'text-faint',
                  )}
                />
                <span className="hidden md:inline">{v.long}</span>
                <span className="md:hidden">{v.short}</span>
              </button>
            )
          })}
        </div>

        <SearchMenu />
        <SettingsMenu onToggle={onToggleSettings} active={settingsOpen} />
      </div>
    </header>
  )
}
