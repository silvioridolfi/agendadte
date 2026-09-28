'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarHeart, Check, Clock, ExternalLink, Loader2, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Confirmar } from '@/components/ui/confirmar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/metrics'
import { MODALIDADES_EVENTO, type EventoDte, type ModalidadEvento } from '@/lib/agenda'
import type { EventoInput } from '@/app/actions'
import { cap, errMsg, fmt, parse, selectClass, getEventos, listarEventos, guardarEvento, eliminarEvento, miParticipacion, registrarParticipacion, ErrorBox, Skeleton } from '@/components/app/comun'
import { anioAR } from '@/lib/hora'

// Aviso para que las vistas recarguen sus datos (p. ej., después de registrar la participación en un evento).
export const RECARGAR = 'agenda-recargar'

// Eventos DTE por fecha dentro del rango visible.
export function useEventos(from: string, to: string) {
  const [list, setList] = useState<EventoDte[]>([])
  useEffect(() => {
    let alive = true
    getEventos(from, to).then(r => alive && setList(r)).catch(() => alive && setList([]))
    return () => { alive = false }
  }, [from, to])
  return useMemo(() => {
    const m = new Map<string, EventoDte[]>()
    for (const e of list) for (const f of e.fechas) m.set(f, [...(m.get(f) ?? []), e])
    return m
  }, [list])
}

