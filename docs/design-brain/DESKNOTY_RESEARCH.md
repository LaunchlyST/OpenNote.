# Desknoty research log

Method: each URL opened in headless Chromium (1440×900, software WebGL), screenshots at
~2.5 s, ~7.5 s and after one scroll. Status column is honest about what rendered.
Contact sheets: `references/sshop.png`, `references/sconv.png`, `references/s3d.png`.

## Access status (2026-11-21)

| Source | Status | Notes |
|---|---|---|
| ecomm.design | **Inspected** | Gallery grid of real stores |
| suttoncommerce.co.uk/inspiration | **Inspected** (hero only) | Dark rounded hero card, editorial type |
| shopsiteawards.com | **Inspected** | Curated archive, store thumbnails |
| replo.app | **Inspected** | Product/landing builder, real product-page mockups |
| instant.so | **Inspected** | Shopify product-page builder mockups |
| godly.website | **Inspected** | Curated design gallery (cards) |
| dribbble.com (digital product store) | **Inspected** | Korsa, Nixtio shots |
| cosmos.so (Product Card ui) | **Inspected** | Card-UI element board |
| truegrittexturesupply.com | **Inspected** (earlier) | Paste-up poster storefront |
| desknoty.com | **Inspected** | Our own homepage voice |
| lusion.co | **Partial** — loader + first transition only | WebGL in software mode |
| bruno-simon.com | **Partial** — intro scene only | Isometric grid + light ring |
| igloo.inc | **Partial** — loading screen only | Scene did not render headless |
| awwwards.com | **Not inspected** | HTTP 502 |
| siteinspire.com | **Not inspected** | Bot checkpoint (429) |
| behance.net | **Not inspected** | HTTP 400 |
| pinterest.com | **Not inspected** | Login wall only |

Totals: 10 inspected, 3 partial, 4 inaccessible. Need 5+ more full inspections
(target 15) — next pass: individual store pages found via ecomm.design / ShopSiteAwards
(Heist, Mate the Label, Skall Studio, Penny, Polestar, Reale Actives), opened directly.

## Findings (inspected only)

### ShopSiteAwards — archive pages of Heist, Skall Studio, Mate the Label, Tadaima
1. https://shopsiteawards.com/
2. Hook: one huge product/lifestyle image fills each store's first screen; type sits on it.
3. Concept: photography-led; 1 brand colour per store (Heist = electric blue + cream serif).
4. Motion: not observable from thumbnails.
5. Attention: oversized headline over a single focal image ("Coffee Without a Curfew." / "HEIST").
6. Product: the product is the hero, not a card.
7. Purchase: CTA lives in the hero; grid follows.
8. Adapt: **one focal product per screen**, headline overlaid with confidence; a single brand colour.
9. Don't copy: their photography/brands.
10. Directly inspected (thumbnails).

### ecomm.design — Polestar, Reale Actives, Elev8, ActiveHop
1. https://ecomm.design/
2–6. Polestar: product shots repeated on a clean white grid with small captions — calm, premium.
   Reale Actives: big lifestyle hero + product row + "Breaking out free" campaign tile.
