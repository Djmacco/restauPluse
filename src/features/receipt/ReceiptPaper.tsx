import { locale, useT } from '../../i18n'
import { METHOD_LABEL, type Receipt, type Settings } from '../../domain/types'

// One component for the real receipt and the designer preview, so what the owner sees is what gets printed.
export function ReceiptPaper({ s, r }: { s: Settings; r: Receipt }) {
  const tx = useT(), c = { justifyContent: 'center' } as const
  const n = (v: number) => v.toLocaleString(locale()).replace(/[\u202f\u00a0]/g, ' ')
  const { restaurant: o, receipt: p } = s
  return (
    <div className="rc" style={{ width: p.paper === 58 ? 220 : 300 }}>
      {p.logoUrl && <img src={p.logoUrl} alt="" style={{ display: 'block', maxWidth: '55%', maxHeight: 60, margin: '0 auto 6px' }} />}
      <div style={c}><b>{o.name}</b></div><div style={c}>{o.address}</div><div style={c}>{o.phone}</div>
      {p.taxId && <div style={c}>{tx('N° contribuable')} {p.taxId}</div>}<hr />
      <div><span>{tx('Reçu N°')} {p.prefix}{String(r.number).padStart(5, '0')}</span><span>{new Date(r.at).toLocaleDateString(locale())}</span></div>
      {p.showTable && <div><span>{tx('Table')} {r.tableId}</span><span>{new Date(r.at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</span></div>}
      {p.showWaiter && r.waiterName && <div><span>{tx('Serveur')}</span><span>{r.waiterName}</span></div>}<hr />
      {r.lines.map(l => <div key={l.id}><span>{l.qty} {tx(l.name)}</span><span>{n(l.qty * l.unitXaf)}</span></div>)}<hr />
      {!!r.discountXaf && <div><span>{tx('Remise')}</span><span>-{n(r.discountXaf)}</span></div>}
      <div><b>{tx('Total')}</b><b>{n(r.totalXaf)}</b></div>
      <div><span>{tx('Payé')} ({tx(METHOD_LABEL[r.method])})</span><span>{n(r.amountXaf)}</span></div>
      <div><b>{tx('Reste')}</b><b>{n(r.remainingXaf)}</b></div><hr />
      <div style={c}>{r.remainingXaf ? tx('Paiement partiel, solde dû') : p.footer}</div>
    </div>
  )
}
