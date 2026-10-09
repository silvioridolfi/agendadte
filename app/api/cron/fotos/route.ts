import { supabaseServer } from '@/lib/supabase-server'
import { driveConfigurado } from '@/lib/drive'
import { ordenarFotos } from '@/lib/fotos'
import { avisoPve, hoyAR, inicioMes, noLaborables, revisarPve, sinEntregar } from '@/lib/pve'

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
  // Registro de la ejecución (ver cron_ejecuciones): se abre al empezar y se completa al terminar; si queda sin `fin`, la función se cortó.
  const registro = await db.from('cron_ejecuciones').insert({ tarea: 'fotos' }).select('id').single()
  const idRegistro = registro.data?.id as string | undefined
  const anotar = async (cambios: Record<string, unknown>) => { if (idRegistro) await db.from('cron_ejecuciones').update(cambios).eq('id', idRegistro) }
  // PVE del mes anterior: aviso el 1.er día hábil y recordatorio el 4.º a quienes todavía no la subieron (vence el 5.º).
  // Va primero: ordenar fotos y revisar Drive de todos los FED puede agotar el tiempo de la función. Sólo consulta el Drive de quienes figuran sin entregar.
  try {
    const hoy = hoyAR()
    const aviso = avisoPve(hoy, await noLaborables(inicioMes(hoy), inicioMes(hoy, 1)))
    if (aviso) {
      const { data: todos } = await db.from('feds').select('id').eq('rol', 'fed')
      const entregadas = async () => (await db.from('pve').select('fed_id').eq('mes', aviso.mes).not('file_id', 'is', null)).data ?? []
      // Antes de avisar se revisa el Drive de quienes figuran sin entregar: si la subieron hoy y la agenda todavía no la registró, no se les avisa.
      let sinAcceso = 0
      for (const f of sinEntregar(todos ?? [], await entregadas())) {
        if (Date.now() - inicio > TOPE_MS / 2) break
        try { await revisarPve(f.id) } catch (e) { sinAcceso++; console.error('cron fotos: no se pudo revisar la PVE de', f.id, e instanceof Error ? e.message : e) /* sin acceso a Drive: se los avisa igual */ }
      }
      const faltan = sinEntregar(todos ?? [], await entregadas())
      // No se repite si la tarea corre dos veces el mismo día.
      const { data: ya } = await db.from('notificaciones').select('fed_id').eq('tipo', 'pve').eq('detalle', aviso.texto).gte('created_at', `${hoy}T00:00:00-03:00`)
      const avisar = faltan.filter(f => !(ya ?? []).some(y => y.fed_id === f.id))
      if (avisar.length) {
        const { error } = await db.from('notificaciones').insert(avisar.map(f => ({ fed_id: f.id, tipo: 'pve', detalle: aviso.texto })))
        if (error) throw new Error(error.message)
      }
      resultados.recordatorioPve = { tipo: aviso.tipo, avisados: avisar.length, sinAcceso }
    }
  } catch (e) { resultados.recordatorioPve = { error: e instanceof Error ? e.message : String(e) } }

  const { data: feds } = await db.from('feds').select('id, nombre_completo, rol').not('carpeta_fotos_id', 'is', null)
  await anotar({ feds_total: feds?.length ?? 0 })
  let procesados = 0
  // Fotos y PVE de cada FED, con tope de tiempo: lo que no alcance se retoma la noche siguiente (la función se corta a los 60 s).
  for (const f of feds ?? []) {
    if (Date.now() - inicio > TOPE_MS) { resultados.cortadoPorTiempo = true; break }
    try { resultados[f.nombre_completo] = await ordenarFotos(f.id) } catch (e) { resultados[f.nombre_completo] = { error: e instanceof Error ? e.message : String(e) } }
    if (f.rol === 'fed') try { resultados[`${f.nombre_completo} · PVE`] = await revisarPve(f.id) } catch (e) { resultados[`${f.nombre_completo} · PVE`] = { error: e instanceof Error ? e.message : String(e) } }
    procesados++
    await anotar({ feds_procesados: procesados })
  }
  await anotar({ fin: new Date().toISOString(), feds_procesados: procesados, cortado_por_tiempo: resultados.cortadoPorTiempo === true, resultado: resultados })
  return Response.json({ ok: true, resultados })
}