const diasTexto = (fechas: string[]) => fechas.map(f => cap(fmt(parse(f), { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''))).join(' y ')
const horario = (e: EventoDte) => (e.hora_inicio ? `${e.hora_inicio.slice(0, 5)}${e.hora_fin ? ` a ${e.hora_fin.slice(0, 5)}` : ''}` : '')

// Marca del evento en el calendario; al tocarla abre el detalle. `registrar`: el FED puede registrar su participación.
export function EventoTag({ e, compact = false, registrar = false }: { e: EventoDte, compact?: boolean, registrar?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  return <>
    <button type="button" onClick={ev => { ev.stopPropagation(); setAbierto(true) }} title={`Evento DTE: ${e.nombre}`}
      className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-accion-evento-dte px-1.5 py-0.5 text-left text-xs font-semibold text-accion-evento-dte-texto transition hover:bg-accion-evento-dte-hover">
      <CalendarHeart className="size-3 shrink-0" aria-hidden /><span className="truncate" title={compact ? 'Evento DTE' : e.nombre}>{compact ? 'Evento DTE' : e.nombre}</span>
    </button>
    {abierto && <EventoDialog e={e} registrar={registrar} onCerrar={() => setAbierto(false)} />}
  </>
}

function EventoDialog({ e, registrar, onCerrar }: { e: EventoDte, registrar: boolean, onCerrar: () => void }) {
  const [mias, setMias] = useState<string[] | null>(null)
  const [elegidas, setElegidas] = useState<string[]>(e.fechas)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  useEffect(() => { if (registrar) miParticipacion(e.id).then(m => { setMias(m); setElegidas(e.fechas.filter(f => !m.includes(f))) }).catch(() => setMias([])) }, [e, registrar])
  const pendientes = e.fechas.filter(f => !(mias ?? []).includes(f))
  async function registrarme() {
    setBusy(true); setError('')
    try {
      const n = await registrarParticipacion(e.id, elegidas)
      setOk(n ? `Listo: se agregó a tu agenda (${n} ${n === 1 ? 'día' : 'días'}).` : 'Ya estaba registrada.')
      setMias(m => [...(m ?? []), ...elegidas]); window.dispatchEvent(new Event(RECARGAR))
    } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }
  return <Dialog open onOpenChange={o => !o && onCerrar()}>
    <DialogContent className="bg-white sm:max-w-md">
      <DialogHeader>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-accion-evento-dte-texto">Evento DTE · {e.modalidad}</p>
        <DialogTitle className="text-xl">{e.nombre}</DialogTitle>
        <DialogDescription>{diasTexto(e.fechas)}</DialogDescription>
      </DialogHeader>
      <dl className="flex flex-col gap-2 text-sm">
        {horario(e) && <div className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-dte-gris-claro" /><dd>{horario(e)}</dd></div>}
        {e.lugar && <div className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-dte-gris-claro" /><dd>{e.lugar}</dd></div>}
        {e.enlace && <div className="flex gap-2"><ExternalLink className="mt-0.5 size-4 shrink-0 text-dte-gris-claro" /><dd className="min-w-0"><a href={e.enlace} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-dte-petroleo underline underline-offset-2">{e.enlace}</a></dd></div>}
        {e.descripcion && <p className="whitespace-pre-line text-dte-tinta">{e.descripcion}</p>}
      </dl>
      {registrar && <div className="mt-2 rounded-tile border border-dte-linea bg-dte-fondo p-3">
        {mias === null ? <Loader2 className="size-4 animate-spin text-dte-gris" />
          : !pendientes.length ? <p className="flex items-center gap-1.5 text-sm font-semibold text-exito"><Check className="size-4" />Tu participación ya está registrada.</p>
          : <>
            <p className="mb-2 text-sm font-semibold">Registrar mi participación</p>
            {e.fechas.length > 1 && <div className="mb-2 flex flex-wrap gap-1.5">{e.fechas.map(f => {
              const ya = (mias ?? []).includes(f), on = ya || elegidas.includes(f)
              return <button key={f} type="button" disabled={ya} aria-pressed={on} onClick={() => setElegidas(l => (l.includes(f) ? l.filter(x => x !== f) : [...l, f]))}
                className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${on ? 'border-dte-petroleo bg-dte-petroleo text-white' : 'border-dte-linea bg-white text-dte-tinta'} ${ya ? 'opacity-60' : ''}`}>{on && <Check className="mr-1 inline size-3" />}{diasTexto([f])}</button>
            })}</div>}
            <p className="mb-2 text-xs text-dte-gris">Se agrega a tu agenda como “Evento DTE”: realizada si ya pasó, planificada si es a futuro.</p>
            <Button size="sm" disabled={busy || !elegidas.length} onClick={registrarme} className="bg-dte-petroleo hover:bg-dte-petroleo-oscuro">{busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}Registrar</Button>
          </>}
        {ok && <p role="status" className="mt-2 text-sm text-exito">{ok}</p>}
        {error && <div className="mt-2"><ErrorBox message={error} /></div>}
      </div>}
    </DialogContent>
  </Dialog>
}

// Administración: alta, edición y baja de eventos DTE.
const VACIO: EventoInput = { nombre: '', fechas: [''], hora_inicio: null, hora_fin: null, modalidad: 'Presencial', lugar: null, enlace: null, descripcion: null }
export function EventosPanel({ onSaved }: { onSaved: (msg: string) => void }) {
  const [year, setYear] = useState(anioAR)
  const [list, setList] = useState<EventoDte[] | null>(null)
  const [form, setForm] = useState<EventoInput>(VACIO)
  const [editando, setEditando] = useState<string | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [aQuitar, setAQuitar] = useState<EventoDte | null>(null)
  const cargar = () => { setList(null); listarEventos(year).then(setList).catch(e => { setList([]); setError(errMsg(e)) }) }
  // Carga al cambiar de año: el estado sólo se actualiza cuando llega la respuesta.
  useEffect(() => { let vivo = true; listarEventos(year).then(l => vivo && setList(l)).catch(e => { if (vivo) { setList([]); setError(errMsg(e)) } }); return () => { vivo = false } }, [year])
  const cambiarAnio = (n: number) => { setList(null); setYear(y => y + n) }
  const set = <K extends keyof EventoInput>(k: K, v: EventoInput[K]) => setForm(f => ({ ...f, [k]: v }))
  const setFecha = (i: number, v: string) => setForm(f => ({ ...f, fechas: f.fechas.map((x, j) => (j === i ? v : x)) }))
  async function guardar() {
    setBusy('save'); setError('')
    try { await guardarEvento({ ...form, fechas: form.fechas.filter(Boolean) }, editando ?? undefined); onSaved(editando ? 'Evento actualizado' : 'Evento cargado: se avisó al equipo'); setForm(VACIO); setEditando(null); cargar() }
    catch (e) { setError(errMsg(e)) } finally { setBusy('') }
  }
  async function quitar(e: EventoDte) {
    setBusy(e.id); setError('')
    try { await eliminarEvento(e.id); onSaved('Evento eliminado'); cargar() } catch (err) { setError(errMsg(err)) } finally { setBusy('') }
  }
  const editar = (e: EventoDte) => { setEditando(e.id); setForm({ nombre: e.nombre, fechas: e.fechas, hora_inicio: e.hora_inicio?.slice(0, 5) ?? null, hora_fin: e.hora_fin?.slice(0, 5) ?? null, modalidad: e.modalidad, lugar: e.lugar, enlace: e.enlace, descripcion: e.descripcion }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const lbl = 'flex flex-col gap-1 text-xs font-semibold'
  return <Panel title="Eventos DTE" subtitle="Jornadas y eventos propios de la DTE (por ejemplo, las JED). Aparecen en el calendario de todos, que pueden registrar su participación. Se avisa al equipo al cargarlos."
    action={<div className="flex items-center gap-1"><Button variant="outline" size="sm" onClick={() => cambiarAnio(-1)}>‹</Button><span className="px-2 text-sm font-bold tabular-nums">{year}</span><Button variant="outline" size="sm" onClick={() => cambiarAnio(1)}>›</Button></div>}>
    <div className="mb-4 grid gap-2 rounded-tile bg-dte-fondo p-3 sm:grid-cols-2">
      <label className={`${lbl} sm:col-span-2`}>Nombre<Input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej.: JED 2026 · Jornadas de Educación Digital" className="h-11 bg-white md:h-9" /></label>
      <div className={`${lbl} sm:col-span-2`}>Fechas
        <div className="flex flex-wrap items-center gap-2">{form.fechas.map((f, i) => <span key={i} className="flex items-center gap-1"><Input type="date" aria-label={`Fecha ${i + 1}`} value={f} onChange={e => setFecha(i, e.target.value)} className="h-11 w-40 bg-white md:h-9" />
          {form.fechas.length > 1 && <Button variant="ghost" size="icon-sm" onClick={() => set('fechas', form.fechas.filter((_, j) => j !== i))} aria-label={`Quitar fecha ${i + 1}`}><X /></Button>}</span>)}
          {form.fechas.length < 10 && <Button variant="outline" size="sm" onClick={() => set('fechas', [...form.fechas, ''])}><Plus data-icon="inline-start" />Otra fecha</Button>}</div>
      </div>
      <div className="grid grid-cols-2 gap-2"><label className={lbl}>Desde (opcional)<Input type="time" value={form.hora_inicio ?? ''} onChange={e => set('hora_inicio', e.target.value || null)} className="h-11 bg-white md:h-9" /></label>
        <label className={lbl}>Hasta (opcional)<Input type="time" value={form.hora_fin ?? ''} onChange={e => set('hora_fin', e.target.value || null)} className="h-11 bg-white md:h-9" /></label></div>
      <label className={lbl}>Modalidad<select className={selectClass} value={form.modalidad} onChange={e => set('modalidad', e.target.value as ModalidadEvento)}>{MODALIDADES_EVENTO.map(m => <option key={m}>{m}</option>)}</select></label>
      <label className={lbl}>Lugar (opcional)<Input value={form.lugar ?? ''} onChange={e => set('lugar', e.target.value || null)} placeholder="Ej.: Teatro Argentino, La Plata" className="h-11 bg-white md:h-9" /></label>
      <label className={lbl}>Enlace (opcional)<Input value={form.enlace ?? ''} onChange={e => set('enlace', e.target.value || null)} placeholder="https://…" className="h-11 bg-white md:h-9" /></label>
      <label className={`${lbl} sm:col-span-2`}>Descripción (opcional)<Textarea rows={2} value={form.descripcion ?? ''} onChange={e => set('descripcion', e.target.value || null)} className="bg-white" /></label>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button size="sm" disabled={busy === 'save' || !form.nombre.trim() || !form.fechas.some(Boolean)} onClick={guardar} variant="marca" className="md:h-9">{busy === 'save' ? <Loader2 className="animate-spin" /> : editando ? <Check data-icon="inline-start" /> : <Plus data-icon="inline-start" />}{editando ? 'Guardar cambios' : 'Cargar evento'}</Button>
        {editando && <Button size="sm" variant="outline" onClick={() => { setEditando(null); setForm(VACIO) }}>Cancelar edición</Button>}
      </div>
    </div>
    {error && <div className="mb-3"><ErrorBox message={error} /></div>}
    {!list ? <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando eventos"><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
      : !list.length ? <p className="text-sm text-dte-gris">No hay eventos cargados en {year}.</p>
      : <ul className="divide-y divide-dte-linea rounded-tile border border-dte-linea">{list.map(e => <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
        <span className="min-w-0"><b>{e.nombre}</b><span className="block text-xs text-dte-gris">{diasTexto(e.fechas)} · {e.modalidad}{horario(e) ? ` · ${horario(e)}` : ''}{e.lugar ? ` · ${e.lugar}` : ''}</span></span>
        <span className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={() => editar(e)} aria-label={`Editar ${e.nombre}`}><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="sm" disabled={busy === e.id} onClick={() => setAQuitar(e)} aria-label={`Eliminar ${e.nombre}`} className="text-peligro hover:bg-peligro-fondo hover:text-peligro">{busy === e.id ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />}</Button>
        </span>
      </li>)}</ul>}
    <Confirmar abierto={!!aQuitar} peligro titulo="¿Eliminar este evento?" accion="Eliminar"
      descripcion={aQuitar ? <><b>{aQuitar.nombre}</b> deja de verse en los calendarios. Las participaciones ya registradas quedan en la agenda de cada uno.</> : ''}
      onConfirmar={() => aQuitar && quitar(aQuitar)} onCerrar={() => setAQuitar(null)} />
  </Panel>
}
