import { supabaseServer } from '@/lib/supabase-server'
import { driveConfigurado } from '@/lib/drive'
import { ordenarFotos } from '@/lib/fotos'

// Tarea nocturna (Vercel Cron): ordena por día las fotos sueltas de cada FED con carpeta cargada.
// Vercel envía "Authorization: Bearer <CRON_SECRET>"; sin ese secreto configurado la tarea no corre.
export const maxDuration = 60

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) return new Response('No autorizado', { status: 401 })
  if (!driveConfigurado()) return Response.json({ ok: false, error: 'Drive sin configurar' })
  const { data: feds } = await supabaseServer().from('feds').select('id, nombre_completo').not('carpeta_fotos_id', 'is', null)
  const resultados: Record<string, unknown> = {}
  for (const f of feds ?? []) {
    try { resultados[f.nombre_completo] = await ordenarFotos(f.id) } catch (e) { resultados[f.nombre_completo] = { error: e instanceof Error ? e.message : String(e) } }
  }
  return Response.json({ ok: true, resultados })
}
