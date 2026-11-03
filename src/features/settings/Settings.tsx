import { useEffect, useState, type ReactNode } from 'react'
import { useDeleteRole, useRoles, useSaveRole, useSession, useMenu, useSaveMenuItem, useSaveSettings, useSaveStaff, useSettings, useStaff, useTableAdmin, useTables } from '../../api/hooks'
import { AdminShell, type Shell } from '../admin/Admin'
import { QrCodes } from './QrCodes'
import { ReceiptPaper } from '../receipt/ReceiptPaper'
import { useT } from '../../i18n'
import { PERMISSIONS, can, METHOD_LABEL, type MenuItem, type PayMethod, type Permission, type Receipt, type RoleDef, type Settings as Cfg, type Staff } from '../../domain/types'

const TABS = ['Restaurant', 'Menu', 'Tables', 'Codes QR', 'Équipe', 'Paiements', 'Reçu'] as const
const SAMPLE: Receipt = { number: 42, tableId: '4', lines: [{ id: 'a', name: 'Poulet braisé', qty: 1, unitXaf: 4500, modifiers: [] }, { id: 'b', name: 'Bière locale 33 cl', qty: 2, unitXaf: 1500, modifiers: [] }], totalXaf: 7500, amountXaf: 5000, method: 'cash', remainingXaf: 2500, at: new Date().toISOString(), waiterName: 'Marc' }
const readImage = (f: File) => new Promise<string>((ok, no) => {
  if (!f.type.startsWith('image/')) return no(new Error('Fichier image requis.'))
  if (f.size > 300_000) return no(new Error('Image trop lourde (300 Ko max).'))
  const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(new Error('Fichier image requis.')); r.readAsDataURL(f)
})
function Field({ label, children }: { label: string; children: ReactNode }) { const tx = useT(); return <label className="st-f"><span>{tx(label)}</span>{children}</label> }
function Err({ e }: { e: unknown }) { const tx = useT(); return e ? <p role="alert" className="bn">{tx((e as Error).message)}</p> : null }

