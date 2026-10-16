import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  CalendarDays,
  PanelLeft,
  PanelRight,
  Rocket,
  RotateCcw,
  Settings as SettingsIcon,
  Sun,
} from 'lucide-react'
import { useApp } from '../store'
import type { Settings } from '../lib/types'
import { cn } from '../lib/id'
import { useClickOutside } from '../hooks'
import { IconButton } from './ui'
import { DeployPanel } from './DeployPanel'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[12px] text-[#5f5e5b]">{label}</span>
      {children}
    </div>
  )
}

function Choice<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="flex rounded-lg bg-[#f5f5f3] p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[7px] px-2 py-1 text-[11px] font-medium transition',
            value === o.value
              ? 'bg-white text-[#191919] shadow-[0_1px_2px_rgba(16,24,40,0.09)]'
              : 'text-[#6b6a66] hover:text-[#191919]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const ROW_HEIGHTS: Array<{ value: number; label: string }> = [
  { value: 44, label: 'S' },
  { value: 56, label: 'M' },
  { value: 72, label: 'L' },
]

export function SettingsMenu() {
  const { settings, updateSettings } = useApp()
  const [open, setOpen] = useState(false)
  const [deployOpen, setDeployOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false))

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    updateSettings({ [key]: value } as Partial<Settings>)

  return (
    <div className="relative" ref={ref}>
      <IconButton
        label="Settings"
        active={open}
        onClick={() => setOpen((o) => !o)}
      >
        <SettingsIcon className="h-[17px] w-[17px]" />
      </IconButton>

      {open && (
        <div className="animate-pop absolute right-0 z-50 mt-2 w-[268px] rounded-xl border border-[#e9e9e7] bg-white p-3 shadow-[0_12px_32px_rgba(16,24,40,0.14)]">
          <div className="mb-1 flex items-center gap-1.5 px-1 pb-1">
            <SettingsIcon className="h-3.5 w-3.5 text-[#8f8e8a]" />
            <h3 className="text-[12.5px] font-semibold">Preferences</h3>
          </div>

          <Row label="Week starts on">
            <Choice
              value={settings.weekStartsOn}
              onChange={(v) => set('weekStartsOn', v)}
              options={[
                { value: 1, label: 'Mon' },
                { value: 0, label: 'Sun' },
              ]}
            />
          </Row>

          <Row label="Time format">
            <Choice
              value={settings.hour12 ? '12' : '24'}
              onChange={(v) => set('hour12', v === '12')}
              options={[
                { value: '24', label: '24h' },
                { value: '12', label: '12h' },
              ]}
            />
          </Row>

          <Row label="Row height">
            <Choice
              value={settings.hourHeight}
              onChange={(v) => set('hourHeight', v)}
              options={ROW_HEIGHTS}
            />
          </Row>

          <div className="my-2 h-px bg-[#f1f1ef]" />

          <button
            type="button"
            onClick={() => set('showWeekends', !settings.showWeekends)}
            className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 hover:bg-[#f7f7f5]"
          >
            <span className="flex items-center gap-2 text-[12px] text-[#5f5e5b]">
              <Sun className="h-3.5 w-3.5 text-[#8f8e8a]" />
              Show weekends
            </span>
            <span
              className={cn(
                'relative block h-[18px] w-[32px] rounded-full transition',
                settings.showWeekends ? 'bg-[#191919]' : 'bg-[#e0dfdb]',
              )}
            >
              <span
                className={cn(
                  'absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all',
                  settings.showWeekends ? 'left-[16px]' : 'left-[2px]',
                )}
              />
            </span>
          </button>

          <div className="my-2 h-px bg-[#f1f1ef]" />

          <div className="flex items-start gap-2 rounded-lg bg-[#fbfce8] p-2.5">
            <CalendarDays className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[#a3d922]" />
            <p className="text-[11px] leading-snug text-[#7a8149]">
              Everything you add is saved in this browser automatically.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Reset the planner? This clears all events, calendars and notes saved in this browser.',
                )
              ) {
                window.localStorage.clear()
                window.location.reload()
              }
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-[12px] text-[#8f8e8a] transition hover:bg-[#fdf1f1] hover:text-[#c0392b]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset sample data
          </button>

          <div className="my-2 h-px bg-[#f1f1ef]" />

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setDeployOpen(true)
            }}
            className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-[12px] text-[#5f5e5b] transition hover:bg-[#f7f7f5] hover:text-[#191919]"
          >
            <Rocket className="h-3.5 w-3.5 text-[#8f8e8a]" />
            Admin &rarr; Deploy
          </button>
        </div>
      )}

      {deployOpen && <DeployPanel onClose={() => setDeployOpen(false)} />}
    </div>
  )
}

export function PanelToggles({
  onToggleLeft,
  onToggleRight,
}: {
  onToggleLeft: () => void
  onToggleRight: () => void
}) {
  return (
    <>
      <IconButton
        label="Toggle sidebar"
        onClick={onToggleLeft}
        className="lg:hidden"
      >
        <PanelLeft className="h-[17px] w-[17px]" />
      </IconButton>
      <IconButton
        label="Toggle notes"
        onClick={onToggleRight}
        className="xl:hidden"
      >
        <PanelRight className="h-[17px] w-[17px]" />
      </IconButton>
    </>
  )
}
