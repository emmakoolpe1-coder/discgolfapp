import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { restoreUserData } from './services/firestoreService.js'
import { emailToUserId } from './firestoreSync.js'

export const APP_VERSION = '1.0.4'
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
  let swUpdateRequested = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!swUpdateRequested) return
    window.location.reload()
  })
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onNeedRefresh() {},
      onOfflineReady() {},
      onRegistered(registration) {
        if (!registration) return
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && registration.waiting) {
              swUpdateRequested = true
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

const THEME_KEY = 'discgolf_theme'

function applyTheme(theme) {
  const valid = ['light', 'dark', 'system'].includes(theme) ? theme : 'system'
  document.documentElement.setAttribute('data-theme', valid)
}

async function init() {
  const root = document.getElementById('root')
  if (!root) return

  // Apply theme before first paint to avoid flash
  try {
    const saved = localStorage.getItem(THEME_KEY) || 'system'
    applyTheme(saved)
  } catch (_) {}

  // Check version BEFORE rendering — avoids double flash
  const shouldContinue = await ensureVersionAndCaches()
  if (!shouldContinue) return

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

  registerServiceWorker()

  // Expose for emergency recovery from browser console: restoreUserData(uid), emailToUserId(email)
  if (typeof window !== 'undefined') {
    window.restoreUserData = restoreUserData
    window.emailToUserId = emailToUserId
  }
}

init().catch((err) => {
  console.error('Init failed', err)
  const root = document.getElementById('root')
  if (root) root.innerHTML = '<div style="padding:1rem;font-family:sans-serif;color:#b91c1c;">Failed to start. Check the console.</div>'
})