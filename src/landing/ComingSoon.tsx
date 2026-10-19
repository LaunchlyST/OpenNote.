import { useRef, useState } from 'react'

const INVITE_CODE = 'Invite27'

export function ComingSoon() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  void dragging
  const [progress, setProgress] = useState(0)
  const [unlocked, setUnlocked] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  function startDrag(clientX: number) {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const update = (x: number) => {
      const p = Math.min(1, Math.max(0, (x - rect.left) / rect.width))
      setProgress(p)
      if (p >= 0.92) {
        setUnlocked(true)
        setDragging(false)
      }
    }
    update(clientX)
    const onMove = (e: PointerEvent) => update(e.clientX)
    const onUp = () => {
      setDragging(false)
      if (progress < 0.92) setProgress(0)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    setDragging(true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim() === INVITE_CODE) {
      try {
        window.localStorage.setItem('desknoty-early-access', '1')
      } catch {
        /* ignore */
      }
      window.location.href = '/app'
    } else {
      setError('That invite code is not valid.')
    }
  }

  return (
    <section
      id="coming-soon"
      className="relative h-screen w-full overflow-hidden"
      style={{
        backgroundImage: 'url(/coming-soon.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 flex h-full flex-col items-center justify-between px-6 py-10">
        <div className="flex flex-col items-center gap-3">
          <img src="/favicon.svg" alt="Desknoty" className="h-12 w-12" />
          <span className="text-[20px] font-semibold tracking-[-0.02em] text-white drop-shadow">
            Desknoty
          </span>
        </div>

        <div className="w-full max-w-md">
          {!unlocked ? (
            <div
              ref={trackRef}
              className="relative h-14 w-full select-none rounded-full bg-white/20 backdrop-blur-md ring-1 ring-white/40"
              onPointerDown={(e) => startDrag(e.clientX)}
            >
              <div
                className="absolute left-1 top-1 h-12 w-12 rounded-full bg-white shadow-lg"
                style={{ transform: `translateX(${progress * (trackRef.current ? trackRef.current.clientWidth - 56 : 0)}px)` }}
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[14px] font-medium text-white">
                Swipe to unlock early access
              </span>
            </div>
          ) : (
            <form onSubmit={submitCode} className="flex flex-col gap-3">
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  setError('')
                }}
                placeholder="Enter invite code"
                className="h-12 w-full rounded-full border-0 bg-white/90 px-5 text-[15px] text-[#141a26] outline-none"
                autoFocus
              />
              {error ? <p className="text-center text-[13px] text-red-200">{error}</p> : null}
              <button
                type="submit"
                className="h-12 w-full rounded-full bg-white text-[15px] font-semibold text-[#141a26]"
              >
                Unlock
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[13px] text-white/80">
          Scroll down to explore Desknoty
        </p>
      </div>
    </section>
  )
}
