# Style 1 — current design (as built, Nov 2026)

Files: `src/projects/seller/Showcase.tsx`, `ShowcaseHome.tsx`, `showcase.css`
(rendered by `StorePage.tsx` for the store home page; product detail = `ProductSheet` in `ProductCard.tsx`).

## Home (full-screen intro)
- Fixed full-viewport dark mosaic under the top bar; page does not scroll on Home.
- Centre panel = seller banner; kicker = real formats; title = store name or @handle; bio; CTA
  "Explore the collection →". Six tiles = product covers / gallery images (no duplicates;
  spare tiles = dark texture). Tiles grow in from the centre on load; pointer parallax on images.
- Inspiration: Oversight Supply "Home — Product Showcase 01" (composition only; their code not used).
- Nothing below the intro (owner's rule: no catalog, FAQ, featured or second hero on Home).

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
