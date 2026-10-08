import 'server-only'
import { esEnero, mensajeEnero } from '@/lib/receso'
import type { Usuario } from '@/lib/sesion'
import { supabaseServer } from '@/lib/supabase-server'

// Piezas compartidas por las acciones del servidor (app/actions.ts y lib/servidor/*).

// Registro de auditoría: quién hizo qué sobre qué registro.
export async function audit(tabla: string, registroId: string | null, operacion: 'alta' | 'modificacion' | 'baja' | 'estado', autorId: string | null, datos?: unknown) {
  await supabaseServer().from('auditoria').insert({ tabla, registro_id: registroId, operacion, autor_id: autorId, datos: datos ?? null })
}

// Quién pide: el perfil de la sesión, para las reglas de lo que se puede ver (lib/permisos.ts).
export const quienEs = (yo: Usuario) => ({ id: yo.fed.id, rol: yo.fed.rol as string, esAdmin: yo.esAdmin })
// Datos de una acción para decidir si la puede ver quien pide: quién la creó y quiénes están etiquetados.
export async function datosDeAccion(itemId: string): Promise<{ fed_id: string, participantes: string[] } | null> {
  const db = supabaseServer()
  const [{ data: item }, { data: part }] = await Promise.all([db.from('agenda_items').select('fed_id').eq('id', itemId).maybeSingle(), db.from('agenda_participantes').select('fed_id').eq('item_id', itemId)])
  return item ? { fed_id: item.fed_id as string, participantes: (part ?? []).map(p => p.fed_id as string) } : null
}

export const errMsgServer = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// PostgREST devuelve como máximo 1000 filas por consulta: se pide por páginas (la vista anual supera ese límite).
export const PAGE = 1000
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null, error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; ; i += PAGE) {
    const { data, error } = await page(i, i + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return out
  }
}
export const opt = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)
export const fechaCorta = (f: string) => { const [y, m, d] = f.split('-'); return `${d}/${m}/${y}` }
// Sólo se trabaja de lunes a viernes en días hábiles: sin fines de semana, feriados nacionales, turísticos ni recesos.
export async function exigirDiasHabiles(fechas: string[]) {
  const finde = fechas.find(f => [0, 6].includes(new Date(`${f}T12:00:00Z`).getUTCDay()))
  if (finde) throw new Error(`El ${fechaCorta(finde)} es fin de semana: sólo se pueden cargar acciones de lunes a viernes.`)
  const ene = fechas.find(esEnero)
  if (ene) throw new Error(mensajeEnero(fechaCorta(ene)))
  if (!fechas.length) return
  const { data } = await supabaseServer().from('feriados').select('fecha, nombre, tipo').in('fecha', fechas).neq('tipo', 'distrital').limit(1)
  const f = data?.[0]
  if (f) throw new Error(`El ${fechaCorta(f.fecha as string)} es ${f.tipo === 'receso' ? 'receso escolar' : 'feriado'} (${f.nombre}): sólo se pueden cargar acciones en días hábiles.`)
}
