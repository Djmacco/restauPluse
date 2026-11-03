import type { SubmitOrderInput } from '../domain/types'

// Orders typed while offline wait here, on this phone, with the idempotency key they were first sent with.
export interface Queued { key: string; input: SubmitOrderInput; at: string; error?: string }
const K = 'rp-queue'
export const queued = (): Queued[] => { try { return JSON.parse(localStorage.getItem(K) ?? '[]') as Queued[] } catch { return [] } }
const write = (q: Queued[]) => { try { localStorage.setItem(K, JSON.stringify(q)); window.dispatchEvent(new Event('rp-queue')) } catch { /* storage full or blocked */ } }
export const enqueue = (input: SubmitOrderInput, key: string) => write([...queued().filter(q => q.key !== key), { key, input, at: new Date().toISOString() }])
export const markFailed = (key: string, error: string) => write(queued().map(q => (q.key === key ? { ...q, error } : q)))
export const drop = (key: string) => write(queued().filter(q => q.key !== key))
