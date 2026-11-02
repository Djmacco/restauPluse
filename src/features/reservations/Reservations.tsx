import { useState } from 'react'
import { useFindReservation, useReservations, useSaveReservation, useSetReservation, useTables } from '../../api/hooks'
import { useT } from '../../i18n'
import type { Reservation, ResStatus } from '../../domain/types'

const TAG: Record<ResStatus, [string, string]> = { pending: ['En attente', 't-bill'], confirmed: ['Confirmée', 't-occ'], arrived: ['Arrivée', 't-ok'], cancelled: ['Annulée', 't-free'], noshow: ['Absent', 't-late'] }
const today = () => new Date().toISOString().slice(0, 10)

function Row({ r, tables }: { r: Reservation; tables: string[] }) {
  const tx = useT(), set = useSetReservation(), save = useSaveReservation(), err = set.error ?? save.error
  const act = (status: ResStatus, label: string, p = false) => <button className={`btn s ${p ? 'p' : ''}`} disabled={set.isPending} onClick={() => set.mutate({ id: r.id, status })}>{tx(label)}</button>
  return (
    <div className="st-row">
      <span><b>{r.time}</b> {r.name}<br /><span className="sm mu">{r.party} {tx('personnes')}{r.phone ? `, ${r.phone}` : ''}{r.code ? `, ${r.code}` : ''}</span></span>
      <select aria-label={tx('Table')} value={r.tableId ?? ''} disabled={['cancelled', 'noshow', 'arrived'].includes(r.status)} onChange={e => save.mutate({ id: r.id, name: r.name, phone: r.phone, date: r.date, time: r.time, party: r.party, tableId: e.target.value || undefined })}>
        <option value="">{tx('Sans table')}</option>{tables.map(t => <option key={t} value={t}>{tx('Table')} {t}</option>)}</select>
      <span className={`tag ${TAG[r.status][1]}`}>{tx(TAG[r.status][0])}</span>
      <span className="row" style={{ flexWrap: 'wrap' }}>
        {r.status === 'pending' && act('confirmed', 'Confirmer', true)}
        {r.status === 'confirmed' && act('arrived', 'Marquer arrivée', true)}
        {r.status === 'confirmed' && act('noshow', 'Marquer absent')}
        {['pending', 'confirmed'].includes(r.status) && act('cancelled', 'Annuler')}</span>
      {err && <p role="alert" className="bn" style={{ gridColumn: '1 / -1', margin: 0 }}>{tx(err.message)}</p>}
    </div>
  )
}

export function Reservations() {
  const tx = useT(), [date, setDate] = useState(today()), q = useReservations(date), tables = useTables(), save = useSaveReservation()
  const [d, setD] = useState({ name: '', phone: '', time: '19:00', party: '2', tableId: '' })
  const ids = (tables.data ?? []).map(t => t.id)
  const [code, setCode] = useState(''), found = useFindReservation(code)
  return (
    <>
      <h1>{tx('Réservations')}</h1>
      <div className="st-card" style={{ margin: '8px 0 14px' }}>
        <label className="st-f"><span>{tx('Vérifier un code')}</span><input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="RV-XXXXXX" /></label>
        {found.isFetched && !found.data && code.trim().length >= 6 && <p className="sm mu" style={{ margin: 0 }}>{tx('Reçu introuvable.')}</p>}
        {found.data && <><p className="sm mu" style={{ margin: 0 }}>{found.data.date}</p><Row r={found.data} tables={ids} /></>}
      </div>
      <div className="st-card" style={{ marginBottom: 14 }}>
        <div className="st-grid">
          <label className="st-f"><span>{tx('Nom')}</span><input type="text" value={d.name} onChange={e => setD({ ...d, name: e.target.value })} /></label>
          <label className="st-f"><span>{tx('Téléphone')}</span><input type="text" inputMode="tel" value={d.phone} onChange={e => setD({ ...d, phone: e.target.value })} /></label>
          <label className="st-f"><span>{tx('Date')}</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label className="st-f"><span>{tx('Heure')}</span><input type="time" value={d.time} onChange={e => setD({ ...d, time: e.target.value })} /></label>
          <label className="st-f"><span>{tx('Personnes')}</span><input type="number" min={1} value={d.party} onChange={e => setD({ ...d, party: e.target.value })} /></label>
          <label className="st-f"><span>{tx('Table')}</span><select value={d.tableId} onChange={e => setD({ ...d, tableId: e.target.value })}><option value="">{tx('Sans table')}</option>{ids.map(t => <option key={t} value={t}>{tx('Table')} {t}</option>)}</select></label></div>
        {save.isError && <p role="alert" className="bn">{tx(save.error.message)}</p>}
        <div><button className="btn p" disabled={save.isPending || !d.name.trim()} onClick={() => save.mutate({ name: d.name, phone: d.phone, date, time: d.time, party: Number(d.party), tableId: d.tableId || undefined }, { onSuccess: () => setD({ ...d, name: '', phone: '' }) })}>{tx('Réserver')}</button></div>
      </div>
      <div className="st-card">
        {q.isPending && <p className="empty">{tx('Chargement…')}</p>}
        {q.data?.map(r => <Row key={r.id + r.status + r.tableId} r={r} tables={ids} />)}
        {q.data && !q.data.length && <p className="empty">{tx('Aucune réservation ce jour.')}</p>}
      </div>
    </>
  )
}
