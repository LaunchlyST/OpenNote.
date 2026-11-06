import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useTilt } from '../motion'
import { MousePointerClick } from 'lucide-react'
import { PREVIEW_TODAY } from '../today'
import { ResponsiveAppWindow } from './mock/AppWindow'
import type { MockScreen } from './mock/AppWindow'
import type { MockView } from './mock/AppChrome'
import { Reveal, Section, SectionHeading } from './primitives'
import { COLORS } from '../../lib/colors'
import { DEMO_DAYS, DEMO_EVENTS, DEMO_WEEKDAYS } from '../demo'

const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`

/** Select a day of the sample week: its events, tasks (tickable, in memory only) and note. */
function DayPicker() {
  const [day, setDay] = useState(PREVIEW_TODAY.todayIndex)
  const [tasks, setTasks] = useState(() => DEMO_DAYS.map((d) => d.tasks.map((t) => ({ ...t }))))
  const events = DEMO_EVENTS.filter((e) => e.day === day).sort((a, b) => a.start - b.start)
  return (
    <div className="lp-dp">
      <div className="lp-dp-days" role="tablist" aria-label="Sample week">
        {DEMO_WEEKDAYS.map((w, i) => (
          <button key={w} type="button" role="tab" aria-selected={day === i} className={day === i ? 'on' : ''} onClick={() => setDay(i)}>
            <small>{w}</small>
            <b>{PREVIEW_TODAY.weekNumbers[i]}</b>
          </button>
        ))}
      </div>
      <div className="lp-dp-body" role="tabpanel" aria-label={`${DEMO_WEEKDAYS[day]} ${PREVIEW_TODAY.weekNumbers[day]}`}>
        <div>
          <h3>Plan</h3>
          <ul className="lp-dp-events">
            {events.map((e) => (
              <li key={e.title}>
                <span style={{ background: COLORS[e.color].dot }} />
                <time>{hhmm(e.start)}</time>
                {e.title}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Tasks</h3>
          <ul className="lp-dp-tasks">
            {tasks[day].map((t, i) => (
              <li key={t.text}>
                <label>
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => setTasks((all) => all.map((d, di) => (di !== day ? d : d.map((x, xi) => (xi === i ? { ...x, done: !x.done } : x)))))}
                  />
                  <span className={t.done ? 'done' : ''}>{t.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="lp-dp-note">
          <h3>Note</h3>
          <p>{DEMO_DAYS[day].note}</p>
        </div>
      </div>
    </div>
  )
}

/** The demo switches between the calendar views and the projects screen. */
type DemoTab = MockView | 'projects'

const VIEW_OPTIONS: Array<{ value: DemoTab; label: string; hint: string }> = [
  { value: 'day', label: 'Day', hint: 'One day, hour by hour.' },
  { value: 'week', label: 'Full Week', hint: 'All seven days side by side.' },
  { value: 'month', label: 'Month', hint: 'The whole month at a glance.' },
  { value: 'projects', label: 'Projects', hint: 'Every project, card and page in one place.' },
]

const DATE_LABELS: Record<MockView, string> = {
  day: `${PREVIEW_TODAY.dayTitle}, ${PREVIEW_TODAY.year}`,
  week: `${PREVIEW_TODAY.weekTitle}, ${PREVIEW_TODAY.year}`,
  month: `${PREVIEW_TODAY.monthName} ${PREVIEW_TODAY.year}`,
}

export function ProductPreview() {
  const [tab, setTab] = useState<DemoTab>('week')
  // The projects screen has no date range, so it keeps the calendar's view.
  const view: MockView = tab === 'projects' ? 'week' : tab
  const screen: MockScreen = tab === 'projects' ? 'projects' : 'calendar'
  const stageRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const touched = useRef(false)
  useTilt(frameRef, 4)

  // As the demo scrolls through the viewport it walks Day → Full Week → Month,
  // until the visitor takes the controls themselves.
  useEffect(() => {
    const el = stageRef.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.registerPlugin(ScrollTrigger)
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 75%',
      end: 'bottom 40%',
      onUpdate: (self) => {
        if (touched.current) return
        const p = self.progress
        setTab(p < 0.3 ? 'day' : p < 0.65 ? 'week' : 'month')
      },
    })
    return () => st.kill()
  }, [])

  const choose = (next: DemoTab) => {
    touched.current = true
    setTab(next)
  }
  const index = Math.max(0, VIEW_OPTIONS.findIndex((o) => o.value === tab))
  const active = VIEW_OPTIONS[index]

  return (
    <Section id="preview">
      <Reveal>
        <SectionHeading
          icon={<MousePointerClick className="h-6 w-6" />}
          tint="#ffdce9"
          heading="Try it with a sample week."
          description="Pick a day to see its plan, tasks and note. Switch views to see the whole week or month. No account needed."
        />
      </Reveal>

      <Reveal delay={100}>
        <div className="mt-10 flex flex-col items-center gap-3">
          <div role="group" aria-label="Calendar view" className="relative grid w-full max-w-[440px] grid-cols-4 rounded-[12px] bg-[#ececea] p-1">
            <span
              aria-hidden="true"
              className="absolute inset-y-1 left-1 w-[calc((100%-8px)/4)] rounded-[9px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: `translateX(${index * 100}%)` }}
            />
            {VIEW_OPTIONS.map((option) => {
              const selected = tab === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => choose(option.value)}
                  aria-pressed={selected}
                  className={
                    'relative z-10 rounded-[9px] px-2 py-2 text-[14px] font-medium transition-colors duration-300 ' +
                    (selected ? 'text-lp-ink' : 'text-lp-body hover:text-lp-ink')
                  }
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          <p aria-live="polite" className="text-[13.5px] text-lp-muted">
            {screen === 'projects' ? 'My Projects' : DATE_LABELS[view]} · {active.hint}
          </p>
        </div>
      </Reveal>

      <Reveal delay={150}>
        <div ref={stageRef} className="mt-8 rounded-[22px] bg-lp-sunken p-2 sm:p-6">
          <div ref={frameRef}>
          <div key={view} className="lp-viewswap">
          <ResponsiveAppWindow view={view} onViewChange={choose} dateLabel={DATE_LABELS[view]} screen={screen} label="Desknoty — sample data" />
          </div>
          </div>
        </div>
        <DayPicker />
        <p className="mt-4 text-center text-[13px] text-lp-muted">
          Sample data only. This demo isn’t connected to an account and can’t change your calendar.
        </p>
      </Reveal>
    </Section>
  )
}
