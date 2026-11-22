# Mistakes log — read before every design change

Real failures from this project (Nov 2026). Format: what → why → fix → prevention.

1. **Generic AI look (glass, gradients, centered slogan + button).**
   Why: designing from defaults, not references. Fix: pick 1 direction from RESEARCH.
   Prevention: every visual decision cites a principle in RESEARCH or DESIGN_SYSTEM.

2. **Stores stuck in a 600px column on desktop.**
   Why: `.ps-main { max-width: 600px }` wraps every public store. Fix: Style-2-scoped
   `.ps-main:has(> .dk)` override. Prevention: measure container width at 1440 in tests.

3. **Products shown twice** (hero wall + grid repeating the same 3).
   Why: hero and grid both rendered `list`. Prevention: assert card count == product count.

4. **Fake-looking empty states** (blank cards, "+ Add product" slots on the live store).
   Prevention: never render placeholders publicly; editor-only affordances behind `!live`.

5. **Button text invisible** (`.dk a { color: inherit }` beat `.dk-btn-ink`).
   Prevention: screenshot every CTA state; check contrast of link-buttons.

6. **Weak covers make any layout look bad** (a sign-up screenshot, five stars on white).
   Prevention: design must still hold with poor art: placeholder typography tiles,
   `object-fit` + `object-position: top`, never tiny thumbnails.

7. **Animation that never settles** (constant shimmer/sparks/drift) read as cheap.
   Prevention: entrance motion once per page load; rest after; reduced-motion = still.

8. **Seller colours fighting the palette** (blue per-product button on an ink design).
   Prevention: in Style 2 the design owns button colours; seller accent only as `--ac`.

9. **Editor and store drift apart** (Studio phone showed slots the live store didn't).
   Prevention: same component for both; editor extras only behind `!live`.

10. **Phone preview animation moved the phone** (`ss-float`) → clicks missed.
    Prevention: no motion on interactive editor surfaces.

11. **Claiming work verified without rendering it.** Prevention: screenshot + numeric
    checks (overflow, card count, CTA opens checkout) at 375/390/430/768/1440 every pass.

12. **Shipping to `main` = shipping live.** Prevention: branch first; owner approves merges.

13. **Duplicate price on sale items** (custom "was" price beside PriceTag, which already
    strikes the old price). Prevention: reuse BuyRow/PriceTag; screenshot a discounted row.

14. **Hidden layer visible at the start of a timeline** (`fromTo(..., immediateRender:false)`
    leaves the target visible until its tween starts). Prevention: `gsap.set` the start state
    when building the timeline; check the first frames of a recording, not just the ends.

15. **Removed the owner's layout while "improving" it** (the slanted right card was replaced by a
    full-width scene). Prevention: when asked to redesign *inside* an area, keep its shape and
    position; change only its contents. Ask if unsure.
