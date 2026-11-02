import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useRotateCode, useSettings, useTableCodes } from '../../api/hooks'
import { useT } from '../../i18n'
import type { TableCode } from '../../domain/types'

// In production set VITE_CUSTOMER_URL to the public customer site. The code, never the table number, goes in the link.
const BASE = (import.meta.env.VITE_CUSTOMER_URL as string | undefined) ?? location.href.split(/[?#]/)[0]!

function Card({ c, name }: { c: TableCode; name: string }) {
  const tx = useT(), rot = useRotateCode(), [img, setImg] = useState(''), [ask, setAsk] = useState(false)
  const url = `${BASE}?t=${c.code}`
  useEffect(() => {
    let on = true
    QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: 'M' }).then(u => { if (on) setImg(u) }).catch(() => { if (on) setImg('') })
    return () => { on = false }
  }, [url])
  return (
    <article className="qr-card">
      <span className="sm">{name}</span>
      {img ? <img src={img} alt={`${tx('Table')} ${c.tableId}, ${tx('Code')} ${c.code}`} /> : <div style={{ width: 200, height: 200 }} />}
      <b className="n">{tx('Table')} {c.tableId}</b>
      <span className="sm">{tx('Scannez pour commander')}</span>
      <span className="qr-code">{c.code}</span>
      <div className="no-print qr-act">
        {!ask ? <>
          <a className="btn s" href={img} download={`table-${c.tableId}-qr.png`} aria-disabled={!img}>{tx('Télécharger')}</a>
          <button className="btn s" onClick={() => setAsk(true)}>{tx('Remplacer le code')}</button></> : <>
          <span className="sm">{tx('L’ancien QR cessera de fonctionner. Confirmer ?')}</span>
          <button className="btn s p" disabled={rot.isPending} onClick={() => rot.mutate(c.tableId, { onSuccess: () => setAsk(false) })}>{tx('Confirmer')}</button>
          <button className="btn s" onClick={() => setAsk(false)}>{tx('Annuler')}</button></>}
        {rot.isError && <p role="alert" className="bn" style={{ width: '100%' }}>{tx(rot.error.message)}</p>}
      </div>
    </article>
  )
}

export function QrCodes() {
  const tx = useT(), q = useTableCodes(), s = useSettings()
  if (q.isPending) return <p className="empty">{tx('Chargement…')}</p>
  if (q.isError) return <p role="alert" className="bn">{tx(q.error.message)}</p>
  return (
    <div className="st-card">
      <p className="sm mu no-print" style={{ margin: 0 }}>{tx('Chaque table a son propre code secret. Remplacez-le si une affiche est perdue ou copiée.')}</p>
      <div className="no-print"><button className="btn p" onClick={() => window.print()}>{tx('Imprimer tous les QR')}</button></div>
      <div className="qr-grid">{[...q.data].sort((a, b) => Number(a.tableId) - Number(b.tableId)).map(c => <Card key={c.tableId + c.code} c={c} name={s.data?.restaurant.name ?? ''} />)}</div>
    </div>
  )
}
