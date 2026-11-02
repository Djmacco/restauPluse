import { useT } from '../../i18n'
import { useState } from 'react'
import { KIND_LABEL } from '../notifications/Notifications'
import { useOrders, useRequests, useTables } from '../../api/hooks'
import { balanceXaf, formatXaf } from '../../domain/types'
import { OrderSheet } from '../orders/OrderSheet'

export function TableGrid() {
  const tx = useT()
  const { data, isPending, isError, refetch } = useTables()
  const [sel, setSel] = useState<string | null>(null)
  const reqs = useRequests().data ?? [], orders = useOrders().data ?? []
  if (sel) return <OrderSheet tableId={sel} onClose={() => setSel(null)} />
  if (isPending) return <p className="empty">{tx('Chargement du plan de salle…')}</p>
  if (isError) return <div className="empty">{tx('Plan de salle indisponible.')} <button className="btn s" onClick={() => refetch()}>{tx('Réessayer')}</button></div>
  return (
    <>
      <h1>{tx('Plan de salle')}</h1>
      <p className="mu" style={{ margin: '0 0 14px' }}>{tx('Touchez une table pour prendre une commande.')}</p>
      <div className="grid">
        {data.map(t => {
          const due = balanceXaf(t)
          return (
            <button key={t.id} className="tbl" onClick={() => setSel(t.id)}>
              <span className="n">{t.id}</span>
              {reqs.filter(r => r.tableId === t.id && r.state !== 'done').map(r => <span key={r.id} className="tag t-bill">{tx(KIND_LABEL[r.kind])}</span>)}
              {orders.some(o => o.tableId === t.id && o.status === 'ready') && <span className="tag t-ok">{tx('Prêt à servir')}</span>}
              <span className="sm mu">{t.session ? tx('Occupée') : `${t.seats} ${tx('places')}`}</span>
              {t.session && <span className="b" style={{ color: due > 0 ? 'var(--rd)' : 'var(--gr)' }}>{due > 0 ? `${tx('Reste')} ${formatXaf(due)}` : tx('Soldée')}</span>}
            </button>
          )
        })}
      </div>
    </>
  )
}
