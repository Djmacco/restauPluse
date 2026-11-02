import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLogout, useOnline, useSession } from './api/hooks'
import { Admin } from './features/admin/Admin'
import { Login } from './features/auth/Login'
import { AuditLog } from './features/audit/AuditLog'
import { OrderList } from './features/orders/OrderList'
import { Reservations } from './features/reservations/Reservations'
import { Booking } from './features/booking/Booking'
import { Cashier } from './features/cashier/Cashier'
import { Customer } from './features/customer/Customer'
import { Kitchen } from './features/kitchen/Kitchen'
import { Notifications } from './features/notifications/Notifications'
import { Settings } from './features/settings/Settings'
import { TableGrid } from './features/tables/TableGrid'
import { canOpen, homeView } from './domain/types'
import { LangProvider, LangSwitch, useT } from './i18n'
import { Logo } from './ui/icons'

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } })
const PLAIN: Record<string, [string, () => React.JSX.Element]> = { tables: ['Serveur', TableGrid], kitchen: ['Cuisine', Kitchen], cashier: ['Caisse', Cashier], orderlist: ['Commandes', OrderList], reservations: ['Réservations', Reservations], audit: ['Journal d’audit', AuditLog] }
const LABEL: Record<string, string> = { admin: 'Accueil', settings: 'Paramètres', ...Object.fromEntries(Object.entries(PLAIN).map(([k, v]) => [k, v[0]])) }

function Shell() {
  const tx = useT(), online = useOnline(), session = useSession(), out = useLogout()
  // A QR link (?t=...) is the public customer app and needs no sign-in.
  const q = new URLSearchParams(location.search), qr = q.has('t'), bk = q.has('book') || q.has('r')
  const [pub, setPub] = useState<'' | 'order' | 'book'>(qr ? 'order' : bk ? 'book' : ''), [want, setWant] = useState<string | null>(null)
  if (pub) return <>{!(qr || bk) && <button className="btn s lg-back" onClick={() => setPub('')}>{tx('Retour à la connexion')}</button>}{pub === 'book' ? <Booking code={q.get('r')} /> : <Customer />}</>
  if (session.isPending) return <p className="empty">{tx('Chargement…')}</p>
  const me = session.data
  if (!me) return <Login onCustomer={() => setPub('order')} onBook={() => setPub('book')} />
  const allowed = ['admin', 'tables', 'orderlist', 'kitchen', 'cashier', 'reservations', 'audit', 'settings'].filter(k => canOpen(me, k))
  const v = want && allowed.includes(want) ? want : homeView(me)
  const shell = { allowed, go: setWant, onLogout: () => out.mutate() }
  if (v === 'none') return <div className="empty"><p>{tx('Aucun accès pour ce rôle. Demandez au propriétaire.')}</p><button className="btn s" onClick={() => out.mutate()}>{tx('Se déconnecter')}</button></div>
  if (v === 'admin') return <Admin shell={shell} />
  if (v === 'settings') return <Settings shell={shell} />
  const View = PLAIN[v]![1]
  return (
    <>
      <header>
        <div className="logo"><Logo size={26} />RestoPulse</div>
        <nav aria-label={tx('Espaces de travail')}>{allowed.map(k => <button key={k} aria-current={v === k} onClick={() => setWant(k)}>{tx(LABEL[k]!)}</button>)}</nav>
        {v !== 'customer' && <Notifications />}
        <LangSwitch />
        <span className="pill"><b>{me.name}</b> {tx(me.roleName)}</span>
        <button className="btn s" onClick={() => out.mutate()}>{tx('Se déconnecter')}</button>
        <span className={`pill ${online ? '' : 'off'}`}><span className="dot" />{online ? tx('En ligne') : tx('Hors ligne')}</span>
      </header>
      <main>
        {!online && <div className="bn" style={{ marginBottom: 12 }}>{tx('Hors ligne. Les actions ne sont pas envoyées tant que la connexion n’est pas rétablie.')}</div>}
        <View />
      </main>
    </>
  )
}

export default function App() {
  return <LangProvider><QueryClientProvider client={qc}><Shell /></QueryClientProvider></LangProvider>
}
