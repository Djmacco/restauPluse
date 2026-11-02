// Money is stored as integer XAF (no minor units). Never use floats for amounts.
export type OrderStatus = 'submitted' | 'accepted' | 'preparing' | 'ready' | 'served' | 'cancelled'

// Mirrors the backend state machine. The server stays authoritative; this only
// decides which buttons to offer.
export const NEXT: Record<OrderStatus, OrderStatus[]> = {
  submitted: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served'],
  served: [],
  cancelled: [],
}
export const canMove = (from: OrderStatus, to: OrderStatus) => NEXT[from].includes(to)

// prep 'ready' = already prepared (drinks, pastries...), served straight away. Missing or 'made' = the kitchen prepares it.
export interface OrderLine { id: string; name: string; qty: number; unitXaf: number; modifiers: string[]; note?: string; prep?: 'ready' | 'made' }
export interface Order {
  id: string; number: number; tableId: string; status: OrderStatus
  createdAt: string // ISO, server clock
  waiterName: string; channel: 'qr' | 'waiter' | 'counter'
  lines: OrderLine[]
  version: number // optimistic concurrency token
  cancelReason?: string
  placedBy?: string // who placed it (email in the demo, user id in production)
  cancelledBy?: string; cancelledAt?: string
}
export interface TableView {
  id: string; label: string; seats: number
  session: { id: string; openedAt: string } | null
  billTotalXaf: number; paidXaf: number
}
export interface SubmitOrderInput {
  tableId: string
  // Client sends ids and quantities only. The server prices and validates.
  lines: { menuItemId: string; qty: number; modifiers: string[]; note?: string }[]
  // Customer flow extras. Payment preference is a hint for the cashier, not a payment.
  guestName?: string; guests?: number; payPreference?: PayMethod
}
export type ServerEvent = { type: 'orders.changed' } | { type: 'resync' }

export const balanceXaf = (t: TableView) => t.billTotalXaf - t.paidXaf
export const formatXaf = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ') + ' FCFA'
export const orderTotalXaf = (o: Order) => o.lines.reduce((a, l) => a + l.unitXaf * l.qty, 0)

export interface MenuItem { id: string; name: string; priceXaf: number; category: string; cooking: boolean; available: boolean; prep?: 'ready' | 'made'; imageUrl?: string; oldPriceXaf?: number; stock?: number; promoEndsAt?: string }
export type PayMethod = 'cash' | 'mtn_momo' | 'orange_money'
export const METHOD_LABEL: Record<PayMethod, string> = { cash: 'Espèces', mtn_momo: 'MTN Mobile Money', orange_money: 'Orange Money' }
export interface Payment { id: string; amountXaf: number; method: PayMethod; reference?: string; at: string }
export interface Bill { discountXaf?: number; tableId: string; lines: OrderLine[]; totalXaf: number; paidXaf: number; remainingXaf: number; payments: Payment[] }
// The server decides whether a Mobile Money payment is accepted; `verified` is the cashier's manual check.
export interface RecordPaymentInput { method: PayMethod; amountXaf: number; reference?: string; verified?: boolean }
export interface Receipt { number: number; tableId: string; lines: OrderLine[]; totalXaf: number; amountXaf: number; method: PayMethod; remainingXaf: number; at: string; waiterName?: string; discountXaf?: number }

export type ServiceKind = 'waiter' | 'water' | 'bill'
export interface ServiceRequest { id: string; tableId: string; kind: ServiceKind; state: 'open' | 'acknowledged' | 'done'; createdAt: string }

export interface Overview {
  sample: boolean // true while history comes from demo data
  kpis: { id: 'collected' | 'orders' | 'tables' | 'outstanding'; value: number; deltaPct: number; series: number[] }[]
  monthly: { month: string; billedXaf: number; collectedXaf: number }[] // month = YYYY-MM
  recent: { id: string; number: number; dishes: string; tableId: string; status: OrderStatus; at: string; totalXaf: number }[]
  paymentMix: { method: PayMethod; amountXaf: number }[]
  topDishes: { id: string; name: string; imageUrl?: string; priceXaf: number; orders: number }[]
  team: { name: string; role: string; orders: number; cancelled: number }[]
}

