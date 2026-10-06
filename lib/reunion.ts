// Reuniones presenciales, virtuales o híbridas: la modalidad se elige al agendarlas y, si no son presenciales, se puede guardar el enlace
// de la videollamada (Meet, Zoom…) para abrirla con un toque.
import type { Accion, ModalidadEvento } from '@/lib/agenda'

export const ACCIONES_REUNION: Accion[] = ['REUNIÓN', 'REUNIÓN CON JEFATURA', 'REUNIÓN CON INSPECCIÓN', 'REUNIÓN CON NIVEL CENTRAL', 'ARTICULACIÓN MUNICIPAL']
export const esReunion = (a: Accion | null | undefined) => !!a && ACCIONES_REUNION.includes(a)
// Virtual o híbrida: no depende de un lugar físico y puede tener enlace.
export const conEnlace = (m: ModalidadEvento | string | null | undefined) => m === 'Virtual' || m === 'Híbrido'

export const MENSAJE_ENLACE = 'No encontramos un enlace de videollamada. Pegá la dirección completa (ej.: https://meet.google.com/abc-defg-hij).'
// Enlace listo para guardar: sólo https (nada de javascript: ni ftp:). Si pegaron un texto más largo (la invitación de Meet o Zoom, por ejemplo),
// se toma la primera dirección que aparece; una dirección sin "https://" lo recibe, y "http://" pasa a "https://".
const sinPuntuacionFinal = (t: string) => t.replace(/[.,;:!?)\]}>'"]+$/, '')
export function normalizarEnlace(s: string | null | undefined): string | null {
  const texto = (s ?? '').trim()
  if (!texto) return null
  const conEsquema = texto.match(/https?:\/\/[^\s<>"']+/i)?.[0]
  const sinEsquema = texto.split(/\s+/).map(sinPuntuacionFinal).find(t => /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(t))
  let e = conEsquema ? sinPuntuacionFinal(conEsquema) : sinEsquema ? `https://${sinEsquema}` : texto
  e = e.replace(/^http:\/\//i, 'https://')
  if (!/^https:\/\/[^\s/]+\S*$/i.test(e) || e.length > 500) throw new Error(MENSAJE_ENLACE)
  return e
}
// Enlace de una acción: sólo las reuniones no presenciales lo guardan; en el resto queda vacío.
export const enlaceDe = (accion: Accion | null | undefined, modalidad: ModalidadEvento | string | null | undefined, enlace: string | null | undefined) =>
  esReunion(accion) && conEnlace(modalidad) ? normalizarEnlace(enlace) : null
