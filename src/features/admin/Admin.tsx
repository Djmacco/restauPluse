import { useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useOverview } from '../../api/hooks'
import { LangSwitch, locale, useT } from '../../i18n'
import { METHOD_LABEL, type Overview, type OrderStatus, type PayMethod } from '../../domain/types'
import { Notifications } from '../notifications/Notifications'
import { Ic, Logo } from '../../ui/icons'

const num = (n: number) => Math.round(n).toLocaleString(locale()).replace(/[\u202f\u00a0]/g, ' ')
const Money = ({ v }: { v: number }) => <>{num(v)}<small> FCFA</small></>
const NAV: [string, string, string][] = [['admin', 'Accueil', 'home'], ['tables', 'Serveur', 'grid'], ['kitchen', 'Cuisine', 'flame'], ['cashier', 'Caisse', 'wallet'], ['orderlist', 'Commandes', 'list'], ['report', 'Rapport du jour', 'chart'], ['reservations', 'Réservations', 'cal'], ['audit', 'Journal d’audit', 'log'], ['settings', 'Paramètres', 'cog']]
const LABEL = { collected: 'Encaissé aujourd’hui', orders: 'Commandes du jour', tables: 'Tables ouvertes', outstanding: 'Reste à encaisser' } as const
const ALERT = { cancel: 'Annulations élevées', discount: 'Remises nombreuses', unpaid: 'Tables clôturées avec impayé', cash: 'Écart de caisse' } as const
const STATUS: Record<OrderStatus, [string, string]> = { submitted: ['Reçue', 'blue'], accepted: ['Reçue', 'blue'], preparing: ['En cours', 'yel'], ready: ['En cours', 'yel'], served: ['Servie', 'grn'], cancelled: ['Annulée', 'red'] }
const FILL: Record<PayMethod, string> = { cash: 'var(--p1)', mtn_momo: 'var(--p2)', orange_money: 'var(--p3)' }

// Pointer-driven 3D tilt. Mouse only, and disabled by CSS under prefers-reduced-motion.
const tilt = {
  onPointerMove: (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 9}deg`)
    e.currentTarget.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 9}deg`)
  },
  onPointerLeave: (e: PointerEvent<HTMLElement>) => { e.currentTarget.style.setProperty('--ry', '0deg'); e.currentTarget.style.setProperty('--rx', '0deg') },
}
const st = (o: Record<string, number | string>) => o as CSSProperties
const smooth = (p: [number, number][]) => p.reduce((d, [x, y], i) => { if (!i) return `M${x},${y}`; const [px, py] = p[i - 1]!; const c = (px + x) / 2; return `${d} C${c},${py} ${c},${y} ${x},${y}` }, '')

function Stat({ k, i }: { k: Overview['kpis'][number]; i: number }) {
  const tx = useT(), max = Math.max(...k.series, 1), up = k.deltaPct >= 0
  return (
    <article className="ad-card ad-stat tilt rise" style={st({ '--i': i })} {...tilt}>
      <div><b className="ad-big">{k.id === 'collected' || k.id === 'outstanding' ? <Money v={k.value} /> : k.value}</b><span className="ad-lab">{tx(LABEL[k.id])}</span></div>
      <div className="ad-spark">
        <span className={`ad-chip ${up ? 'up' : 'dn'}`}>{up ? '↑' : '↓'} {Math.abs(k.deltaPct).toFixed(1)}%</span>
        <div aria-hidden="true">{k.series.map((v, j) => <i key={j} className={j === 4 ? 'hl' : ''} style={st({ height: `${20 + (v / max) * 80}%`, '--j': j })} />)}</div>
        <small>{tx('depuis le mois dernier')}</small>
      </div>
    </article>
  )
}

