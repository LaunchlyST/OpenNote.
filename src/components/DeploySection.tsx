import { useState } from 'react'
import {
  Check,
  ExternalLink,
  Loader2,
  LogOut,
  RefreshCw,
  Rocket,
} from 'lucide-react'
import { useAuth } from '../auth'
import { useDeploy } from '../deploy/useDeploy'
import { cn } from '../lib/id'
import {
  Button,
  ComingSoon,
  Field,
  SettingsCard,
  SettingsRow,
} from './SettingsSection'

/**
 * Admin Settings → Deploy.
 *
 * Read-only by default: the page reports what the server knows, and the
 * Deploy button stays disabled until the server confirms a provider is
 * connected and deployments are switched on. Nothing here decides whether a
 * deployment may happen — `api/deploy.ts` does, and refuses otherwise.
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
        'inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide',
        tone === 'good' && 'bg-accent-soft text-accent-text',
        tone === 'idle' && 'bg-surface text-muted ring-1 ring-border-subtle',
        tone === 'bad' && 'bg-red-50 text-red-500',
      )}
    >
      {children}
    </span>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="animate-fade">
      <h2 className="text-[17px] font-bold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <p className="mt-1 text-[12.5px] leading-snug text-muted">{description}</p>
      <div className="mt-4 space-y-3">{children}</div>
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

function SignInCard() {
  const { user } = useAuth()
  const { signIn, phase, error, unavailable } = useDeploy(user?.email)
  const [passphrase, setPassphrase] = useState('')
  const busy = phase === 'signing-in'

  return (
    <SettingsCard title="Administrator sign-in">
      <div className="space-y-3 px-5 py-4">
        <p className="text-[11.5px] leading-snug text-muted">
          Deployment controls are locked to the administrator. Enter the
          passphrase held in the server environment
          {' '}
          <code className="rounded bg-surface px-1 py-0.5 text-[10.5px] text-ink-soft">
            DEPLOY_ADMIN_PASSWORD
          </code>
          .
        </p>

        {unavailable ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-[11.5px] leading-snug text-red-500">
            {error}
          </p>
        ) : (
          error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[11.5px] leading-snug text-red-500">
              {error}
            </p>
          )
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (busy || !passphrase) return
            void signIn(passphrase)
          }}
          className="space-y-3"
        >
          <Field
            label="Administrator passphrase"
            type="password"
            value={passphrase}
            onChange={setPassphrase}
            autoComplete="current-password"
          />
          <Button type="submit" disabled={busy || !passphrase}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Unlock deployment controls
          </Button>
        </form>

        <p className="text-[11px] leading-snug text-faint">
          The passphrase is checked by the server and exchanged for an
          HttpOnly session cookie. It is never stored in this browser.
        </p>
      </div>
    </SettingsCard>
  )
}

export function DeploySection() {
  const {
    loading,
    session,
    status,
    phase,
    steps,
    error,
    canDeploy,
    signOut,
    deploy,
    refresh,
  } = useDeploy()

  if (loading) {
    return (
      <Section
        title="Deploy"
        description="Publishing OpenNote to your hosting provider."
      >
        <SettingsCard>
          <div className="flex items-center gap-2 px-5 py-6 text-[12.5px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking the deployment service…
          </div>
        </SettingsCard>
      </Section>
    )
  }

  if (!session?.authConfigured) {
    return (
      <Section
        title="Deploy"
        description="Publishing OpenNote to your hosting provider."
      >
        <SettingsCard>
          <div className="space-y-3 px-5 py-6">
            <ComingSoon>
              The deployment service is not configured on the server yet. It
              needs <code className="text-[11px]">DEPLOY_ADMIN_PASSWORD</code> and{' '}
              <code className="text-[11px]">SESSION_SECRET</code> in the hosting
              environment before this page can do anything.
            </ComingSoon>
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-[11.5px] leading-snug text-red-500">
                {error}
              </p>
            )}
          </div>
        </SettingsCard>
      </Section>
    )
  }

  if (!session.authenticated) {
    return (
      <Section
        title="Deploy"
        description="Publishing OpenNote to your hosting provider."
      >
        <SignInCard />
      </Section>
    )
  }

  const busy = phase === 'deploying'

  return (
    <Section
      title="Deploy"
      description="Publishing OpenNote to your hosting provider."
    >
      <SettingsCard title="Status">
        <SettingsRow
          label="Website deployment"
          hint={
            status?.enabled
              ? 'The server is allowed to publish new builds.'
              : 'Publishing is switched off on the server, so the button below cannot deploy.'
          }
        >
          <Badge tone={status?.enabled ? 'good' : 'idle'}>
            {status?.enabled ? 'Enabled' : 'Switched off'}
          </Badge>
        </SettingsRow>

        <SettingsRow
          label="Hosting provider"
          hint={
            status?.connected
              ? `Connected to ${status.providerLabel}. Its deploy hook is held on the server.`
              : 'No deploy hook is configured on the server yet.'
          }
        >
          <Badge tone={status?.connected ? 'good' : 'bad'}>
            {status?.connected ? 'Connected' : 'Not connected'}
          </Badge>
        </SettingsRow>

        <SettingsRow label="Provider" hint="Where the build is produced.">
          <span className="text-[12.5px] font-medium text-ink">
            {status?.providerLabel ?? 'Unknown'}
          </span>
        </SettingsRow>

        <SettingsRow
          label="Production website URL"
          hint="The public address visitors use."
        >
          {status?.productionUrl ? (
            <a
              href={status.productionUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent-text underline underline-offset-2"
            >
              {status.productionUrl.replace(/^https?:\/\//, '')}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-[12.5px] font-medium text-muted">Not set</span>
          )}
        </SettingsRow>

        <SettingsRow
          label="Last successful deployment"
          hint={
            status?.lastDeployment
              ? 'Recorded when the hosting provider accepted the request. The live URL updates once its build finishes.'
              : 'No deployment has been requested from this server yet.'
          }
        >
          <span className="text-[12.5px] font-medium text-ink">
            {status?.lastDeployment
              ? formatTimestamp(status.lastDeployment.requestedAt)
              : 'Never'}
          </span>
        </SettingsRow>
      </SettingsCard>

      {status?.missing && status.missing.length > 0 && (
        <SettingsCard title="Before the first deployment">
          <ul className="space-y-2 px-5 py-4">
            {status.missing.map((item) => (
              <li
                key={item}
                className="flex gap-2.5 text-[11.5px] leading-snug text-muted"
              >
                <span
                  aria-hidden="true"
                  className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-deep"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SettingsCard>
      )}

      <SettingsCard title="Publish">
        <div className="space-y-3 px-5 py-4">
          <p className="text-[11.5px] leading-snug text-muted">
            This sends a real deployment request to {status?.providerLabel}. The
            provider builds the latest commit and publishes it to the
            production URL above.
          </p>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[11.5px] leading-snug text-red-500">
              {error}
            </p>
          )}

          {steps.length > 0 && (
            <ol className="space-y-1.5 rounded-xl bg-surface px-3.5 py-3">
              {steps.map((step, i) => (
                <li
                  key={step}
                  className="flex gap-2 text-[11.5px] leading-snug text-ink-soft"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                  />
                  <span>
                    <span className="text-faint">{i + 1}. </span>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {!status?.ready && (
            <p className="text-[11px] leading-snug text-faint">
              Deploying is unavailable until the items above are set on the
              server. This button stays disabled until then.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void deploy()} disabled={!canDeploy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : phase === 'done' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              Deploy Website
            </Button>

            <Button variant="secondary" onClick={() => void refresh()}>
              <RefreshCw className="h-4 w-4" />
              Refresh status
            </Button>

            <Button variant="secondary" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              Lock controls
            </Button>
          </div>
        </div>
      </SettingsCard>

      <p className="px-1 text-[11px] leading-snug text-faint">
        Hosting credentials never reach this page — the server holds them and
        performs the deployment on this request.
      </p>
    </Section>
  )
}