import { lang } from '../i18n'
import { io } from 'socket.io-client'
import saladImg from '../assets/salad.jpg'
import gyozaImg from '../assets/gyoza.jpg'
import cookiesImg from '../assets/cookies.jpg'
import croissantImg from '../assets/croissant.jpg'
import { PERMISSIONS, canMove, type BookingInput, type ReservationReceipt, type AuditEntry, type PaymentRec, type Reservation, type ReservationInput, type ResStatus, type Shift, type Permission, type RoleDef, type TableCode, type PublicSettings, type Role, type Session, type Settings, type Staff, type Overview, type PayMethod, type ServiceKind, type ServiceRequest, type Bill, type MenuItem, type Payment, type Receipt, type RecordPaymentInput, type Order, type OrderStatus, type ServerEvent, type SubmitOrderInput, type TableView } from '../domain/types'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

// The only surface the UI knows about. Swap implementations without touching components.
export interface ApiClient {
  listOrders(): Promise<Order[]>
  listTables(): Promise<TableView[]>
  submitOrder(input: SubmitOrderInput, idempotencyKey: string): Promise<Order>
  transitionOrder(id: string, to: OrderStatus, version: number): Promise<Order>
  listMenu(): Promise<MenuItem[]>
  getOverview(): Promise<Overview>
  getBill(tableId: string): Promise<Bill>
  recordPayment(tableId: string, input: RecordPaymentInput, idempotencyKey: string): Promise<Receipt>
  // Public customer surface, keyed by the table code from the QR. No staff session, no staff data.
  customerOrders(token: string): Promise<Order[]>
  customerSubmit(token: string, input: Omit<SubmitOrderInput, 'tableId'>, idempotencyKey: string): Promise<Order>
  requestService(token: string, kind: ServiceKind): Promise<ServiceRequest>
  // Staff side of service requests
  listRequests(): Promise<ServiceRequest[]>
  updateRequest(id: string, state: 'acknowledged' | 'done'): Promise<ServiceRequest>
  // Auth. In production the session is an httpOnly cookie set by the server.
  me(): Promise<Session | null>
  login(email: string, password: string): Promise<Session>
  logout(): Promise<void>
  requestReset(email: string): Promise<void>
  // Configuration, owner only except reads
  getSettings(): Promise<Settings>
  getPublicSettings(): Promise<PublicSettings>
  saveSettings(s: Settings): Promise<Settings>
  listStaff(): Promise<Staff[]>
  saveStaff(s: Omit<Staff, 'id'> & { id?: string }): Promise<Staff & { tempPassword?: string }>
  saveMenuItem(m: Partial<MenuItem> & { name: string; priceXaf: number; category: string }): Promise<MenuItem>
  addTable(): Promise<void>
  // Secret per-table codes behind the QR posters. A leaked poster is fixed by rotating its code.
  listTableCodes(): Promise<TableCode[]>
  rotateTableCode(tableId: string): Promise<TableCode>
  removeTable(id: string): Promise<void>
  // Roles: the owner or an administrator defines them and ticks permissions
  listRoles(): Promise<RoleDef[]>
  saveRole(r: { id?: string; name: string; permissions: Permission[] }): Promise<RoleDef>
  deleteRole(id: string): Promise<void>
  // Cash register
  currentShift(): Promise<Shift | null>
  openShift(openingXaf: number): Promise<Shift>
  cashMovement(kind: 'in' | 'out', amountXaf: number, reason: string): Promise<Shift>
  closeShift(countedXaf: number, note: string): Promise<Shift>
  // Refunds, discounts, cancellations
  listPayments(): Promise<PaymentRec[]>
  refundPayment(id: string, amountXaf: number, reason: string): Promise<PaymentRec>
  applyDiscount(tableId: string, amountXaf: number, reason: string): Promise<void>
  cancelOrder(id: string, version: number, reason: string): Promise<Order>
  // Reservations and audit
  listReservations(date: string): Promise<Reservation[]>
  saveReservation(r: ReservationInput): Promise<Reservation>
  setReservationStatus(id: string, status: ResStatus): Promise<Reservation>
  listAudit(): Promise<AuditEntry[]>
  // Public reservations, no sign-in
  getAvailability(date: string, time: string, party: number): Promise<{ tableId: string; seats: number }[]>
  bookTable(input: BookingInput, idempotencyKey: string): Promise<ReservationReceipt>
  getReceipt(code: string): Promise<ReservationReceipt>
  findReservation(code: string): Promise<Reservation | null>
  subscribe(onEvent: (e: ServerEvent) => void): () => void
}

