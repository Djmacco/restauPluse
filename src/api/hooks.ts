import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enqueue } from './queue'
import { learn } from '../i18n'
import { ApiError, HttpClient, MockClient, type ApiClient } from './client'
import type { BookingInput, Order, Settings, SignupInput, OrderStatus, RecordPaymentInput, ServiceKind, SubmitOrderInput } from '../domain/types'

const url = import.meta.env.VITE_API_URL as string | undefined
export const api: ApiClient = url ? new HttpClient(url) : new MockClient()

// Socket events never patch the cache. They only trigger a refetch, so the database stays the source of truth.
function useLiveInvalidate(keys: string[]) {
  const qc = useQueryClient()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => api.subscribe(() => keys.forEach(k => qc.invalidateQueries({ queryKey: [k] }))), [qc])
}
// Polling and focus refetch cover the case where the socket drops silently.
const live = { refetchInterval: 20_000, refetchOnWindowFocus: true } as const

export const useOrders = (enabled = true) => {
  useLiveInvalidate(['orders', 'tables'])
  return useQuery({ queryKey: ['orders'], queryFn: () => api.listOrders(), enabled, ...live })
}
export const useTables = () => {
  useLiveInvalidate(['orders', 'tables'])
  return useQuery({ queryKey: ['tables'], queryFn: () => api.listTables(), ...live })
}

export function useTransition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; to: OrderStatus; version: number }) => api.transitionOrder(v.id, v.to, v.version),
    // Refetch on success and on failure, so a 409 shows the order's real current state.
    onSettled: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['tables'] }) },
  })
}

export function useSubmitOrder() {
  const qc = useQueryClient()
  // One key per cart, reused on retry, so a timeout cannot create a duplicate order.
  const key = useRef(crypto.randomUUID())
  return useMutation({
    mutationFn: async (i: SubmitOrderInput): Promise<Order | 'queued'> => {
      try {
        if (!navigator.onLine) throw new ApiError(0, 'Connexion perdue. Rien n’a été enregistré.')
        return await api.submitOrder(i, key.current)
      } catch (e) {
        // No network: keep the order on this phone with the same key. It is sent when the signal returns, and the server ignores a repeat.
        if (e instanceof ApiError && e.status === 0) { enqueue(i, key.current); return 'queued' }
        throw e
      }
    },
    onSuccess: () => { key.current = crypto.randomUUID(); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['tables'] }) },
  })
}

export const useOnline = () => useSyncExternalStore(
  cb => { addEventListener('online', cb); addEventListener('offline', cb); return () => { removeEventListener('online', cb); removeEventListener('offline', cb) } },
  () => navigator.onLine)

export function useNow(ms = 1000) {
  const [t, setT] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setT(Date.now()), ms); return () => clearInterval(i) }, [ms])
  return t
}

// table: a customer's table code (string), nothing for staff (undefined), or null to wait until the code is known.
export const useMenu = (table?: string | null) => useQuery({ queryKey: ['menu', table ?? 'staff'], enabled: table !== null, queryFn: async () => { const m = await api.listMenu(table ?? undefined); learn(Object.fromEntries(m.filter(x => x.nameEn).map(x => [x.name, x.nameEn!]))); return m }, staleTime: 60_000 })
export const useBill = (tableId: string | null) => {
  useLiveInvalidate(['bill'])
  return useQuery({ queryKey: ['bill', tableId], queryFn: () => api.getBill(tableId!), enabled: !!tableId, ...live })
}
export function useRecordPayment() {
  const qc = useQueryClient()
  const key = useRef(crypto.randomUUID())
  return useMutation({
    mutationFn: (v: { tableId: string; input: RecordPaymentInput }) => api.recordPayment(v.tableId, v.input, key.current),
    onSuccess: () => { key.current = crypto.randomUUID() },
    // A rejected request was not applied, so the next attempt gets a fresh key. Network failures keep the key for a safe retry.
    onError: e => { if (e instanceof ApiError && e.status >= 400) key.current = crypto.randomUUID() },
    onSettled: () => ['bill', 'tables', 'orders', 'overview'].forEach(k => qc.invalidateQueries({ queryKey: [k] })),
  })
}

