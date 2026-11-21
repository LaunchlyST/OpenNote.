# Conversion plan

Journey: **HOOK → CURIOSITY → PRODUCT → VALUE → TRUST → PURCHASE**

| Stage | Mechanism | Guardrail |
|---|---|---|
| Hook | 5-second Threshold arrival, store name in stone | "SHOP NOW" visible and working at 0 ms |
| Curiosity | ENTER opens the door; tunnel shows real covers as inlays | Skip always visible; never forced |
| Product | Store reveal → feature row → grid | Real products only, original order |
| Value | "What you get" ticks, format, instant delivery | No invented benefits |
| Trust | Verified ratings only when they exist; secure checkout line; real seller identity | No fake reviews / badges |
| Purchase | One ink CTA per product, opens existing checkout | Existing Stripe/bank/affiliate flows untouched |

Discounts: only `product.offer` from the server (it already drops expired offers).
No invented timers; the existing optional real countdown is the only timer.

## Measurement (to plan with the owner; privacy-respecting, first-party)
Events: store_view, intro_enter, intro_skip, intro_complete, chamber_view,
product_view, cta_click, checkout_start, purchase_complete.
A/B: 50/50 "Threshold intro" vs "direct store" per visitor (sticky cookie), compare
checkout_start / store_view and purchase / store_view over ≥ 2 weeks. No claims of
uplift until data supports it.