export class HttpClient implements ApiClient {
  constructor(private base: string) {}
  private async req<T>(path: string, init: RequestInit = {}, key?: string): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${this.base}/api/v1${path}`, {
        ...init, credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept-Language': lang(), ...(key ? { 'Idempotency-Key': key } : {}) },
      })
    } catch { throw new ApiError(0, 'Connexion perdue. Rien n’a été enregistré.') }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ApiError(res.status, body.message ?? 'Une erreur est survenue.')
    }
    return (res.status === 204 ? undefined : res.json()) as Promise<T>
  }
  listOrders() { return this.req<Order[]>('/orders?active=true') }
  listTables() { return this.req<TableView[]>('/tables') }
  submitOrder(input: SubmitOrderInput, key: string) {
    return this.req<Order>('/orders', { method: 'POST', body: JSON.stringify(input) }, key)
  }
  transitionOrder(id: string, to: OrderStatus, version: number) {
    return this.req<Order>(`/orders/${id}/status`, { method: 'POST', body: JSON.stringify({ to, version }) })
  }
  listMenu() { return this.req<MenuItem[]>('/menu/items') }
  listRequests() { return this.req<ServiceRequest[]>('/service-requests?open=true') }
  updateRequest(id: string, state: 'acknowledged' | 'done') { return this.req<ServiceRequest>(`/service-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ state }) }) }
  me() { return this.req<Session | null>('/auth/me') }
  login(email: string, password: string) { return this.req<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }) }
  logout() { return this.req<void>('/auth/logout', { method: 'POST' }) }
  requestReset(email: string) { return this.req<void>('/auth/reset', { method: 'POST', body: JSON.stringify({ email }) }) }
  getSettings() { return this.req<Settings>('/settings') }
  getPublicSettings() { return this.req<PublicSettings>('/public/settings') }
  saveSettings(s: Settings) { return this.req<Settings>('/settings', { method: 'PUT', body: JSON.stringify(s) }) }
  listStaff() { return this.req<Staff[]>('/staff') }
  saveStaff(s: Omit<Staff, 'id'> & { id?: string }) { return this.req<Staff & { tempPassword?: string }>(s.id ? `/staff/${s.id}` : '/staff', { method: s.id ? 'PATCH' : 'POST', body: JSON.stringify(s) }) }
  saveMenuItem(m: Partial<MenuItem> & { name: string; priceXaf: number; category: string }) { return this.req<MenuItem>(m.id ? `/menu/items/${m.id}` : '/menu/items', { method: m.id ? 'PATCH' : 'POST', body: JSON.stringify(m) }) }
  addTable() { return this.req<void>('/tables', { method: 'POST' }) }
  listTableCodes() { return this.req<TableCode[]>('/tables/codes') }
  rotateTableCode(tableId: string) { return this.req<TableCode>(`/tables/${tableId}/code/rotate`, { method: 'POST' }) }
  removeTable(id: string) { return this.req<void>(`/tables/${id}`, { method: 'DELETE' }) }
  listRoles() { return this.req<RoleDef[]>('/roles') }
  saveRole(r: { id?: string; name: string; permissions: Permission[] }) { return this.req<RoleDef>(r.id ? `/roles/${r.id}` : '/roles', { method: r.id ? 'PUT' : 'POST', body: JSON.stringify(r) }) }
  deleteRole(id: string) { return this.req<void>(`/roles/${id}`, { method: 'DELETE' }) }
  currentShift() { return this.req<Shift | null>('/cashier-shifts/current') }
  openShift(openingXaf: number) { return this.req<Shift>('/cashier-shifts', { method: 'POST', body: JSON.stringify({ openingXaf }) }) }
  cashMovement(kind: 'in' | 'out', amountXaf: number, reason: string) { return this.req<Shift>('/cashier-shifts/current/movements', { method: 'POST', body: JSON.stringify({ kind, amountXaf, reason }) }) }
  closeShift(countedXaf: number, note: string) { return this.req<Shift>('/cashier-shifts/current/close', { method: 'POST', body: JSON.stringify({ countedXaf, note }) }) }
  listPayments() { return this.req<PaymentRec[]>('/payments?recent=true') }
  refundPayment(id: string, amountXaf: number, reason: string) { return this.req<PaymentRec>(`/payments/${id}/refunds`, { method: 'POST', body: JSON.stringify({ amountXaf, reason }) }) }
  applyDiscount(tableId: string, amountXaf: number, reason: string) { return this.req<void>(`/tables/${tableId}/discount`, { method: 'POST', body: JSON.stringify({ amountXaf, reason }) }) }
  cancelOrder(id: string, version: number, reason: string) { return this.req<Order>(`/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ version, reason }) }) }
  listReservations(date: string) { return this.req<Reservation[]>(`/reservations?date=${date}`) }
  saveReservation(r: ReservationInput) { return this.req<Reservation>(r.id ? `/reservations/${r.id}` : '/reservations', { method: r.id ? 'PUT' : 'POST', body: JSON.stringify(r) }) }
  setReservationStatus(id: string, status: ResStatus) { return this.req<Reservation>(`/reservations/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }) }
  listAudit() { return this.req<AuditEntry[]>('/audit-logs') }
  getAvailability(date: string, time: string, party: number) { return this.req<{ tableId: string; seats: number }[]>(`/public/availability?date=${date}&time=${time}&party=${party}`) }
  bookTable(input: BookingInput, key: string) { return this.req<ReservationReceipt>('/public/reservations', { method: 'POST', body: JSON.stringify(input) }, key) }
  getReceipt(code: string) { return this.req<ReservationReceipt>(`/public/reservations/${encodeURIComponent(code)}`) }
  findReservation(code: string) { return this.req<Reservation | null>(`/reservations/by-code/${encodeURIComponent(code)}`) }
  getOverview() { return this.req<Overview>('/reports/overview') }
  getBill(tableId: string) { return this.req<Bill>(`/tables/${tableId}/bill`) }
  recordPayment(tableId: string, input: RecordPaymentInput, key: string) {
    return this.req<Receipt>(`/tables/${tableId}/payments`, { method: 'POST', body: JSON.stringify(input) }, key)
  }
  customerOrders(token: string) { return this.req<Order[]>(`/public/tables/${encodeURIComponent(token)}/orders`) }
  customerSubmit(token: string, input: Omit<SubmitOrderInput, 'tableId'>, key: string) {
    return this.req<Order>(`/public/tables/${encodeURIComponent(token)}/orders`, { method: 'POST', body: JSON.stringify(input) }, key)
  }
  requestService(token: string, kind: ServiceKind) {
    return this.req<ServiceRequest>(`/public/tables/${encodeURIComponent(token)}/requests`, { method: 'POST', body: JSON.stringify({ kind }) })
  }
  subscribe(onEvent: (e: ServerEvent) => void) {
    // Restaurant scope comes from the authenticated session on the server, never from the client.
    const s = io(`${this.base}/orders`, { withCredentials: true })
    s.on('connect', () => onEvent({ type: 'resync' })) // on every (re)connect, refetch the truth
    s.on('order.changed', () => onEvent({ type: 'orders.changed' }))
    return () => { s.disconnect() }
  }
}

// In-memory stand-in enforcing the rules the real backend must enforce.
const CATS = ['Boissons', 'Grillades', 'Accompagnements', 'Desserts']
const M = (id: string, name: string, priceXaf: number, c: number): MenuItem => ({ id, name, priceXaf, category: CATS[c]!, cooking: c === 1, available: true, prep: c === 0 || c === 3 ? 'ready' : 'made' })
const X = (m: MenuItem, o: Partial<MenuItem>): MenuItem => ({ ...m, ...o })
const PROMO_END = new Date(Date.now() + (12 * 3600 + 10 * 60 + 9) * 1000).toISOString()
const MOCK_MENU: MenuItem[] = [
  X(M('salad', 'Salade tomate et tofu', 3400, 2), { imageUrl: saladImg, oldPriceXaf: 4000, stock: 12, promoEndsAt: PROMO_END }),
  X(M('gyoza', 'Gyozas de poulet japonais', 2900, 2), { imageUrl: gyozaImg, oldPriceXaf: 3400, stock: 8, promoEndsAt: PROMO_END }),
  X(M('cookies', 'Cookies et lait', 2000, 3), { imageUrl: cookiesImg, stock: 21 }),
  X(M('croissant', 'Croissant du matin', 1500, 3), { imageUrl: croissantImg, stock: 19 }),
  M('eau', 'Eau minérale 1 L', 500, 0), M('gingembre', 'Jus de gingembre', 1000, 0), M('biere', 'Bière locale 33 cl', 1500, 0),
  M('poulet', 'Poulet braisé', 4500, 1), M('poisson', 'Poisson braisé', 5000, 1), M('brochettes', 'Brochettes de bœuf', 2500, 1),
  M('plantain', 'Plantain frit', 1000, 2), M('manioc', 'Bâtons de manioc', 800, 2), M('riz', 'Riz sauté', 1500, 2)]
