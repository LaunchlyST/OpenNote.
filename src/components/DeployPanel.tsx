import { useEffect } from 'react'
import {
  Check,
  ExternalLink,
  Loader2,
  Rocket,
  ShieldAlert,
  X,
} from 'lucide-react'
import { useDeploy } from '../deploy/useDeploy'
import { cn } from '../lib/id'

/**
 * Admin → Deploy.
 *
 * Reports what the server knows and offers a Deploy Website button that makes
 * a real deployment request through `server/deploy.ts`. The panel never decides
 * whether publishing is allowed — the server does, and refuses while
 * `DEPLOY_ENABLED` is not "true".
 */

function Badge({
  tone,
  children,
}: {
  tone: 'good' | 'idle' | 'bad'
  children: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]',
        tone === 'good' && 'bg-[#eaf6d4] text-[#4d6b1f]',
        tone === 'idle' && 'bg-[#f1f1ef] text-[#8f8e8a]',
        tone === 'bad' && 'bg-[#fdf1f1] text-[#c0392b]',
      )}
    >
      {children}
    </span>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-[#191919]">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] leading-snug text-[#8f8e8a]">{hint}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  )
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DeployPanel({ onClose }: { onClose: () => void }) {
  const { loading, status, forbidden, deploying, steps, error, canDeploy, deploy, refresh } =
    useDeploy()

  // Escape closes the panel, matching the other dismissible surfaces.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close deploy panel"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-[#0b0f19]/30"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Deploy"
        className="animate-pop relative z-10 flex max-h-[85vh] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-[#e9e9e7] bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[#ececea] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-[#8f8e8a]" />
            <h2 className="text-[13.5px] font-semibold text-[#191919]">Deploy</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg text-[#8f8e8a] transition hover:bg-[#f3f3f1] hover:text-[#191919]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="flex items-center gap-2 py-6 text-[12px] text-[#8f8e8a]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking the deployment service…
            </p>
          ) : forbidden ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-[#f7f7f5] p-3">
              <ShieldAlert className="mt-[1px] h-4 w-4 shrink-0 text-[#8f8e8a]" />
              <p className="text-[11.5px] leading-snug text-[#5f5e5b]">
                This account is not allowed to deploy. Deployment controls are
                limited to verified administrator accounts listed in{' '}
                <code className="rounded bg-white px-1 py-0.5 text-[10.5px]">
                  ADMIN_EMAILS
                </code>{' '}
                on the server.
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-[#f1f1ef]">
                <Row
                  label="Website deployment"
                  hint={
                    status?.enabled
                      ? 'The server is allowed to publish new builds.'
                      : 'Publishing is switched off on the server.'
                  }
                >
                  <Badge tone={status?.enabled ? 'good' : 'idle'}>
                    {status?.enabled ? 'Enabled' : 'Switched off'}
                  </Badge>
                </Row>

                <Row
                  label="Hosting provider"
                  hint={
                    status?.connected
                      ? `${status.providerLabel} is connected. Its deploy hook is held on the server.`
                      : 'No deploy hook is configured on the server yet.'
                  }
                >
                  <Badge tone={status?.connected ? 'good' : 'bad'}>
                    {status?.connected ? 'Connected' : 'Not connected'}
                  </Badge>
                </Row>

                <Row label="Production website URL" hint="The public address visitors use.">
                  {status?.productionUrl ? (
                    <a
                      href={status.productionUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#191919] underline underline-offset-2"
                    >
                      {status.productionUrl.replace(/^https?:\/\//, '')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-[11.5px] text-[#8f8e8a]">Not set</span>
                  )}
                </Row>

                <Row
                  label="Last deployment"
                  hint={
                    status?.lastDeployment
                      ? 'Recorded when the host accepted the request. The live site updates once its build finishes.'
                      : 'Nothing has been deployed from this server yet.'
                  }
                >
                  <span className="text-[11.5px] font-medium text-[#191919]">
                    {status?.lastDeployment
                      ? formatTimestamp(status.lastDeployment.requestedAt)
                      : 'Never'}
                  </span>
                </Row>
              </div>

              {status && status.missing.length > 0 && (
                <div className="mt-3 rounded-xl bg-[#fbfce8] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#7a8149]">
                    Before the first deployment
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {status.missing.map((item) => (
                      <li key={item} className="text-[11px] leading-snug text-[#7a8149]">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <p className="mt-3 rounded-xl bg-[#fdf1f1] px-3 py-2 text-[11.5px] leading-snug text-[#c0392b]">
                  {error}
                </p>
              )}

              {steps.length > 0 && (
                <ol className="mt-3 space-y-1 rounded-xl bg-[#f7f7f5] px-3 py-2.5">
                  {steps.map((step, i) => (
                    <li key={step} className="flex gap-2 text-[11.5px] leading-snug text-[#5f5e5b]">
                      <span className="shrink-0 text-[#a3a29e]">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}

              {!status?.ready && (
                <p className="mt-3 text-[11px] leading-snug text-[#a3a29e]">
                  The Deploy button stays disabled until the items above are set
                  on the server.
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-[#ececea] px-5 py-3">
          <button
            type="button"
            onClick={() => void deploy()}
            disabled={!canDeploy || forbidden}
            className={cn(
              'inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12px] font-semibold transition active:scale-[0.99]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              canDeploy
                ? 'bg-[#191919] text-white hover:bg-[#37352f]'
                : 'bg-[#f1f1ef] text-[#a3a29e]',
            )}
          >
            {deploying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : steps.length > 0 ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Rocket className="h-3.5 w-3.5" />
            )}
            Deploy Website
          </button>

          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-[10px] border border-[#e9e9e7] px-3 py-2 text-[12px] font-medium text-[#5f5e5b] transition hover:bg-[#f7f7f5] hover:text-[#191919]"
          >
            Refresh
          </button>
        </footer>
      </div>
    </div>
  )
}