// Public customers poll instead of opening a staff socket. The server stays the source of truth.
export const useCustomerOrders = (token: string | null) =>
  useQuery({ queryKey: ['customer', token], queryFn: () => api.customerOrders(token!), enabled: !!token, refetchInterval: 10_000, refetchOnWindowFocus: true, retry: false })
export function useCustomerSubmit(token: string) {
  const qc = useQueryClient()
  const key = useRef(crypto.randomUUID())
  return useMutation({
    mutationFn: (i: Omit<SubmitOrderInput, 'tableId'>) => api.customerSubmit(token, i, key.current),
    onSuccess: () => { key.current = crypto.randomUUID(); qc.invalidateQueries({ queryKey: ['customer'] }) },
  })
}
export const useServiceRequest = (token: string) => useMutation({ mutationFn: (k: ServiceKind) => api.requestService(token, k) })

export const useOverview = () => {
  useLiveInvalidate(['overview'])
  return useQuery({ queryKey: ['overview'], queryFn: () => api.getOverview(), ...live })
}

export const useRequests = () => {
  useLiveInvalidate(['requests'])
  return useQuery({ queryKey: ['requests'], queryFn: () => api.listRequests(), refetchInterval: 10_000, refetchOnWindowFocus: true })
}
export function useUpdateRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; state: 'acknowledged' | 'done' }) => api.updateRequest(v.id, v.state),
    onSettled: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  })
}

// Session and configuration
export const useSession = () => useQuery({ queryKey: ['session'], queryFn: () => api.me(), staleTime: 60_000, refetchOnWindowFocus: true, retry: false })
export function useLogin() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (v: { email: string; password: string }) => api.login(v.email, v.password), onSuccess: s => { qc.clear(); qc.setQueryData(['session'], s) } })
}
export function useLogout() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: () => api.logout(), onSettled: () => { qc.clear(); qc.setQueryData(['session'], null) } })
}
export const useReset = () => useMutation({ mutationFn: (email: string) => api.requestReset(email) })
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => api.getSettings(), staleTime: 30_000 })
export const usePublicSettings = (table?: string | null) => useQuery({ queryKey: ['public-settings', table ?? ''], enabled: table !== null, queryFn: () => api.getPublicSettings(table ?? undefined), staleTime: 30_000 })
export const useStaff = () => useQuery({ queryKey: ['staff'], queryFn: () => api.listStaff() })
function useAct<V, R>(fn: (v: V) => Promise<R>, keys: string[]) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => keys.forEach(k => qc.invalidateQueries({ queryKey: [k] })) })
}
export const useSaveSettings = () => useAct((s: Settings) => api.saveSettings(s), ['settings', 'public-settings'])
export const useSaveStaff = () => useAct((s: Parameters<ApiClient['saveStaff']>[0]) => api.saveStaff(s), ['staff'])
export const useSaveMenuItem = () => useAct((m: Parameters<ApiClient['saveMenuItem']>[0]) => api.saveMenuItem(m), ['menu', 'overview'])
export const useTableAdmin = () => useAct((a: { add: true } | { remove: string }) => ('add' in a ? api.addTable() : api.removeTable(a.remove)), ['tables', 'overview', 'codes'])
export const useTableCodes = () => useQuery({ queryKey: ['codes'], queryFn: () => api.listTableCodes() })
export const useRotateCode = () => useAct((id: string) => api.rotateTableCode(id), ['codes'])
export const useRoles = () => useQuery({ queryKey: ['roles'], queryFn: () => api.listRoles() })
export const useSaveRole = () => useAct((r: Parameters<ApiClient['saveRole']>[0]) => api.saveRole(r), ['roles', 'session', 'staff'])
export const useDeleteRole = () => useAct((id: string) => api.deleteRole(id), ['roles'])