const parseOpts = (t: string) => t.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [n, p] = l.split(':').map(x => x.trim()); return { name: n!, priceXaf: Number(p) || 0 } })
function MenuRow({ item, cats }: { item?: MenuItem; cats: string[] }) {
  const tx = useT(), save = useSaveMenuItem(), [more, setMore] = useState(false)
  const blank = { nameEn: '', description: '', descriptionEn: '', allergens: '', portion: '', options: '', oldPrice: '', promoEnds: '' }
  const [d, setD] = useState({ name: item?.name ?? '', price: String(item?.priceXaf ?? ''), category: item?.category ?? cats[0] ?? '', cooking: item?.cooking ?? false, prep: (item?.prep ?? 'made') as 'ready' | 'made', available: item?.available ?? true, imageUrl: item?.imageUrl,
    ...(item ? { nameEn: item.nameEn ?? '', description: item.description ?? '', descriptionEn: item.descriptionEn ?? '', allergens: (item.allergens ?? []).join(', '), portion: item.portion ?? '', options: (item.options ?? []).map(o => `${o.name} : ${o.priceXaf}`).join('\n'), oldPrice: item.oldPriceXaf ? String(item.oldPriceXaf) : '', promoEnds: item.promoEndsAt ? item.promoEndsAt.slice(0, 16) : '' } : blank) })
  const [err, setErr] = useState<unknown>(null)
  const go = (over: Partial<typeof d> = {}) => {
    const x = { ...d, ...over }; setD(x); setErr(null)
    // The body is the full editable state: a field left empty here is cleared on the server.
    save.mutate({ ...(item ? { id: item.id } : {}), name: x.name, priceXaf: Number(x.price), category: x.category, cooking: x.cooking, prep: x.prep, available: x.available, imageUrl: x.imageUrl,
      nameEn: x.nameEn.trim() || undefined, description: x.description.trim() || undefined, descriptionEn: x.descriptionEn.trim() || undefined, portion: x.portion.trim() || undefined,
      allergens: x.allergens.split(',').map(a => a.trim()).filter(Boolean), options: parseOpts(x.options),
      oldPriceXaf: x.oldPrice ? Number(x.oldPrice) : undefined, promoEndsAt: x.promoEnds ? new Date(x.promoEnds).toISOString() : undefined },
      { onSuccess: () => { if (!item) setD(p => ({ ...p, name: '', price: '', imageUrl: undefined, ...blank })) }, onError: setErr })
  }
  return (
    <div className="st-row">
      <input type="text" aria-label={tx('Plat')} placeholder={tx('Plat')} value={d.name} onChange={e => setD({ ...d, name: e.target.value })} />
      <input type="number" aria-label={tx('Prix (FCFA)')} placeholder={tx('Prix (FCFA)')} value={d.price} onChange={e => setD({ ...d, price: e.target.value })} />
      <select aria-label={tx('Catégorie')} value={d.category} onChange={e => setD({ ...d, category: e.target.value })}>{cats.map(c => <option key={c} value={c}>{tx(c)}</option>)}</select>
      <select aria-label={tx('Préparation')} value={d.prep} onChange={e => setD({ ...d, prep: e.target.value as 'ready' | 'made' })}><option value="made">{tx('À préparer à la commande')}</option><option value="ready">{tx('Déjà prêt (service direct)')}</option></select>
      <label className="opt"><input type="checkbox" checked={d.cooking} onChange={e => setD({ ...d, cooking: e.target.checked })} />{tx('Cuisson à choisir')}</label>
      {item && <label className="opt"><input type="checkbox" checked={d.available} onChange={e => go({ available: e.target.checked })} />{tx('Disponible')}</label>}
      <label className="btn s" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>{d.imageUrl ? '✓ ' : ''}{tx('Photo')}
        <input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) try { setD({ ...d, imageUrl: await readImage(f) }); setErr(null) } catch (x) { setErr(x) } }} /></label>
      <button className="btn s" aria-expanded={more} onClick={() => setMore(!more)}>{tx('Détails')}</button>
      <button className="btn s p" disabled={save.isPending || !d.name.trim() || !d.price} onClick={() => go()}>{item ? tx('Enregistrer') : tx('Ajouter un plat')}</button>
      {more && <div className="st-grid" style={{ gridColumn: '1 / -1' }}>
        <Field label="Nom (anglais)"><input type="text" value={d.nameEn} onChange={e => setD({ ...d, nameEn: e.target.value })} /></Field>
        <Field label="Portion"><input type="text" value={d.portion} onChange={e => setD({ ...d, portion: e.target.value })} /></Field>
        <Field label="Description (français)"><textarea rows={2} value={d.description} onChange={e => setD({ ...d, description: e.target.value })} /></Field>
        <Field label="Description (anglais)"><textarea rows={2} value={d.descriptionEn} onChange={e => setD({ ...d, descriptionEn: e.target.value })} /></Field>
        <Field label="Allergènes (séparés par des virgules)"><input type="text" value={d.allergens} onChange={e => setD({ ...d, allergens: e.target.value })} /></Field>
        <Field label="Options payantes (une par ligne : nom : prix)"><textarea rows={3} placeholder="Sauce piquante : 500" value={d.options} onChange={e => setD({ ...d, options: e.target.value })} /></Field>
        <Field label="Prix barré (ancien prix)"><input type="number" value={d.oldPrice} onChange={e => setD({ ...d, oldPrice: e.target.value })} /></Field>
        <Field label="Fin de la promotion"><input type="datetime-local" value={d.promoEnds} onChange={e => setD({ ...d, promoEnds: e.target.value })} /></Field></div>}
      <div style={{ gridColumn: '1 / -1' }}><Err e={err ?? save.error} /></div>
    </div>
  )
}

const PL = Object.fromEntries(PERMISSIONS) as Record<Permission, string>
const TABPERM: Record<string, Permission> = { Restaurant: 'settings', Tables: 'settings', 'Codes QR': 'settings', Paiements: 'settings', 'Reçu': 'settings', Menu: 'menu', 'Équipe': 'team' }

