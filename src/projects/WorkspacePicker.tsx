import {
  ArrowRight,
  CalendarDays,
  Crown,
  FolderKanban,
  Gem,
  LayoutGrid,
  NotebookPen,
  Sparkles,
  UserRound,
  Workflow,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth'
import { useRouter } from '../router'
import { Logo } from '../landing/components/primitives'
import { AccountMenu } from './MyProjects'
import { paths } from './api'

/**
 * The welcome page after sign-in. Desknoty Free is the clear next step;
 * Desknoty Pro is shown as a coming product and cannot be opened or bought
 * (unless the account's server-side plan already is Pro).
 */

const FREE_BENEFITS: Array<[ReactNode, string]> = [
  [<CalendarDays className="h-4 w-4" />, 'Beautiful daily, weekly and monthly calendar.'],
  [<NotebookPen className="h-4 w-4" />, 'Create notes and organise your ideas.'],
  [<FolderKanban className="h-4 w-4" />, 'Manage projects and daily plans.'],
  [<UserRound className="h-4 w-4" />, 'Your personal workspace, always ready.'],
]

const PRO_BENEFITS: Array<[ReactNode, string]> = [
  [<Zap className="h-4 w-4" />, 'Advanced productivity tools.'],
  [<LayoutGrid className="h-4 w-4" />, 'Business management features.'],
  [<Workflow className="h-4 w-4" />, 'Smarter workflows.'],
  [<Sparkles className="h-4 w-4" />, 'More ways to organise your work.'],
]

export function WorkspacePicker() {
  const { user } = useAuth()
  const { navigate } = useRouter()
  const hasPro = user?.plan === 'pro'

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-y-auto overflow-x-hidden bg-[#fafaf9]">
      {/* Soft background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            'radial-gradient(60% 55% at 30% 0%, rgba(190,242,100,0.22), transparent 70%), radial-gradient(45% 45% at 80% 10%, rgba(167,139,250,0.12), transparent 70%)',
        }}
      />

      <header className="relative z-10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/" aria-label="Desknoty home">
            <Logo size="sm" />
          </a>
          <AccountMenu />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 pb-14 pt-8 sm:px-6 sm:pt-12">
        <section className="mx-auto max-w-2xl text-center">
          <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-[#191919] sm:text-[48px]">
            Your space to make{' '}
            <span className="relative whitespace-nowrap">
              <span aria-hidden="true" className="absolute inset-x-[-4px] bottom-[6px] h-[0.36em] rounded-sm bg-[#d9f99d]" />
              <span className="relative">things happen.</span>
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[15.5px] leading-relaxed text-[#5f5e5b]">
            Plan your days, capture your ideas, and keep everything organised with Desknoty.
          </p>
          <p className="mt-3 text-[13px] font-medium text-[#8f8e8a]">Start free today. More possibilities are coming.</p>
        </section>

        <section aria-label="Workspaces" className="mt-10 grid gap-5 md:grid-cols-2 md:items-stretch">
          {/* Free — the main action */}
          <article
            aria-label="Desknoty Free"
            className="group relative flex flex-col rounded-[22px] border border-[#cfe9a0] bg-white p-6 shadow-[0_0_0_4px_rgba(190,242,100,0.18),0_20px_40px_-24px_rgba(77,124,15,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_0_0_5px_rgba(190,242,100,0.28),0_26px_50px_-24px_rgba(77,124,15,0.4)] motion-reduce:transform-none sm:p-7"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#ecfccb] text-[#3f6212]">
                <CalendarDays className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-[#ecfccb] px-2.5 py-1 text-[10.5px] font-bold tracking-[0.08em] text-[#3f6212]">FREE FOREVER</span>
            </div>
            <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.025em] text-[#191919]">Desknoty Free</h2>
            <p className="mt-1.5 text-[14px] text-[#5f5e5b]">Everything you need to organise your day, beautifully.</p>
            <ul className="mt-6 flex-1 space-y-3">
              {FREE_BENEFITS.map(([icon, text]) => (
                <li key={text} className="flex items-start gap-3 text-[14px] text-[#37352f]">
                  <span className="mt-[1px] grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#f7fee7] text-[#4d7c0f]">{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => navigate(paths.dashboard('free'))}
              className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#191919] text-[15px] font-semibold text-white transition hover:bg-[#2e2d2a] focus-visible:outline-offset-4"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
            </button>
            <p className="mt-2.5 text-center text-[12px] text-[#8f8e8a]">No payment required.</p>
          </article>

          {/* Pro — coming soon */}
          <article
            aria-label="Desknoty Pro"
            className="group relative flex flex-col overflow-hidden rounded-[22px] border border-[#2c2b33] p-6 text-white transition hover:border-[#3d3b47] sm:p-7"
            style={{
              background:
                'radial-gradient(80% 60% at 100% 0%, rgba(167,139,250,0.28), transparent 60%), radial-gradient(60% 50% at 0% 100%, rgba(203,213,225,0.10), transparent 60%), #17161b',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-[#ddd6fe] ring-1 ring-inset ring-white/10">
                <Crown className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10.5px] font-bold tracking-[0.08em] text-[#e9e5ff] ring-1 ring-inset ring-white/15">
                {hasPro ? 'YOUR PLAN' : 'COMING SOON'}
              </span>
            </div>
            <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.025em]">Desknoty Pro</h2>
            <p className="mt-1.5 text-[14px] text-[#c9c6d6]">Your next level of productivity is on its way.</p>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8f8aa8]">Planned features</p>
            <ul className="mt-3 flex-1 space-y-3">
              {PRO_BENEFITS.map(([icon, text]) => (
                <li key={text} className="flex items-start gap-3 text-[14px] text-[#e7e5ef]">
                  <span className="mt-[1px] grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-[#c4b5fd]">{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
            {hasPro ? (
              <button
                type="button"
                onClick={() => navigate(paths.dashboard('pro'))}
                className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold text-[#17161b] transition hover:bg-[#ede9fe]"
              >
                Open Pro workspace <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <span className="group/pro relative mt-7 block">
                <button
                  type="button"
                  disabled
                  aria-describedby="pro-tip"
                  className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-white/[0.08] text-[15px] font-semibold text-[#c9c6d6] ring-1 ring-inset ring-white/10"
                >
                  <Gem className="h-4 w-4" />
                  Pro — Coming Soon
                </button>
                <span
                  id="pro-tip"
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#17161b] opacity-0 shadow-lg transition-opacity group-hover/pro:opacity-100"
                >
                  Desknoty Pro is in development.
                </span>
              </span>
            )}
            <p className="mt-2.5 text-center text-[12px] text-[#8f8aa8]">Something powerful is on the way.</p>
          </article>
        </section>

        <section aria-label="Why Desknoty" className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            [<CalendarDays className="h-4 w-4" />, 'Plan Beautifully', 'Organise your schedule with a clean calendar.'],
            [<NotebookPen className="h-4 w-4" />, 'Capture Everything', 'Keep important notes and ideas together.'],
            [<FolderKanban className="h-4 w-4" />, 'Stay Organised', 'Manage projects in your own workspace.'],
          ].map(([icon, title, body]) => (
            <div key={title as string} className="flex items-start gap-3 rounded-2xl border border-[#ececea] bg-white/70 px-4 py-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#f4f4f2] text-[#37352f]">{icon}</span>
              <div>
                <p className="text-[13.5px] font-semibold text-[#191919]">{title}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-[#8f8e8a]">{body}</p>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
