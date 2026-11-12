import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, Calendar, Check, CheckSquare, ChevronDown, NotebookPen, ShoppingBag, Sparkles } from 'lucide-react'
import { Logo } from './components/primitives'
import './newhome.css'

/**
 * The new Desknoty homepage. It is NOT public yet:
 *  - everyone sees it at desknoty.com once Settings → Launch is on "Public launch"
 *  - admins can preview it any time at desknoty.com/home-preview
 * The waitlist page (ComingSoon) is untouched and stays the default.
 */

const SIGNUP = '/app/signup'
const SIGNIN = '/app/signin'

/* ---------- small helpers ---------- */

/** Adds `.in` once the element scrolls into view (once; no replay). */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) return void el.classList.add('in')
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { rootMargin: '0px 0px -12% 0px' })
    el.querySelectorAll('.nh-rv').forEach((n) => io.observe(n))
    if (el.classList.contains('nh-rv')) io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

function Section({ id, className, children, label }: { id?: string; className?: string; children: ReactNode; label?: string }) {
  const ref = useReveal<HTMLElement>()
  return <section ref={ref} id={id} aria-label={label} className={`nh-sec ${className ?? ''}`}>{children}</section>
}

/* ---------- nav ---------- */

const LINKS = [
  ['Notes', '#notes'],
  ['Calendar', '#calendar'],
  ['Tasks', '#tasks'],
  ['Creator store', '#store'],
  ['FAQ', '#faq'],
] as const

function Nav() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('')
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => void (document.body.style.overflow = '')
  }, [open])
  useEffect(() => {
    // the section in view is shown as current in the nav
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(`#${e.target.id}`)), { rootMargin: '-45% 0px -50% 0px' })
    LINKS.forEach(([, h]) => { const el = document.querySelector(h); if (el) io.observe(el) })
    return () => io.disconnect()
  }, [])
  return (
    <>
      <a href="#main" className="nh-skip">Skip to content</a>
      <nav className="nh-nav" aria-label="Main">
        <a href="#top" className="nh-brand" aria-label="Desknoty home"><Logo size="sm" tone="paper" /></a>
        <ul className="nh-links">
          {LINKS.map(([t, h]) => <li key={h}><a href={h} aria-current={active === h ? 'true' : undefined}>{t}</a></li>)}
        </ul>
        <a href={SIGNIN} className="nh-signin">Sign in</a>
        <a href={SIGNUP} className="nh-btn nh-btn-sm">Start free</a>
        <button type="button" className={`nh-burger ${open ? 'on' : ''}`} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}><i /><i /></button>
      </nav>
      <div className={`nh-menu ${open ? 'on' : ''}`} aria-hidden={!open}>
        <ul>
          {[...LINKS, ['Sign in', SIGNIN] as const].map(([t, h], i) => (
            <li key={h} style={{ transitionDelay: open ? `${Math.min(i * 60, 340)}ms` : '0ms' }}><a href={h} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>{t}</a></li>
          ))}
        </ul>
        <a href={SIGNUP} className="nh-btn" tabIndex={open ? 0 : -1}>Start free <ArrowRight className="h-4 w-4" /></a>
      </div>
    </>
  )
}

/* ---------- hero product preview (cycles through the four tools) ---------- */

const SCENES = [
  { k: 'notes', label: 'Notes', icon: NotebookPen },
  { k: 'calendar', label: 'Calendar', icon: Calendar },
  { k: 'tasks', label: 'Tasks', icon: CheckSquare },
  { k: 'store', label: 'Store', icon: ShoppingBag },
] as const

