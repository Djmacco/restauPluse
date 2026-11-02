import { useT, LangSwitch } from '../../i18n'
import { useState } from 'react'
import { usePublicSettings, useCustomerOrders, useCustomerSubmit, useMenu, useNow, useOnline, useServiceRequest } from '../../api/hooks'
import { formatXaf, METHOD_LABEL, type MenuItem, type Order, type OrderStatus, type PayMethod, type ServiceKind } from '../../domain/types'
import { ItemSheet, type Line } from '../orders/OrderSheet'
import { Ic, Logo } from '../../ui/icons'

const STEPS: [OrderStatus, string][] = [['submitted', 'Envoyée'], ['accepted', 'Acceptée en cuisine'], ['preparing', 'En préparation'], ['ready', 'Prête']]
const STEPS_DIRECT: [OrderStatus, string][] = [['submitted', 'Envoyée'], ['ready', 'Prête'], ['served', 'Servie']] // all dishes already prepared: no kitchen step
const ASK: Record<ServiceKind, [string, string]> = { waiter: ['Appeler un serveur', 'Un serveur arrive. Merci de patienter.'], water: ['De l’eau', 'De l’eau arrive.'], bill: ['L’addition', 'Addition demandée. Un serveur vous l’apporte.'] }
const PAY: [PayMethod, 'cash' | 'phone'][] = [['cash', 'cash'], ['mtn_momo', 'phone'], ['orange_money', 'phone']]
const hms = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(v => String(v).padStart(2, '0')).join(' : ') }
const pct = (m: MenuItem) => (m.oldPriceXaf ? Math.round(((m.oldPriceXaf - m.priceXaf) / m.oldPriceXaf) * 100) : 0)

function Stepper({ q, name, onDec, onInc, disabled }: { q: number; name: string; onDec: () => void; onInc: () => void; disabled?: boolean }) {
  const tx = useT()
  return (
    <div className="k-ctl">
      <button className="k-minus" aria-label={`${tx('Retirer')} ${tx(name)}`} onClick={onDec}>−</button><b>{q}</b>
      <button className="k-plus" aria-label={`${tx('Ajouter')} ${tx(name)}`} onClick={onInc} disabled={disabled}>+</button>
    </div>
  )
}

function Card({ m, q, onInc, onDec }: { m: MenuItem; q: number; onInc: () => void; onDec: () => void }) {
  const tx = useT()
  return (
    <article className="k-c">
      <div className="k-ph">{m.imageUrl && <img src={m.imageUrl} alt={tx(m.name)} />}{m.prep === 'ready' && <span className="k-prep">{tx('Déjà prêt')}</span>}{m.stock != null && <span className="k-av">{tx('Disponible :')} {m.stock}</span>}</div>
      <div className="k-nm">{tx(m.name)}</div>
      <div className="k-mt">{m.oldPriceXaf ? <><span className="k-dc">{pct(m)}%</span><span className="k-old">{formatXaf(m.oldPriceXaf)}</span></> : tx('Prix par portion')}</div>
      <div className="k-pr"><span>{formatXaf(m.priceXaf)}</span>
        {q ? <Stepper q={q} name={tx(m.name)} onDec={onDec} onInc={onInc} disabled={m.stock != null && q >= m.stock} />
          : <button className={`k-ob ${m.oldPriceXaf ? '' : 'o'}`} disabled={!m.available} onClick={onInc}>{m.available ? tx('Commander') : tx('Épuisé')}</button>}
      </div>
    </article>
  )
}

