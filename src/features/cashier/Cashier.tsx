import { useT, locale } from '../../i18n'
import { useState } from 'react'
import { ReceiptPaper } from '../receipt/ReceiptPaper'
import { DiscountForm, RefundsPanel } from './Refunds'
import { ShiftBar } from './Shift'
import { useSession, useSettings, useBill, useOnline, useRecordPayment, useTables } from '../../api/hooks'
import { can, balanceXaf, formatXaf, METHOD_LABEL, type Bill, type PayMethod, type Receipt } from '../../domain/types'

const NOTES = [5000, 10000, 20000]
const time = (iso: string) => new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })

function PaymentSheet({ bill, onClose, onDone }: { bill: Bill; onClose: () => void; onDone: (r: Receipt) => void }) {
  const tx = useT()
  const pay = useRecordPayment(), online = useOnline(), { data: cfg } = useSettings()
  const [method, setMethod] = useState<PayMethod>('cash')
  const [amount, setAmount] = useState(String(bill.remainingXaf))
  const [given, setGiven] = useState(0), [ref, setRef] = useState(''), [verified, setVerified] = useState(false)
  const amt = Number(amount)
  const over = amt > bill.remainingXaf
  const proofOk = method === 'cash' || verified
  const valid = Number.isInteger(amt) && amt > 0 && !over && proofOk && online
  const change = method === 'cash' && given > amt ? given - amt : 0
  return (
    <div className="ov">
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`${tx('Paiement table')} ${bill.tableId}`}>
        <div className="row sp"><h2>{tx('Paiement, table')} {bill.tableId}</h2><button className="btn s" onClick={onClose}>{tx('Fermer')}</button></div>
        <div className="rem">{formatXaf(bill.remainingXaf)}<span className="sm" style={{ display: 'block', fontWeight: 500 }}>{tx('à régler au total')}</span></div>
        <div className="row" role="group" aria-label={tx('Moyen de paiement')}>
          {(Object.keys(METHOD_LABEL) as PayMethod[]).filter(m => cfg?.payments[m].enabled !== false).map(m => (
            <button key={m} className="btn s" style={{ flex: 1, ...(m === method ? { border: '2px solid var(--or)' } : {}) }} aria-pressed={m === method}
              onClick={() => { setMethod(m); setRef(''); setVerified(false) }}>{tx(METHOD_LABEL[m])}</button>
          ))}
        </div>
        {method !== 'cash' && cfg?.payments[method].number && <p className="sm mu" style={{ margin: 0 }}>{tx('Numéro du restaurant :')} {cfg.payments[method].number}</p>}
        {method !== 'cash' && cfg?.payments[method].qrUrl && <div style={{ textAlign: 'center' }}><img src={cfg.payments[method].qrUrl} alt={`${tx('Code QR de paiement')} ${tx(METHOD_LABEL[method])}`} style={{ width: 150, background: '#fff', borderRadius: 10, padding: 6 }} /><p className="sm mu" style={{ margin: '4px 0 0' }}>{tx('Montrer ce code au client')}</p></div>}
        <label className="b" htmlFor="amt">{tx('Montant encaissé (FCFA)')}</label>
        <input id="amt" type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} />
        {over && <div className="sm" role="alert" style={{ color: 'var(--rd)' }}>{tx('Le montant dépasse le solde restant.')}</div>}
        {method === 'cash' ? (
          <>
            <div className="b sm">{tx('Billet remis par le client')}</div>
            <div className="row">{NOTES.map(v => <button key={v} className="btn s" style={{ flex: 1, ...(given === v ? { border: '2px solid var(--or)' } : {}) }} aria-pressed={given === v} onClick={() => setGiven(v)}>{v.toLocaleString(locale())}</button>)}</div>
            {change > 0 && <div className="card b">{tx('Monnaie à rendre :')} {formatXaf(change)}</div>}
          </>
        ) : (
          <>
            <label className="opt"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} />{tx('J’ai vérifié ce paiement sur le téléphone du restaurant')}</label>
          </>
        )}
        {pay.isError && <p role="alert" className="bn">{tx(pay.error.message)}</p>}
        {!online && <p role="alert" className="bn">{tx('Hors ligne. Aucun paiement n’est enregistré.')}</p>}
        <button className="btn p w" disabled={!valid || pay.isPending}
          onClick={() => pay.mutate({ tableId: bill.tableId, input: { method, amountXaf: amt, verified } }, { onSuccess: onDone })}>
          {pay.isPending ? tx('Enregistrement…') : `${tx('Confirmer')} ${formatXaf(valid ? amt : 0)}`}
        </button>
      </div>
    </div>
  )
}