export type Role = string // id of a role the owner or an administrator defined
export interface Session { name: string; email: string; role: Role; roleName: string; permissions: Permission[] }
export interface Staff { id: string; name: string; email: string; role: Role; active: boolean }
export interface PayConfig { enabled: boolean; number?: string; qrUrl?: string } // qrUrl: payment QR image (data URL in the demo)
export interface Settings {
  restaurant: { name: string; address: string; phone: string; opens: string; closes: string }
  payments: Record<PayMethod, PayConfig>
  receipt: { footer: string; prefix: string; taxId: string; paper: 58 | 80; showTable: boolean; showWaiter: boolean; logoUrl?: string }
}
export type PublicSettings = Pick<Settings, 'restaurant' | 'payments'>

export interface TableCode { tableId: string; code: string; rotatedAt: string }

export type Permission = 'dashboard' | 'orders' | 'kitchen' | 'cashier' | 'menu' | 'settings' | 'team' | 'reservations' | 'refunds' | 'audit' | 'cancel'
export const PERMISSIONS: [Permission, string][] = [['dashboard', 'Tableau de bord'], ['orders', 'Prise de commande'], ['kitchen', 'Cuisine'], ['cashier', 'Caisse'], ['menu', 'Gestion du menu'], ['settings', 'Paramètres du restaurant'], ['team', 'Équipe et rôles'], ['reservations', 'Réservations'], ['refunds', 'Remboursements et remises'], ['cancel', 'Annuler des commandes'], ['audit', 'Journal d’audit']]
export interface RoleDef { id: string; name: string; permissions: Permission[]; system?: boolean }
// Decides what to show. The server must check the permission on every request.
const OPEN: Record<string, Permission[]> = { admin: ['dashboard'], tables: ['orders'], kitchen: ['kitchen'], cashier: ['cashier'], settings: ['settings', 'menu', 'team'], orderlist: ['orders', 'dashboard'], reservations: ['reservations'], audit: ['audit'] }
export const canOpen = (s: Session, v: string) => OPEN[v]?.some(p => s.permissions.includes(p)) ?? false
export const homeView = (s: Session) => ['admin', 'tables', 'cashier', 'kitchen', 'reservations', 'orderlist', 'settings', 'audit'].find(v => canOpen(s, v)) ?? 'none'
export const can = (s: Session | null | undefined, p: Permission) => !!s?.permissions.includes(p)

export interface Shift { id: string; cashier: string; openedAt: string; openingXaf: number; closedAt?: string; countedXaf?: number; expectedXaf?: number; diffXaf?: number; note?: string; moves: { kind: 'in' | 'out' | 'refund'; amountXaf: number; reason: string; at: string }[] }
export interface PaymentRec { id: string; tableId: string; amountXaf: number; method: PayMethod; at: string; refundedXaf: number }
export type ResStatus = 'pending' | 'confirmed' | 'arrived' | 'cancelled' | 'noshow'
export interface Reservation { id: string; name: string; phone: string; date: string; time: string; party: number; tableId?: string; status: ResStatus; code?: string; note?: string; createdAt?: string }
export type ReservationInput = Omit<Reservation, 'id' | 'status'> & { id?: string }
export interface AuditEntry { id: string; at: string; actor: string; action: string; detail: string }
export interface BookingInput { name: string; phone: string; date: string; time: string; party: number; tableId: string; note?: string }
// What the guest keeps as proof. The code is unique and acts as the guest's key to read this one booking.
export interface ReservationReceipt { code: string; name: string; date: string; time: string; party: number; tableId: string; status: ResStatus; note?: string; createdAt: string }