function HeroPreview() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => setI((v) => (v + 1) % SCENES.length), 3600)
    return () => window.clearInterval(t)
  }, [paused])
  // gentle tilt towards the pointer (desktop only)
  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !box.current) return
    const r = box.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
    box.current.style.transform = `perspective(1400px) rotateX(${(-y * 3).toFixed(2)}deg) rotateY(${(x * 4).toFixed(2)}deg)`
  }
  return (
    <div className="nh-hp-wrap" onPointerMove={move} onPointerLeave={() => box.current && (box.current.style.transform = '')} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div ref={box} className="nh-hp" role="img" aria-label="Desknoty showing notes, calendar, tasks and a creator store">
        <div className="nh-hp-bar"><i /><i /><i /><span>desknoty.com/app</span></div>
        <div className="nh-hp-body">
          <aside className="nh-hp-side">
            {SCENES.map((s, n) => (
              <button key={s.k} type="button" className={n === i ? 'on' : ''} onClick={() => setI(n)} tabIndex={-1}><s.icon className="h-4 w-4" /> <span>{s.label}</span></button>
            ))}
          </aside>
          <div className="nh-hp-stage">
            <div className={`nh-scene ${i === 0 ? 'on' : ''}`}><MiniNote /></div>
            <div className={`nh-scene ${i === 1 ? 'on' : ''}`}><MiniWeek /></div>
            <div className={`nh-scene ${i === 2 ? 'on' : ''}`}><MiniTasks /></div>
            <div className={`nh-scene ${i === 3 ? 'on' : ''}`}><MiniStore /></div>
          </div>
        </div>
      </div>
      <div className="nh-hp-dots" role="tablist" aria-label="Preview">
        {SCENES.map((s, n) => <button key={s.k} type="button" role="tab" aria-selected={n === i} aria-label={s.label} onClick={() => setI(n)} />)}
      </div>
    </div>
  )
}

function MiniNote() {
  return (
    <div className="nh-mn">
      <p className="nh-cap">Notebook · Launch plan</p>
      <h4>Spring course launch</h4>
      <p>Record the four lessons on Tuesday, edit on Wednesday and open sales Friday at 9.</p>
      <ul>
        <li className="done"><Check className="h-3 w-3" /> Outline lessons</li>
        <li className="done"><Check className="h-3 w-3" /> Write the sales page</li>
        <li><span /> Upload the workbook</li>
      </ul>
      <span className="nh-caret" aria-hidden="true" />
    </div>
  )
}

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const EVENTS: Array<[number, number, number, string, string]> = [
  [0, 1, 2, 'Plan week', 'a'],
  [1, 0, 3, 'Record lessons', 'b'],
  [2, 2, 2, 'Edit video', 'c'],
  [3, 1, 1, 'Client call', 'a'],
  [4, 0, 2, 'Open sales', 'd'],
]
function MiniWeek() {
  return (
    <div className="nh-mw">
      <p className="nh-cap">This week</p>
      <div className="nh-mw-grid">
        {WEEK.map((d) => <span key={d} className="nh-mw-d">{d}</span>)}
        {EVENTS.map(([c, r, h, t, k]) => <span key={t} className={`nh-ev nh-ev-${k}`} style={{ gridColumn: c + 1, gridRow: `${r + 2} / span ${h}` }}>{t}</span>)}
      </div>
    </div>
  )
}

function MiniTasks() {
  return (
    <div className="nh-mt">
      <p className="nh-cap">Today · 3 of 5 done</p>
      <div className="nh-mt-bar"><i /></div>
      {['Reply to Jo about the bundle', 'Export lesson 2', 'Book the studio', 'Update store prices', 'Send Friday newsletter'].map((t, n) => (
        <div key={t} className={`nh-mt-row ${n < 3 ? 'done' : ''}`} style={{ animationDelay: `${n * 80}ms` }}><span className="nh-box">{n < 3 && <Check className="h-3 w-3" />}</span>{t}</div>
      ))}
    </div>
  )
}

function MiniStore() {
  return (
    <div className="nh-ms">
      <p className="nh-cap">Your store · desknoty.com/maya</p>
      <div className="nh-ms-grid">
        <ProductCard tone="lime" title="Content planner" price="£24.00" sale="£12.00" badge="50% OFF" />
        <ProductCard tone="blue" title="Lightroom presets" price="£9.50" />
      </div>
    </div>
  )
}

