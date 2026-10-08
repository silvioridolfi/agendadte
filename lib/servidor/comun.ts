import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'

// Piezas compartidas por las acciones del servidor (app/actions.ts y lib/servidor/*).

// Registro de auditoría: quién hizo qué sobre qué registro.
export async function audit(tabla: string, registroId: string | null, operacion: 'alta' | 'modificacion' | 'baja' | 'estado', autorId: string | null, datos?: unknown) {
  await supabaseServer().from('auditoria').insert({ tabla, registro_id: registroId, operacion, autor_id: autorId, datos: datos ?? null })
}
