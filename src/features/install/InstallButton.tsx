import { useEffect, useState } from 'react'
import { useT } from '../../i18n'

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
// The browser fires this once, often before React has mounted, so it is captured at load.
let deferred: InstallEvent | null = null
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; dispatchEvent(new Event('rp-install')) })
  addEventListener('appinstalled', () => { deferred = null; dispatchEvent(new Event('rp-install')) })
}

// Shows only when installing is really possible: Chrome, Edge and Android offer a prompt, iPhone and iPad need a hint, and an installed app shows nothing.
export function InstallButton({ className = 'btn s' }: { className?: string }) {
  const tx = useT(), [ready, setReady] = useState(!!deferred), [tip, setTip] = useState(false)
  useEffect(() => { const f = () => setReady(!!deferred); addEventListener('rp-install', f); return () => removeEventListener('rp-install', f) }, [])
  const installed = matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !!document.querySelector('link[rel=manifest]')
  if (installed || (!ready && !ios)) return null
  const click = async () => {
    if (!deferred) { setTip(!tip); return }
    await deferred.prompt(); await deferred.userChoice.catch(() => null)
    deferred = null; setReady(false)
  }
  return (
    <>
      <button className={className} onClick={click} aria-expanded={deferred ? undefined : tip}>{tx('Installer l’application')}</button>
      {tip && <p role="status" className="sm" style={{ margin: '6px 0 0', opacity: 0.85 }}>{tx('Touchez Partager, puis « Sur l’écran d’accueil ».')}</p>}
    </>
  )
}