const wait = (ms = 250) => new Promise(r => setTimeout(r, ms))
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString()

export class MockClient implements ApiClient {
  private n = 1042
  private r = 0
  private subs = new Set<(e: ServerEvent) => void>()
  private seen = new Map<string, Order | Receipt>()
  private pays = new Map<string, Payment[]>()
  private reqs: ServiceRequest[] = [{ id: 'r0', tableId: '2', kind: 'bill', state: 'open', createdAt: ago(3) }]
  // Demo history so the dashboard has something to draw. The real API computes all of this from the database.
  // Lifetime counters per waiter. A real backend counts from the orders table, which never loses cancelled orders.
  private placed: Record<string, number> = { Marc: 12, Jean: 9 }
  private cancelled: Record<string, number> = { Marc: 1 }
  private tableIds = ['1', '2', '3', '4', '5', '6']
  private codes = new Map<string, { code: string; at: string }>(['A3F9KD', 'B7H2QM', 'C5N8RT', 'D2P6WV', 'E9J4XS', 'F4L7YZ'].map((code, i) => [String(i + 1), { code, at: new Date().toISOString() }]))
  private newCode(): string {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let c: string
    do { c = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => A[b % A.length]).join('') } while ([...this.codes.values()].some(x => x.code === c))
    return c
  }
  // Demo accounts. The real backend stores salted password hashes and never ships credentials to the browser.
  private accounts: (Staff & { pw: string })[] = [
    { id: 'u1', name: 'Mama Ngozi', email: 'owner@demo.cm', role: 'owner', active: true, pw: 'owner123' },
    { id: 'u2', name: 'Paul Essomba', email: 'manager@demo.cm', role: 'manager', active: true, pw: 'manager123' },
    { id: 'u3', name: 'Marc', email: 'waiter@demo.cm', role: 'waiter', active: true, pw: 'waiter123' },
    { id: 'u4', name: 'Aïcha', email: 'cashier@demo.cm', role: 'cashier', active: true, pw: 'cashier123' },
    { id: 'u5', name: 'Chef Tony', email: 'kitchen@demo.cm', role: 'kitchen', active: true, pw: 'kitchen123' },
    { id: 'u6', name: 'Grace Tabi', email: 'admin@demo.cm', role: 'admin', active: true, pw: 'admin123' },
    { id: 'u7', name: 'Julie Mballa', email: 'secretary@demo.cm', role: 'secretary', active: true, pw: 'secretary123' }]
  private user: Session | null = (() => { try { const v = sessionStorage.getItem('rp-session'); return v ? (JSON.parse(v) as Session) : null } catch { return null } })()
  private settings: Settings = {
    restaurant: { name: 'Chez Mama Ngozi', address: 'Rue de la Réunification, Yaoundé', phone: '+237 6 00 00 00 00', opens: '08:00', closes: '23:00' },
    payments: { cash: { enabled: true }, mtn_momo: { enabled: true, number: '6 70 00 00 00' }, orange_money: { enabled: true, number: '6 90 00 00 00' } },
    receipt: { footer: 'Merci de votre visite !', prefix: 'R-', taxId: '', paper: 80, showTable: true, showWaiter: true } }
  private roles: RoleDef[] = [
    { id: 'owner', name: 'Propriétaire', system: true, permissions: PERMISSIONS.map(p => p[0]) },
    { id: 'admin', name: 'Administrateur', permissions: PERMISSIONS.map(p => p[0]) },
    { id: 'manager', name: 'Gérant', permissions: ['dashboard', 'orders', 'kitchen', 'cashier', 'reservations', 'refunds', 'cancel'] },
    { id: 'waiter', name: 'Serveur', permissions: ['orders'] },
    { id: 'cashier', name: 'Caissier', permissions: ['cashier'] },
    { id: 'kitchen', name: 'Cuisine', permissions: ['kitchen'] },
    { id: 'secretary', name: 'Secrétaire', permissions: ['reservations'] }]
  // Permissions are recomputed from the current role on every call, so a change applies immediately.
  private fresh(): Session | null {
    const u = this.user; if (!u) return null
    const a = this.accounts.find(x => x.email === u.email && x.active), r = a && this.roles.find(x => x.id === a.role)
    return a && r ? { name: a.name, email: a.email, role: a.role, roleName: r.name, permissions: [...r.permissions] } : null
  }
  private need(perm: Permission) {
    const u = this.fresh()
    if (!u) throw new ApiError(401, 'Connexion requise.')
    if (!u.permissions.includes(perm)) throw new ApiError(403, 'Action non autorisée pour votre rôle.')
  }
  private payRecs: PaymentRec[] = [
    { id: 'p-s1', tableId: '1', amountXaf: 45000, method: 'cash', at: ago(180), refundedXaf: 0 },
    { id: 'p-s2', tableId: '3', amountXaf: 28500, method: 'mtn_momo', at: ago(120), refundedXaf: 0 },
    { id: 'p-s3', tableId: '6', amountXaf: 16500, method: 'orange_money', at: ago(60), refundedXaf: 0 }]
  private get ledger() { return this.payRecs.map(p => ({ a: p.amountXaf - p.refundedXaf, m: p.method })) }
  private discounts = new Map<string, { a: number; reason: string }>()
  private shifts: (Shift & { cashSales: number; cashierEmail: string })[] = []
  private log: AuditEntry[] = []
  private booked = new Map<string, ReservationReceipt>()
  private reservations: Reservation[] = [
    { id: 'res1', name: 'Famille Tchoumi', phone: '+237 6 11 11 11 11', date: new Date().toISOString().slice(0, 10), time: '19:30', party: 6, tableId: '4', status: 'confirmed', code: 'RV-3K9M2A' },
    { id: 'res2', name: 'M. Kamga', phone: '+237 6 22 22 22 22', date: new Date().toISOString().slice(0, 10), time: '20:00', party: 2, status: 'pending', code: 'RV-7QD4XN' }]
  private audit(action: string, detail: string) { this.log.push({ id: `a${this.log.length + 1}`, at: new Date().toISOString(), actor: this.user?.name ?? 'Client', action, detail }) }
  private shiftOf() { return this.shifts.find(x => !x.closedAt && x.cashierEmail === this.user?.email) }
  private viewShift(x: Shift & { cashSales: number; cashierEmail: string }): Shift { const { cashSales: _c, cashierEmail: _e, ...o } = x; return structuredClone(o) }
  constructor() {
    // Every sensitive action leaves an audit entry. In production the server writes these in the same transaction.
    const A: Record<string, [string, (a: any[]) => string]> = { // eslint-disable-line @typescript-eslint/no-explicit-any
      login: ['Connexion', a => a[0]], saveSettings: ['Paramètres modifiés', () => ''], saveStaff: ['Membre créé ou modifié', a => a[0].email],
      saveRole: ['Rôle créé ou modifié', a => a[0].name], deleteRole: ['Rôle supprimé', a => a[0]], rotateTableCode: ['Code QR remplacé', a => `Table ${a[0]}`],
      saveMenuItem: ['Plat créé ou modifié', a => a[0].name], recordPayment: ['Paiement enregistré', a => `Table ${a[0]}, ${a[1].amountXaf} FCFA, ${a[1].method}`],
      refundPayment: ['Remboursement', a => `${a[0]}, ${a[1]} FCFA, ${a[2]}`], applyDiscount: ['Remise', a => `Table ${a[0]}, ${a[1]} FCFA, ${a[2]}`],
      cancelOrder: ['Commande annulée', a => { const o = this.orders.find(x => x.id === a[0]); return `#${o?.number} (${o?.waiterName}): ${a[2]}` }],
      submitOrder: ['Commande envoyée', a => `Table ${a[0].tableId}, ${a[0].lines.length} ${a[0].lines.length > 1 ? 'lignes' : 'ligne'}`], openShift: ['Caisse ouverte', a => `${a[0]} FCFA`], closeShift: ['Caisse fermée', a => `${a[0]} FCFA, ${a[1]}`],
      cashMovement: ['Mouvement de caisse', a => `${a[0]} ${a[1]} FCFA, ${a[2]}`], saveReservation: ['Réservation créée', a => a[0].name], bookTable: ['Réservation créée', a => `${a[0].name} (en ligne)`], setReservationStatus: ['Statut de réservation', a => `${a[0]} ${a[1]}`] }
    const self = this as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>
    for (const [name, [label, detail]] of Object.entries(A)) {
      const orig = self[name]!.bind(this)
      self[name] = async (...a: unknown[]) => {
        try { const r = await orig(...a); this.audit(label, detail(a)); return r } catch (e) { if (name === 'login') this.audit('Échec de connexion', String(a[0])); throw e }
      }
    }
  }
  private sold = new Map<string, number>([['gyoza', 93], ['salad', 75], ['cookies', 45], ['croissant', 38]])
  private orders: Order[] = [
    { id: 'o1041', number: 1041, tableId: '5', status: 'preparing', createdAt: ago(9), waiterName: 'Marc', channel: 'waiter', version: 2,
      lines: [{ id: 'l1', name: 'Poulet braisé', qty: 1, unitXaf: 4500, modifiers: ['À point'] }] },
    { id: 'o1040', number: 1040, tableId: '2', status: 'served', createdAt: ago(24), waiterName: 'Jean', channel: 'waiter', version: 3,
      lines: [{ id: 'l2', name: 'Brochettes de bœuf', qty: 2, unitXaf: 2500, modifiers: ['Bien cuit'] }, { id: 'l3', name: 'Eau minérale 1 L', qty: 1, unitXaf: 500, modifiers: [] }] },
  ]
  private emit() { this.subs.forEach(f => f({ type: 'orders.changed' })) }
  private bill(tableId: string): Bill {
    const lines = this.orders.filter(o => o.tableId === tableId && o.status !== 'cancelled').flatMap(o => o.lines)
    const discountXaf = this.discounts.get(tableId)?.a ?? 0
    const totalXaf = lines.reduce((a, l) => a + l.qty * l.unitXaf, 0) - discountXaf
    const payments = this.pays.get(tableId) ?? []
    const paidXaf = payments.reduce((a, p) => a + p.amountXaf, 0)
    return { tableId, lines, discountXaf, totalXaf, paidXaf, remainingXaf: totalXaf - paidXaf, payments }
  }
  async listOrders() { await wait(); return structuredClone(this.orders) }
  async listMenu() { await wait(100); return structuredClone(MOCK_MENU) }
  async listRequests() { await wait(); return structuredClone(this.reqs.filter(r => r.state !== 'done')) }
  async updateRequest(id: string, state: 'acknowledged' | 'done') {
    await wait()
    const r = this.reqs.find(x => x.id === id); if (!r) throw new ApiError(404, 'Demande introuvable.')
    r.state = state; this.emit(); return structuredClone(r)
  }
  async currentShift() { await wait(100); this.need('cashier'); const x = this.shiftOf(); return x ? this.viewShift(x) : null }
  async openShift(openingXaf: number) {
    await wait(); this.need('cashier')
    if (this.shiftOf()) throw new ApiError(409, 'Une session de caisse est déjà ouverte.')
    if (!Number.isInteger(openingXaf) || openingXaf < 0) throw new ApiError(422, 'Montant invalide.')
    const x = { id: `sh${this.shifts.length + 1}`, cashier: this.fresh()!.name, cashierEmail: this.user!.email, openedAt: new Date().toISOString(), openingXaf, moves: [], cashSales: 0 }
    this.shifts.push(x); return this.viewShift(x)
  }
  async cashMovement(kind: 'in' | 'out', amountXaf: number, reason: string) {
    await wait(); this.need('cashier'); const x = this.shiftOf()
    if (!x) throw new ApiError(409, 'Ouvrez la caisse d’abord.')
    if (!reason.trim()) throw new ApiError(422, 'Motif requis.')
    if (!Number.isInteger(amountXaf) || amountXaf <= 0) throw new ApiError(422, 'Montant invalide.')
    x.moves.push({ kind, amountXaf, reason: reason.trim(), at: new Date().toISOString() }); return this.viewShift(x)
  }
  async closeShift(countedXaf: number, note: string) {
    await wait(); this.need('cashier'); const x = this.shiftOf()
    if (!x) throw new ApiError(409, 'Ouvrez la caisse d’abord.')
    if (!Number.isInteger(countedXaf) || countedXaf < 0) throw new ApiError(422, 'Montant invalide.')
    // Expected cash is computed from recorded movements, never typed by the cashier.
    const m = (k: string) => x.moves.filter(v => v.kind === k).reduce((a, v) => a + v.amountXaf, 0)
    const expectedXaf = x.openingXaf + x.cashSales + m('in') - m('out') - m('refund'), diffXaf = countedXaf - expectedXaf
    if (diffXaf !== 0 && !note.trim()) throw new ApiError(422, 'Expliquez l’écart de caisse.')
    Object.assign(x, { closedAt: new Date().toISOString(), countedXaf, expectedXaf, diffXaf, note: note.trim() }); return this.viewShift(x)
  }
  async listPayments() { await wait(); this.need('refunds'); return structuredClone([...this.payRecs].reverse().slice(0, 8)) }
  async refundPayment(id: string, amountXaf: number, reason: string) {
    await wait(); this.need('refunds')
    const p = this.payRecs.find(x => x.id === id); if (!p) throw new ApiError(404, 'Paiement introuvable.')
    if (!reason.trim()) throw new ApiError(422, 'Motif requis.')
    if (!Number.isInteger(amountXaf) || amountXaf <= 0 || amountXaf > p.amountXaf - p.refundedXaf) throw new ApiError(422, 'Montant de remboursement invalide.')
    if (p.method === 'cash') {
      const x = this.shiftOf(); if (!x) throw new ApiError(409, 'Ouvrez la caisse avant de rembourser en espèces.')
      x.moves.push({ kind: 'refund', amountXaf, reason: reason.trim(), at: new Date().toISOString() })
    }
    p.refundedXaf += amountXaf; this.emit(); return structuredClone(p)
  }
  async applyDiscount(tableId: string, amountXaf: number, reason: string) {
    await wait(); this.need('refunds')
    if (!reason.trim()) throw new ApiError(422, 'Motif requis.')
    const b = this.bill(tableId)
    if (!Number.isInteger(amountXaf) || amountXaf <= 0 || amountXaf > b.totalXaf + (b.discountXaf ?? 0) - b.paidXaf) throw new ApiError(422, 'Remise trop élevée.')
    this.discounts.set(tableId, { a: amountXaf, reason: reason.trim() }); this.emit()
  }
  async cancelOrder(id: string, version: number, reason: string) {
    await wait(); this.need('cancel')
    const o = this.orders.find(x => x.id === id); if (!o) throw new ApiError(404, 'Commande introuvable.')
    if (o.version !== version) throw new ApiError(409, 'Cette commande vient d’être modifiée. L’écran se met à jour.')
    if (!reason.trim()) throw new ApiError(422, 'Motif requis.')
    if (!canMove(o.status, 'cancelled')) throw new ApiError(422, 'Ce changement d’état n’est pas autorisé.')
    const me = this.fresh()!
    // Fraud controls: once cooking has started only a manager may cancel, and the person who placed an order cannot cancel it after 2 minutes.
    if (o.status === 'preparing' && !me.permissions.includes('refunds')) throw new ApiError(403, 'Le plat est déjà en préparation : un responsable doit annuler.')
    if (o.placedBy && o.placedBy === me.email && Date.now() - +new Date(o.createdAt) > 120_000) throw new ApiError(403, 'Après 2 minutes, une autre personne doit annuler cette commande.')
    o.status = 'cancelled'; o.cancelReason = reason.trim(); o.cancelledBy = me.name; o.cancelledAt = new Date().toISOString(); this.cancelled[o.waiterName] = (this.cancelled[o.waiterName] ?? 0) + 1; o.version++; this.emit(); return structuredClone(o)
  }
  private clash(r: Reservation) {
    const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
    return this.reservations.some(x => x.id !== r.id && x.tableId === r.tableId && x.date === r.date && ['confirmed', 'arrived'].includes(x.status) && Math.abs(mins(x.time) - mins(r.time)) < 90)
  }
  async listReservations(date: string) { await wait(); this.need('reservations'); return structuredClone(this.reservations.filter(r => r.date === date).sort((a, b) => a.time.localeCompare(b.time))) }
  async saveReservation(r: ReservationInput) {
    await wait(); this.need('reservations')
    if (!r.name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !/^\d{2}:\d{2}$/.test(r.time) || !(r.party >= 1)) throw new ApiError(422, 'Nom et date valides requis.')
    const ex = this.reservations.find(x => x.id === r.id)
    if (ex) { const n = { ...ex, ...r, status: ex.status } as Reservation; if (['confirmed', 'arrived'].includes(n.status) && this.clash(n)) throw new ApiError(409, 'Cette table est déjà réservée à cette heure.'); Object.assign(ex, n); return structuredClone(ex) }
    const n: Reservation = { ...r, id: `res${this.reservations.length + 1}`, status: 'pending', code: this.resCode(), createdAt: new Date().toISOString() }; this.reservations.push(n); return structuredClone(n)
  }
  async setReservationStatus(id: string, status: ResStatus) {
    await wait(); this.need('reservations')
    const r = this.reservations.find(x => x.id === id); if (!r) throw new ApiError(404, 'Réservation introuvable.')
    if (status === 'confirmed') {
      if (!r.tableId) throw new ApiError(422, 'Choisissez une table avant de confirmer.')
      if (this.clash(r)) throw new ApiError(409, 'Cette table est déjà réservée à cette heure.')
    }
    r.status = status; return structuredClone(r)
  }
  private seatsOf(id: string) { return Number(id) % 3 === 0 ? 6 : 4 }
  private resCode(): string { let c: string; do { c = 'RV-' + this.newCode() } while (this.reservations.some(r => r.code === c)); return c }
  private free(date: string, time: string, party: number) {
    const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)), d = new Date(), now = d.getHours() * 60 + d.getMinutes(), today = d.toISOString().slice(0, 10)
    return this.tableIds.filter(id => this.seatsOf(id) >= party
      && !this.reservations.some(x => x.tableId === id && x.date === date && ['pending', 'confirmed', 'arrived'].includes(x.status) && Math.abs(m(x.time) - m(time)) < 90)
      && !(date === today && m(time) - now < 90 && this.orders.some(o => o.tableId === id))) // a table in use now is not offered for the next 90 minutes
      .map(id => ({ tableId: id, seats: this.seatsOf(id) }))
  }
  private receiptOf(r: Reservation): ReservationReceipt { return { code: r.code!, name: r.name, date: r.date, time: r.time, party: r.party, tableId: r.tableId!, status: r.status, note: r.note, createdAt: r.createdAt ?? new Date().toISOString() } }
  async getAvailability(date: string, time: string, party: number) {
    await wait(150)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !(party >= 1 && party <= 20)) throw new ApiError(422, 'Nom et date valides requis.')
    return this.free(date, time, party)
  }
  async bookTable(input: BookingInput, key: string) {
    await wait()
    const hit = this.booked.get(key); if (hit) return structuredClone(hit) // a retry never creates a second booking
    const phone = input.phone.replace(/\D/g, ''), today = new Date().toISOString().slice(0, 10), at = new Date(`${input.date}T${input.time}:00`)
    if (input.name.trim().length < 2 || phone.length < 8 || !(input.party >= 1 && input.party <= 20)) throw new ApiError(422, 'Nom et téléphone valides requis.')
    if (!(+at > Date.now())) throw new ApiError(422, 'Choisissez une date et une heure à venir.')
    if (+at > Date.now() + 60 * 86400000) throw new ApiError(422, 'Réservation possible jusqu’à 60 jours à l’avance.')
    const { opens, closes } = this.settings.restaurant
    if (input.time < opens || input.time > closes) throw new ApiError(422, 'Le restaurant est fermé à cette heure.')
    if (this.reservations.filter(x => x.phone.replace(/\D/g, '') === phone && ['pending', 'confirmed'].includes(x.status) && x.date >= today).length >= 2) throw new ApiError(429, 'Trop de demandes pour ce numéro. Appelez le restaurant.')
    if (!this.free(input.date, input.time, input.party).some(t => t.tableId === input.tableId)) throw new ApiError(409, 'Cette table n’est plus disponible à cette heure.')
    const r: Reservation = { id: `res${this.reservations.length + 1}`, name: input.name.trim(), phone: input.phone.trim(), date: input.date, time: input.time, party: input.party, tableId: input.tableId, status: 'pending', code: this.resCode(), note: input.note?.trim() || undefined, createdAt: new Date().toISOString() }
    this.reservations.push(r); const rc = this.receiptOf(r); this.booked.set(key, rc); this.emit(); return structuredClone(rc)
  }
  async getReceipt(code: string) { await wait(150); const r = this.reservations.find(x => x.code === code.trim().toUpperCase()); if (!r) throw new ApiError(404, 'Reçu introuvable.'); return this.receiptOf(r) }
  async findReservation(code: string) { await wait(100); this.need('reservations'); return structuredClone(this.reservations.find(x => x.code === code.trim().toUpperCase()) ?? null) }
  async listAudit() { await wait(); this.need('audit'); return structuredClone([...this.log].reverse()) }
  async me() { await wait(100); return this.fresh() }
  async listRoles() { await wait(100); if (!this.fresh()) throw new ApiError(401, 'Connexion requise.'); return structuredClone(this.roles) }
  async saveRole(r: { id?: string; name: string; permissions: Permission[] }): Promise<RoleDef> {
    await wait(); this.need('team'); const me = this.fresh()!
    if (!r.name.trim()) throw new ApiError(422, 'Nom du rôle requis.')
    if (!r.permissions.every(p => me.permissions.includes(p))) throw new ApiError(403, 'Vous ne pouvez pas attribuer un rôle plus puissant que le vôtre.')
    const ex = r.id ? this.roles.find(x => x.id === r.id) : undefined
    if (r.id && !ex) throw new ApiError(404, 'Rôle introuvable.')
    if (ex?.system) throw new ApiError(403, 'Le rôle Propriétaire ne peut pas être modifié.')
    if (ex && ex.id === me.role) throw new ApiError(403, 'Vous ne pouvez pas modifier votre propre rôle.')
    const perms = [...new Set(r.permissions)]
    if (ex) { ex.name = r.name.trim(); ex.permissions = perms; return structuredClone(ex) }
    const n: RoleDef = { id: `r${this.roles.length + 1}${Date.now() % 1000}`, name: r.name.trim(), permissions: perms }
    this.roles.push(n); return structuredClone(n)
  }
  async deleteRole(id: string) {
    await wait(); this.need('team')
    const r = this.roles.find(x => x.id === id); if (!r) throw new ApiError(404, 'Rôle introuvable.')
    if (r.system) throw new ApiError(403, 'Le rôle Propriétaire ne peut pas être modifié.')
    if (this.accounts.some(a => a.role === id)) throw new ApiError(409, 'Ce rôle est attribué à des membres.')
    this.roles = this.roles.filter(x => x.id !== id)
  }
  async login(email: string, password: string) {
    await wait()
    const a = this.accounts.find(x => x.email === email.trim().toLowerCase() && x.pw === password && x.active)
    if (!a) throw new ApiError(401, 'Email ou mot de passe incorrect.') // same message for unknown email and wrong password
    this.user = { name: a.name, email: a.email, role: a.role, roleName: '', permissions: [] }
    try { sessionStorage.setItem('rp-session', JSON.stringify(this.user)) } catch { /* demo only */ }
    return this.fresh()!
  }
  async logout() { this.user = null; try { sessionStorage.removeItem('rp-session') } catch { /* ignore */ } }
  async requestReset(_email: string) { await wait() } // always succeeds, never reveals whether the account exists
  async getSettings() { await wait(100); if (!this.user) throw new ApiError(401, 'Connexion requise.'); return structuredClone(this.settings) }
  async getPublicSettings() { await wait(100); const { restaurant, payments } = this.settings; return structuredClone({ restaurant, payments }) }
  async saveSettings(s: Settings) {
    await wait(); this.need('settings')
    if (!s.restaurant.name.trim()) throw new ApiError(422, 'Le nom du restaurant est obligatoire.')
    if (!Object.values(s.payments).some(p => p.enabled)) throw new ApiError(422, 'Activez au moins un moyen de paiement.')
    // Swapping a payment number or QR is a classic way to divert money, so it gets its own audit entry.
    for (const m of Object.keys(s.payments) as PayMethod[]) if (s.payments[m].qrUrl !== this.settings.payments[m].qrUrl || s.payments[m].number !== this.settings.payments[m].number) this.audit('Coordonnées de paiement modifiées', m)
    this.settings = structuredClone(s); return structuredClone(this.settings)
  }
  async listStaff(): Promise<Staff[]> { await wait(); this.need('team'); return this.accounts.map(({ pw: _pw, ...s }) => s) }
  async saveStaff(s: Omit<Staff, 'id'> & { id?: string }): Promise<Staff & { tempPassword?: string }> {
    await wait(); this.need('team')
    if (!s.name.trim() || !/^\S+@\S+\.\S+$/.test(s.email)) throw new ApiError(422, 'Nom et email valides requis.')
    const a = this.accounts.find(x => x.id === s.id)
    const me = this.fresh()!, rd = this.roles.find(r => r.id === s.role)
    if (!rd) throw new ApiError(422, 'Rôle inconnu.')
    if ((rd.id === 'owner' || a?.role === 'owner') && me.role !== 'owner') throw new ApiError(403, 'Seul le propriétaire peut gérer les propriétaires.')
    if (!rd.permissions.every(p => me.permissions.includes(p))) throw new ApiError(403, 'Vous ne pouvez pas attribuer un rôle plus puissant que le vôtre.')
    if (a) {
      if (a.email === this.user!.email && (s.role !== a.role || !s.active)) throw new ApiError(422, 'Vous ne pouvez pas modifier votre propre rôle.')
      Object.assign(a, { name: s.name, role: s.role, active: s.active }); const { pw: _p, ...o } = a; return o
    }
    if (this.accounts.some(x => x.email === s.email.toLowerCase())) throw new ApiError(409, 'Cet email est déjà utilisé.')
    const n = { id: `u${this.accounts.length + 1}`, name: s.name, email: s.email.toLowerCase(), role: s.role, active: true, pw: this.newCode() + this.newCode().slice(0, 2) } // shown once to the owner, never stored in clear in a real system
    this.accounts.push(n); const { pw: _p, ...o } = n; return { ...o, tempPassword: n.pw }
  }
  async saveMenuItem(m: Partial<MenuItem> & { name: string; priceXaf: number; category: string }) {
    await wait(); this.need('menu')
    if (!m.name.trim() || !Number.isInteger(m.priceXaf) || m.priceXaf <= 0) throw new ApiError(422, 'Nom et prix valides requis.')
    const i = MOCK_MENU.findIndex(x => x.id === m.id)
    if (i >= 0) { MOCK_MENU[i] = { ...MOCK_MENU[i]!, ...m }; return structuredClone(MOCK_MENU[i]!) }
    const n: MenuItem = { cooking: false, available: true, ...m, id: `m${MOCK_MENU.length + 1}` }
    MOCK_MENU.push(n); return structuredClone(n)
  }
  async addTable() {
    await wait(); this.need('settings')
    const id = String(Math.max(...this.tableIds.map(Number)) + 1)
    this.tableIds.push(id); this.codes.set(id, { code: this.newCode(), at: new Date().toISOString() })
  }
  async listTableCodes(): Promise<TableCode[]> {
    await wait(); this.need('settings')
    return this.tableIds.map(tableId => ({ tableId, code: this.codes.get(tableId)!.code, rotatedAt: this.codes.get(tableId)!.at }))
  }
  async rotateTableCode(tableId: string): Promise<TableCode> {
    await wait(); this.need('settings')
    if (!this.tableIds.includes(tableId)) throw new ApiError(404, 'Table introuvable.')
    const v = { code: this.newCode(), at: new Date().toISOString() }; this.codes.set(tableId, v) // the old code stops working immediately
    return { tableId, code: v.code, rotatedAt: v.at }
  }
  async removeTable(id: string) {
    await wait(); this.need('settings')
    if (this.bill(id).totalXaf > 0) throw new ApiError(409, 'Table occupée : impossible de la supprimer.')
    this.tableIds = this.tableIds.filter(x => x !== id); this.codes.delete(id)
  }
  async getOverview(): Promise<Overview> {
    await wait(); this.need('dashboard')
    const bills = this.tableIds.map(id => this.bill(id))
    const sum = (m: PayMethod) => this.ledger.filter(x => x.m === m).reduce((a, x) => a + x.a, 0)
    const serie = (v: number) => [0.55, 0.7, 0.62, 0.9, 0.78, 1, 0.85, 0.95].map(f => Math.round(Math.max(v, 1) * f))
    const kpi = (id: Overview['kpis'][number]['id'], value: number, deltaPct: number) => ({ id, value, deltaPct, series: serie(value) })
    const months = Array.from({ length: 8 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 7 + i); return d.toISOString().slice(0, 7) })
    const staff: Record<string, number> = {}
    this.orders.forEach(o => { staff[o.waiterName] = (staff[o.waiterName] ?? 0) + 1 })
    return {
      sample: true,
      kpis: [kpi('collected', this.ledger.reduce((a, x) => a + x.a, 0), 12.4), kpi('orders', this.n - 1039, -4.2), kpi('tables', bills.filter(b => b.totalXaf > 0).length, 8.1), kpi('outstanding', bills.reduce((a, b) => a + b.remainingXaf, 0), -20.1)],
      monthly: months.map((month, i) => ({ month, billedXaf: Math.round([2.1, 2.4, 2.2, 2.9, 2.6, 3.1, 2.8, 3.3][i]! * 1e6), collectedXaf: Math.round([1.9, 2.2, 2.1, 2.6, 2.4, 2.9, 2.6, 3.0][i]! * 1e6) })),
      recent: [...this.orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6)
        .map(o => ({ id: o.id, number: o.number, dishes: o.lines.map(l => l.name).join(', '), tableId: o.tableId, status: o.status, at: o.createdAt, totalXaf: o.lines.reduce((a, l) => a + l.qty * l.unitXaf, 0) })),
      paymentMix: (['cash', 'mtn_momo', 'orange_money'] as PayMethod[]).map(method => ({ method, amountXaf: sum(method) })),
      topDishes: [...this.sold].sort((a, b) => b[1] - a[1]).slice(0, 4).flatMap(([id, orders]) => { const m = MOCK_MENU.find(x => x.id === id); return m ? [{ id, name: m.name, imageUrl: m.imageUrl, priceXaf: m.priceXaf, orders }] : [] }),
      team: Object.entries(this.placed).map(([name, orders]) => ({ name, role: 'Serveur', orders, cancelled: this.cancelled[name] ?? 0 })),
    }
  }
  async getBill(id: string) { await wait(); return structuredClone(this.bill(id)) }
  async listTables(): Promise<TableView[]> {
    await wait()
    return this.tableIds.map(id => {
      const b = this.bill(id), first = this.orders.find(o => o.tableId === id)
      return { id, label: `Table ${id}`, seats: this.seatsOf(id), session: first ? { id: `s${id}`, openedAt: first.createdAt } : null, billTotalXaf: b.totalXaf, paidXaf: b.paidXaf }
    })
  }
  async submitOrder(input: SubmitOrderInput, key: string, channel: Order['channel'] = 'waiter') {
    await wait()
    const hit = this.seen.get(key) as Order | undefined; if (hit) return structuredClone(hit) // idempotent retry
    const lines = input.lines.map((l, i) => {
      const m = MOCK_MENU.find(x => x.id === l.menuItemId)
      if (!m || !m.available || l.qty < 1) throw new ApiError(422, 'Plat indisponible.')
      const extra = l.modifiers.includes('Sauce piquante') ? 500 : 0 // the server prices, never the client
      return { id: `l${this.n}-${i}`, name: m.name, qty: l.qty, unitXaf: m.priceXaf + extra, modifiers: l.modifiers, note: l.note, prep: m.prep ?? 'made' }
    })
    const o: Order = { id: `o${++this.n}`, number: this.n, tableId: input.tableId, status: lines.every(l => l.prep === 'ready') ? 'ready' : 'submitted', createdAt: new Date().toISOString(), waiterName: channel === 'qr' ? 'Client' : (this.user?.name ?? 'Marc'), channel, lines, version: 1, placedBy: channel === 'qr' ? undefined : this.user?.email }
    input.lines.forEach(l => this.sold.set(l.menuItemId, (this.sold.get(l.menuItemId) ?? 0) + l.qty))
    if (channel !== 'qr') { const w = this.user?.name ?? 'Marc'; this.placed[w] = (this.placed[w] ?? 0) + 1 }
    this.orders.push(o); this.seen.set(key, o); this.emit(); return structuredClone(o)
  }
  async transitionOrder(id: string, to: OrderStatus, version: number) {
    await wait()
    const o = this.orders.find(x => x.id === id); if (!o) throw new ApiError(404, 'Commande introuvable.')
    if (o.version !== version) throw new ApiError(409, 'Cette commande vient d’être modifiée. L’écran se met à jour.')
    if (!canMove(o.status, to)) throw new ApiError(422, 'Ce changement d’état n’est pas autorisé.')
    o.status = to; o.version++; this.emit(); return structuredClone(o)
  }
  async recordPayment(tableId: string, input: RecordPaymentInput, key: string) {
    await wait()
    const hit = this.seen.get(key) as Receipt | undefined; if (hit) return structuredClone(hit) // duplicate request never double-counts
    const b = this.bill(tableId)
    if (!Number.isInteger(input.amountXaf) || input.amountXaf <= 0) throw new ApiError(422, 'Montant invalide.')
    if (input.amountXaf > b.remainingXaf) throw new ApiError(422, 'Le montant dépasse le solde restant.')
    if (input.method === 'cash' && !this.shiftOf()) throw new ApiError(409, 'Ouvrez la caisse avant d’encaisser en espèces.')
    // Mobile Money: the staff member confirms the money arrived on the restaurant's phone. No transaction reference is collected.
    if (input.method !== 'cash' && !input.verified) throw new ApiError(422, 'Confirmez que le paiement est arrivé sur le téléphone du restaurant.')
    const p: Payment = { id: `p${++this.r}`, amountXaf: input.amountXaf, method: input.method, reference: input.reference, at: new Date().toISOString() }
    this.pays.set(tableId, [...(this.pays.get(tableId) ?? []), p]); this.payRecs.push({ id: p.id, tableId, amountXaf: p.amountXaf, method: p.method, at: p.at, refundedXaf: 0 }); if (p.method === 'cash') this.shiftOf()!.cashSales += p.amountXaf
    const remainingXaf = b.remainingXaf - p.amountXaf
    const rc: Receipt = { number: this.r, tableId, discountXaf: b.discountXaf || undefined, waiterName: this.orders.find(o => o.tableId === tableId)?.waiterName, lines: b.lines, totalXaf: b.totalXaf, amountXaf: p.amountXaf, method: p.method, remainingXaf, at: p.at }
    if (remainingXaf === 0) { this.orders = this.orders.filter(o => o.tableId !== tableId); this.pays.delete(tableId); this.discounts.delete(tableId) } // session closes only when the balance is zero
    this.seen.set(key, rc); this.emit(); return structuredClone(rc)
  }
  private table(token: string) {
    const hit = [...this.codes].find(([, c]) => c.code === token.trim().toUpperCase())
    if (!hit) throw new ApiError(404, 'Code de table inconnu.')
    return hit[0]
  }
  async customerOrders(token: string) { await wait(); const t = this.table(token); return structuredClone(this.orders.filter(o => o.tableId === t && o.channel === 'qr')) }
  async customerSubmit(token: string, input: Omit<SubmitOrderInput, 'tableId'>, key: string) {
    return this.submitOrder({ ...input, tableId: this.table(token) }, key, 'qr') // same pricing and validation as staff orders
  }
  async requestService(token: string, kind: ServiceKind) {
    await wait(); const t = this.table(token)
    const open = this.reqs.find(r => r.tableId === t && r.kind === kind && r.state !== 'done')
    if (open) return structuredClone(open) // repeated taps never create a second open request
    const r: ServiceRequest = { id: `r${this.reqs.length + 1}`, tableId: t, kind, state: 'open', createdAt: new Date().toISOString() }
    this.reqs.push(r); this.emit(); return structuredClone(r)
  }
  subscribe(f: (e: ServerEvent) => void) { this.subs.add(f); return () => { this.subs.delete(f) } }
}
