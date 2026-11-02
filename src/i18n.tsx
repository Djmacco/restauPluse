import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { EN } from './locales/en'

export type Lang = 'fr' | 'en'
const KEY = 'rp-lang'
let cur: Lang = 'fr' // French is the default
try { const s = localStorage.getItem(KEY); if (s === 'en' || s === 'fr') cur = s } catch { /* storage can be unavailable */ }

export const lang = () => cur
export const locale = () => (cur === 'en' ? 'en-GB' : 'fr-FR')
const Ctx = createContext<{ lang: Lang; set: (l: Lang) => void }>({ lang: 'fr', set: () => {} })

export function LangProvider({ children }: { children: ReactNode }) {
  const [l, setL] = useState<Lang>(cur)
  const set = (x: Lang) => { cur = x; try { localStorage.setItem(KEY, x) } catch { /* ignore */ } setL(x) }
  useEffect(() => { document.documentElement.lang = l }, [l])
  return <Ctx.Provider value={{ lang: l, set }}>{children}</Ctx.Provider>
}

// French text is the key. Unknown keys fall back to themselves, so a missing translation shows French, never a blank.
export const useT = () => { const { lang: l } = useContext(Ctx); return (k: string) => (l === 'en' ? EN[k] ?? k : k) }

export function LangSwitch() {
  const { lang: l, set } = useContext(Ctx)
  return (
    <div className="lang" role="group" aria-label="Langue / Language">
      {(['fr', 'en'] as Lang[]).map(x => <button key={x} lang={x} aria-pressed={l === x} onClick={() => set(x)}>{x.toUpperCase()}</button>)}
    </div>
  )
}
