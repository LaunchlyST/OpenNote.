import type { CSSProperties } from 'react'
import { AtSign, Globe, Play, X as XIcon } from 'lucide-react'
import { CURRENCIES, FONTS, PRESETS } from './model'
import type { StoreDraft } from './model'

/**
 * The public store page. The phone preview renders this exact component,
 * so what the seller sees is what a buyer will see.
 */
export function StorePage({ store }: { store: StoreDraft }) {
  const preset = PRESETS.find((p) => p.id === store.theme.preset) ?? PRESETS[0]
  const font = FONTS.find((f) => f.id === store.theme.font)?.css ?? FONTS[0].css
  const radius = store.theme.button === 'pill' ? 999 : store.theme.button === 'sharp' ? 4 : 12
  const bg =
    store.theme.background === 'gradient'
      ? `linear-gradient(180deg, ${preset.bg} 0%, color-mix(in srgb, ${store.theme.accent} 22%, ${preset.bg}) 100%)`
      : preset.bg
  const socials = [
    { k: 'instagram', icon: <AtSign className="h-4 w-4" /> },
    { k: 'youtube', icon: <Play className="h-4 w-4" /> },
    { k: 'x', icon: <XIcon className="h-4 w-4" /> },
    { k: 'website', icon: <Globe className="h-4 w-4" /> },
  ].filter((s) => store.socials[s.k as keyof StoreDraft['socials']].trim())
  const products = store.products.filter((p) => p.title.trim())

  return (
    <div className="sp" style={{ background: bg, color: preset.ink, fontFamily: font, '--ac': store.theme.accent, '--on': preset.bg, '--r': `${radius}px` } as CSSProperties}>
      <div className="sp-head">
        <span className="sp-avatar" style={store.avatar ? { backgroundImage: `url(${store.avatar})` } : { background: store.theme.accent, color: preset.bg }}>
          {!store.avatar && store.name.trim().charAt(0).toUpperCase()}
        </span>
        <h2 className="sp-name">{store.name}</h2>
        {store.handle && <p className="sp-handle">@{store.handle}</p>}
        {store.bio && <p className="sp-bio">{store.bio}</p>}
        {socials.length > 0 && (
          <div className="sp-socials">
            {socials.map((s) => (
              <span key={s.k}>{s.icon}</span>
            ))}
          </div>
        )}
      </div>

      <div className="sp-products">
        {products.length === 0 ? (
          <p className="sp-none">Products you add show up here.</p>
        ) : (
          products.map((p) => {
            const sym = CURRENCIES.find((c) => c.code === p.currency)?.symbol ?? '£'
            const price = Number(p.price || 0)
            return (
              <article key={p.id} className="sp-card">
                {p.cover ? <span className="sp-cover" style={{ backgroundImage: `url(${p.cover})` }} /> : <span className="sp-cover sp-cover-empty" />}
                <div className="sp-card-body">
                  <h3>{p.title}</h3>
                  {p.short && <p>{p.short}</p>}
                  <span className="sp-buy">
                    {price === 0 ? 'Free' : `${p.pwyw ? 'From ' : ''}${sym}${price.toFixed(price % 1 ? 2 : 0)}`}
                  </span>
                </div>
              </article>
            )
          })
        )}
      </div>
      <p className="sp-foot">Made with Desknoty</p>
    </div>
  )
}
