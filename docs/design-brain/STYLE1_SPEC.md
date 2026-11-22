# Style 1 — current design (as built, Nov 2026)

Files: `src/projects/seller/Showcase.tsx`, `ShowcaseHome.tsx`, `showcase.css`
(rendered by `StorePage.tsx` for the store home page; product detail = `ProductSheet` in `ProductCard.tsx`).

## Home — The Digital Portal (`PortalHome.tsx`, `PortalScene.ts`, `portalKind.ts`)
- Full-viewport 3D desk scene under the nav: beige CRT (glass opening, scanlines, grid horizon,
  @handle and real covers on screen), warm lamp + key light, keyboard, leaves, low-poly bird.
- Copy is HTML in a left column: Skip to products (first focus), Creator store, name, bio,
  real offer line, Enter the store; product chips = keyboard equivalent of the 3D objects.
- Objects by type: sheets / book / display (video) / icon tiles / neutral display; hover opens,
  click or chip selects → "View product" / "Open in the store" (brings it to the front).
- Three.js is loaded only when Home is shown; still scene for reduced motion, no WebGL, failed
  load and the Studio preview. Scene pauses when hidden or on Products.
- Transition: one paused GSAP timeline (1.6 s, ×1.35 on mobile, ×3 for skip/reduced):
  brighten → approach → glass → tunnel of covers and rings → shop fades in. Home = reverse().

## Products (shopping layout)
- Left: sticky banner stage (seller's own tap-to-play `Banner`), "Creator store", @handle, bio,
  Instant download / Secure checkout, orange "Shop collection".
- Top bar: logo, Home / Products / Reviews with one sliding orange underline; right: socials +
  "N digital products" pill; search only for 9+ products. No "Shop now", no cart.
- Right: the slanted card at the right end (~46% width) — KEEP THIS SHAPE. Inside it:
  "Explore the collection", category tabs (only if ≥2 real categories) and the showroom
  carousel (`ShowcaseCarousel.tsx`): one large card in front, neighbours peeking, drag/swipe,
  arrows, dots, keyboard, trackpad. Each product has a deterministic theme (hash of id over 6
  palettes; seller's CTA colour overrides); the shape fills with that product's scene
  (gradients + blurred cover light + arc) blending continuously with the drag.
  Card: art (contain over blurred copy), title, short line, chips (type/format/real rating),
  sale price when discounted, accent button "Buy now — £X" / "Get free download".
- Studio: Phone / Laptop switch above the preview (laptop = page at 1440px, scaled).
- Feedback: only from the floating button or "Reviews"; drawer with real reviews and verified writing.

## Transition (one GSAP timeline, `useViewTransition`)
- Progress 0 = Home, 1 = Products. Forward: copy fades up → tiles fly apart and past the camera
  (product covers fly to their row art) → centre clip-path opens to full screen and zooms →
  overlay dissolves, stage scales in, panel slides from the right, rows rise.
- Home = `reverse()` of the same timeline; clicks mid-way flip direction. States:
  HOME_READY / HOME_TO_PRODUCTS / PRODUCTS_READY / PRODUCTS_TO_HOME. URL `?view=products`,
  Back/Forward supported. Reduced motion = same timeline at 2.6× speed without travel.

## Rules carried from MISTAKES
- Real data only (no invented reviews, counts, discounts, taglines).
- Design owns button colours. Animations settle. Test 1440/1680/390 + a recording of transitions.