function ProductCard({ tone, title, price, sale, badge }: { tone: string; title: string; price: string; sale?: string; badge?: string }) {
  return (
    <article className="nh-pc">
      <span className={`nh-pc-img nh-t-${tone}`}>{badge && <em>{badge}</em>}</span>
      <b>{title}</b>
      <span className="nh-pc-price">{sale ? <><s>{price}</s> {sale}</> : price}</span>
      <span className="nh-pc-buy">Buy now</span>
    </article>
  )
}

/* ---------- tagline: words light up one at a time ---------- */

function Tagline() {
  const ref = useRef<HTMLParagraphElement>(null)
  const text = 'Your notes, your days and the things you sell. One desk, so nothing slips between apps.'
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const words = [...el.querySelectorAll<HTMLElement>('span')]
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return words.forEach((w) => w.classList.add('lit'))
    let raf = 0
    const run = () => {
      raf = 0
      const line = window.innerHeight * 0.62
      words.forEach((w) => w.classList.toggle('lit', w.getBoundingClientRect().top < line))
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(run) }
    run()
    window.addEventListener('scroll', on, { passive: true })
    return () => (window.removeEventListener('scroll', on), cancelAnimationFrame(raf))
  }, [])
  return (
    <Section className="nh-tag" label="What Desknoty is">
      <p ref={ref} className="nh-tagline">{text.split(' ').map((w, n) => <span key={n}>{w} </span>)}</p>
    </Section>
  )
}

/* ---------- feature sections with small live demos ---------- */

function Feature({ id, kicker, title, text, points, children, flip }: { id: string; kicker: string; title: ReactNode; text: string; points: string[]; children: ReactNode; flip?: boolean }) {
  return (
    <Section id={id} className={`nh-feat ${flip ? 'flip' : ''}`} label={kicker}>
      <div className="nh-feat-copy nh-rv">
        <p className="nh-kicker">{kicker}</p>
        <h2 className="nh-h3">{title}</h2>
        <p className="nh-body">{text}</p>
        <ul className="nh-points">{points.map((p) => <li key={p}><Check className="h-4 w-4" aria-hidden="true" />{p}</li>)}</ul>
      </div>
      <div className="nh-feat-demo nh-rv">{children}</div>
    </Section>
  )
}

function NotesDemo() {
  const [items, setItems] = useState([
    { t: 'Draft the welcome email', d: true },
    { t: 'Pick a cover photo', d: false },
    { t: 'Price the bundle', d: false },
  ])
  return (
    <div className="nh-card nh-notes">
      <p className="nh-cap">Notebook · Ideas</p>
      <h4>Autumn bundle</h4>
      <p>Three templates, one price. Launch it to the newsletter first, then on TikTok.</p>
      {items.map((it, n) => (
        <button key={it.t} type="button" className={`nh-check ${it.d ? 'done' : ''}`} aria-pressed={it.d} onClick={() => setItems(items.map((x, m) => (m === n ? { ...x, d: !x.d } : x)))}>
          <span className="nh-box">{it.d && <Check className="h-3 w-3" />}</span>{it.t}
        </button>
      ))}
      <p className="nh-hint">Tap a line to tick it</p>
    </div>
  )
}

function CalendarDemo() {
  const days = [
    { d: 'Mon', n: 13, e: ['Plan the week', 'Gym 7:30'] },
    { d: 'Tue', n: 14, e: ['Record lesson 3', 'Call with Priya'] },
    { d: 'Wed', n: 15, e: ['Edit and upload'] },
    { d: 'Thu', n: 16, e: ['Newsletter', 'Dentist 15:10'] },
    { d: 'Fri', n: 17, e: ['Open sales at 9:00'] },
  ]
  const [pick, setPick] = useState(1)
  return (
    <div className="nh-card nh-cal">
      <div className="nh-cal-days" role="tablist" aria-label="Days">
        {days.map((x, n) => (
          <button key={x.d} type="button" role="tab" aria-selected={pick === n} onClick={() => setPick(n)}><small>{x.d}</small><b>{x.n}</b></button>
        ))}
      </div>
      <div className="nh-cal-list" key={pick}>
        {days[pick].e.map((t, n) => <div key={t} className="nh-cal-ev" style={{ animationDelay: `${n * 70}ms` }}><i />{t}</div>)}
      </div>
      <p className="nh-hint">Pick a day</p>
    </div>
  )
}