// Cash register, refunds, orders, reservations, audit
export const useShift = () => useQuery({ queryKey: ['shift'], queryFn: () => api.currentShift(), retry: false })
export const useOpenShift = () => useAct((v: number) => api.openShift(v), ['shift'])
export const useCashMove = () => useAct((v: { kind: 'in' | 'out'; amount: number; reason: string }) => api.cashMovement(v.kind, v.amount, v.reason), ['shift'])
export const useCloseShift = () => useAct((v: { counted: number; note: string }) => api.closeShift(v.counted, v.note), ['shift', 'audit'])
export const usePayments = () => useQuery({ queryKey: ['payments'], queryFn: () => api.listPayments() })
export const useRefund = () => useAct((v: { id: string; amount: number; reason: string }) => api.refundPayment(v.id, v.amount, v.reason), ['payments', 'shift', 'overview', 'audit'])
export const useDiscount = () => useAct((v: { tableId: string; amount: number; reason: string }) => api.applyDiscount(v.tableId, v.amount, v.reason), ['bill', 'tables', 'audit'])
export const useCancelOrder = () => useAct((v: { id: string; version: number; reason: string }) => api.cancelOrder(v.id, v.version, v.reason), ['orders', 'tables', 'overview', 'audit'])
export const useReservations = (date: string) => useQuery({ queryKey: ['reservations', date], queryFn: () => api.listReservations(date) })
export const useSaveReservation = () => useAct((r: Parameters<ApiClient['saveReservation']>[0]) => api.saveReservation(r), ['reservations'])
export const useSetReservation = () => useAct((v: { id: string; status: Parameters<ApiClient['setReservationStatus']>[1] }) => api.setReservationStatus(v.id, v.status), ['reservations'])
export const useAudit = () => useQuery({ queryKey: ['audit'], queryFn: () => api.listAudit(), refetchInterval: 15_000 })

// Public booking and receipts
export const useAvailability = (date: string, time: string, party: number, on: boolean) => useQuery({ queryKey: ['availability', date, time, party], queryFn: () => api.getAvailability(date, time, party), enabled: on, retry: false })
export function useBook() {
  const key = useRef(crypto.randomUUID()) // retries of the same form reuse the key, so no duplicate booking
  return useMutation({ mutationFn: (i: BookingInput) => api.bookTable(i, key.current), onSuccess: () => { key.current = crypto.randomUUID() } })
}
export const useReceipt = (code: string | null) => useQuery({ queryKey: ['receipt', code], queryFn: () => api.getReceipt(code!), enabled: !!code, retry: false, refetchInterval: 20_000 })
export const useFindReservation = (code: string) => useQuery({ queryKey: ['reservations', 'code', code], queryFn: () => api.findReservation(code), enabled: code.trim().length >= 6 })

// Closing with an unpaid balance, history, daily report, pending bookings
export const useCloseTable = () => useAct((v: { tableId: string; reason: string }) => api.closeTable(v.tableId, v.reason), ['tables', 'bill', 'orders', 'overview', 'audit', 'history', 'report'])
export const useOrderHistory = (from: string, to: string, on: boolean) => useQuery({ queryKey: ['history', from, to], queryFn: () => api.listOrderHistory(from, to), enabled: on })
export const useDailyReport = (date: string) => useQuery({ queryKey: ['report', date], queryFn: () => api.getDailyReport(date) })
export const usePendingReservations = (enabled: boolean) => useQuery({ queryKey: ['reservations', 'pending'], queryFn: () => api.listPendingReservations(), enabled, refetchInterval: 20_000, refetchOnWindowFocus: true })
export function useSignup() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (i: SignupInput) => api.signup(i), onSuccess: s => { qc.clear(); qc.setQueryData(['session'], s) } }) // the owner is signed in straight away
}