7. Clear rhythm: hero → product row → campaign block.
8. Adapt: **campaign block between product rows** (our discount chamber's storefront echo).
9. Don't copy layouts 1:1. 10. Directly inspected (thumbnails).

### Replo — "The website builder that learns what sells"
1. https://www.replo.app/
2. Dark hero, serif italic accent word ("*sells*"), product page mockup below the fold line.
3–6. Product page mock: price, "We lowered our price" badge, benefit ticks, quote, "55% off" tag.
7. Conversion stack visible: benefits list → social proof quote → discount tag next to price.
8. Adapt: **benefit checklist + discount tag adjacent to the price** on our PDP.
9. Don't copy branding/claims. 10. Directly inspected.

### Instant.so — Shopify store builder
1. https://instant.so/
2–6. Their PDP mocks: split layout (gallery left, buy box right), quantity, "Add to cart $39",
   "Pay in 4" line, collapsible Description / Shipping rows.
7. Buy box above the fold; secondary info collapsed.
8. Adapt: **sticky buy box + collapsible "What you get / Format / Delivery"**.
9. Don't copy. 10. Directly inspected.

### Sutton Commerce — Shopify Store Inspiration
1. https://www.suttoncommerce.co.uk/inspiration
2. A rounded dark panel hero inside a light page; orange accent; huge sans headline.
8. Adapt: **the hero as an object (a framed panel) inside the page** — maps to "the last
   architectural frame becomes the store hero". 10. Hero only.

### Dribbble — Korsa "Discover · Shop · Download", Nixtio "SOLE"
1. https://dribbble.com/search/digital-product-store
2. Korsa: dark monochrome stage, one product lit, three-word nav as a sentence.
   Nixtio: warm skin-tone photography, serif headline, price chip on the product image.
8. Adapt: **a lit single object in darkness** (door/chamber lighting), **price chip on art**.
10. Directly inspected (shots).

### Cosmos — Product Card UI
1. https://www.cosmos.so/search/elements/Product%20Card%20ui
2. Strongest: full-bleed image card with price + title set in bold over the bottom
   ("$256 Mens Washed Oversized Hoodie"); Ice Matcha price notch.
8. Adapt: **image-first card, price typographically dominant**. 10. Directly inspected.

### True Grit Texture Supply
1. https://www.truegrittexturesupply.com/
2. Products as physical objects (paper posters on a board) — tactile, memorable.
8. Adapt (Concept C idea): **products as objects in a world**, not boxes. 10. Inspected.

### Lusion / Bruno Simon / igloo (partial)
- Lusion: a numeric loader (071 → 100) then white planes transforming in 3D space.
  Adapt: **loading as part of the show**, but ours must never block shopping.
- Bruno Simon: dark isometric floor grid; a light ring draws itself before the world appears.
  Adapt: **light drawing the architecture into existence** (our 0.4–1.1 s beat).
- igloo: only a pale loading screen rendered; nothing to claim.
- Caution: these are portfolio experiences with long loads — **the opposite of a store's
  needs**. We take the craft, not the wait.

## Extracted principles
1. One focal object per screen, lit; everything else recedes.
2. The product is the hero; price is typographically strong and next to the action.
3. A campaign block between product rows (where real discounts live).
4. Buy box: price + discount tag + benefit ticks + one primary CTA, above the fold.
5. 3D sells atmosphere; the store must work fully before/without it.

### Oversight Supply — "Home — Product Showcase 01" (Evergrid)
1. https://supply.madebyoversight.com/sections/evergrid-home-product-showcase-01
2. Inspected: the public page and its free interactive preview (desktop, scrolled). Source code
   needs a signed-in account — **not obtained, not used**.
3. Seen: one full-bleed landscape image that, on scroll, shrinks into the centre panel of a
   dark mosaic of rounded landscape tiles (2 on top, 1 each side, 2 below); a serif two-line
   headline fades in over the centre panel.
8. Adapted (own code): Style 1 Home = that mosaic built from the seller's own images; Home →
   Products is one GSAP timeline (centre panel opens via clip-path, other tiles part, product
   covers fly to their rows); Home plays the same timeline in reverse.

### MotionSites (motionsites.ai) — Nov 2026
- Inspected: the gallery, the public lesson "Build a scroll-animated website with AI" (its full
  prompt text is public: scroll-scrubbed video via a canvas frame cache, lerp 0.12, reveal
  translate-y + opacity 700 ms), and preview pop-ups of Virtual Store, Golden Portal, VHS Archive,
  Loops Virtual Store, Card Story, Orbit Sphere (two frames each, not full recordings).
- Most prompts are behind a paid plan — not obtained, not used.
- Taken: camera-led storytelling, one focal object, products as objects in a world, motion
  that is driven by one progress value (here a reversible timeline rather than scroll).
