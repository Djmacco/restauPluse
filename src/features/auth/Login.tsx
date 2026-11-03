import { useState } from 'react'
import { useLogin, useReset } from '../../api/hooks'
import { LangSwitch, useT } from '../../i18n'
import { Logo } from '../../ui/icons'

const DEMO = !import.meta.env.VITE_API_URL
const ACCOUNTS: [string, string, string][] = [['owner@demo.cm', 'owner123', 'Propriétaire'], ['admin@demo.cm', 'admin123', 'Administrateur'], ['manager@demo.cm', 'manager123', 'Gérant'], ['waiter@demo.cm', 'waiter123', 'Serveur'], ['cashier@demo.cm', 'cashier123', 'Caissier'], ['kitchen@demo.cm', 'kitchen123', 'Cuisine'], ['secretary@demo.cm', 'secretary123', 'Secrétaire']]

export function Login({ onCustomer, onBook, onHome, onSignup }: { onCustomer: () => void; onBook: () => void; onHome: () => void; onSignup: () => void }) {
  const tx = useT(), login = useLogin(), reset = useReset()
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [forgot, setForgot] = useState(false)
  return (
    <div className="lg">
      <div style={{ alignSelf: 'flex-end' }}><LangSwitch /></div>
      <div style={{ margin: '0 auto' }}><Logo /></div>
      <h1>{forgot ? tx('Réinitialiser le mot de passe') : tx('Connexion')}</h1>
      <form onSubmit={e => { e.preventDefault(); if (forgot) reset.mutate(email.trim()); else login.mutate({ email: email.trim(), password: pw }) }}>
        <label className="k-lab" htmlFor="em">{tx('Email')}</label>
        <div className="k-fld"><input id="em" type="text" inputMode="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></div>
        {!forgot && <><label className="k-lab" htmlFor="pw">{tx('Mot de passe')}</label>
          <div className="k-fld"><input id="pw" type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} /></div></>}
        {login.isError && !forgot && <p role="alert" className="bn" style={{ margin: '0 0 12px' }}>{tx(login.error.message)}</p>}
        {reset.isSuccess && forgot && <p role="status" className="bn" style={{ margin: '0 0 12px' }}>{tx('Si ce compte existe, un lien de réinitialisation vient d’être envoyé.')}</p>}
        <button className="btn p w" type="submit" disabled={!email.trim() || (!forgot && !pw) || login.isPending || reset.isPending}>
          {login.isPending ? tx('Connexion…') : forgot ? tx('Envoyer le lien') : tx('Se connecter')}</button>
      </form>
      <button className="lg-link" onClick={() => { setForgot(!forgot); reset.reset() }}>{forgot ? tx('Retour à la connexion') : tx('Mot de passe oublié ?')}</button>
      {DEMO && !forgot && <div className="lg-demo"><p className="sm mu" style={{ margin: 0 }}>{tx('Comptes de démonstration (sans valeur réelle)')}</p>
        <div>{ACCOUNTS.map(([e, p, r]) => <button key={e} className="btn s" onClick={() => { setEmail(e); setPw(p) }}>{tx(r)}</button>)}</div></div>}
      <button className="lg-link" onClick={onSignup}>{tx('Créer votre restaurant')}</button>
      <button className="lg-link" onClick={onHome}>{tx('Page publique du restaurant')}</button>
      <button className="lg-link" onClick={onBook}>{tx('Réserver une table')}</button>
      <button className="lg-link" onClick={onCustomer}>{tx('Application client (QR)')}</button>
    </div>
  )
}