function StaffRow({ s, roles, all }: { s?: Staff; roles: RoleDef[]; all: RoleDef[] }) {
  const tx = useT(), save = useSaveStaff()
  const [d, setD] = useState({ name: s?.name ?? '', email: s?.email ?? '', role: s?.role ?? roles.find(r => r.id === 'waiter')?.id ?? roles[0]?.id ?? '' }), [pw, setPw] = useState('')
  const go = (over: Partial<Staff> = {}) => save.mutate({ ...(s ? { id: s.id } : {}), name: d.name, email: d.email, role: d.role, active: s?.active ?? true, ...over }, { onSuccess: r => { if (!s) { setPw(r.tempPassword ?? ''); setD({ name: '', email: '', role: d.role }) } } })
  const mine = !s || roles.some(r => r.id === s.role) // you cannot edit someone more powerful than you
  const opts = s && !mine ? [...all.filter(r => r.id === s.role), ...roles] : roles
  const cur = all.find(r => r.id === d.role)
  return (
    <div className="st-row">
      <input type="text" aria-label={tx('Nom')} placeholder={tx('Nom')} value={d.name} readOnly={!!s} onChange={e => setD({ ...d, name: e.target.value })} />
      <input type="text" aria-label={tx('Email')} placeholder={tx('Email')} value={d.email} readOnly={!!s} onChange={e => setD({ ...d, email: e.target.value })} />
      <select aria-label={tx('Rôle')} value={d.role} disabled={!mine} onChange={e => { setD({ ...d, role: e.target.value }); if (s) go({ role: e.target.value }) }}>{opts.map(r => <option key={r.id} value={r.id}>{tx(r.name)}</option>)}</select>
      {s ? <label className="opt"><input type="checkbox" checked={s.active} disabled={!mine} onChange={e => go({ active: e.target.checked })} />{tx('Actif')}</label> : <span />}
      {!s && <button className="btn s p" disabled={save.isPending || !d.name.trim() || !d.email.trim() || !d.role} onClick={() => go()}>{tx('Inviter')}</button>}
      {!s && cur && <p className="sm mu" style={{ gridColumn: '1 / -1', margin: 0 }}>{cur.permissions.length ? cur.permissions.map(p => tx(PL[p])).join(', ') : tx('Aucune autorisation')}</p>}
      {pw && <p role="status" className="bn" style={{ gridColumn: '1 / -1', margin: 0 }}>{tx('Compte créé. Mot de passe provisoire :')} <b className="qr-code">{pw}</b> {tx('Notez-le maintenant, il ne sera plus affiché.')}</p>}
      <div style={{ gridColumn: '1 / -1' }}><Err e={save.error} /></div>
    </div>
  )
}

function RolesEditor() {
  const tx = useT(), roles = useRoles(), save = useSaveRole(), del = useDeleteRole(), me = useSession().data, [name, setName] = useState('')
  if (!roles.data) return <p className="empty">{tx('Chargement…')}</p>
  const toggle = (r: RoleDef, p: Permission, on: boolean) => save.mutate({ id: r.id, name: r.name, permissions: on ? [...r.permissions, p] : r.permissions.filter(x => x !== p) })
  return (
    <>
      <p className="sm mu" style={{ margin: 0 }}>{tx('Cochez ce que chaque rôle peut faire. Vous ne pouvez accorder que ce que vous pouvez faire vous-même.')}</p>
      <div className="ad-scroll"><table className="ad-tbl"><thead><tr><th scope="col">{tx('Rôle')}</th>{PERMISSIONS.map(([k, l]) => <th key={k} scope="col">{tx(l)}</th>)}<th /></tr></thead>
        <tbody>{roles.data.map(r => <tr key={r.id}><td><b>{tx(r.name)}</b></td>
          {PERMISSIONS.map(([k]) => <td key={k}><input type="checkbox" aria-label={`${tx(r.name)}: ${tx(PL[k])}`} checked={r.permissions.includes(k)} disabled={!!r.system || r.id === me?.role || !me?.permissions.includes(k) || save.isPending} onChange={e => toggle(r, k, e.target.checked)} /></td>)}
          <td>{!r.system && <button className="btn s" disabled={del.isPending} onClick={() => del.mutate(r.id)}>{tx('Supprimer')}</button>}</td></tr>)}</tbody></table></div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input type="text" aria-label={tx('Nom du rôle')} placeholder={tx('Nom du rôle')} value={name} onChange={e => setName(e.target.value)} style={{ maxWidth: 260 }} />
        <button className="btn s p" disabled={!name.trim() || save.isPending} onClick={() => save.mutate({ name: name.trim(), permissions: [] }, { onSuccess: () => setName('') })}>{tx('Créer un rôle')}</button></div>
      <Err e={save.error ?? del.error} />
    </>
  )
}

