import { supabaseServer } from '@/lib/supabase-server'
import { driveConfigurado } from '@/lib/drive'
import { sincronizarCronogramas } from '@/lib/cronogramas-sync'

// Tarea nocturna (Vercel Cron): sincroniza los cronogramas de Nivel Central desde el consolidado de conectividad (sólo lectura).
// Va aparte de la de fotos para no competir por el tiempo de la función. Vercel envía "Authorization: Bearer <CRON_SECRET>".
export const maxDuration = 60

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) return new Response('No autorizado', { status: 401 })
  if (!driveConfigurado()) return Response.json({ ok: false, error: 'Drive sin configurar' })
  const db = supabaseServer()
  const registro = await db.from('cron_ejecuciones').insert({ tarea: 'cronogramas' }).select('id').single()
  const id = registro.data?.id as string | undefined
  const cerrar = async (resultado: Record<string, unknown>) => { if (id) await db.from('cron_ejecuciones').update({ fin: new Date().toISOString(), resultado }).eq('id', id) }
  try {
    const r = await sincronizarCronogramas()
    await cerrar({ ...r })
    return Response.json({ ok: true, ...r })
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await cerrar({ error })
    return Response.json({ ok: false, error })
  }
}
