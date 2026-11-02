import { useT } from '../../i18n'
import { useState } from 'react'
import { useMenu, useOnline, useOrders, useSubmitOrder, useTransition } from '../../api/hooks'
import { formatXaf, type MenuItem } from '../../domain/types'

const COOK = ['Bien cuit', 'À point', 'Saignant']
const SPICY_XAF = 500 // display estimate only, the server reprices
export interface Line { menuItemId: string; name: string; qty: number; unitXaf: number; modifiers: string[]; note: string }

export function ItemSheet({ item, onAdd, onClose }: { item: MenuItem; onAdd: (l: Line) => void; onClose: () => void }) {
  const tx = useT()
  const [qty, setQty] = useState(1), [cook, setCook] = useState(''), [spicy, setSpicy] = useState(false), [note, setNote] = useState('')
  const unit = item.priceXaf + (spicy ? SPICY_XAF : 0)
  const ready = !item.cooking || cook !== ''
  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={tx(item.name)}>
        <div className="row sp"><h2>{tx(item.name)}</h2><b>{formatXaf(item.priceXaf)}</b></div>
        {item.cooking && (
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <legend className="b sm" style={{ padding: '0 0 6px' }}>{tx('Cuisson (obligatoire)')}</legend>
            {COOK.map(c => <label key={c} className="opt"><input type="radio" name="cook" checked={cook === c} onChange={() => setCook(c)} />{tx(c)}</label>)}
          </fieldset>
        )}
        {item.cooking && <label className="opt"><input type="checkbox" checked={spicy} onChange={e => setSpicy(e.target.checked)} />{tx('Sauce piquante')} (+{SPICY_XAF} FCFA)</label>}
        <textarea rows={2} placeholder={tx('Instructions spéciales')} value={note} onChange={e => setNote(e.target.value)} />
        <div className="cnt">
          <button aria-label={tx('Moins')} onClick={() => setQty(Math.max(1, qty - 1))}>−</button><b>{qty}</b><button aria-label={tx('Plus')} onClick={() => setQty(qty + 1)}>+</button>
        </div>
        <button className="btn p w" disabled={!ready}
          onClick={() => onAdd({ menuItemId: item.id, name: item.name, qty, unitXaf: unit, modifiers: [...(cook ? [cook] : []), ...(spicy ? ['Sauce piquante'] : [])], note })}>
          {tx('Ajouter')}, {formatXaf(unit * qty)}
        </button>
      </div>
    </div>
  )
}

export function OrderSheet({ tableId, onClose }: { tableId: string; onClose: () => void }) {
  const tx = useT()
  const { data: menu, isPending, isError, refetch } = useMenu()
  const submit = useSubmitOrder()
  const online = useOnline()
  const serve = useTransition(), ready = (useOrders().data ?? []).filter(o => o.tableId === tableId && o.status === 'ready')
  const [cat, setCat] = useState('Boissons'), [q, setQ] = useState(''), [cart, setCart] = useState<Line[]>([]), [pick, setPick] = useState<MenuItem | null>(null)
  if (isPending) return <p className="empty">{tx('Chargement de la carte…')}</p>
  if (isError) return <div className="empty">{tx('Carte indisponible.')} <button className="btn s" onClick={() => refetch()}>{tx('Réessayer')}</button></div>
  const cats = [...new Set(menu.map(m => m.category))]
  const list = menu.filter(m => (q ? m.name.toLowerCase().includes(q.toLowerCase()) : m.category === cat))
  const total = cart.reduce((a, l) => a + l.unitXaf * l.qty, 0)
  const add = (m: MenuItem) => m.cooking ? setPick(m) : setCart(c => [...c, { menuItemId: m.id, name: m.name, qty: 1, unitXaf: m.priceXaf, modifiers: [], note: '' }])
  return (
    <div className="col">
      <div className="row sp"><button className="btn s" onClick={onClose}>{tx('Retour aux tables')}</button><span className="b">{tx('Table')} {tableId}</span></div>
      {ready.map(o => <div key={o.id} className="card row sp"><span><b>{tx('Prêt à servir')}</b><br /><span className="sm mu">{o.lines.map(l => `${l.qty} ${tx(l.name)}`).join(', ')}</span></span>
        <button className="btn s g" disabled={serve.isPending} onClick={() => serve.mutate({ id: o.id, to: 'served', version: o.version })}>{tx('Marquer servi')}</button></div>)}
      {serve.isError && <p role="alert" className="bn">{tx(serve.error.message)}</p>}
      <input type="search" placeholder={tx('Rechercher un plat')} aria-label={tx('Rechercher un plat')} value={q} onChange={e => setQ(e.target.value)} />
      <div className="pills" role="group" aria-label={tx('Catégories')}>
        {cats.map(c => <button key={c} aria-pressed={c === cat && !q} onClick={() => { setCat(c); setQ('') }}>{tx(c)}</button>)}
      </div>
      <div className="card" style={{ padding: '2px 14px' }}>
        {list.map(m => (
          <button key={m.id} className="item" disabled={!m.available} style={m.available ? undefined : { opacity: 0.5 }} onClick={() => add(m)}>
            <span><span className="b">{tx(m.name)}</span>{m.cooking && <><br /><span className="sm mu">{tx('Cuisson à choisir')}</span></>}</span>
            <span className="b">{m.available ? formatXaf(m.priceXaf) : tx('Épuisé')}</span>
          </button>
        ))}
        {!list.length && <div className="empty">{tx('Aucun plat ne correspond.')}</div>}
      </div>
      {submit.isError && <p role="alert" className="bn">{tx(submit.error.message)}</p>}
      {!online && <p role="alert" className="bn">{tx('Hors ligne. La commande ne peut pas être envoyée.')}</p>}
      {cart.length > 0 && (
        <div className="cartbar">
          <button className="btn p w" disabled={submit.isPending || !online}
            onClick={() => submit.mutate({ tableId, lines: cart.map(l => ({ menuItemId: l.menuItemId, qty: l.qty, modifiers: l.modifiers, note: l.note || undefined })) }, { onSuccess: onClose })}>
            {submit.isPending ? tx('Envoi…') : `${tx('Envoyer en cuisine')} (${formatXaf(total)})`}
          </button>
        </div>
      )}
      {pick && <ItemSheet item={pick} onClose={() => setPick(null)} onAdd={l => { setCart(c => [...c, l]); setPick(null) }} />}
    </div>
  )
}