export function Settings({ shell }: { shell: Shell }) {
  const tx = useT(), q = useSettings(), save = useSaveSettings(), menu = useMenu(), staff = useStaff(), tables = useTables(), tadm = useTableAdmin()
  const me = useSession().data, rolesQ = useRoles()
  const roles = (rolesQ.data ?? []).filter(r => me && (r.id !== 'owner' || me.role === 'owner') && r.permissions.every(p => me.permissions.includes(p)))
  const shown = TABS.filter(t => can(me, TABPERM[t]!))
  const [tab, setTab] = useState<(typeof TABS)[number]>('Restaurant'), [d, setD] = useState<Cfg | null>(null), [err, setErr] = useState<unknown>(null)
  useEffect(() => { if (q.data && !d) setD(structuredClone(q.data)) }, [q.data]) // eslint-disable-line react-hooks/exhaustive-deps
  const up = (fn: (x: Cfg) => void) => setD(p => { const n = structuredClone(p!); fn(n); return n })
  const cats = [...new Set((menu.data ?? []).map(m => m.category))]
  useEffect(() => { if (me && shown.length && !shown.includes(tab)) setTab(shown[0]!) }) // eslint-disable-line
  const draft = tab === 'Restaurant' || tab === 'Paiements' || tab === 'Reçu'
  return (
    <AdminShell current="settings" shell={shell}>
      <div className="ad-top"><div><h1>{tx('Paramètres')}</h1></div></div>
      <div className="st-tabs" role="group" aria-label={tx('Paramètres')}>{shown.map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{tx(t)}</button>)}</div>
      {(q.isPending || (draft && !d)) && <p className="empty">{tx('Chargement…')}</p>}
      {draft && d && (
        <div className={tab === 'Reçu' ? 'st-split' : ''}>
          <div className="st-card">
            {tab === 'Restaurant' && <div className="st-grid">
              <Field label="Nom du restaurant"><input type="text" value={d.restaurant.name} onChange={e => up(x => { x.restaurant.name = e.target.value })} /></Field>
              <Field label="Adresse"><input type="text" value={d.restaurant.address} onChange={e => up(x => { x.restaurant.address = e.target.value })} /></Field>
              <Field label="Téléphone"><input type="text" value={d.restaurant.phone} onChange={e => up(x => { x.restaurant.phone = e.target.value })} /></Field>
              <Field label="Devise"><input type="text" value="XAF (FCFA)" readOnly /></Field>
              <Field label="Ouverture"><input type="text" inputMode="numeric" placeholder="08:00" value={d.restaurant.opens} onChange={e => up(x => { x.restaurant.opens = e.target.value })} /></Field>
              <Field label="Fermeture"><input type="text" inputMode="numeric" placeholder="23:00" value={d.restaurant.closes} onChange={e => up(x => { x.restaurant.closes = e.target.value })} /></Field></div>}
            {tab === 'Paiements' && <>
              <p className="sm mu" style={{ margin: 0 }}>{tx('Chaque paiement Mobile Money est vérifié à la main par le caissier.')}</p>
              <p className="sm mu" style={{ margin: 0 }}>{tx('Importez le QR fourni par MTN ou Orange pour votre compte marchand. Le client pourra le scanner ou le télécharger.')}</p>
              {(Object.keys(METHOD_LABEL) as PayMethod[]).map(m => (
                <div key={m} className="st-row" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
                  <label className="opt"><input type="checkbox" checked={d.payments[m].enabled} onChange={e => up(x => { x.payments[m].enabled = e.target.checked })} />{tx(METHOD_LABEL[m])}</label>
                  {m !== 'cash' ? <input type="text" aria-label={tx('Numéro du restaurant')} placeholder={tx('Numéro du restaurant')} value={d.payments[m].number ?? ''} onChange={e => up(x => { x.payments[m].number = e.target.value })} /> : <span />}
                  {m !== 'cash' && (
                    <div className="row" style={{ gridColumn: '1 / -1', flexWrap: 'wrap' }}>
                      <label className="btn s" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>{tx('Importer le code QR')}
                        <input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) try { const u = await readImage(f); up(x => { x.payments[m].qrUrl = u }); setErr(null) } catch (x) { setErr(x) } }} /></label>
                      {d.payments[m].qrUrl && <><img src={d.payments[m].qrUrl} alt={`${tx('Code QR de paiement')} ${tx(METHOD_LABEL[m])}`} style={{ width: 96, height: 96, objectFit: 'contain', background: '#fff', borderRadius: 8 }} />
                        <button className="btn s" onClick={() => up(x => { delete x.payments[m].qrUrl })}>{tx('Retirer')}</button></>}
                    </div>)}
                </div>))}</>}
            {tab === 'Reçu' && <>
              <div className="st-grid">
                <Field label="Préfixe du numéro"><input type="text" value={d.receipt.prefix} onChange={e => up(x => { x.receipt.prefix = e.target.value })} /></Field>
                <Field label="N° contribuable"><input type="text" value={d.receipt.taxId} onChange={e => up(x => { x.receipt.taxId = e.target.value })} /></Field>
                <Field label="Papier"><select value={d.receipt.paper} onChange={e => up(x => { x.receipt.paper = Number(e.target.value) as 58 | 80 })}><option value={80}>80 mm</option><option value={58}>58 mm</option></select></Field></div>
              <Field label="Pied de page"><input type="text" value={d.receipt.footer} onChange={e => up(x => { x.receipt.footer = e.target.value })} /></Field>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <label className="opt"><input type="checkbox" checked={d.receipt.showTable} onChange={e => up(x => { x.receipt.showTable = e.target.checked })} />{tx('Afficher la table')}</label>
                <label className="opt"><input type="checkbox" checked={d.receipt.showWaiter} onChange={e => up(x => { x.receipt.showWaiter = e.target.checked })} />{tx('Afficher le serveur')}</label>
                <label className="btn s" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>{tx('Logo')}
                  <input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) try { const u = await readImage(f); up(x => { x.receipt.logoUrl = u }); setErr(null) } catch (x) { setErr(x) } }} /></label>
                {d.receipt.logoUrl && <button className="btn s" onClick={() => up(x => { delete x.receipt.logoUrl })}>{tx('Retirer le logo')}</button>}</div></>}
            <Err e={err ?? save.error} />
            <div className="row"><button className="btn p" disabled={save.isPending} onClick={() => { setErr(null); save.mutate(d) }}>{tx('Enregistrer')}</button>{save.isSuccess && !save.isPending && <span role="status" className="sm b" style={{ color: 'var(--gr)' }}>{tx('Enregistré')}</span>}</div>
          </div>
          {tab === 'Reçu' && <div><h2 style={{ marginBottom: 10 }}>{tx('Aperçu du reçu')}</h2><ReceiptPaper s={d} r={SAMPLE} /></div>}
        </div>)}
      {tab === 'Menu' && <div className="st-card"><MenuRow cats={cats} />{(menu.data ?? []).map(m => <MenuRow key={m.id + m.priceXaf + m.name} item={m} cats={cats} />)}</div>}
      {tab === 'Tables' && <div className="st-card"><div className="grid">{(tables.data ?? []).map(t => <div key={t.id} className="card" style={{ background: 'var(--f)' }}><b>{tx('Table')} {t.id}</b><br /><span className="sm mu">{t.session ? tx('Occupée') : `${t.seats} ${tx('places')}`}</span><br />
        <button className="btn s" style={{ marginTop: 8 }} disabled={!!t.session || tadm.isPending} onClick={() => tadm.mutate({ remove: t.id })}>{tx('Supprimer')}</button></div>)}</div>
        <Err e={tadm.error} /><div><button className="btn p" disabled={tadm.isPending} onClick={() => tadm.mutate({ add: true })}>{tx('Ajouter une table')}</button></div></div>}
      {tab === 'Codes QR' && <QrCodes />}
      {tab === 'Équipe' && <div className="st-card">
        <h2>{tx('Ajouter un membre')}</h2><StaffRow roles={roles} all={rolesQ.data ?? []} />
        <h2>{tx('Membres de l’équipe')}</h2>{(staff.data ?? []).map(s => <StaffRow key={s.id + s.role + s.active} s={s} roles={roles} all={rolesQ.data ?? []} />)}<Err e={staff.error} />
        <h2>{tx('Rôles et autorisations')}</h2><RolesEditor /></div>}
    </AdminShell>
  )
}
