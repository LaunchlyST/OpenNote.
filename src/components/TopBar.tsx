import { ChevronLeft, ChevronRight, StickyNote } from 'lucide-react'
import { useApp } from '../store'
import type { ViewMode } from '../lib/types'
import { formatHeader } from '../lib/date'
import { cn } from '../lib/id'
import { IconButton } from './ui'
import { PanelToggles, SettingsMenu } from './SettingsMenu'
import { SearchMenu } from './SearchMenu'

const VIEWS: Array<{ value: ViewMode; short: string; long: string }> = [
  { value: 'day', short: 'Day', long: 'Day' },
  { value: 'week', short: 'Week', long: 'Full Week' },
  { value: 'month', short: 'Month', long: 'Month' },
]

export function TopBar({
  onToggleLeft,
  onToggleRight,
}: {
  onToggleLeft: () => void
  onToggleRight: () => void
}) {
  const { view, setView, selectedDate, navigate, goToToday, settings } = useApp()
  const headerLabel = formatHeader(view, selectedDate, settings.weekStartsOn)

  return (
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-[#e9eaee] bg-white px-3 sm:px-4">
      <div className="flex items-center gap-2 pr-1 lg:w-[236px]">
        <div className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-[#bef264] text-[#33400f] shadow-[0_1px_2px_rgba(16,24,40,0.14)]">
          <StickyNote className="h-[16px] w-[16px]" strokeWidth={2.3} />
        </div>
        <span className="hidden text-[15px] font-semibold tracking-[-0.015em] sm:block">
          OpenNote
        </span>
      </div>

      <PanelToggles
        onToggleLeft={onToggleLeft}
        onToggleRight={onToggleRight}
      />

      <div className="flex items-center gap-0.5">
        <IconButton label="Previous" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton label="Next" onClick={() => navigate(1)}>
          <ChevronRight className="h-[18px] w-[18px]" />
        </IconButton>
        <button
          type="button"
          onClick={goToToday}
          className="ml-1 rounded-lg border border-[#e4e6ec] bg-white px-3 py-[6px] text-[12.5px] font-medium text-[#3d4354] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#d4d8e0] hover:bg-[#f7f8fa] active:scale-[0.97]"
        >
          Today
        </button>
        <h1 className="ml-2.5 hidden truncate text-[15px] font-semibold tracking-[-0.015em] md:block">
          {headerLabel}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="mr-0.5 hidden truncate text-[13px] font-semibold md:block xl:hidden">
          {headerLabel}
        </span>

        <div className="flex rounded-xl bg-[#f1f2f5] p-[3px] ring-1 ring-black/[0.03]">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setView(v.value)}
              className={cn(
                'rounded-[9px] px-3 py-[6px] text-[12.5px] font-medium transition-all duration-150',
                view === v.value
                  ? 'bg-white text-[#1f2330] shadow-[0_1px_3px_rgba(16,24,40,0.12)]'
                  : 'text-[#6b7183] hover:text-[#1f2330]',
              )}
            >
              <span className="hidden md:inline">{v.long}</span>
              <span className="md:hidden">{v.short}</span>
            </button>
          ))}
        </div>

        <SearchMenu />
        <SettingsMenu />
      </div>
    </header>
  )
}