function ReceiptSheet({ r, onClose }: { r: Receipt; onClose: () => void }) {
  const tx = useT()
  const { data: cfg } = useSettings()
  const n = (v: number) => v.toLocaleString(locale())
  return (
    <div className="ov"><div className="sheet" role="dialog" aria-modal="true" aria-label={tx('Reçu')}>
      <h2>{tx('Reçu de paiement')}</h2>
      {cfg && <ReceiptPaper s={cfg} r={r} />}
      <div className="row"><button className="btn w" onClick={() => window.print()}>{tx('Imprimer')}</button><button className="btn p w" onClick={onClose}>{tx('Fermer')}</button></div>
    </div></div>
  )
}

export function Cashier() {
  const tx = useT()
  const me = useSession().data
  const tables = useTables()
  const [chosen, setChosen] = useState<string | null>(null), [paying, setPaying] = useState(false), [receipt, setReceipt] = useState<Receipt | null>(null)
  const open = (tables.data ?? []).filter(t => t.session && balanceXaf(t) > 0)
  const sel = open.find(t => t.id === chosen)?.id ?? open[0]?.id ?? null
  const bill = useBill(sel)
  if (tables.isPending) return <p className="empty">{tx('Chargement des additions…')}</p>
  if (tables.isError) return <div className="empty">{tx('Additions indisponibles.')} <button className="btn s" onClick={() => tables.refetch()}>{tx('Réessayer')}</button></div>
  const b = bill.data
  return (
    <>
      <ShiftBar />
      <div className="two">
        <div>
          <h1>{tx('Caisse')}</h1><p className="mu" style={{ margin: '0 0 12px' }}>{tx('Additions ouvertes')}</p>
          <div className="bl">
            {open.map(t => <button key={t.id} className="bi" aria-pressed={t.id === sel} onClick={() => setChosen(t.id)}><b>{tx('Table')} {t.id}</b><span className="b">{formatXaf(balanceXaf(t))}</span></button>)}
            {!open.length && <div className="empty card">{tx('Aucune addition ouverte. Une table apparaît ici dès qu’elle a une commande à payer.')}</div>}
          </div>
        </div>
        <div>
          {b && b.tableId === sel ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2>{tx('Table')} {b.tableId}</h2>
              <div>{b.lines.map(l => <div key={l.id} className="row sp sm" style={{ padding: '4px 0' }}><span>{l.qty} × {tx(l.name)}{l.modifiers.length ? <span className="mu"> ({l.modifiers.map(tx).join(', ')})</span> : null}</span><span>{formatXaf(l.qty * l.unitXaf)}</span></div>)}</div>
              {!!b.discountXaf && <div className="row sp sm"><span>{tx('Remise')}</span><b>-{formatXaf(b.discountXaf)}</b></div>}
              <div className="row sp"><span>{tx('Total')}</span><b>{formatXaf(b.totalXaf)}</b></div>
              <div className="row sp"><span>{tx('Déjà payé')}</span><b>{formatXaf(b.paidXaf)}</b></div>
              {b.payments.map(p => <div key={p.id} className="sm mu">{time(p.at)} : {formatXaf(p.amountXaf)} {tx('par')} {tx(METHOD_LABEL[p.method])}{p.reference ? ` (${tx('réf.')} ${p.reference})` : ''}</div>)}
              <div className={`rem ${b.remainingXaf ? '' : 'z'}`}><span className="sm" style={{ display: 'block', fontWeight: 500 }}>{tx('Reste à payer')}</span>{formatXaf(b.remainingXaf)}</div>
              <button className="btn p w" disabled={!b.remainingXaf} onClick={() => setPaying(true)}>{tx('Encaisser un paiement')}</button>
              {can(me, 'refunds') && b.remainingXaf > 0 && <DiscountForm tableId={b.tableId} />}
            </div>
          ) : sel ? <p className="empty">{tx('Chargement de l’addition…')}</p> : <div className="empty card">{tx('Sélectionnez une addition.')}</div>}
        </div>
      </div>
      {paying && b && <PaymentSheet bill={b} onClose={() => setPaying(false)} onDone={r => { setPaying(false); setReceipt(r) }} />}
      {receipt && <ReceiptSheet r={receipt} onClose={() => setReceipt(null)} />}
      {can(me, 'refunds') && <RefundsPanel />}
    </>
  )
}
