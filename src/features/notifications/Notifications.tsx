import { useEffect, useRef, useState } from 'react'
import { useNow, useRequests, useUpdateRequest } from '../../api/hooks'
import { useT } from '../../i18n'
import { Ic } from '../../ui/icons'
import type { ServiceKind } from '../../domain/types'

export const KIND_LABEL: Record<ServiceKind, string> = { waiter: 'Appel serveur', water: 'Demande d’eau', bill: 'Addition demandée' }

// Short sound for a new request. Browsers may block audio before the first tap, so failure is silent and the live region still announces it.
function beep() {
  try {
    const c = new AudioContext(), o = c.createOscillator(), g = c.createGain()
    o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = 0.08
    o.start(); o.stop(c.currentTime + 0.18); setTimeout(() => c.close(), 400)
  } catch { /* audio unavailable */ }
}

export function Notifications() {
  const tx = useT(), { data = [] } = useRequests(), upd = useUpdateRequest(), now = useNow(30_000)
  const [open, setOpen] = useState(false), [live, setLive] = useState('')
  const seen = useRef<Set<string> | null>(null)
  const pending = data.filter(r => r.state !== 'done').sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))

  useEffect(() => {
    if (seen.current) {
      const fresh = pending.filter(r => !seen.current!.has(r.id))
      if (fresh.length) { beep(); setLive(`${tx('Nouvelle demande :')} ${tx('Table')} ${fresh[0]!.tableId}, ${tx(KIND_LABEL[fresh[0]!.kind])}`) }
    }
    seen.current = new Set(pending.map(r => r.id))
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    addEventListener('keydown', f); return () => removeEventListener('keydown', f)
  }, [open])

  return (
    <div className="np-wrap">
      <button className="bell" aria-label={`${tx('Notifications')} (${pending.length})`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Ic n="bell" size={20} />{pending.length > 0 && <i>{pending.length}</i>}
      </button>
      <span className="sr" aria-live="polite">{live}</span>
      {open && <>
        <button className="np-back" aria-label={tx('Fermer')} onClick={() => setOpen(false)} />
        <div className="np" role="dialog" aria-label={tx('Notifications')}>
          <h2>{tx('Notifications')}</h2>
          {!pending.length && <p className="empty">{tx('Aucune demande en cours.')}</p>}
          {pending.map(r => (
            <div key={r.id} className="np-row">
              <div><b>{tx('Table')} {r.tableId}</b><span className="sm mu"> {Math.max(0, Math.round((now - +new Date(r.createdAt)) / 60000))} min</span><br />
                <span className={`tag ${r.state === 'open' ? 't-late' : 't-occ'}`}>{tx(KIND_LABEL[r.kind])}{r.state === 'acknowledged' ? ` : ${tx('Pris en charge')}` : ''}</span></div>
              <button className="btn s p" disabled={upd.isPending} onClick={() => upd.mutate({ id: r.id, state: r.state === 'open' ? 'acknowledged' : 'done' })}>{r.state === 'open' ? tx('Prendre en charge') : tx('Terminé')}</button>
            </div>
          ))}
          {upd.isError && <p role="alert" className="sm" style={{ color: 'var(--rd)' }}>{tx(upd.error.message)}</p>}
        </div></>}
    </div>
  )
}
