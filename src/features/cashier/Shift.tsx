import { useState } from 'react'
import { useCashMove, useCloseShift, useOpenShift, useShift } from '../../api/hooks'
import { locale, useT } from '../../i18n'
import { formatXaf, type Shift } from '../../domain/types'

export function ShiftBar() {
  const tx = useT(), q = useShift(), open = useOpenShift(), move = useCashMove(), close = useCloseShift()
  const [mode, setMode] = useState<'' | 'in' | 'out' | 'close'>(''), [amt, setAmt] = useState(''), [why, setWhy] = useState(''), [done, setDone] = useState<Shift | null>(null)
  if (q.isPending) return null
  const s = q.data, err = open.error ?? move.error ?? close.error
  const reset = () => { setMode(''); setAmt(''); setWhy('') }
  return (
    <section className="card" style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!s ? <>
        <h2>{tx('Caisse fermée')}</h2>
        {done && <div className="st-row" role="status">
          <span><span className="sm mu">{tx('Attendu')}</span><br /><b>{formatXaf(done.expectedXaf ?? 0)}</b></span>
          <span><span className="sm mu">{tx('Compté')}</span><br /><b>{formatXaf(done.countedXaf ?? 0)}</b></span>
          <span><span className="sm mu">{tx('Écart')}</span><br /><b className={done.diffXaf ? 'diff-bad' : 'diff-ok'}>{(done.diffXaf ?? 0) > 0 ? '+' : ''}{formatXaf(done.diffXaf ?? 0)}</b></span>
          {done.note && <span className="sm mu">{done.note}</span>}</div>}
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="st-f" style={{ maxWidth: 240 }}><span>{tx('Fond de caisse (FCFA)')}</span><input type="number" inputMode="numeric" value={amt} onChange={e => setAmt(e.target.value)} /></label>
          <button className="btn p" disabled={open.isPending || amt === ''} onClick={() => open.mutate(Number(amt), { onSuccess: () => { setAmt(''); setDone(null) } })}>{tx('Ouvrir la caisse')}</button></div>
      </> : <>
        <div className="row sp" style={{ flexWrap: 'wrap' }}><h2>{tx('Caisse ouverte')}</h2><span className="sm mu">{new Date(s.openedAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}, {tx('Fond')} {formatXaf(s.openingXaf)}</span></div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn s" aria-pressed={mode === 'in'} onClick={() => setMode('in')}>{tx('Entrée d’argent')}</button>
          <button className="btn s" aria-pressed={mode === 'out'} onClick={() => setMode('out')}>{tx('Sortie d’argent')}</button>
          <button className="btn s p" onClick={() => setMode('close')}>{tx('Fermer la caisse')}</button></div>
        {mode && <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="st-f" style={{ maxWidth: 200 }}><span>{mode === 'close' ? tx('Montant compté (FCFA)') : tx('Montant')}</span><input type="number" inputMode="numeric" value={amt} onChange={e => setAmt(e.target.value)} /></label>
          <label className="st-f" style={{ flex: 1, minWidth: 200 }}><span>{mode === 'close' ? tx('Note sur l’écart') : tx('Motif')}</span><input type="text" value={why} onChange={e => setWhy(e.target.value)} /></label>
          <button className="btn p" disabled={amt === '' || move.isPending || close.isPending}
            onClick={() => mode === 'close' ? close.mutate({ counted: Number(amt), note: why }, { onSuccess: r => { setDone(r); reset() } }) : move.mutate({ kind: mode, amount: Number(amt), reason: why }, { onSuccess: reset })}>{tx('Confirmer')}</button>
          <button className="btn" onClick={reset}>{tx('Annuler')}</button></div>}
      </>}
      {err && <p role="alert" className="bn">{tx(err.message)}</p>}
    </section>
  )
}
