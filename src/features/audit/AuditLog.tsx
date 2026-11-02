import { useState } from 'react'
import { useAudit } from '../../api/hooks'
import { locale, useT } from '../../i18n'

export function AuditLog() {
  const tx = useT(), q = useAudit(), [s, setS] = useState('')
  if (q.isPending) return <p className="empty">{tx('Chargement…')}</p>
  if (q.isError) return <p role="alert" className="bn">{tx(q.error.message)}</p>
  const rows = q.data.filter(e => `${e.actor} ${tx(e.action)} ${e.detail}`.toLowerCase().includes(s.toLowerCase()))
  return (
    <>
      <h1>{tx('Journal d’audit')}</h1>
      <input type="search" value={s} onChange={e => setS(e.target.value)} placeholder={tx('Rechercher')} aria-label={tx('Rechercher')} style={{ margin: '8px 0 14px', maxWidth: 360 }} />
      <div className="card"><div className="ad-scroll"><table className="ad-tbl"><thead><tr>{['Date et heure', 'Acteur', 'Action', 'Détail'].map(h => <th key={h} scope="col">{tx(h)}</th>)}</tr></thead>
        <tbody>{rows.map(e => <tr key={e.id}><td>{new Date(e.at).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' })}</td><td>{e.actor}</td><td>{tx(e.action)}</td><td>{e.detail}</td></tr>)}</tbody></table>
        {!rows.length && <p className="empty">{tx('Aucune entrée.')}</p>}</div></div>
    </>
  )
}
