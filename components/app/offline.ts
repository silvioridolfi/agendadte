'use client'

// Uso sin conexión: las acciones cargadas sin señal quedan en este dispositivo y se envían al volver la conexión.
// La agenda también guarda una copia de lo último que se vio para poder consultarla sin señal.
import * as api from '@/app/actions'
import type { AgendaItem, AgendaItemInput } from '@/lib/agenda'

const COLA = 'agenda-territorial:pendientes'
const CACHE = 'agenda-territorial:cache:'
type Pendiente = { input: AgendaItemInput, id?: string, ts: number }

function leer<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
function escribir(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* sin espacio o bloqueado: se ignora */ }
}

export function encolarOffline(input: AgendaItemInput, id?: string) {
  escribir(COLA, [...leer<Pendiente[]>(COLA, []), { input, id, ts: Date.now() }])
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
      const r = await api.saveItem(p.input, p.id)
      if (r.ok) enviadas++
      else { fallidas.push(`${p.input.accion} del ${p.input.fecha}: ${r.error}`) }
    } catch { quedan.push(p) }
  }
  escribir(COLA, quedan)
  window.dispatchEvent(new Event('agenda-pendientes'))
  return { enviadas, fallidas }
}

export function guardarCache(clave: string, items: AgendaItem[]) { escribir(CACHE + clave, { ts: Date.now(), items }) }
export function leerCache(clave: string): { ts: number, items: AgendaItem[] } | null { return leer(CACHE + clave, null) }
