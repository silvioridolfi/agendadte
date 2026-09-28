'use client'

// Uso sin conexión: las acciones cargadas sin señal quedan en este dispositivo y se envían al volver la conexión.
// La agenda también guarda una copia de lo último que se vio para poder consultarla sin señal.
import * as api from '@/app/actions'
import type { AgendaItem, AgendaItemInput } from '@/lib/agenda'

const COLA = 'agenda-territorial:pendientes'
const CACHE = 'agenda-territorial:cache:'
// `visita`: visita con varias acciones cargada sin señal; se envía junta para que quede como una sola.
type Pendiente = { input: AgendaItemInput, id?: string, visita?: AgendaItemInput[], ts: number }

function leer<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
// Copias guardadas, de la más vieja a la más nueva.
function copias(): { key: string, ts: number }[] {
  try {
    return Object.keys(localStorage).filter(k => k.startsWith(CACHE))
      .map(key => { try { return { key, ts: (JSON.parse(localStorage.getItem(key) ?? '{}') as { ts?: number }).ts ?? 0 } } catch { return { key, ts: 0 } } })
      .sort((a, b) => a.ts - b.ts)
  } catch { return [] }
}
function escribir(key: string, value: unknown) {
  const texto = JSON.stringify(value)
  // Si no hay espacio, se liberan las copias más viejas (nunca la cola de pendientes) y se reintenta.
  for (let intento = 0; intento < 20; intento++) {
    try { localStorage.setItem(key, texto); return } catch {
      const vieja = copias().find(c => c.key !== key)
      if (!vieja) return
      try { localStorage.removeItem(vieja.key) } catch { return }
    }
  }
}

export function encolarOffline(input: AgendaItemInput, id?: string) {
  escribir(COLA, [...leer<Pendiente[]>(COLA, []), { input, id, ts: Date.now() }])
  window.dispatchEvent(new Event('agenda-pendientes'))
}

export function encolarVisitaOffline(inputs: AgendaItemInput[]) {
  escribir(COLA, [...leer<Pendiente[]>(COLA, []), { input: inputs[0], visita: inputs, ts: Date.now() }])
  window.dispatchEvent(new Event('agenda-pendientes'))
}

export const pendientes = () => leer<Pendiente[]>(COLA, []).length

// Envía la cola en orden. Las que fallan por un error del servidor quedan para revisar; las de red se reintentan después.
export async function sincronizarPendientes(): Promise<{ enviadas: number, fallidas: string[] }> {
  const cola = leer<Pendiente[]>(COLA, [])
  if (!cola.length || !navigator.onLine) return { enviadas: 0, fallidas: [] }
  const quedan: Pendiente[] = [], fallidas: string[] = []
  let enviadas = 0
  for (const p of cola) {
    try {
      if (p.visita) {
        // Si una acción de la visita falla, las anteriores ya quedaron guardadas: no se reintenta para no duplicarlas.
        const r = await api.guardarVisita(p.visita)
        if (!r.ok) fallidas.push(`Visita del ${p.input.fecha}: ${r.error}`)
        else { enviadas += r.data.guardadas.length; if (r.data.error) fallidas.push(`Visita del ${p.input.fecha}: no se pudo guardar ${r.data.error}`) }
        continue
      }
      const r = await api.saveItem(p.input, p.id)
      if (r.ok) enviadas++
      else { fallidas.push(`${p.input.accion} del ${p.input.fecha}: ${r.error}`) }
    } catch { quedan.push(p) }
  }
  escribir(COLA, quedan)
  window.dispatchEvent(new Event('agenda-pendientes'))
  return { enviadas, fallidas }
}

const MAX_COPIAS = 12
export function guardarCache(clave: string, items: AgendaItem[]) {
  escribir(CACHE + clave, { ts: Date.now(), items })
  const todas = copias()
  for (const c of todas.slice(0, Math.max(0, todas.length - MAX_COPIAS))) try { localStorage.removeItem(c.key) } catch { /* bloqueado */ }
}
export function leerCache(clave: string): { ts: number, items: AgendaItem[] } | null { return leer(CACHE + clave, null) }

// Al cerrar sesión se borran las copias (la cola de pendientes queda para no perder cargas sin enviar).
export function limpiarCache() { for (const c of copias()) try { localStorage.removeItem(c.key) } catch { /* bloqueado */ } }
