import 'server-only'
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
