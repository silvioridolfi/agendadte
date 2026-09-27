import { supabaseServer } from '@/lib/supabase-server'
import { usuarioActual } from '@/lib/sesion'
import { descargar } from '@/lib/drive'
import { REGION, nombreMes } from '@/lib/pve'
import { armarZip } from '@/lib/zip'

// Descarga todas las PVE entregadas de un mes en un ZIP (sólo coordinación y administración).
export const maxDuration = 60

export async function GET(request: Request) {
  const yo = await usuarioActual()
  if (!yo) return new Response('Sesión vencida', { status: 401 })
  if (yo.fed.rol !== 'coordinacion' && !yo.esAdmin) return new Response('No autorizado', { status: 403 })
  const mes = new URL(request.url).searchParams.get('mes') ?? ''
  if (!/^\d{4}-\d{2}-01$/.test(mes)) return new Response('Mes inválido', { status: 400 })
  // ?solo=corregidas: sólo las reentregadas que todavía no se enviaron (para responder a Nivel Central).
  const corregidas = new URL(request.url).searchParams.get('solo') === 'corregidas'
  const { data: filas } = await supabaseServer().from('pve').select('file_id, nombre, reentregada_at, enviada_at').eq('mes', mes).not('file_id', 'is', null)
  const data = (filas ?? []).filter(r => !corregidas || (r.reentregada_at && !r.enviada_at))
  const archivos: { nombre: string, datos: Buffer }[] = []
  for (const r of data ?? []) {
    try { archivos.push({ nombre: r.nombre ?? `${r.file_id}.pdf`, datos: Buffer.from(await descargar(r.file_id as string)) }) } catch { /* archivo borrado: se omite */ }
  }
  if (!archivos.length) return new Response('No hay PVE entregadas para ese mes', { status: 404 })
  const nombre = `${REGION} - PVE (${nombreMes(mes)})${corregidas ? ' - CORREGIDAS' : ''}.zip`
  return new Response(new Uint8Array(armarZip(archivos)), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}` } })
}
