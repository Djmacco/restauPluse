import { useState } from 'react'
import { useSignup } from '../../api/hooks'
import { LangSwitch, useT } from '../../i18n'
import { Logo } from '../../ui/icons'

// A new restaurant creates itself and its owner account in one step. The owner is signed in straight away.
export function Signup({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const tx = useT(), signup = useSignup()
  const [d, setD] = useState({ restaurantName: '', name: '', email: '', password: '' })
  const valid = d.restaurantName.trim() && d.name.trim() && /^\S+@\S+\.\S+$/.test(d.email.trim()) && d.password.length >= 10
  const f = (k: keyof typeof d) => ({ value: d[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value }) })
  return (
    <div className="lg">
      <div style={{ alignSelf: 'flex-end' }}><LangSwitch /></div>
      <div style={{ margin: '0 auto' }}><Logo /></div>
      <h1>{tx('Créer votre restaurant')}</h1>
      <form onSubmit={e => { e.preventDefault(); if (valid) signup.mutate({ ...d, restaurantName: d.restaurantName.trim(), name: d.name.trim(), email: d.email.trim() }, { onSuccess: onCreated }) }}>
        <label className="k-lab" htmlFor="sr">{tx('Nom du restaurant')}</label><div className="k-fld"><input id="sr" type="text" autoComplete="organization" {...f('restaurantName')} /></div>
        <label className="k-lab" htmlFor="sn">{tx('Votre nom')}</label><div className="k-fld"><input id="sn" type="text" autoComplete="name" {...f('name')} /></div>
        <label className="k-lab" htmlFor="se">{tx('Email')}</label><div className="k-fld"><input id="se" type="text" inputMode="email" autoComplete="username" {...f('email')} /></div>
        <label className="k-lab" htmlFor="sp">{tx('Mot de passe')}</label><div className="k-fld" style={{ marginBottom: 6 }}><input id="sp" type="password" autoComplete="new-password" aria-describedby="sph" {...f('password')} /></div>
        <p id="sph" className="sm mu" style={{ margin: '0 0 14px' }}>{tx('10 caractères minimum.')}</p>
        {signup.isError && <p role="alert" className="bn" style={{ margin: '0 0 12px' }}>{tx(signup.error.message)}</p>}
        <button className="btn p w" type="submit" disabled={!valid || signup.isPending}>{signup.isPending ? tx('Création…') : tx('Créer mon restaurant')}</button>
      </form>
      <button className="lg-link" onClick={onBack}>{tx('Vous avez déjà un compte ?')} {tx('Se connecter')}</button>
    </div>
  )
}
