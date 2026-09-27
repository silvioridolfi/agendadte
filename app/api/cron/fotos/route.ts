import { supabaseServer } from '@/lib/supabase-server'
import { driveConfigurado } from '@/lib/drive'
import { ordenarFotos } from '@/lib/fotos'
import { hoyAR, nombreMes, inicioMes, revisarPve, ultimoHabil } from '@/lib/pve'

// Tarea nocturna (Vercel Cron): ordena por día las fotos sueltas de cada FED con carpeta cargada y revisa sus PVE.
// El último día hábil del mes recuerda a cada FED subir su PVE.
// Vercel envía "Authorization: Bearer <CRON_SECRET>"; sin ese secreto configurado la tarea no corre.
export const maxDuration = 60

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) return new Response('No autorizado', { status: 401 })
  if (!driveConfigurado()) return Response.json({ ok: false, error: 'Drive sin configurar' })
  const db = supabaseServer()
  const { data: feds } = await db.from('feds').select('id, nombre_completo, rol').not('carpeta_fotos_id', 'is', null)
  const resultados: Record<string, unknown> = {}
  for (const f of feds ?? []) {
    try { resultados[f.nombre_completo] = await ordenarFotos(f.id) } catch (e) { resultados[f.nombre_completo] = { error: e instanceof Error ? e.message : String(e) } }
    if (f.rol === 'fed') try { resultados[`${f.nombre_completo} · PVE`] = await revisarPve(f.id) } catch (e) { resultados[`${f.nombre_completo} · PVE`] = { error: e instanceof Error ? e.message : String(e) } }
  }
  const hoy = hoyAR()
  if (hoy === ultimoHabil(hoy)) {
    const mes = inicioMes(hoy)
    const { data: todos } = await db.from('feds').select('id').eq('rol', 'fed')
    const { data: hechas } = await db.from('pve').select('fed_id').eq('mes', mes).not('file_id', 'is', null)
    const faltan = (todos ?? []).filter(f => !(hechas ?? []).some(h => h.fed_id === f.id))
    if (faltan.length) await db.from('notificaciones').insert(faltan.map(f => ({ fed_id: f.id, tipo: 'pve', detalle: `Recordatorio: subí tu PVE de ${nombreMes(mes).toLowerCase()} a su carpeta de Drive` })))
    resultados.recordatorioPve = faltan.length
  }
  return Response.json({ ok: true, resultados })
}
