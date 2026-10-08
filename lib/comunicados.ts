// Comunicados del CED a los FED (puro): validación, a quién le toca, estado y lecturas.
export const NIVELES_COMUNICADO = ['importante', 'informativo'] as const
export type NivelComunicado = (typeof NIVELES_COMUNICADO)[number]
export const NIVEL_COMUNICADO_LABEL: Record<NivelComunicado, string> = { importante: 'Importante', informativo: 'Informativo' }
export const MAX_TITULO_COMUNICADO = 80
export const MAX_TEXTO_COMUNICADO = 1500

export type Comunicado = {
  id: string, titulo: string, texto: string, nivel: NivelComunicado,
  // null = todos los FED.
  fed_ids: string[] | null, autor_id: string | null, vence_el: string | null, retirado: boolean, created_at: string, editado_at: string | null,
}
export type EntradaComunicado = { titulo: string, texto: string, nivel: NivelComunicado, fedIds: string[] | null, venceEl: string | null }

// Mensaje del primer problema, o null si está bien. `hoy`: aaaa-mm-dd.
export function validarComunicado(e: EntradaComunicado, hoy: string): string | null {
  const titulo = e.titulo.trim(), texto = e.texto.trim()
  if (!titulo) return 'Escribí el título'
  if (titulo.length > MAX_TITULO_COMUNICADO) return `El título admite hasta ${MAX_TITULO_COMUNICADO} caracteres`
  if (!texto) return 'Escribí el mensaje'
  if (texto.length > MAX_TEXTO_COMUNICADO) return `El mensaje admite hasta ${MAX_TEXTO_COMUNICADO} caracteres`
  if (!NIVELES_COMUNICADO.includes(e.nivel)) return 'Elegí el nivel del comunicado'
  if (e.fedIds && !e.fedIds.length) return 'Elegí al menos un FED, o mandalo a todos'
  if (e.venceEl && !/^\d{4}-\d{2}-\d{2}$/.test(e.venceEl)) return 'La fecha de vencimiento no es válida'
  if (e.venceEl && e.venceEl < hoy) return 'La fecha de vencimiento ya pasó'
  return null
}

export type EstadoComunicado = 'vigente' | 'vencido' | 'retirado'
export const estadoComunicado = (c: Pick<Comunicado, 'retirado' | 'vence_el'>, hoy: string): EstadoComunicado => (c.retirado ? 'retirado' : c.vence_el && c.vence_el < hoy ? 'vencido' : 'vigente')

// Los FED a los que les llega: los elegidos, o todos los FED (la coordinación no recibe).
export function destinatariosDe<T extends { id: string, rol: string }>(c: Pick<Comunicado, 'fed_ids'>, feds: T[]): T[] {
  return c.fed_ids ? feds.filter(f => c.fed_ids!.includes(f.id)) : feds.filter(f => f.rol === 'fed')
}
export const llegaA = (c: Pick<Comunicado, 'fed_ids'>, fed: { id: string, rol: string }) => (c.fed_ids ? c.fed_ids.includes(fed.id) : fed.rol === 'fed')

// Primero los importantes y, dentro de cada nivel, el más nuevo.
export const ordenarPendientes = <T extends { nivel: NivelComunicado, created_at: string }>(l: T[]): T[] =>
  [...l].sort((a, b) => Number(b.nivel === 'importante') - Number(a.nivel === 'importante') || b.created_at.localeCompare(a.created_at))

export const resumenLecturas = (dest: { leidoAt: string | null }[]) => ({ leidos: dest.filter(d => d.leidoAt).length, total: dest.length })

// Parte el texto en tramos de texto y enlaces (solo http y https), para mostrarlo sin inyectar HTML.
export type TramoTexto = { texto: string, enlace?: string }
export function tramosConEnlaces(t: string): TramoTexto[] {
  const out: TramoTexto[] = []
  let i = 0
  for (const m of t.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const ini = m.index ?? 0
    const url = m[0].replace(/[.,;:!?)\]]+$/, '')
    if (ini > i) out.push({ texto: t.slice(i, ini) })
    out.push({ texto: url, enlace: url })
    i = ini + url.length
  }
  if (i < t.length) out.push({ texto: t.slice(i) })
  return out
}
