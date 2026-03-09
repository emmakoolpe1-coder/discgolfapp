import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Bump this on each deploy so clients clear caches and reload
export const APP_VERSION = '1.0.1'

const VERSION_STORAGE_KEY = 'discgolf_app_version'

async function ensureVersionAndCaches() {
  try {
    const stored = localStorage.getItem(VERSION_STORAGE_KEY)
    if (stored !== APP_VERSION) {
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.map((name) => caches.delete(name)))
      }
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION)
      window.location.reload()
      return false
    }
  } catch (_) {}
  return true
}

function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onNeedRefresh() {},
      onOfflineReady() {},
      onRegistered(registration) {
        if (!registration) return

        // Ensure we always move to the latest SW as soon as it's available.
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        registration.update()
        setInterval(() => registration.update(), 60 * 60 * 1000)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update()
        })
      },
      onRegisterError(e) {
        console.error('SW registration failed', e)
      },
    })
  }).catch(() => {})
}

async function init() {
  const root = document.getElementById('root')
  if (!root) return

  // Render the app first so the user never sees a white screen while version check runs.
  try {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (err) {
    console.error('App render failed', err)
    root.innerHTML = '<div style="padding:1rem;font-family:sans-serif;color:#b91c1c;">Failed to load app. Check the console.</div>'
    return
  }

  const shouldContinue = await ensureVersionAndCaches()
  if (!shouldContinue) return // reload already triggered
  registerServiceWorker()
}

init().catch((err) => {
  console.error('Init failed', err)
  const root = document.getElementById('root')
  if (root) root.innerHTML = '<div style="padding:1rem;font-family:sans-serif;color:#b91c1c;">Failed to start. Check the console.</div>'
})
