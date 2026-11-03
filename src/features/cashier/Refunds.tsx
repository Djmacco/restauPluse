import { useState } from 'react'
import { useCloseTable, useDiscount, usePayments, useRefund } from '../../api/hooks'
import { locale, useT } from '../../i18n'
import { METHOD_LABEL, formatXaf } from '../../domain/types'

export function DiscountForm({ tableId }: { tableId: string }) {
  const tx = useT(), d = useDiscount(), [open, setOpen] = useState(false), [amt, setAmt] = useState(''), [why, setWhy] = useState('')
  if (!open) return <button className="btn s" onClick={() => setOpen(true)}>{tx('Remise')}</button>
  return (
    <div className="st-row">
      <input type="number" inputMode="numeric" aria-label={tx('Montant')} placeholder={tx('Montant')} value={amt} onChange={e => setAmt(e.target.value)} />
      <input type="text" aria-label={tx('Motif')} placeholder={tx('Motif')} value={why} onChange={e => setWhy(e.target.value)} />
      <button className="btn s p" disabled={d.isPending || !amt} onClick={() => d.mutate({ tableId, amount: Number(amt), reason: why }, { onSuccess: () => { setOpen(false); setAmt(''); setWhy('') } })}>{tx('Appliquer')}</button>
      <button className="btn s" onClick={() => setOpen(false)}>{tx('Annuler')}</button>
      {d.isError && <p role="alert" className="bn" style={{ gridColumn: '1 / -1', margin: 0 }}>{tx(d.error.message)}</p>}
    </div>
  )
}

export function RefundsPanel() {
  const tx = useT(), q = usePayments(), refund = useRefund(), [sel, setSel] = useState<string | null>(null), [amt, setAmt] = useState(''), [why, setWhy] = useState('')
  return (
    <section className="card" style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2>{tx('Remboursements')}</h2>
      {q.data?.map(p => (
        <div key={p.id} className="st-row">
          <span><b>{tx('Table')} {p.tableId}</b> <span className="sm mu">{new Date(p.at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}, {tx(METHOD_LABEL[p.method])}</span></span>
          <span>{formatXaf(p.amountXaf)}{p.refundedXaf > 0 && <span className="sm mu"> ({tx('Remboursé')} {formatXaf(p.refundedXaf)})</span>}</span>
          {sel === p.id ? <>
            <input type="number" inputMode="numeric" aria-label={tx('Montant')} value={amt} onChange={e => setAmt(e.target.value)} />
            <input type="text" aria-label={tx('Motif')} placeholder={tx('Motif')} value={why} onChange={e => setWhy(e.target.value)} />
            <button className="btn s p" disabled={refund.isPending || !amt} onClick={() => refund.mutate({ id: p.id, amount: Number(amt), reason: why }, { onSuccess: () => { setSel(null); setWhy('') } })}>{tx('Confirmer')}</button>
            <button className="btn s" onClick={() => setSel(null)}>{tx('Annuler')}</button></>
            : <button className="btn s" disabled={p.refundedXaf >= p.amountXaf} onClick={() => { setSel(p.id); setAmt(String(p.amountXaf - p.refundedXaf)); refund.reset() }}>{tx('Rembourser')}</button>}
        </div>))}
      {refund.isError && <p role="alert" className="bn">{tx(refund.error.message)}</p>}
    </section>
  )
}

export function CloseTableForm({ tableId, remaining }: { tableId: string; remaining: number }) {
  const tx = useT(), c = useCloseTable(), [open, setOpen] = useState(false), [why, setWhy] = useState('')
  if (!open) return <button className="btn s" onClick={() => setOpen(true)}>{tx('Clôturer avec impayé')}</button>
  return (
    <div className="st-row">
      <p className="sm" style={{ gridColumn: '1 / -1', margin: 0 }}>{tx('Le solde de')} <b>{formatXaf(remaining)}</b> {tx('sera enregistré comme impayé.')}</p>
      <input type="text" aria-label={tx('Motif')} placeholder={tx('Motif')} value={why} onChange={e => setWhy(e.target.value)} />
      <button className="btn s p" disabled={c.isPending || !why.trim()} onClick={() => c.mutate({ tableId, reason: why }, { onSuccess: () => { setOpen(false); setWhy('') } })}>{tx('Confirmer')}</button>
      <button className="btn s" onClick={() => setOpen(false)}>{tx('Annuler')}</button>
      {c.isError && <p role="alert" className="bn" style={{ gridColumn: '1 / -1', margin: 0 }}>{tx(c.error.message)}</p>}
    </div>
  )
}
