// Reuniones presenciales, virtuales o híbridas: la modalidad se elige al agendarlas y, si no son presenciales, se puede guardar el enlace
// de la videollamada (Meet, Zoom…) para abrirla con un toque.
import type { Accion, ModalidadEvento } from '@/lib/agenda'

export const ACCIONES_REUNION: Accion[] = ['REUNIÓN', 'REUNIÓN CON JEFATURA', 'REUNIÓN CON INSPECCIÓN', 'REUNIÓN CON NIVEL CENTRAL', 'ARTICULACIÓN MUNICIPAL']
export const esReunion = (a: Accion | null | undefined) => !!a && ACCIONES_REUNION.includes(a)
// Virtual o híbrida: no depende de un lugar físico y puede tener enlace.
export const conEnlace = (m: ModalidadEvento | string | null | undefined) => m === 'Virtual' || m === 'Híbrido'

export const MENSAJE_ENLACE = 'El enlace debe empezar con https:// (ej.: https://meet.google.com/abc-defg-hij).'
// Enlace listo para guardar: sólo https (nada de javascript: ni http), sin espacios; si falta el "https://" y parece una dirección, se lo agrega.
export function normalizarEnlace(s: string | null | undefined): string | null {
  let e = (s ?? '').trim()
  if (!e) return null
  if (!/^[a-z][a-z0-9+.-]*:/i.test(e) && /^[\w-]+(\.[\w-]+)+(\/|$)/.test(e)) e = `https://${e}`
  if (!/^https:\/\/[^\s/]+\S*$/i.test(e) || e.length > 500) throw new Error(MENSAJE_ENLACE)
  return e
}
// Enlace de una acción: sólo las reuniones no presenciales lo guardan; en el resto queda vacío.
export const enlaceDe = (accion: Accion | null | undefined, modalidad: ModalidadEvento | string | null | undefined, enlace: string | null | undefined) =>
  esReunion(accion) && conEnlace(modalidad) ? normalizarEnlace(enlace) : null
