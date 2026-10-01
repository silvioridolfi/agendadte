import { supabaseServer } from '@/lib/supabase-server'
import { driveConfigurado } from '@/lib/drive'
import { ordenarFotos } from '@/lib/fotos'
import { avisoPve, hoyAR, inicioMes, noLaborables, revisarPve } from '@/lib/pve'

// Tarea nocturna (Vercel Cron): ordena por día las fotos sueltas de cada FED con carpeta cargada y revisa sus PVE.
// PVE: aviso el 1.er día hábil del mes y recordatorio el 4.º (vencen el 5.º día hábil del mes siguiente).
// Vercel envía "Authorization: Bearer <CRON_SECRET>"; sin ese secreto configurado la tarea no corre.
export const maxDuration = 60
// Se corta antes del límite de la función para no perder el resultado.
const TOPE_MS = 45_000

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) return new Response('No autorizado', { status: 401 })
  if (!driveConfigurado()) return Response.json({ ok: false, error: 'Drive sin configurar' })
  const db = supabaseServer()
  const resultados: Record<string, unknown> = {}
  const inicio = Date.now()
  // PVE del mes anterior: aviso el 1.er día hábil y recordatorio el 4.º a quienes todavía no la subieron (vence el 5.º).
  // Va primero (sólo base de datos): ordenar fotos y revisar Drive de todos los FED puede agotar el tiempo de la función.
  try {
    const hoy = hoyAR()
    const aviso = avisoPve(hoy, await noLaborables(inicioMes(hoy), inicioMes(hoy, 1)))
    if (aviso) {
      const { data: todos } = await db.from('feds').select('id').eq('rol', 'fed')
      const { data: hechas } = await db.from('pve').select('fed_id').eq('mes', aviso.mes).not('file_id', 'is', null)
      const faltan = (todos ?? []).filter(f => !(hechas ?? []).some(h => h.fed_id === f.id))
      // No se repite si la tarea corre dos veces el mismo día.
      const { data: ya } = await db.from('notificaciones').select('fed_id').eq('tipo', 'pve').eq('detalle', aviso.texto).gte('created_at', `${hoy}T00:00:00-03:00`)
      const avisar = faltan.filter(f => !(ya ?? []).some(y => y.fed_id === f.id))
      if (avisar.length) {
        const { error } = await db.from('notificaciones').insert(avisar.map(f => ({ fed_id: f.id, tipo: 'pve', detalle: aviso.texto })))
        if (error) throw new Error(error.message)
      }
      resultados.recordatorioPve = { tipo: aviso.tipo, avisados: avisar.length }
    }
  } catch (e) { resultados.recordatorioPve = { error: e instanceof Error ? e.message : String(e) } }

  const { data: feds } = await db.from('feds').select('id, nombre_completo, rol').not('carpeta_fotos_id', 'is', null)
  // Fotos y PVE de cada FED, con tope de tiempo: lo que no alcance se retoma la noche siguiente (la función se corta a los 60 s).
  for (const f of feds ?? []) {
    if (Date.now() - inicio > TOPE_MS) { resultados.cortadoPorTiempo = true; break }
    try { resultados[f.nombre_completo] = await ordenarFotos(f.id) } catch (e) { resultados[f.nombre_completo] = { error: e instanceof Error ? e.message : String(e) } }
    if (f.rol === 'fed') try { resultados[`${f.nombre_completo} · PVE`] = await revisarPve(f.id) } catch (e) { resultados[`${f.nombre_completo} · PVE`] = { error: e instanceof Error ? e.message : String(e) } }
  }
  return Response.json({ ok: true, resultados })
}
