import { useState } from 'react'
import { useMenu, usePublicSettings } from '../../api/hooks'
import { LangSwitch, lang, useT } from '../../i18n'
import { formatXaf, type MenuItem } from '../../domain/types'
import { Logo } from '../../ui/icons'

// Public face of the restaurant: opening hours, the menu with descriptions and allergens, and a Book button. No sign-in.
export function PublicHome({ onBook }: { onBook: () => void }) {
  const tx = useT(), cfg = usePublicSettings().data, menu = useMenu(), [cat, setCat] = useState('')
  const items = (menu.data ?? []).filter(m => !m.promoEndsAt || +new Date(m.promoEndsAt) > Date.now() || !m.oldPriceXaf), cats = [...new Set(items.map(m => m.category))], active = cat || cats[0] || ''
  const dsc = (m: MenuItem) => (lang() === 'en' ? m.descriptionEn ?? m.description : m.description)
  return (
    <div className="k-app"><div className="bk">
      <div style={{ textAlign: 'right' }}><LangSwitch /></div>
      <div style={{ display: 'grid', placeItems: 'center' }}><Logo /></div>
      <h1 style={{ textAlign: 'center' }}>{cfg?.restaurant.name ?? 'RestoPulse'}</h1>
      {cfg && <p className="mu" style={{ textAlign: 'center', margin: '0 0 18px' }}>{cfg.restaurant.address}<br />
        <a href={`tel:${cfg.restaurant.phone.replace(/\s/g, '')}`} style={{ color: 'inherit' }}>{cfg.restaurant.phone}</a><br />{tx('Horaires')} : {cfg.restaurant.opens} - {cfg.restaurant.closes}</p>}
      <button className="btn p w" onClick={onBook}>{tx('Réserver une table')}</button>
      <h2 style={{ margin: '28px 0 12px', fontSize: 22 }}>{tx('Notre carte')}</h2>
      <div className="pills" style={{ position: 'static' }} role="group" aria-label={tx('Catégories')}>{cats.map(c => <button key={c} aria-pressed={c === active} onClick={() => setCat(c)}>{tx(c)}</button>)}</div>
      {menu.isPending && <p className="empty">{tx('Chargement de la carte…')}</p>}
      <div className="bl" style={{ marginTop: 8 }}>{items.filter(m => m.category === active).map(m => (
        <article key={m.id} className="k-ci" style={{ opacity: m.available ? 1 : 0.55 }}>
          {m.imageUrl ? <img className="k-im" src={m.imageUrl} alt={tx(m.name)} /> : <div className="k-im" />}
          <div><div className="n">{tx(m.name)}</div>
            {dsc(m) && <div className="sm mu">{dsc(m)}</div>}
            {(m.portion || m.allergens?.length) && <div className="sm mu">{[m.portion, m.allergens?.length ? `${tx('Allergènes')} : ${m.allergens.map(tx).join(', ')}` : ''].filter(Boolean).join(', ')}</div>}
            <div className="p">{m.available ? formatXaf(m.priceXaf) : tx('Épuisé')}{m.oldPriceXaf && <small style={{ textDecoration: 'line-through' }}> {formatXaf(m.oldPriceXaf)}</small>}</div></div>
        </article>))}</div>
    </div></div>
  )
}
