import { useState } from 'react'
import { useCancelOrder, useOrders, useSession } from '../../api/hooks'
import { locale, useT } from '../../i18n'
import { can, formatXaf, orderTotalXaf, type OrderStatus } from '../../domain/types'

const SN: Record<OrderStatus, string> = { submitted: 'Reçue', accepted: 'Acceptée en cuisine', preparing: 'En préparation', ready: 'Prête', served: 'Servie', cancelled: 'Annulée' }
const TAG: Record<OrderStatus, string> = { submitted: 't-new', accepted: 't-occ', preparing: 't-bill', ready: 't-ok', served: 't-free', cancelled: 't-late' }

export function OrderList() {
  const tx = useT(), q = useOrders(), me = useSession().data, cancel = useCancelOrder()
  const [f, setF] = useState<OrderStatus | 'all'>('all'), [sel, setSel] = useState<string | null>(null), [why, setWhy] = useState('')
  if (q.isPending) return <p className="empty">{tx('Chargement des commandes…')}</p>
  if (q.isError) return <div className="empty">{tx('Impossible de charger les commandes.')} <button className="btn s" onClick={() => q.refetch()}>{tx('Réessayer')}</button></div>
  const rows = q.data.filter(o => f === 'all' || o.status === f).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  return (
    <>
      <h1>{tx('Commandes')}</h1>
      <div className="st-tabs" role="group" aria-label={tx('Statut')}>{(['all', ...Object.keys(SN)] as (OrderStatus | 'all')[]).map(k => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{k === 'all' ? tx('Toutes') : tx(SN[k])}</button>)}</div>
      <div className="card"><div className="ad-scroll"><table className="ad-tbl"><thead><tr>{['N°', 'Table', 'Plats', 'Statut', 'Heure', 'Total'].map(h => <th key={h} scope="col">{tx(h)}</th>)}<th /></tr></thead>
        <tbody>{rows.map(o => (
          <tr key={o.id}><td>{o.number}</td><td>{o.tableId}</td>
            <td>{o.lines.map(l => `${l.qty} ${tx(l.name)}`).join(', ')}<br /><span className="sm mu">{tx('Serveur')} : {o.waiterName}</span>{o.cancelReason && <><br /><span className="sm" style={{ color: 'var(--rd)' }}>{tx('Motif')} : {o.cancelReason}, {tx('par')} {o.cancelledBy}</span></>}</td>
            <td><span className={`tag ${TAG[o.status]}`}>{tx(SN[o.status])}</span></td>
            <td>{new Date(o.createdAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</td><td>{formatXaf(orderTotalXaf(o))}</td>
            <td>{can(me, 'cancel') && (['submitted', 'accepted'].includes(o.status) || (o.status === 'preparing' && can(me, 'refunds'))) && (sel === o.id ? (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <input type="text" aria-label={tx('Motif de l’annulation')} placeholder={tx('Motif de l’annulation')} value={why} onChange={e => setWhy(e.target.value)} style={{ minWidth: 180 }} />
                <button className="btn s p" disabled={cancel.isPending || !why.trim()} onClick={() => cancel.mutate({ id: o.id, version: o.version, reason: why }, { onSuccess: () => { setSel(null); setWhy('') } })}>{tx('Confirmer')}</button>
                <button className="btn s" onClick={() => setSel(null)}>{tx('Annuler')}</button></div>
            ) : <button className="btn s" onClick={() => { setSel(o.id); cancel.reset() }}>{tx('Annuler la commande')}</button>)}</td></tr>))}</tbody></table>
        {!rows.length && <p className="empty">{tx('Aucune commande.')}</p>}</div>
        {cancel.isError && <p role="alert" className="bn" style={{ marginTop: 10 }}>{tx(cancel.error.message)}</p>}</div>
    </>
  )
}
