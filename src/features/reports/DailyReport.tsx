import { useState } from 'react'
import { useDailyReport } from '../../api/hooks'
import { useT } from '../../i18n'
import { METHOD_LABEL, formatXaf, type DailyReport as R } from '../../domain/types'

const today = () => new Date().toISOString().slice(0, 10)

export function DailyReport() {
  const tx = useT(), [date, setDate] = useState(today()), q = useDailyReport(date)
  if (q.isPending) return <p className="empty">{tx('Chargement…')}</p>
  if (q.isError) return <p role="alert" className="bn">{tx(q.error.message)}</p>
  const r: R = q.data, collected = r.collected.reduce((a, c) => a + c.amountXaf, 0), net = collected - r.refundedXaf
  const csv = () => {
    const rows: (string | number)[][] = [[tx('Rapport du jour'), r.date], [tx('Commandes passées'), r.ordersPlaced], [tx('Facturé'), r.billedXaf],
      ...r.collected.map(c => [tx(METHOD_LABEL[c.method]), c.amountXaf]), [tx('Remboursements'), r.refundedXaf], [tx('Encaissé net'), net], [tx('Remises'), r.discountsXaf], [],
      [tx('Annulations')], ...r.cancelled.map(c => [c.number, c.waiter, c.reason, c.by]), [], [tx('Impayés')], ...r.unpaid.map(u => [u.tableId, u.amountXaf, u.reason, u.by]), [],
      [tx('Sessions de caisse')], ...r.shifts.map(s => [s.cashier, s.openingXaf, s.expectedXaf, s.countedXaf, s.diffXaf, s.note ?? ''])]
    const text = '\ufeff' + rows.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a')
    a.href = url; a.download = `rapport-${r.date}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  const stat = (l: string, v: string, c?: string) => <div className="card"><span className="sm mu">{tx(l)}</span><br /><b style={{ fontSize: 22, color: c }}>{v}</b></div>
  return (
    <>
      <div className="row sp no-print" style={{ flexWrap: 'wrap' }}><h1>{tx('Rapport du jour')}</h1>
        <div className="row"><input type="date" aria-label={tx('Date')} value={date} max={today()} onChange={e => setDate(e.target.value)} style={{ maxWidth: 180 }} />
          <button className="btn s" onClick={csv}>{tx('Télécharger (CSV)')}</button><button className="btn s p" onClick={() => window.print()}>{tx('Imprimer')}</button></div></div>
      <h1 style={{ display: 'none' }} className="print-title">{tx('Rapport du jour')} {r.date}</h1>
      <div className="st-grid" style={{ margin: '12px 0' }}>
        {stat('Commandes passées', String(r.ordersPlaced))}{stat('Facturé', formatXaf(r.billedXaf))}{stat('Encaissé net', formatXaf(net), 'var(--gr)')}
        {stat('Remises', formatXaf(r.discountsXaf))}{stat('Remboursements', formatXaf(r.refundedXaf))}</div>
      <div className="st-card" style={{ marginBottom: 14 }}><h2>{tx('Encaissé par moyen')}</h2>
        {r.collected.map(c => <div key={c.method} className="row sp"><span>{tx(METHOD_LABEL[c.method])}</span><b>{formatXaf(c.amountXaf)}</b></div>)}</div>
      <div className="st-card" style={{ marginBottom: 14 }}><h2>{tx('Annulations')} ({r.cancelled.length})</h2>
        {!r.cancelled.length && <p className="sm mu" style={{ margin: 0 }}>{tx('Aucune annulation.')}</p>}
        {r.cancelled.map(c => <div key={c.number} className="sm">N° {c.number} ({c.waiter}) : {c.reason}, {tx('par')} {c.by}</div>)}</div>
      <div className="st-card" style={{ marginBottom: 14 }}><h2>{tx('Impayés')} ({r.unpaid.length})</h2>
        {!r.unpaid.length && <p className="sm mu" style={{ margin: 0 }}>{tx('Aucun impayé.')}</p>}
        {r.unpaid.map((u, i) => <div key={i} className="sm">{tx('Table')} {u.tableId} : <b>{formatXaf(u.amountXaf)}</b>, {u.reason} ({tx('par')} {u.by})</div>)}</div>
      <div className="st-card"><h2>{tx('Sessions de caisse')}</h2>
        {!r.shifts.length && <p className="sm mu" style={{ margin: 0 }}>{tx('Aucune session fermée.')}</p>}
        {r.shifts.map((s, i) => <div key={i} className="sm">{s.cashier} : {tx('Fond')} {formatXaf(s.openingXaf)}, {tx('Attendu')} {formatXaf(s.expectedXaf)}, {tx('Compté')} {formatXaf(s.countedXaf)}, {tx('Écart')} <b className={s.diffXaf ? 'diff-bad' : 'diff-ok'}>{formatXaf(s.diffXaf)}</b>{s.note ? `, ${s.note}` : ''}</div>)}</div>
    </>
  )
}
