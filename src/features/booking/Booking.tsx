import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useAvailability, useBook, usePublicSettings, useReceipt } from '../../api/hooks'
import { LangSwitch, locale, useT } from '../../i18n'
import { Logo } from '../../ui/icons'
import type { ResStatus } from '../../domain/types'

const BASE = (import.meta.env.VITE_CUSTOMER_URL as string | undefined) ?? location.href.split(/[?#]/)[0]!
const TAG: Record<ResStatus, [string, string]> = { pending: ['En attente', 't-bill'], confirmed: ['Confirmée', 't-occ'], arrived: ['Arrivée', 't-ok'], cancelled: ['Annulée', 't-free'], noshow: ['Absent', 't-late'] }
const iso = (d: Date) => d.toISOString().slice(0, 10)
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const slots = (opens: string, closes: string) => { const o: string[] = []; for (let x = mins(opens); x <= mins(closes) - 60; x += 30) o.push(`${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`); return o }

function ReceiptView({ code, onBack }: { code: string; onBack: () => void }) {
  const tx = useT(), q = useReceipt(code), cfg = usePublicSettings().data, [qr, setQr] = useState('')
  useEffect(() => { QRCode.toDataURL(`${BASE}?r=${code}`, { margin: 1, width: 360, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr('')) }, [code])
  if (q.isPending) return <p className="empty">{tx('Chargement…')}</p>
  if (q.isError) return <div className="empty"><p role="alert">{tx(q.error.message)}</p><button className="btn s" onClick={onBack}>{tx('Retour')}</button></div>
  const r = q.data, [label, cls] = TAG[r.status], c = { justifyContent: 'center' } as const
  const day = new Date(`${r.date}T00:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <>
      <div className="rc rv-print" style={{ width: 300, margin: '0 auto' }}>
        <div style={c}><b>{cfg?.restaurant.name}</b></div><div style={c}>{cfg?.restaurant.address}</div><div style={c}>{cfg?.restaurant.phone}</div><hr />
        <div style={c}><b>{tx('Reçu de réservation')}</b></div>
        <div style={c}>{qr && <img src={qr} alt={r.code} style={{ width: 150, height: 150 }} />}</div>
        <div style={c}><b style={{ fontSize: 18, letterSpacing: '.12em' }}>{r.code}</b></div><hr />
        <div><span>{tx('Nom')}</span><span>{r.name}</span></div>
        <div><span>{tx('Date')}</span><span>{day}</span></div>
        <div><span>{tx('Heure')}</span><span>{r.time}</span></div>
        <div><span>{tx('Nombre de personnes')}</span><span>{r.party}</span></div>
        <div><span>{tx('Table')}</span><span>{r.tableId}</span></div>
        {r.note && <div><span>{tx('Note (facultatif)')}</span><span>{r.note}</span></div>}<hr />
        <div style={c}><b>{tx(label)}</b></div><div style={c}>{tx('Présentez ce reçu à votre arrivée.')}</div>
      </div>
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
        <div style={{ textAlign: 'center' }}><span className={`tag ${cls}`}>{tx(label)}</span></div>
        <p className="sm mu" style={{ textAlign: 'center', margin: 0 }}>{tx('Cette réservation n’est confirmée que lorsque le restaurant la valide. Le statut se met à jour ici.')}</p>
        <button className="btn p w" onClick={() => window.print()}>{tx('Imprimer ou enregistrer en PDF')}</button>
        <button className="btn w" onClick={onBack}>{tx('Nouvelle réservation')}</button>
      </div>
    </>
  )
}

export function Booking({ code: initial }: { code: string | null }) {
  const tx = useT(), cfg = usePublicSettings().data, book = useBook()
  const [code, setCode] = useState<string | null>(initial ? initial.toUpperCase() : null), [have, setHave] = useState(''), [step, setStep] = useState<1 | 2 | 3>(1)
  const [d, setD] = useState({ date: iso(new Date()), time: '', party: 2, tableId: '', name: '', phone: '', note: '' })
  const times = slots(cfg?.restaurant.opens ?? '11:00', cfg?.restaurant.closes ?? '22:00')
  const av = useAvailability(d.date, d.time, d.party, step === 2 && !!d.time)
  const max = iso(new Date(Date.now() + 60 * 86400000))
  if (code) return <div className="k-app"><div className="bk"><ReceiptView code={code} onBack={() => { setCode(null); setStep(1); setD({ ...d, tableId: '' }) }} /></div></div>
  return (
    <div className="k-app"><div className="bk">
      <div style={{ textAlign: 'right' }}><LangSwitch /></div>
      <div style={{ display: 'grid', placeItems: 'center' }}><Logo /></div>
      <h1 style={{ textAlign: 'center' }}>{tx('Réserver une table')}</h1>
      {step === 1 && <>
        <label className="k-lab" htmlFor="bd">{tx('Date')}</label>
        <div className="k-fld"><input id="bd" type="date" min={iso(new Date())} max={max} value={d.date} onChange={e => setD({ ...d, date: e.target.value, tableId: '' })} /></div>
        <label className="k-lab" htmlFor="bt">{tx('Heure')}</label>
        <div className="k-fld"><select id="bt" value={d.time} onChange={e => setD({ ...d, time: e.target.value, tableId: '' })} style={{ background: 'none', padding: 0 }}><option value="">--:--</option>{times.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        <span className="k-lab" id="bp">{tx('Nombre de personnes')}</span>
        <div className="k-fld" aria-labelledby="bp"><span>{d.party}</span>
          <div className="k-ctl"><button className="k-minus" aria-label={tx('Moins une personne')} onClick={() => setD({ ...d, party: Math.max(1, d.party - 1), tableId: '' })}>−</button><button className="k-plus" aria-label={tx('Plus une personne')} onClick={() => setD({ ...d, party: Math.min(20, d.party + 1), tableId: '' })}>+</button></div></div>
        <button className="btn p w" disabled={!d.time || !d.date} onClick={() => setStep(2)}>{tx('Voir les tables libres')}</button>
        <div style={{ marginTop: 26 }}><span className="k-lab">{tx('J’ai déjà un reçu')}</span>
          <div className="row"><div className="k-fld" style={{ flex: 1, marginBottom: 0 }}><input type="text" aria-label={tx('Code du reçu')} placeholder="RV-XXXXXX" value={have} onChange={e => setHave(e.target.value.toUpperCase())} /></div>
            <button className="btn" disabled={have.trim().length < 6} onClick={() => setCode(have.trim())}>{tx('Voir mon reçu')}</button></div></div>
      </>}
      {step === 2 && <>
        <h2 style={{ marginBottom: 10 }}>{tx('Tables libres')}</h2>
        {av.isPending && <p className="empty">{tx('Chargement…')}</p>}
        {av.isError && <p role="alert" className="bn">{tx(av.error.message)}</p>}
        {av.data && !av.data.length && <p className="empty">{tx('Aucune table libre à cette heure. Essayez un autre horaire.')}</p>}
        <div className="bl">{av.data?.map(t => <button key={t.tableId} className="bi" aria-pressed={d.tableId === t.tableId} onClick={() => setD({ ...d, tableId: t.tableId })}><b>{tx('Table')} {t.tableId}</b><span className="sm mu">{t.seats} {tx('places')}</span></button>)}</div>
        <div className="row" style={{ marginTop: 18 }}><button className="btn" onClick={() => setStep(1)}>{tx('Retour')}</button><button className="btn p" style={{ flex: 1 }} disabled={!d.tableId} onClick={() => setStep(3)}>{tx('Continuer')}</button></div>
      </>}
      {step === 3 && <>
        <h2 style={{ marginBottom: 10 }}>{tx('Vos coordonnées')}</h2>
        <label className="k-lab" htmlFor="bn">{tx('Nom')}</label><div className="k-fld"><input id="bn" type="text" autoComplete="name" value={d.name} onChange={e => setD({ ...d, name: e.target.value })} /></div>
        <label className="k-lab" htmlFor="bph">{tx('Téléphone')}</label><div className="k-fld"><input id="bph" type="text" inputMode="tel" autoComplete="tel" value={d.phone} onChange={e => setD({ ...d, phone: e.target.value })} /></div>
        <label className="k-lab" htmlFor="bno">{tx('Note (facultatif)')}</label><div className="k-fld"><input id="bno" type="text" value={d.note} onChange={e => setD({ ...d, note: e.target.value })} /></div>
        <p className="sm mu" style={{ margin: '0 0 14px' }}>{tx('Aucun paiement n’est demandé pour le moment.')}</p>
        {book.isError && <p role="alert" className="bn" style={{ marginBottom: 12 }}>{tx(book.error.message)}</p>}
        <div className="row"><button className="btn" onClick={() => setStep(2)}>{tx('Retour')}</button>
          <button className="btn p" style={{ flex: 1 }} disabled={book.isPending || d.name.trim().length < 2 || d.phone.replace(/\D/g, '').length < 8}
            onClick={() => book.mutate({ name: d.name, phone: d.phone, date: d.date, time: d.time, party: d.party, tableId: d.tableId, note: d.note || undefined }, { onSuccess: r => setCode(r.code) })}>{book.isPending ? tx('Envoi…') : tx('Envoyer la demande')}</button></div>
      </>}
    </div></div>
  )
}
