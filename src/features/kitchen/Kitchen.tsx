import { useT } from '../../i18n'
import { useNow, useOrders, useTransition } from '../../api/hooks'
import type { Order, OrderStatus } from '../../domain/types'

const ACTION: Partial<Record<OrderStatus, { label: string; to: OrderStatus }>> = {
  submitted: { label: 'Accepter', to: 'accepted' },
  accepted: { label: 'Commencer la préparation', to: 'preparing' },
  preparing: { label: 'Marquer prêt', to: 'ready' },
  ready: { label: 'Servir', to: 'served' },
}
const COLS: { title: string; cls: string; from: OrderStatus[] }[] = [
  { title: 'Nouvelles commandes', cls: '', from: ['submitted', 'accepted'] },
  { title: 'En préparation', cls: 'pr', from: ['preparing'] },
  { title: 'Prêtes à servir', cls: 'rd', from: ['ready'] },
]
const LATE_MS = 15 * 60_000
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function Ticket({ o, now }: { o: Order; now: number }) {
  const tx = useT()
  const tr = useTransition()
  const age = now - new Date(o.createdAt).getTime()
  const late = o.status !== 'ready' && age > LATE_MS
  const act = ACTION[o.status]
  return (
    <article className={`tk ${late ? 'late' : ''}`}>
      <div className="row sp">
        <span>
          <b style={{ fontSize: 18 }}>{tx('N°')} {o.number}</b> <span className="b">{tx('Table')} {o.tableId}</span>
          <br /><span className="sm mu">{tx('Serveur :')} {o.waiterName}</span>
        </span>
        <span className="tm">{mmss(age)}{late ? ' ' + tx('en retard') : ''}</span>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 12px' }}>
        {o.lines.filter(l => l.prep !== 'ready').map(l => (
          <li key={l.id} className="li" style={{ display: 'block' }}>
            <b>{l.qty}×</b> {tx(l.name)}<br />
            {l.modifiers.map(m => <span key={m} className="mod">{tx(m)}</span>)}
            {l.note && <span className="sm mu">{l.note}</span>}
          </li>
        ))}
      </ul>
      {o.lines.some(l => l.prep === 'ready') && <p className="sm mu" style={{ margin: '0 0 10px' }}>{tx('Déjà prêts, à joindre :')} {o.lines.filter(l => l.prep === 'ready').map(l => `${l.qty} ${tx(l.name)}`).join(', ')}</p>}
      {tr.isError && <p role="alert" className="sm" style={{ color: 'var(--rd)' }}>{tx(tr.error.message)}</p>}
      {act && (
        <button
          className={`btn w ${o.status === 'ready' ? 'g' : 'p'}`}
          style={{ minHeight: 52, fontSize: 17 }}
          disabled={tr.isPending}
          onClick={() => tr.mutate({ id: o.id, to: act.to, version: o.version })}
        >
          {tr.isPending ? tx('Envoi…') : tx(act.label)}
        </button>
      )}
    </article>
  )
}

export function Kitchen() {
  const tx = useT()
  const { data, isPending, isError, refetch } = useOrders()
  const now = useNow()
  if (isPending) return <p className="empty">{tx('Chargement des commandes…')}</p>
  if (isError) return <div className="empty">{tx('Impossible de charger les commandes.')} <button className="btn s" onClick={() => refetch()}>{tx('Réessayer')}</button></div>
  const cancelled = data.filter(o => o.status === 'cancelled' && o.cancelledAt && now - +new Date(o.cancelledAt) < 15 * 60_000 && o.lines.some(l => l.prep !== 'ready'))
  return (
    <>
      <h1>{tx('Cuisine')}</h1>
      {cancelled.map(o => <div key={o.id} role="alert" className="bn" style={{ background: 'var(--rb)', color: 'var(--rd)', marginBottom: 10 }}><b>{tx('Commande annulée')} : {tx('Table')} {o.tableId}, N° {o.number}</b> {o.cancelReason}<br /><span className="sm">{o.lines.filter(l => l.prep !== 'ready').map(l => `${l.qty} ${tx(l.name)}`).join(', ')}</span></div>)}
      <div className="kds">
        {COLS.map(c => {
          const os = data
            .filter(o => c.from.includes(o.status) && o.lines.some(l => l.prep !== 'ready'))
            .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
          return (
            <section key={c.title} aria-label={tx(c.title)}>
              <div className={`kh ${c.cls}`}><h2>{tx(c.title)}</h2><b>{os.length}</b></div>
              {os.map(o => <Ticket key={o.id} o={o} now={now} />)}
              {!os.length && <div className="empty">{tx('Aucune commande ici.')}</div>}
            </section>
          )
        })}
      </div>
    </>
  )
}
