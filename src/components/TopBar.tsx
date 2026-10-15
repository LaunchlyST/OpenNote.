import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../store'
import type { ViewMode } from '../lib/types'
import { formatHeader } from '../lib/date'
import { AppIcon } from '../landing/components/primitives'
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
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-[#e9e9e7] bg-white px-3 sm:px-4">
      <div className="flex items-center gap-2 pr-1 lg:w-[236px]">
        <AppIcon className="h-[30px] w-[30px] text-[30px]" />
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
          className="ml-1 rounded-lg border border-[#e3e3e0] bg-white px-3 py-[6px] text-[12.5px] font-medium text-[#37352f] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#dcdbd7] hover:bg-[#f7f7f5] active:scale-[0.97]"
        >
          Today
        </button>
        <h1 className="ml-3 hidden truncate text-[17px] font-semibold tracking-[-0.025em] md:block">
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
                  ? 'bg-white text-[#191919] shadow-[0_1px_3px_rgba(16,24,40,0.12)]'
                  : 'text-[#6b6a66] hover:text-[#191919]',
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
