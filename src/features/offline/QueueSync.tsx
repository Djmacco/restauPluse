import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/hooks'
import { ApiError } from '../../api/client'
import { drop, markFailed, queued } from '../../api/queue'
import { useT } from '../../i18n'

// Sends orders saved on this phone while offline. Each one keeps its original idempotency key, so a repeat can never create a second order.
export function QueueSync() {
  const tx = useT(), qc = useQueryClient(), [items, setItems] = useState(queued), busy = useRef(false)
  useEffect(() => { const f = () => setItems(queued()); addEventListener('rp-queue', f); return () => removeEventListener('rp-queue', f) }, [])
  const flush = useCallback(async () => {
    if (busy.current || !navigator.onLine) return
    busy.current = true
    for (const q of queued().filter(x => !x.error)) {
      try { await api.submitOrder(q.input, q.key); drop(q.key); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['tables'] }) }
      catch (e) { if (e instanceof ApiError && e.status === 0) break; markFailed(q.key, (e as Error).message) } // a refused order is kept visible, never lost silently
    }
    busy.current = false
  }, [qc])
  useEffect(() => { flush(); const t = setInterval(flush, 15_000); addEventListener('online', flush); return () => { clearInterval(t); removeEventListener('online', flush) } }, [flush])
  const waiting = items.filter(i => !i.error), failed = items.filter(i => i.error)
  if (!items.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
      {waiting.length > 0 && <div role="status" className="bn row sp" style={{ flexWrap: 'wrap' }}><span>{waiting.length} {tx('commande(s) en attente d’envoi sur ce téléphone.')}</span>
        <button className="btn s" disabled={!navigator.onLine} onClick={flush}>{tx('Envoyer maintenant')}</button></div>}
      {failed.map(f => <div key={f.key} role="alert" className="bn row sp" style={{ flexWrap: 'wrap', background: 'var(--rb)', color: 'var(--rd)' }}>
        <span>{tx('Non envoyée :')} {tx('Table')} {f.input.tableId}, {tx(f.error!)}</span><button className="btn s" onClick={() => drop(f.key)}>{tx('Supprimer')}</button></div>)}
    </div>
  )
}