export function Customer() {
  const tx = useT()
  const people = (n: number) => `${n} ${tx(n > 1 ? 'personnes' : 'personne')}`
  // Table code comes from the QR link (?t=...). Never inferred from location or IP.
  const [token, setToken] = useState<string | null>(() => new URLSearchParams(location.search).get('t') ?? (import.meta.env.VITE_API_URL ? null : 'D2P6WV')) // demo only: the mock opens on table 4
  const [scr, setScr] = useState<'welcome' | 'menu' | 'order'>('welcome')
  const [name, setName] = useState(''), [guests, setGuests] = useState(2), [code, setCode] = useState('')
  const [cart, setCart] = useState<Line[]>([]), [pick, setPick] = useState<MenuItem | null>(null)
  const [q, setQ] = useState(''), [sort, setSort] = useState(false), [pay, setPay] = useState<PayMethod>('cash'), [msg, setMsg] = useState(''), [done, setDone] = useState<Order | null>(null)
  const orders = useCustomerOrders(token), menu = useMenu(), online = useOnline(), now = useNow()
  const submit = useCustomerSubmit(token ?? ''), svc = useServiceRequest(token ?? ''), cfg = usePublicSettings().data
  const items = menu.data ?? []
  const tableOk = !!token && orders.isSuccess
  const qty = (id: string) => cart.filter(l => l.menuItemId === id).reduce((a, l) => a + l.qty, 0)
  const count = cart.reduce((a, l) => a + l.qty, 0)

  const inc = (m: MenuItem) => {
    if (m.stock != null && qty(m.id) >= m.stock) return
    if (m.cooking) return setPick(m)
    setCart(c => { const i = c.findIndex(l => l.menuItemId === m.id && !l.modifiers.length); return i < 0 ? [...c, { menuItemId: m.id, name: m.name, qty: 1, unitXaf: m.priceXaf, modifiers: [], note: '' }] : c.map((l, k) => (k === i ? { ...l, qty: l.qty + 1 } : l)) })
  }
  const dec = (id: string) => setCart(c => { const i = c.map(l => l.menuItemId).lastIndexOf(id); return c.flatMap((l, k) => (k !== i ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : [])) })
  const line = (i: number, d: number) => setCart(c => c.flatMap((l, k) => (k !== i ? [l] : l.qty + d > 0 ? [{ ...l, qty: l.qty + d }] : [])))

  const base = (l: Line) => items.find(m => m.id === l.menuItemId)
  const sub = cart.reduce((a, l) => { const m = base(l); return a + (l.unitXaf - (m?.priceXaf ?? 0) + (m?.oldPriceXaf ?? m?.priceXaf ?? 0)) * l.qty }, 0)
  const total = cart.reduce((a, l) => a + l.unitXaf * l.qty, 0)

  const promos = items.filter(m => m.promoEndsAt)
  const ends = promos.length ? Math.min(...promos.map(m => +new Date(m.promoEndsAt!))) : 0
  const rest = items.filter(m => m.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (sort ? a.priceXaf - b.priceXaf : 0))
  const last = [...(orders.data ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]
  const direct = !!last && last.lines.every(l => l.prep === 'ready'), mixed = !!last && !direct && last.lines.some(l => l.prep === 'ready')
  const steps = direct ? STEPS_DIRECT : STEPS
  const idx = last ? steps.findIndex(s => s[0] === last.status) : -1

  if (scr === 'welcome') return (
    <div className="k-app"><main className="k-w">
      <div style={{ alignSelf: 'flex-end' }}><LangSwitch /></div>
      <div style={{ margin: '0 auto' }}><Logo /></div>
      <h1>{tx('Bonjour 👋, bienvenue chez Mama Ngozi !')}</h1>
      <p className="k-lead">{tx('Saisissez votre nom et le nombre de personnes à table. Vous pourrez ensuite choisir parmi nos meilleurs plats.')}</p>
      <label className="k-lab" htmlFor="nm">{tx('Votre nom')}</label>
      <div className="k-fld"><input id="nm" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Emir Abiyyu" autoComplete="name" /></div>
      <span className="k-lab" id="gl">{tx('Nombre de personnes')}</span>
      <div className="k-fld" aria-labelledby="gl"><span>{people(guests)}</span>
        <div className="k-ctl"><button className="k-minus" aria-label={tx('Moins une personne')} onClick={() => setGuests(Math.max(1, guests - 1))}>−</button><button className="k-plus" aria-label={tx('Plus une personne')} onClick={() => setGuests(Math.min(20, guests + 1))}>+</button></div></div>
      {!tableOk && <><label className="k-lab" htmlFor="cd">{tx('Code de table')}</label><div className="k-fld"><input id="cd" type="text" inputMode="numeric" value={token ?? code} onChange={e => setCode(e.target.value)} readOnly={!!token} placeholder={tx('Affiché sur votre table')} /></div>
        <p className="sm mu" style={{ margin: '-6px 0 0' }}>{tx('Pas de téléphone ? Demandez simplement à un serveur.')}</p></>}
      <div className="k-grow" style={{ flex: 1 }} />
      <button className="btn p w" disabled={!name.trim() || (!token && !code.trim())} onClick={() => { if (!token) setToken(code.trim().toUpperCase()); setScr('menu') }}>{tx('Terminé')}</button>
    </main></div>
  )

  if (scr === 'order') return (
    <div className="k-app"><main className="k-o">
      <button className="k-bk" aria-label={tx('Retour au menu')} onClick={() => setScr('menu')}><Ic n="back" size={24} /></button>
      <h1>{tx('Commande en cours')}</h1>
      <div className="k-list">
        {cart.map((l, i) => (
          <div className="k-ci" key={i}>
            {base(l)?.imageUrl ? <img className="k-im" src={base(l)!.imageUrl} alt="" /> : <div className="k-im" />}
            <div><div className="n">{tx(l.name)}</div>{l.modifiers.length > 0 && <div className="sm mu">{l.modifiers.map(tx).join(', ')}</div>}
              <div className="p">{formatXaf(l.unitXaf)} <small>x{l.qty}</small></div>
              <Stepper q={l.qty} name={tx(l.name)} onDec={() => line(i, -1)} onInc={() => line(i, 1)} /></div>
            <button className="k-tr" aria-label={`${tx('Supprimer')} ${tx(l.name)}`} onClick={() => setCart(c => c.filter((_, k) => k !== i))}><Ic n="trash" size={22} /></button>
          </div>
        ))}
        {!cart.length && <p className="empty">{tx('Votre panier est vide.')}</p>}
      </div>
      <h3>{tx('Récapitulatif')}</h3>
      <div className="k-sr"><span>{tx('Sous-total')}</span><span>{formatXaf(sub)}</span></div>
      <div className="k-sr"><span>{tx('Remises')}</span><span>-{formatXaf(sub - total)}</span></div>
      <div className="k-sr"><span>{tx('Taxes')}</span><span>{tx('Incluses')}</span></div>
      <div className="k-tot"><span>{tx('Total')}</span><b>{formatXaf(total)}</b></div>
      <h3>{tx('Moyen de paiement')}</h3>
      <div className="k-pm" role="group" aria-label={tx('Moyen de paiement')}>
        {PAY.filter(([k]) => cfg?.payments[k].enabled !== false).map(([k, i]) => <button key={k} aria-pressed={pay === k} onClick={() => setPay(k)}>{pay === k && <span className="k-ck"><Ic n="check" size={12} /></span>}<Ic n={i} size={24} />{tx(METHOD_LABEL[k])}</button>)}
      </div>
      {pay !== 'cash' && cfg?.payments[pay].number && <p className="sm" style={{ margin: '-12px 0 18px' }}>{tx('Envoyez')} <b>{formatXaf(total)}</b> {tx('au')} <b>{cfg.payments[pay].number}</b>, {tx('puis montrez le message de confirmation à votre serveur.')}</p>}
      {pay !== 'cash' && cfg?.payments[pay].qrUrl && <div style={{ textAlign: 'center', margin: '0 0 18px' }}>
        <img src={cfg.payments[pay].qrUrl} alt={`${tx('Code QR de paiement')} ${tx(METHOD_LABEL[pay])}`} style={{ width: 200, maxWidth: '70%', background: '#fff', borderRadius: 12, padding: 8 }} />
        <p className="sm mu" style={{ margin: '6px 0' }}>{tx('Scannez ce code avec votre application Mobile Money, ou téléchargez-le.')}</p>
        <a className="btn s" href={cfg.payments[pay].qrUrl} download="qr-paiement">{tx('Télécharger')}</a></div>}
      {submit.isError && <p role="alert" className="bn" style={{ marginBottom: 12 }}>{tx(submit.error.message)}</p>}
      {!online && <p role="alert" className="bn" style={{ marginBottom: 12 }}>{tx('Connexion perdue. Votre commande n’a pas été envoyée.')}</p>}
      <button className="btn p w" disabled={!cart.length || !tableOk || submit.isPending || !online}
        onClick={() => submit.mutate({ lines: cart.map(l => ({ menuItemId: l.menuItemId, qty: l.qty, modifiers: l.modifiers, note: l.note || undefined })), guestName: name.trim(), guests, payPreference: pay }, { onSuccess: o => { setDone(o); setCart([]) } })}>
        {submit.isPending ? tx('Envoi…') : tx('Commander')}
      </button>
      {!tableOk && <p role="alert" className="sm" style={{ color: 'var(--rd)', textAlign: 'center' }}>{tx('Code de table inconnu. Demandez à un serveur.')}</p>}
      {done && (
        <div className="ov"><div className="sheet" role="dialog" aria-modal="true" aria-label={tx('Commande envoyée')}><div className="k-done">
          <div className="ok"><Ic n="check" size={28} /></div><h2>{tx('Commande n°')} {done.number} {tx('envoyée')}</h2>
          <p className="mu">{tx('Merci')} {name}. {done.lines.every(l => l.prep === 'ready') ? tx('Vos plats sont déjà prêts : un serveur vous les apporte.') : tx('Votre commande arrive en cuisine.')} {tx('Le règlement se fait auprès de votre serveur.')}</p>
          <button className="btn p w" onClick={() => { setDone(null); setScr('menu') }}>{tx('Retour au menu')}</button></div></div></div>
      )}
    </main></div>
  )

  return (
    <div className="k-app"><main>
      <section className="k-info">
        <div className="k-top"><span>{tx('Informations client')}</span><LangSwitch /><button onClick={() => setScr('welcome')}>{tx('Modifier')}</button></div>
        <div className="k-boxes"><div className="k-box"><small>{tx('Votre nom')}</small><span>{name}</span></div><div className="k-box"><small>{tx('Nombre de personnes')}</small><span>{people(guests)}</span></div></div>
        {tableOk && <div className="k-help">{(Object.keys(ASK) as ServiceKind[]).map(k => <button key={k} className="btn s" disabled={svc.isPending || !online} onClick={() => svc.mutate(k, { onSuccess: () => setMsg(tx(ASK[k][1])) })}>{tx(ASK[k][0])}</button>)}</div>}
        {msg && <p role="status" className="sm b" style={{ margin: '10px 0 0', color: 'var(--gr)' }}>{msg}</p>}
        {svc.isError && <p role="alert" className="sm" style={{ margin: '10px 0 0', color: 'var(--rd)' }}>{tx(svc.error.message)}</p>}
        {orders.isError && <p role="alert" className="sm" style={{ margin: '10px 0 0', color: 'var(--rd)' }}>{tx(orders.error.message)} {tx('Demandez à un serveur.')}</p>}
      </section>
      <section className="k-band">
        {last && (
          <div className="card" style={{ marginBottom: 22 }}>
            <div className="row sp"><h2>{tx('Commande n°')} {last.number}</h2><span className="b" style={{ color: 'var(--gr)' }}>{formatXaf(last.lines.reduce((a, l) => a + l.qty * l.unitXaf, 0))}</span></div>
            {last.status === 'cancelled' ? <p className="sm" style={{ color: 'var(--rd)' }}>{tx('Cette commande a été annulée. Un serveur peut vous renseigner.')}</p> :
              <div className="steps" style={{ marginTop: 10 }} aria-label={tx('Avancement de la commande')}>{steps.map(([k, l], i) => <div key={k} className={last.status === 'served' || i < idx ? 'dn' : i === idx ? 'on' : ''}>{last.status === 'served' && i === 3 ? tx('Servie') : tx(l)}</div>)}</div>}
            {mixed && <p className="sm mu" style={{ margin: '10px 0 0' }}>{tx('Certains plats sont déjà prêts et arrivent avec le reste de votre commande.')}</p>}
          </div>
        )}
        {menu.isPending && <p className="empty">{tx('Chargement de la carte…')}</p>}
        {menu.isError && <div className="empty">{tx('Carte indisponible.')} <button className="btn s" onClick={() => menu.refetch()}>{tx('Réessayer')}</button></div>}
        {promos.length > 0 && <>
          <div className="k-hd"><h2>{tx('Promos du jour')}</h2><span className="k-tmr">{tx('Se termine dans')} <b>{hms(ends - now)}</b></span></div>
          <div className="k-hs">{promos.map(m => <Card key={m.id} m={m} q={qty(m.id)} onInc={() => inc(m)} onDec={() => dec(m.id)} />)}</div></>}
        <label className="k-srch"><Ic n="search" /><input type="search" placeholder={tx('Chercher un plat ou une boisson')} aria-label={tx('Chercher un plat ou une boisson')} value={q} onChange={e => setQ(e.target.value)} /></label>
        <div className="k-hd"><h2>{tx('Notre meilleure carte')}</h2><button className="k-fb" aria-pressed={sort} aria-label={tx('Trier par prix croissant')} onClick={() => setSort(!sort)}><Ic n="sliders" /></button></div>
        <div className="k-grid">{rest.map(m => <Card key={m.id} m={m} q={qty(m.id)} onInc={() => inc(m)} onDec={() => dec(m.id)} />)}</div>
        {!rest.length && !menu.isPending && <p className="empty">{tx('Aucun plat ne correspond.')}</p>}
      </section>
      {count > 0 && <button className="k-cart" onClick={() => setScr('order')}><Ic n="bag" size={22} />{tx('Mon panier')}<i>{count}</i></button>}
      {pick && <ItemSheet item={pick} onClose={() => setPick(null)} onAdd={l => { setCart(c => [...c, l]); setPick(null) }} />}
    </main></div>
  )
}