function Revenue({ d }: { d: Overview }) {
  const tx = useT(), [tab, setTab] = useState<'billedXaf' | 'collectedXaf'>('collectedXaf'), [hi, setHi] = useState(d.monthly.length - 3)
  const vs = d.monthly.map(m => m[tab]), lo = Math.min(...vs) * 0.8, hiV = Math.max(...vs), W = 480, H = 150
  const pts = vs.map((v, i) => [(i / (vs.length - 1)) * W, H - 14 - ((v - lo) / (hiV - lo || 1)) * (H - 50)] as [number, number])
  const line = smooth(pts), avg = vs.reduce((a, b) => a + b, 0) / vs.length, prev = vs[vs.length - 2] ?? 1, delta = ((vs[vs.length - 1]! - prev) / prev) * 100
  const sum = (k: 'billedXaf' | 'collectedXaf') => d.monthly.reduce((a, m) => a + m[k], 0)
  const mon = (m: string) => new Date(m + '-01').toLocaleDateString(locale(), { month: 'short' })
  return (
    <section className="ad-card tilt rise" style={st({ '--i': 4 })} {...tilt}>
      <div className="row sp"><h2>{tx('Revenus mensuels')}</h2>
        <div className="ad-seg" role="group" aria-label={tx('Revenus mensuels')}>
          <button aria-pressed={tab === 'billedXaf'} onClick={() => setTab('billedXaf')}>{tx('Facturé')}</button>
          <button aria-pressed={tab === 'collectedXaf'} onClick={() => setTab('collectedXaf')}>{tx('Encaissé')}</button></div></div>
      <div className="ad-chart">
        <div><span className="ad-lab">{tx(tab === 'billedXaf' ? 'Moyenne mensuelle facturée' : 'Moyenne mensuelle encaissée')}</span><b className="ad-big"><Money v={avg} /></b>
          <span className="ad-chip wht">{delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(2)}% <small>{tx('vs mois précédent')}</small></span></div>
        <div className="ad-plot" onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); setHi(Math.max(0, Math.min(vs.length - 1, Math.round(((e.clientX - r.left) / r.width) * (vs.length - 1))))) }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={tx('Revenus mensuels')}>
            <path d={`${line} L${W},${H} L0,${H} Z`} fill="var(--area)" /><path d={line} fill="none" stroke="var(--area-line)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <line x1={pts[hi]![0]} x2={pts[hi]![0]} y1={pts[hi]![1]} y2={H} stroke="var(--tx)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          </svg>
          <i className="ad-dot" style={{ left: `${(pts[hi]![0] / W) * 100}%`, top: `${(pts[hi]![1] / H) * 100}%` }} />
          <div className="ad-tip" style={{ left: `${Math.min(78, Math.max(2, (pts[hi]![0] / W) * 100 - 14))}%` }}><small>{tx(tab === 'billedXaf' ? 'Total facturé' : 'Total encaissé')}</small><b><Money v={vs[hi]!} /></b></div>
          <div className="ad-mon">{d.monthly.map(m => <span key={m.month}>{mon(m.month)}</span>)}</div>
        </div>
      </div>
      <div className="ad-tot">{([['Total facturé', sum('billedXaf')], ['Total encaissé', sum('collectedXaf')], ['Reste à encaisser', sum('billedXaf') - sum('collectedXaf')]] as [string, number][]).map(([l, v]) =>
        <div key={l}><span className="ad-ic"><Ic n="wallet" size={20} /></span><div><b><Money v={v} /></b><span className="ad-lab">{tx(l)}</span></div></div>)}</div>
    </section>
  )
}

function Recent({ d, q }: { d: Overview; q: string }) {
  const tx = useT(), rows = d.recent.filter(r => `${r.number} ${r.dishes} ${r.tableId}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <section className="ad-card tilt rise" style={st({ '--i': 5 })} {...tilt}>
      <div className="row sp"><h2>{tx('Commandes récentes')}</h2><span className="ad-day">{tx('Aujourd’hui')}</span></div>
      <div className="ad-scroll"><table className="ad-tbl"><thead><tr>{['N°', 'Plats', 'Table', 'Statut', 'Heure', 'Total'].map(h => <th key={h} scope="col">{tx(h)}</th>)}</tr></thead>
        <tbody>{rows.map(r => <tr key={r.id}><td>{r.number}</td><td>{r.dishes.split(', ').map(tx).join(', ')}</td><td>{r.tableId}</td><td><span className={`ad-st ${STATUS[r.status][1]}`}>{tx(STATUS[r.status][0])}</span></td>
          <td>{new Date(r.at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</td><td><Money v={r.totalXaf} /></td></tr>)}</tbody></table>
        {!rows.length && <p className="empty">{tx('Aucune commande à afficher.')}</p>}</div>
    </section>
  )
}

function Donut({ d }: { d: Overview }) {
  const tx = useT(), [on, setOn] = useState(0), total = d.paymentMix.reduce((a, p) => a + p.amountXaf, 0), R = 70, C = 2 * Math.PI * R
  let off = 0
  return (
    <section className="ad-card tilt rise" style={st({ '--i': 6 })} {...tilt}>
      <h2>{tx('Paiements par moyen')}</h2>
      {!total ? <p className="empty">{tx('Aucun paiement encaissé.')}</p> : <>
        <div className="ad-donut">
          <svg viewBox="0 0 200 200" role="img" aria-label={tx('Paiements par moyen')}>
            {d.paymentMix.map((p, i) => { const len = (p.amountXaf / total) * C, el = <circle key={p.method} cx="100" cy="100" r={R} fill="none" stroke={FILL[p.method]} strokeWidth={on === i ? 34 : 28} strokeDasharray={`${Math.max(len - 3, 0)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 100 100)" strokeLinecap="round" onPointerEnter={() => setOn(i)} style={{ animation: 'dash 1s cubic-bezier(.2,.8,.2,1) backwards' }} />; off += len; return el })}
          </svg>
          <div className="ad-tip static"><b>{Math.round((d.paymentMix[on]!.amountXaf / total) * 100)}% {tx(METHOD_LABEL[d.paymentMix[on]!.method])}</b></div>
        </div>
        <ul className="ad-legend">{d.paymentMix.map((p, i) => <li key={p.method}><button onClick={() => setOn(i)} aria-pressed={on === i}><i style={{ background: FILL[p.method] }} />{tx(METHOD_LABEL[p.method])}</button></li>)}</ul></>}
    </section>
  )
}

