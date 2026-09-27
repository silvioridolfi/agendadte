import { supabaseServer } from '@/lib/supabase-server'
import { driveConfigurado } from '@/lib/drive'
import { ordenarFotos } from '@/lib/fotos'
import { PRIMER_MES, habilesDelMes, hoyAR, nombreMes, inicioMes, noLaborables, revisarPve } from '@/lib/pve'

// Tarea nocturna (Vercel Cron): ordena por día las fotos sueltas de cada FED con carpeta cargada y revisa sus PVE.
// PVE: aviso el 1.er día hábil del mes y recordatorio el 4.º (vencen el 5.º día hábil del mes siguiente).
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
  // PVE del mes anterior: aviso el 1.er día hábil y recordatorio el 4.º a quienes todavía no la subieron (vence el 5.º).
  const hoy = hoyAR(), mes = inicioMes(hoy, -1)
  const habiles = habilesDelMes(inicioMes(hoy), await noLaborables(inicioMes(hoy), inicioMes(hoy, 1)))
  const vence = habiles[4], dia = habiles.indexOf(hoy)
  if (vence && mes >= PRIMER_MES && (dia === 0 || dia === 3)) {
    const { data: todos } = await db.from('feds').select('id').eq('rol', 'fed')
    const { data: hechas } = await db.from('pve').select('fed_id').eq('mes', mes).not('file_id', 'is', null)
    const faltan = (todos ?? []).filter(f => !(hechas ?? []).some(h => h.fed_id === f.id))
    const venceTxt = `${vence.slice(8, 10)}/${vence.slice(5, 7)}`
    const texto = dia === 0 ? `Ya podés subir tu PVE de ${nombreMes(mes).toLowerCase()}: vence el ${venceTxt}` : `Mañana (${venceTxt}) vence tu PVE de ${nombreMes(mes).toLowerCase()}`
    if (faltan.length) await db.from('notificaciones').insert(faltan.map(f => ({ fed_id: f.id, tipo: 'pve', detalle: texto })))
    resultados.recordatorioPve = faltan.length
  }
  return Response.json({ ok: true, resultados })
}
