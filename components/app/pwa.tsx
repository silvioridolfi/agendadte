'use client'

import { useEffect } from 'react'

// Registra el service worker (sólo en producción) para poder instalar la app y abrirla sin conexión.
export function RegistrarPWA() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}
