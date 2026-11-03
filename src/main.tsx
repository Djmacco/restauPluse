import { createRoot } from 'react-dom/client'
import './design.css'
import App from './App'
createRoot(document.getElementById('root')!).render(<App />)

// Installable app: caches the app shell so it opens without network. Data screens still need the network.
if ('serviceWorker' in navigator && import.meta.env.PROD) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
