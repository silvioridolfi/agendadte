import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import { MODALIDADES_EVENTO, type EventoDte } from '@/lib/agenda'
import { type Usuario } from '@/lib/sesion'
import { hoyAR } from '@/lib/hora'
import { audit, exigirDiasHabiles, opt } from '@/lib/servidor/comun'

// Eventos DTE: los carga administración; cada FED registra su participación.
// ---- Eventos DTE: los carga administración; cada FED registra su participación (acción "EVENTO DTE" vinculada).
const EVENTO_COLS = 'id, nombre, fechas, hora_inicio, hora_fin, modalidad, lugar, enlace, descripcion'
const fechaIso = /^\d{4}-\d{2}-\d{2}$/
async function eventosEntre(from: string, to: string): Promise<EventoDte[]> {
  // Son pocos por año: se traen todos y se filtran los que tienen alguna fecha en el rango.
  const { data, error } = await supabaseServer().from('eventos_dte').select(EVENTO_COLS)
  if (error) throw new Error(error.message)
  return ((data ?? []).map(e => ({ ...e, fechas: [...(e.fechas as string[])].sort() })) as EventoDte[])
    .filter(e => e.fechas.some(f => f >= from && f <= to)).sort((a, b) => a.fechas[0].localeCompare(b.fechas[0]))
}
export async function getEventos(_yo: Usuario, from: string, to: string) {
  return eventosEntre(from, to)
}
export async function listarEventos(_yo: Usuario, anio: number) {
  return eventosEntre(`${anio}-01-01`, `${anio}-12-31`)
}
export type EventoInput = Omit<EventoDte, 'id'>
export async function guardarEvento(yo: Usuario, ev: EventoInput, id?: string) {
  if (!yo.esAdmin) throw new Error('Sólo administración puede cargar eventos')
  const fechas = [...new Set(ev.fechas.filter(f => fechaIso.test(f)))].sort()
  if (!opt(ev.nombre) || !fechas.length) throw new Error('Nombre y al menos una fecha son obligatorios')
  if (fechas.length > 10) throw new Error('Un evento puede tener hasta 10 fechas')
  await exigirDiasHabiles(fechas)
  if (!MODALIDADES_EVENTO.includes(ev.modalidad)) throw new Error('Elegí la modalidad')
  const hora = (h: string | null) => (h && /^\d{2}:\d{2}/.test(h) ? h.slice(0, 5) : null)
  const row = { nombre: opt(ev.nombre)!, fechas, hora_inicio: hora(ev.hora_inicio), hora_fin: hora(ev.hora_fin), modalidad: ev.modalidad, lugar: opt(ev.lugar), enlace: opt(ev.enlace), descripcion: opt(ev.descripcion) }
  if (row.enlace && !/^https?:\/\//.test(row.enlace)) throw new Error('El enlace debe empezar con https://')
  const db = supabaseServer()
  const res = id ? await db.from('eventos_dte').update(row).eq('id', id).select('id').single() : await db.from('eventos_dte').insert({ ...row, creado_por: yo.fed.id }).select('id').single()
  if (res.error) throw new Error(res.error.message)
  const eventoId = res.data.id as string
  if (!id) {
    // Aviso a todo el equipo.
    const { data: feds } = await db.from('feds').select('id').neq('id', yo.fed.id)
    const dias = fechas.map(f => `${f.slice(8, 10)}/${f.slice(5, 7)}`).join(' y ')
    if (feds?.length) await db.from('notificaciones').insert(feds.map(f => ({ fed_id: f.id, autor_id: yo.fed.id, tipo: 'evento', evento_id: eventoId, detalle: `${row.nombre} · ${dias} · ${row.modalidad}` })))
  }
  await audit('eventos_dte', eventoId, id ? 'modificacion' : 'alta', yo.fed.id, row)
  return eventoId
}
export async function eliminarEvento(yo: Usuario, id: string) {
  if (!yo.esAdmin) throw new Error('Sólo administración puede eliminar eventos')
  // Las acciones de participación ya registradas quedan en la agenda de cada uno (sin el vínculo al evento).
  const { error } = await supabaseServer().from('eventos_dte').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await audit('eventos_dte', id, 'baja', yo.fed.id)
}
// Fechas del evento en las que yo ya registré participación.
export async function miParticipacion(yo: Usuario, eventoId: string) {
  const { data } = await supabaseServer().from('agenda_items').select('fecha').eq('evento_id', eventoId).eq('fed_id', yo.fed.id)
  return (data ?? []).map(d => d.fecha as string)
}
// Registrar participación: una acción "EVENTO DTE" por fecha elegida; realizada si ya pasó, planificada si es futura.
export async function registrarParticipacion(yo: Usuario, eventoId: string, fechas: string[]) {
  const db = supabaseServer()
  const { data: ev } = await db.from('eventos_dte').select(EVENTO_COLS).eq('id', eventoId).maybeSingle()
  if (!ev) throw new Error('El evento no existe')
  const validas = fechas.filter(f => (ev.fechas as string[]).includes(f))
  const { data: ya } = await db.from('agenda_items').select('fecha').eq('evento_id', eventoId).eq('fed_id', yo.fed.id)
  const nuevas = validas.filter(f => !(ya ?? []).some(x => x.fecha === f))
  if (!nuevas.length) return 0
  const hoy = hoyAR()
  const { error } = await db.from('agenda_items').insert(nuevas.map(fecha => ({
    fed_id: yo.fed.id, fecha, accion: 'EVENTO DTE', estado: fecha <= hoy ? 'realizada' : 'planificada', evento_id: eventoId,
    hora_inicio: ev.hora_inicio, hora_fin: ev.hora_fin, sub_accion: ev.nombre, modalidad: ev.modalidad,
    lugar: ev.modalidad === 'Virtual' ? 'Virtual' : ev.lugar ?? 'Evento DTE', origen: 'app',
  })))
  if (error) throw new Error(error.code === '23505' ? 'Ya registraste tu participación' : error.message)
  await audit('agenda_items', null, 'alta', yo.fed.id, { evento: eventoId, fechas: nuevas })
  return nuevas.length
}
