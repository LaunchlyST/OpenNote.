import { Check, Crown, Lock, NotebookPen } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth'
import { useRouter } from '../router'
import { PLANS } from '../lib/plan'
import { cn } from '../lib/id'
import { PageChrome } from './Chrome'
import { paths } from './api'

const FREE_FEATURES = [
  'Access your Free workspace.',
  'Create and manage calendar projects.',
  'Save notes, events and tasks.',
  'Use features available in the Free plan.',
]
const PRO_FEATURES = [
  'Access your Pro workspace.',
  'Use premium features available to Pro subscribers.',
  'Create and manage calendar projects.',
  'Save notes, events and tasks.',
]

/** Shown right after sign-in: pick the Free or Pro workspace. */
export function WorkspacePicker() {
  const { user } = useAuth()
  const { navigate } = useRouter()
  const hasPro = user?.plan === 'pro'
  const pro = PLANS.pro

  return (
    <PageChrome>
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-[#191919] sm:text-[36px]">
          Choose Your Workspace
        </h1>
        <p className="mt-2 text-[15px] text-[#6b6a66]">
          Each workspace keeps its own projects. Switching never mixes or removes anything.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-3xl gap-5 md:grid-cols-2">
        <WorkspaceCard
          icon={<NotebookPen className="h-5 w-5" />}
          title="OpenNote Free"
          badge={user?.plan === 'free' ? 'Your plan' : undefined}
          features={FREE_FEATURES}
          action={
            <button
              type="button"
              onClick={() => navigate(paths.dashboard('free'))}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#191919] text-[14px] font-semibold text-white transition hover:bg-[#37352f]"
            >
              Open Free workspace
            </button>
          }
        />
        <WorkspaceCard
          icon={<Crown className="h-5 w-5" />}
          title="OpenNote Pro"
          badge={hasPro ? 'Your plan' : pro.purchasable ? pro.price : 'Coming soon'}
          locked={!hasPro}
          features={PRO_FEATURES}
          action={
            hasPro ? (
              <button
                type="button"
                onClick={() => navigate(paths.dashboard('pro'))}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#191919] text-[14px] font-semibold text-white transition hover:bg-[#37352f]"
              >
                Open Pro workspace
              </button>
            ) : (
              <div>
                <button
                  type="button"
                  disabled
                  className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[#e3e3e0] bg-[#f3f3f1] text-[14px] font-semibold text-[#8f8e8a]"
                >
                  <Lock className="h-4 w-4" />
                  {pro.purchasable ? 'Upgrade to Pro' : 'Pro is coming soon'}
                </button>
                <p className="mt-2 text-center text-[12px] text-[#8f8e8a]">
                  {pro.purchasable
                    ? 'An active Pro subscription is needed to open this workspace.'
                    : 'Checkout is not switched on yet. You have not been charged.'}
                </p>
              </div>
            )
          }
        />
      </div>
    </PageChrome>
  )
}

function WorkspaceCard({
  icon,
  title,
  badge,
  features,
  action,
  locked = false,
}: {
  icon: ReactNode
  title: string
  badge?: string
  features: string[]
  action: ReactNode
  locked?: boolean
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col rounded-2xl border bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition',
        locked
          ? 'border-[#ececea]'
          : 'border-[#e3e3e0] hover:border-[#cfcfcb] hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.2)]',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid h-10 w-10 place-items-center rounded-xl',
            locked ? 'bg-[#f3f3f1] text-[#a3a29e]' : 'bg-[#e8f7b5] text-[#4b6410]',
          )}
        >
          {icon}
        </span>
        <h2 className="flex-1 text-[18px] font-semibold tracking-[-0.02em] text-[#191919]">{title}</h2>
        {badge && (
          <span className="rounded-full bg-[#f3f3f1] px-2.5 py-1 text-[11px] font-semibold text-[#5f5e5b]">
            {badge}
          </span>
        )}
      </div>
      <ul className={cn('mt-5 flex-1 space-y-2.5', locked && 'opacity-60')}>
        {features.map((f) => (
          <li key={f} className="flex gap-2.5 text-[14px] text-[#37352f]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#65a30d]" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-6">{action}</div>
    </section>
  )
}