function Trending({ d }: { d: Overview }) {
  const tx = useT()
  const go = (dir: number) => document.getElementById('ad-track')?.scrollBy({ left: dir * 220, behavior: 'smooth' })
  return (
    <section className="ad-card rise" style={st({ '--i': 7 })}>
      <div className="row sp"><h2>{tx('Plats les plus commandés')}</h2><div className="row" style={{ gap: 4 }}><button className="ad-arw" onClick={() => go(-1)} aria-label={tx('Précédent')}>←</button><button className="ad-arw" onClick={() => go(1)} aria-label={tx('Suivant')}>→</button></div></div>
      <div className="ad-track" id="ad-track" tabIndex={0}>{d.topDishes.map(t => (
        <article key={t.id} className="ad-dish tilt" {...tilt}>
          <div className="ad-img">{t.imageUrl && <img src={t.imageUrl} alt={tx(t.name)} />}</div>
          <span className="ad-dn">{tx(t.name)}</span><div className="row sp"><b><Money v={t.priceXaf} /></b><span className="ad-lab">{tx('Commandes')} <b>{t.orders}</b></span></div>
        </article>))}</div>
    </section>
  )
}

function Team({ d }: { d: Overview }) {
  const tx = useT()
  return (
    <section className="ad-card tilt rise" style={st({ '--i': 8 })} {...tilt}>
      <h2>{tx('Activité de l’équipe')}</h2>
      {d.team.map((m, i) => <div key={m.name} className="ad-row"><span className={`ad-av a${i % 3}`}>{m.name.slice(0, 2).toUpperCase()}</span><div><b>{m.name}</b><span className="ad-lab">{tx(m.role)}</span></div><div className="r"><b className="ad-big sm">{m.orders}</b><span className="ad-lab">{tx('commandes')}, {m.cancelled} {tx('annulées')}</span>{m.orders >= 4 && m.cancelled / m.orders >= 0.25 && <span className="ad-chip" style={{ background: 'var(--cr)' }}>{tx('À vérifier')}</span>}</div></div>)}
      {!d.team.length && <p className="empty">{tx('Aucune commande à afficher.')}</p>}
    </section>
  )
}

export type Shell = { allowed: string[]; go: (k: string) => void; onLogout: () => void }
export function AdminShell({ current, shell, children }: { current: string; shell: Shell; children: ReactNode }) {
  const tx = useT()
  return (
    <div className="ad">
      <aside className="ad-side">
        <div className="ad-brand"><Logo size={30} /><span>RestoPulse</span></div>
        <div role="navigation" aria-label={tx('Navigation principale')} className="ad-nav">{NAV.filter(([k]) => shell.allowed.includes(k)).map(([k, l, ic]) => <button key={k} aria-current={k === current} onClick={() => shell.go(k)}><Ic n={ic} size={20} /><span>{tx(l)}</span></button>)}</div>
        <div className="ad-lang"><LangSwitch /><button className="ad-out" onClick={shell.onLogout}><Ic n="out" size={18} /><span>{tx('Se déconnecter')}</span></button></div>
      </aside>
      <section className="ad-main">{children}</section>
    </div>
  )
}

export function Admin({ shell }: { shell: Shell }) {
  const tx = useT(), { data, isPending, isError, refetch } = useOverview(), [q, setQ] = useState('')
  return (
    <AdminShell current="admin" shell={shell}>
      <div className="ad-top"><div><h1>{tx('Vue d’ensemble')}</h1><p className="mu" style={{ margin: 0 }}>{tx('Bonjour, bienvenue !')}</p></div>
        <label className="ad-search"><Ic n="search" size={20} /><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={tx('Chercher une commande…')} aria-label={tx('Chercher une commande…')} /></label><Notifications /></div>
      {isPending && <p className="empty">{tx('Chargement du tableau de bord…')}</p>}
      {isError && <div className="empty">{tx('Tableau de bord indisponible.')} <button className="btn s" onClick={() => refetch()}>{tx('Réessayer')}</button></div>}
      {data && <>
        {data.sample && <p className="bn" style={{ margin: '0 0 14px' }}>{tx('Données d’exemple : les courbes, variations et paiements viennent d’une démo locale.')}</p>}
        {data.alerts?.map(a => <p key={a.kind + a.detail} role="alert" className="bn" style={{ background: 'var(--rb)', color: 'var(--rd)', margin: '0 0 10px' }}><b>{tx(ALERT[a.kind])}</b> : {a.detail}</p>)}
        <div className="ad-stats">{data.kpis.map((k, i) => <Stat key={k.id} k={k} i={i} />)}</div>
        <div className="ad-r2"><Revenue d={data} /><Recent d={data} q={q} /></div>
        <div className="ad-r3"><Donut d={data} /><Trending d={data} /><Team d={data} /></div></>}
    </AdminShell>
  )
}
