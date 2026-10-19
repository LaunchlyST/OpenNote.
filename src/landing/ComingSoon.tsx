import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { apiUrl } from '../lib/api-base'
import { useRouter } from '../router'
import { cn } from '../lib/id'
import { SITE, useDocumentMeta } from './seo'

/**
 * The entry screen for desknoty.com — a full-screen Coming Soon scene.
 *
 * The balloon-letter artwork and the room live in `/coming-soon.png`; this
 * component places a floating crop of the letters back over the scene so they
 * can drift, and a real invite-code control over the painted one. The code is
 * validated by the backend (`POST /api/early-access`), which remembers success
 * in an httpOnly cookie — `/landing` checks that cookie with the server before
 * it renders anything.
 */

type Phase = 'idle' | 'code' | 'checking' | 'wrong' | 'leaving'

/** Where the balloon letters sit inside the 1536×1024 artwork. */
const LETTERS = { left: '16.27%', top: '26.86%', width: '67.71%', height: '46.88%' } as const

/**
 * A cinematic sky wipe: rises over the scene, holds while the landing page is
 * swapped in underneath, then fades away. Kept outside React on purpose — it
 * must outlive this component's unmount at navigation time.
 */
function playSkyTransition(done: () => void) {
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText =
    'position:fixed;inset:0;z-index:9999;pointer-events:none;transform:translateY(100%);' +
    'transition:transform .8s cubic-bezier(.22,1,.36,1);' +
    'background:linear-gradient(180deg,#8fc9ff 0%,#b7ddff 30%,#d9efff 60%,#f4faff 100%)'
  for (const [left, top, width, opacity] of [
    ['8%', '20%', '38%', '0.9'],
    ['52%', '36%', '46%', '0.8'],
    ['24%', '58%', '52%', '0.7'],
  ] as const) {
    const cloud = document.createElement('div')
    cloud.style.cssText = `position:absolute;left:${left};top:${top};width:${width};height:14%;border-radius:9999px;background:rgba(255,255,255,${opacity});filter:blur(34px)`
    el.appendChild(cloud)
  }
  document.body.appendChild(el)
  requestAnimationFrame(() => {
    el.style.transform = 'translateY(0)'
  })
  window.setTimeout(() => {
    done()
    requestAnimationFrame(() => {
      el.style.transition = 'opacity .6s ease'
      el.style.opacity = '0'
      window.setTimeout(() => el.remove(), 650)
    })
  }, 900)
}

export function ComingSoon() {
  useDocumentMeta(`Coming Soon — ${SITE.name}`, SITE.description)
  const { navigate } = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [code, setCode] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (phase === 'code') inputRef.current?.focus()
  }, [phase])

  function startExit() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      navigate('/landing')
      return
    }
    setPhase('leaving')
    window.setTimeout(() => playSkyTransition(() => navigate('/landing')), 450)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (phase === 'idle') {
      setPhase('code')
      return
    }
    if (phase === 'checking' || phase === 'leaving') return
    const attempt = code.trim()
    if (!attempt) return
    setPhase('checking')
    try {
      const res = await fetch(apiUrl('/api/early-access'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: attempt }),
      })
      if (!res.ok) throw new Error('invalid')
      startExit()
    } catch {
      setPhase('wrong')
    }
  }

  return (
    <section aria-label="Desknoty — coming soon" className="fixed inset-0 overflow-hidden bg-[#f2ede6]">
      <h1 className="sr-only">Desknoty — Coming Soon</h1>

      {/* The same room, softly blurred, so any screen shape stays immersive. */}
      <img
        src="/coming-soon.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-105"
      />

      {/* The scene itself, locked to the artwork's 3:2 frame. */}
      <div className="flex h-full items-center justify-center">
        <div
          className={cn('relative aspect-[3/2]', phase === 'leaving' && 'cine-zoom')}
          style={{ width: 'min(100vw, 150svh)' }}
        >
          <img src="/coming-soon.png" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full" />

          {/* A feathered crop of the balloon letters, floating back over the room. */}
          <img
            src="/coming-soon-letters.png"
            alt=""
            aria-hidden="true"
            className={cn('pointer-events-none absolute', phase === 'leaving' ? 'cine-letters' : 'lp-letter-float')}
            style={{
              ...LETTERS,
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, #000 5%, #000 95%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 7%, #000 92%, transparent 100%)',
              WebkitMaskComposite: 'source-in',
              maskImage:
                'linear-gradient(to right, transparent 0%, #000 5%, #000 95%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 7%, #000 92%, transparent 100%)',
              maskComposite: 'intersect',
            } as React.CSSProperties}
          />

          {/* The real unlock control, painted over the one in the artwork. */}
          <form
            onSubmit={submit}
            className={cn(
              'absolute top-[75.5%] left-1/2 flex w-[92%] -translate-x-1/2 items-center gap-2 rounded-full border border-white/60 bg-white/80 p-1.5 pl-4 shadow-[0_18px_50px_-20px_rgba(80,60,40,0.45)] backdrop-blur-md transition-opacity duration-300 sm:w-[57%] sm:pl-6',
              phase === 'wrong' && 'lp-shake',
              phase === 'leaving' && 'opacity-0',
            )}
          >
            {phase !== 'idle' && (
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  if (phase === 'wrong') setPhase('code')
                }}
                disabled={phase === 'checking' || phase === 'leaving'}
                placeholder="Enter your invite code"
                aria-label="Invite code"
                className="min-w-0 flex-1 rounded-full bg-transparent px-2 py-2 text-[13px] text-[#141a26] outline-none placeholder:text-[#8b8891] sm:px-3 sm:text-[15px]"
              />
            )}
            <button
              type="submit"
              disabled={phase === 'checking' || phase === 'leaving'}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full bg-[#141a26] px-4 py-2.5 text-[12.5px] font-semibold text-white transition active:scale-[0.97] sm:px-6 sm:text-[14px]',
                phase === 'idle' && 'w-full justify-center',
              )}
            >
              {phase === 'checking' ? 'Checking…' : 'Unlock Early Access'}
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
            </button>
            {phase === 'wrong' && (
              <p role="alert" className="absolute top-full mt-2 w-full text-center text-[12.5px] font-medium text-[#c2413b]">
                That invite code is not valid.
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  )
}
