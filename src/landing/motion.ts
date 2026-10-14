import { useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Scroll choreography for the landing page.
 *
 * Each section opts in with a `data-anim` attribute and gets its own motion,
 * so no two sections enter the same way:
 *
 *   mask      headings wipe up through a clip mask
 *   tile      icon tiles flip over and settle
 *   unfold    How It Works cards swing open like pages from their left edge
 *   assemble  feature cards slide in from different directions and lock together
 *   expand    an interface close-up grows from a small preview into the card
 *   tilt      the hero laptop lies back and lifts upright as you scroll
 *   flip      pricing cards rotate up from the table
 *   lines     FAQ rows draw in from the left, one after another
 *   rise3d    final device cards rise out of depth
 *
 * Everything is built inside gsap.matchMedia so reduced-motion visitors get the
 * finished page, and everything is reverted on unmount.
 */
export function useScrollMotion() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const q = <T extends Element = HTMLElement>(sel: string) => gsap.utils.toArray<T>(sel)
      const trigger = (el: Element, start = 'top 85%') => ({ trigger: el, start, toggleActions: 'play none none reverse' })

      q('[data-anim="mask"]').forEach((el) => {
        gsap.from(el, {
          clipPath: 'inset(0% 0% 100% 0%)',
          yPercent: 30,
          duration: 1.1,
          ease: 'expo.out',
          scrollTrigger: trigger(el),
        })
      })

      q('[data-anim="tile"]').forEach((el) => {
        gsap.from(el, {
          rotationY: 180,
          rotation: -25,
          scale: 0.4,
          duration: 1.1,
          ease: 'back.out(2)',
          scrollTrigger: trigger(el, 'top 90%'),
        })
      })

      q('[data-anim="unfold"]').forEach((group) => {
        const items = group.querySelectorAll('[data-anim-item]')
        gsap.set(items, { transformPerspective: 1400, transformOrigin: '0% 50%' })
        gsap.from(items, {
          rotationY: -75,
          opacity: 0,
          duration: 1.2,
          ease: 'expo.out',
          stagger: 0.14,
          scrollTrigger: trigger(group, 'top 80%'),
        })
      })

      q('[data-anim="assemble"]').forEach((group) => {
        const items = group.querySelectorAll('[data-anim-item]')
        const from = [
          { x: -120, rotation: -4 },
          { x: 120, rotation: 4 },
          { y: 120, rotation: -2 },
          { y: 120, rotation: 2 },
        ]
        items.forEach((item, i) => {
          gsap.from(item, {
            ...from[i % from.length],
            opacity: 0,
            duration: 1.1,
            ease: 'expo.out',
            delay: (i % 2) * 0.08,
            scrollTrigger: trigger(item, 'top 92%'),
          })
        })
      })

      q('[data-anim="expand"]').forEach((el) => {
        gsap.fromTo(
          el,
          { clipPath: 'inset(18% 22% 0% 22% round 24px)', scale: 0.92 },
          {
            clipPath: 'inset(0% 0% 0% 0% round 12px)',
            scale: 1,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 45%', scrub: 0.6 },
          },
        )
      })

      q('[data-anim="tilt"]').forEach((el) => {
        gsap.set(el, { transformPerspective: 1600, transformOrigin: '50% 100%' })
        gsap.fromTo(
          el,
          { rotationX: 22, scale: 0.9 },
          {
            rotationX: 0,
            scale: 1,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 25%', scrub: 0.8 },
          },
        )
      })

      q('[data-anim="flip"]').forEach((group) => {
        const items = group.querySelectorAll('[data-anim-item]')
        gsap.set(items, { transformPerspective: 1200, transformOrigin: '50% 100%' })
        gsap.from(items, {
          rotationX: 70,
          y: 80,
          opacity: 0,
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.12,
          scrollTrigger: trigger(group, 'top 80%'),
        })
      })

      q('[data-anim="lines"]').forEach((group) => {
        gsap.from(group.querySelectorAll('[data-anim-item]'), {
          clipPath: 'inset(0% 100% 0% 0%)',
          x: -20,
          duration: 0.9,
          ease: 'power4.out',
          stagger: 0.07,
          scrollTrigger: trigger(group, 'top 85%'),
        })
      })

      q('[data-anim="rise3d"]').forEach((group) => {
        const items = group.querySelectorAll('[data-anim-item]')
        gsap.set(items, { transformPerspective: 1400 })
        gsap.from(items, {
          z: -400,
          y: 140,
          rotationX: 25,
          opacity: 0,
          duration: 1.3,
          ease: 'expo.out',
          stagger: 0.15,
          scrollTrigger: trigger(group, 'top 85%'),
        })
      })
    })

    // Fonts and lazy content change heights after mount.
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 600)
    return () => {
      window.clearTimeout(refresh)
      mm.revert()
    }
  }, [])
}

/**
 * Pointer-driven 3D tilt for product frames: the window leans toward the
 * cursor, with a soft glare following it. Fine pointers only.
 */
export function useTilt(ref: { current: HTMLElement | null }, strength = 6) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!window.matchMedia?.('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3.out' })
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3.out' })
    gsap.set(el, { transformPerspective: 1600 })
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      ry(px * strength)
      rx(-py * strength)
    }
    const onLeave = () => {
      rx(0)
      ry(0)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [ref, strength])
}