function TasksDemo() {
  const [done, setDone] = useState([true, false, false, false])
  const list = ['Answer customer emails', 'Export the workbook PDF', 'Schedule three posts', 'Back up the course files']
  const pct = Math.round((done.filter(Boolean).length / list.length) * 100)
  return (
    <div className="nh-card nh-tasks">
      <div className="nh-tasks-head"><p className="nh-cap">Today</p><b>{pct}%</b></div>
      <div className="nh-mt-bar"><i style={{ transform: `scaleX(${pct / 100})` }} /></div>
      {list.map((t, n) => (
        <button key={t} type="button" className={`nh-check ${done[n] ? 'done' : ''}`} aria-pressed={done[n]} onClick={() => setDone(done.map((v, m) => (m === n ? !v : v)))}>
          <span className="nh-box">{done[n] && <Check className="h-3 w-3" />}</span>{t}
        </button>
      ))}
    </div>
  )
}

function StoreDemo() {
  return (
    <div className="nh-phone">
      <span className="nh-island" aria-hidden="true" />
      <div className="nh-phone-in">
        <span className="nh-avatar">M</span>
        <b className="nh-pname">Maya Hart</b>
        <small>@maya</small>
        <div className="nh-ms-grid">
          <ProductCard tone="lime" title="Content planner" price="£24.00" sale="£12.00" badge="50% OFF" />
          <ProductCard tone="blue" title="Lightroom presets" price="£9.50" />
          <ProductCard tone="pink" title="Reels script pack" price="£7.99" />
          <ProductCard tone="sand" title="Free mood board" price="Free" />
        </div>
      </div>
    </div>
  )
}

/* ---------- FAQ ---------- */

