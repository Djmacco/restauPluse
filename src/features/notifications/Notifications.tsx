import { useEffect, useRef, useState } from 'react'
import { useNow, useOrders, usePendingReservations, useRequests, useSession, useTransition, useUpdateRequest } from '../../api/hooks'
import { useT } from '../../i18n'
import { Ic } from '../../ui/icons'
import { can, type ServiceKind } from '../../domain/types'

export const KIND_LABEL: Record<ServiceKind, string> = { waiter: 'Appel serveur', water: 'Demande d’eau', bill: 'Addition demandée' }

// Short sound for something new. Browsers may block audio before the first tap, so the live region also announces it.
function beep() {
  try {
    const c = new AudioContext(), o = c.createOscillator(), g = c.createGain()
    o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = 0.08
    o.start(); o.stop(c.currentTime + 0.18); setTimeout(() => c.close(), 400)
  } catch { /* audio unavailable */ }
}
interface Row { id: string; tableId?: string; at: string; tag: string; cls: string; detail?: string; act?: { label: string; run: () => void } }

export function Notifications() {
  const tx = useT(), me = useSession().data, now = useNow(30_000), upd = useUpdateRequest(), serve = useTransition()
  const canO = can(me, 'orders'), canR = can(me, 'reservations')
  const rq = useRequests(), oq = useOrders(canO), pq = usePendingReservations(canR)
  const [open, setOpen] = useState(false), [live, setLive] = useState('')
  const rows: Row[] = [
    ...(rq.data ?? []).filter(r => r.state !== 'done').map(r => ({ id: 'q' + r.id, tableId: r.tableId, at: r.createdAt, tag: KIND_LABEL[r.kind], cls: r.state === 'open' ? 't-late' : 't-occ',
      act: { label: r.state === 'open' ? 'Prendre en charge' : 'Terminé', run: () => upd.mutate({ id: r.id, state: r.state === 'open' ? 'acknowledged' : 'done' }) } })),
    ...(canO ? (oq.data ?? []).filter(o => o.status === 'ready').map(o => ({ id: 'o' + o.id, tableId: o.tableId, at: o.createdAt, tag: 'Commande prête', cls: 't-ok',
      detail: o.lines.map(l => `${l.qty} ${tx(l.name)}`).join(', '), act: { label: 'Marquer servi', run: () => serve.mutate({ id: o.id, to: 'served' as const, version: o.version }) } })) : []),
    ...(canR ? (pq.data ?? []).map(r => ({ id: 'r' + r.id, tableId: r.tableId, at: r.createdAt ?? `${r.date}T${r.time}`, tag: 'Nouvelle réservation', cls: 't-bill', detail: `${r.name}, ${r.date} ${r.time}, ${r.party}` })) : []),
  ].sort((a, b) => +new Date(a.at) - +new Date(b.at))
  const loaded = rq.isSuccess && (!canO || oq.isSuccess) && (!canR || pq.isSuccess), key = rows.map(r => r.id).join('|')
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!loaded) return
    if (seen.current) { // the first load only records what already exists, so opening the app never beeps
      const fresh = rows.filter(r => !seen.current!.has(r.id))
      if (fresh.length) { beep(); setLive(`${tx(fresh[0]!.tag)}${fresh[0]!.tableId ? `: ${tx('Table')} ${fresh[0]!.tableId}` : ''}`) }
    }
    seen.current = new Set(rows.map(r => r.id))
  }, [key, loaded]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    addEventListener('keydown', f); return () => removeEventListener('keydown', f)
  }, [open])
  const err = upd.error ?? serve.error
  return (
    <div className="np-wrap">
      <button className="bell" aria-label={`${tx('Notifications')} (${rows.length})`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Ic n="bell" size={20} />{rows.length > 0 && <i>{rows.length}</i>}
      </button>
      <span className="sr" aria-live="polite">{live}</span>
      {open && <>
        <button className="np-back" aria-label={tx('Fermer')} onClick={() => setOpen(false)} />
        <div className="np" role="dialog" aria-label={tx('Notifications')}>
          <h2>{tx('Notifications')}</h2>
          {!rows.length && <p className="empty">{tx('Aucune demande en cours.')}</p>}
          {rows.map(r => (
            <div key={r.id} className="np-row">
              <div>{r.tableId && <b>{tx('Table')} {r.tableId} </b>}<span className="sm mu">{Math.max(0, Math.round((now - +new Date(r.at)) / 60000))} min</span><br />
                <span className={`tag ${r.cls}`}>{tx(r.tag)}</span>{r.detail && <><br /><span className="sm mu">{r.detail}</span></>}</div>
              {r.act && <button className="btn s p" disabled={upd.isPending || serve.isPending} onClick={r.act.run}>{tx(r.act.label)}</button>}
            </div>
          ))}
          {err && <p role="alert" className="sm" style={{ color: 'var(--rd)' }}>{tx(err.message)}</p>}
        </div></>}
    </div>
  )
}
