# Motion spec — Concept A "The Threshold" (proposal, awaiting approval)

Stack: **Three.js 0.187 + GSAP 3.12** (both already in package.json — no new deps).
One `WebGLRenderer`, created lazily after the store HTML is interactive; paused when
off-screen (`IntersectionObserver`) and on `visibilitychange`; fully disposed on unmount.
Global rule: **SHOP NOW and the product list are usable at 0 ms**, before any WebGL.

| # | Beat | Trigger | Start → End | Duration / easing | Camera / objects / light | Interrupt | Mobile | Reduced motion | Failure |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Arrival: world establishes | page load | black → fog-lit monolith, store name engraved | 0–0.4 s, `expo.out` | static camera; fog density 0.06→0.035 | any click/scroll jumps to settled frame | same, half-res DPR 1 | still poster frame (pre-rendered) | CSS poster image + name |
| 2 | Light reveal | after 1 | a single raking light sweeps the facade, revealing relief | 0.4–1.1 s, `power2.inOut` | spot light x −6→+6; normal-mapped relief | skip to end | baked light texture instead of dynamic shadow | skip | poster |
| 3 | Seam ignites | after 2 | hairline seam between two door slabs glows | 1.1–1.8 s, `sine.inOut` | emissive 0→1 on seam mesh; "ENTER" becomes active | — | same | static glow | CSS line |
| 4 | Door opens | ENTER click/tap/Enter key | slabs rotate on hinges 0°→78° | 1.2 s, `power3.inOut` | real slab geometry with thickness; light spill grows through gap; camera dolly z 8→3 | ESC / "Skip to shop" reverses or jumps | 0.9 s | instant cut to store | jump to store |
| 5 | Tunnel: "The Stacks" | after 4 | camera travels through a corridor of floating monolith slabs that slide into alignment as you pass (each slab = one real product cover as a lit inlay) | 3.2 s total: accelerate 0.8 s, cruise 1.6 s, decelerate 0.8 s (`power2.in` → linear → `power3.out`) | slabs translate x ±4→0 just before the camera; light pools per slab | wheel/tap = advance faster; "Skip" always visible | fewer slabs (max 6), no shadows | skipped | skipped |
| 6 | Discount chamber (only if a product has a live `offer`) | end of 5 | a monumental "30%" extrudes from the floor; product cover on a plinth under a spotlight | 1.6 s, `back.out(1.4)` for numerals | text geometry rises y −3→0; spot intensity 0→1 | click CTA → product; "Continue" → store | numerals as flat planes | static card | DOM promo card |
| 7 | Store reveal | after 5/6 | the final arch's frame scales to become the store hero's border | 0.9 s, `expo.inOut` | camera pulls back; canvas fades under DOM hero | — | same | — | — |

Rules: entrance plays **once per page load** (refresh / new visit replays). The chamber
plays at most once per session (sessionStorage), never invented. No endless loops except
a very slow ambient fog drift (< 0.02 units/s) that stops when off-screen.