const FAQ: Array<[string, string]> = [
  ['What is Desknoty?', 'A workspace that keeps your notes, calendar and tasks together, with a creator store built in so you can sell digital products from the same place you plan them.'],
  ['Who is it for?', 'Creators, freelancers and small teams who plan their work and sell things like templates, presets, guides or courses.'],
  ['How does the creator store work?', 'You upload a file, set a price and publish. Buyers get a secure download link after paying. You can run discounts with a sale badge and choose the button text.'],
  ['How do buyers pay?', 'By card through Stripe or by bank transfer to the account you add in Payouts. Free products are sent to the buyer’s email.'],
  ['Do I need a website?', 'No. Your store lives at desknoty.com/yourname and works on phones and computers.'],
  ['Can I use Desknoty on my phone?', 'Yes. Every screen is built to work on a phone as well as on a laptop.'],
]

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <Section id="faq" className="nh-faq" label="Questions">
      <h2 className="nh-h3 nh-rv">Questions, answered</h2>
      <div className="nh-faq-list nh-rv">
        {FAQ.map(([q, a], n) => (
          <div key={q} className={`nh-q ${open === n ? 'on' : ''}`}>
            <button type="button" aria-expanded={open === n} onClick={() => setOpen(open === n ? null : n)}>{q}<ChevronDown className="h-4 w-4" aria-hidden="true" /></button>
            <div className="nh-a"><p>{a}</p></div>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ---------- page ---------- */

export function NewHome() {
  const heroRef = useReveal<HTMLElement>()
  useEffect(() => {
    const prev = document.title
    document.title = 'Desknoty: notes, calendar, tasks and a creator store in one place'
    document.documentElement.classList.add('nh-smooth')
    return () => { document.title = prev; document.documentElement.classList.remove('nh-smooth') }
  }, [])
  return (
    <div className="nh" id="top">
      <Nav />
      <main id="main">
        <section ref={heroRef} className="nh-hero" aria-label="Introduction">
          <p className="nh-pill nh-rv"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Notes · Calendar · Tasks · Creator store</p>
          <h1 className="nh-h1 nh-rv">Plan your days,<br />write it down,<br />sell what you make.</h1>
          <p className="nh-sub nh-rv">Desknoty puts your notebook, calendar and to do list next to a store for your digital products. One login, one tidy desk.</p>
          <div className="nh-ctas nh-rv">
            <a href={SIGNUP} className="nh-btn">Start free <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
          </div>
          <p className="nh-proof nh-rv">Works in your browser and on your phone. Nothing to install.</p>
          <div className="nh-rv nh-hero-vis"><HeroPreview /></div>
        </section>

        <Tagline />

        <Feature id="notes" kicker="Notebook" title={<>Notes that turn<br />into plans</>} text="Write ideas, drafts and checklists in clean pages. Tick things off as you go and keep each project in its own notebook." points={['Checklists inside any note', 'Notebooks for every project', 'Fast search across everything']}>
          <NotesDemo />
        </Feature>

        <Feature id="calendar" kicker="Calendar" flip title={<>See the whole week<br />at a glance</>} text="Drop recording days, calls and launches onto your week. Smart reminders nudge you before each one starts." points={['Day, week and month views', 'Reminders before events', 'Plan launches alongside work']}>
          <CalendarDemo />
        </Feature>

        <Feature id="tasks" kicker="Tasks" title={<>Today’s list,<br />always in reach</>} text="Keep a short list for today and a longer one for later. Progress fills up as you work through it." points={['Today and later lists', 'Progress you can see', 'Tasks linked to notes and days']}>
          <TasksDemo />
        </Feature>

        <Feature id="store" kicker="Creator store" flip title={<>Your own shop<br />at desknoty.com/you</>} text="Upload a template, preset or guide, set a price and publish. Run a sale with a badge, and buyers download the file right after paying." points={['Card or bank transfer payments', 'Discounts with sale badges', 'Secure downloads for buyers']}>
          <StoreDemo />
        </Feature>

        <Section className="nh-how" label="How it works">
          <h2 className="nh-h3 nh-rv">Set up in three steps</h2>
          <ol className="nh-steps">
            {[
              ['01', 'Create your account', 'Sign up with your email and open your desk.'],
              ['02', 'Plan and write', 'Add notes, events and tasks for the week ahead.'],
              ['03', 'Open your store', 'Add a product, set a price and press Publish.'],
            ].map(([n, t, d]) => (
              <li key={n} className="nh-step nh-rv"><span>{n}</span><b>{t}</b><p>{d}</p></li>
            ))}
          </ol>
        </Section>

        <Faq />

        <Section className="nh-final" label="Get started">
          <div className="nh-final-card nh-rv">
            <h2 className="nh-h2">Your desk is ready<br />when you are.</h2>
            <p className="nh-sub">Bring your notes, days and products together today.</p>
            <a href={SIGNUP} className="nh-btn">Start free <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
          </div>
        </Section>
      </main>

      <footer className="nh-foot">
        <div className="nh-foot-top">
          <div>
            <Logo size="sm" tone="paper" />
            <p>Notes, calendar, tasks and a creator store in one place.</p>
          </div>
          <nav aria-label="Product"><b>Product</b><a href="#notes">Notes</a><a href="#calendar">Calendar</a><a href="#tasks">Tasks</a><a href="#store">Creator store</a></nav>
          <nav aria-label="Account"><b>Account</b><a href={SIGNUP}>Create account</a><a href={SIGNIN}>Sign in</a><a href="#faq">FAQ</a></nav>
          <nav aria-label="Legal"><b>Legal</b><span className="nh-soon">Privacy policy · coming soon</span><span className="nh-soon">Terms · coming soon</span></nav>
        </div>
        <p className="nh-copy">© {new Date().getFullYear()} Desknoty</p>
      </footer>
    </div>
  )
}

export default NewHome
