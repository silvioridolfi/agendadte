'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, MapPin, UserX } from 'lucide-react'
import { Segmented, Pill } from '@/components/ui/segmented'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DISTRITOS_REGION, type AgendaItem, type Fed } from '@/lib/agenda'
import { titleCase } from '@/lib/format'
import { EventoTag, useEventos } from '@/components/app/eventos'
import { actionStyle, addDays, cap, fmt, hhmm, iso, parse, selectClass, siglaEscuela, conGrupo, startOfWeek, toWeekday, firstName, getAllItems, useItems, useFeriados, EtiquetasAccion, ErrorBox, FeriadoTag, Skeleton, Vacio, WeekNav } from '@/components/app/comun'
import { ItemCard } from '@/components/app/agenda'
import { hoyAR, horaAR, fechaHoyAR } from '@/lib/hora'
import { agruparVisitas } from '@/lib/visita'
import { enTerritorio } from '@/lib/territorio'

type Modo = 'dia' | 'semana' | 'proximas'
const MODOS = [['dia', 'Día'], ['semana', 'Semana'], ['proximas', 'Próximas']] as const
const H_INICIO = 7, H_FIN = 20
const minutos = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const pos = (t: string) => Math.min(100, Math.max(0, ((minutos(t) - H_INICIO * 60) / ((H_FIN - H_INICIO) * 60)) * 100))
const ausencia = (i: AgendaItem) => i.accion === 'LICENCIA' || i.accion === 'PARO'
const lugar = (i: AgendaItem) => (i.school ? conGrupo(i, siglaEscuela(i.school)) : i.lugar || titleCase(i.accion))
const horario = (i: AgendaItem) => (i.hora_inicio ? `${hhmm(i.hora_inicio)}${i.hora_fin ? `–${hhmm(i.hora_fin)}` : ''}` : 'Sin horario')

// Agenda del equipo (coordinación): qué hace cada FED en el día, la semana y las próximas visitas a escuelas.
export function AgendaEquipoView({ feds, reloadKey, onSelect }: { feds: Fed[], reloadKey: number, onSelect: (i: AgendaItem) => void }) {
  const [modo, setModo] = useState<Modo>('dia')
  const [fecha, setFecha] = useState(() => toWeekday(fechaHoyAR()))
  const [soloTerritorio, setSoloTerritorio] = useState(true)
  const [distrito, setDistrito] = useState('')
  const [fedId, setFedId] = useState('')
  const [celda, setCelda] = useState<{ fed: Fed, dia: Date } | null>(null)

  const hoy = hoyAR()
  const lunes = startOfWeek(fecha)
  const [desde, hasta] = modo === 'dia' ? [fecha, fecha] : modo === 'semana' ? [lunes, addDays(lunes, 4)] : [fechaHoyAR(), addDays(fechaHoyAR(), 7)]
  const { items, error, retry } = useItems(() => getAllItems(iso(desde), iso(hasta)), [iso(desde), iso(hasta), reloadKey], `todos:${iso(desde)}:${iso(hasta)}`)
  const feriados = useFeriados(iso(desde), iso(hasta), null)
  const eventos = useEventos(iso(desde), iso(hasta))

  const equipo = useMemo(() => feds.filter(f => (!fedId || f.id === fedId) && (!distrito || f.distritos_a_cargo.includes(distrito))), [feds, fedId, distrito])
  // Acciones de cada FED: las propias y aquellas en las que participa (salvo que haya rechazado la invitación).
  const delFed = useMemo(() => {
    const m = new Map<string, AgendaItem[]>(feds.map(f => [f.id, []]))
    // Una visita con varias acciones se muestra como una sola.
    for (const i of agruparVisitas(items ?? [])) {
      if (i.estado === 'cancelada') continue
      if (!ausencia(i) && soloTerritorio && !enTerritorio(i)) continue
      if (distrito && i.school && i.school.distrito?.toUpperCase() !== distrito && !ausencia(i)) continue
      const ids = new Set([i.fed_id, ...i.participantes.filter(p => p.respuesta !== 'rechaza').map(p => p.fed_id)])
      for (const id of ids) m.get(id)?.push(i)
    }
    for (const l of m.values()) l.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio ?? '99').localeCompare(b.hora_inicio ?? '99'))
    return m
  }, [items, feds, soloTerritorio, distrito])
  const deDia = (fed: Fed, d: string) => (delFed.get(fed.id) ?? []).filter(i => i.fecha === d)

  const paso = modo === 'semana' ? 7 : 1
  const mover = (n: number) => setFecha(f => toWeekday(addDays(f, n * paso), n < 0 ? -1 : 1))
  const titulo = modo === 'dia' ? cap(fmt(fecha, { weekday: 'long', day: 'numeric', month: 'long' }))
    : modo === 'semana' ? `Semana del ${fmt(lunes, { day: 'numeric', month: 'long' })}` : 'Próximos 7 días'

  const conActividad = equipo.filter(f => deDia(f, iso(fecha)).some(i => !ausencia(i))).length
  const ausentes = equipo.filter(f => deDia(f, iso(fecha)).some(ausencia)).length

  return <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-3 rounded-card border border-dte-linea bg-white p-3 shadow-e1">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Segmented label="Vista de la agenda del equipo" value={modo} options={MODOS} onChange={setModo} />
        {modo !== 'proximas' && <WeekNav llena onPrev={() => mover(-1)} onNext={() => mover(1)} onToday={() => setFecha(toWeekday(fechaHoyAR()))} prevLabel={modo === 'dia' ? 'Día anterior' : 'Semana anterior'} nextLabel={modo === 'dia' ? 'Día siguiente' : 'Semana siguiente'} />}
      </div>
      <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr] sm:items-center">
        <div className="flex flex-wrap gap-1.5"><Pill on={soloTerritorio} onClick={() => setSoloTerritorio(true)} conIcono={false}>En territorio</Pill><Pill on={!soloTerritorio} onClick={() => setSoloTerritorio(false)} conIcono={false}>Todas las acciones</Pill></div>
        <select aria-label="Distrito" value={distrito} onChange={e => setDistrito(e.target.value)} className={selectClass}><option value="">Todos los distritos</option>{DISTRITOS_REGION.map(d => <option key={d} value={d}>{titleCase(d)}</option>)}</select>
        <select aria-label="FED" value={fedId} onChange={e => setFedId(e.target.value)} className={selectClass}><option value="">Todo el equipo</option>{feds.map(f => <option key={f.id} value={f.id}>{f.nombre_completo}</option>)}</select>
      </div>
    </div>

    <header className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-lg font-bold">{titulo}</h3>
      {modo === 'dia' && items && <p className="text-sm text-dte-gris"><b className="text-dte-tinta">{conActividad}</b> de {equipo.length} con acciones{soloTerritorio ? ' en territorio' : ''}{ausentes ? ` · ${ausentes} con licencia o paro` : ''}</p>}
    </header>
    {modo === 'dia' && (feriados.get(iso(fecha)) ?? []).length > 0 && <div className="flex flex-wrap gap-1">{feriados.get(iso(fecha))!.map(f => <FeriadoTag key={f.nombre} f={f} />)}</div>}
    {modo === 'dia' && (eventos.get(iso(fecha)) ?? []).length > 0 && <div className="flex flex-wrap gap-1">{eventos.get(iso(fecha))!.map(e => <EventoTag key={e.id} e={e} />)}</div>}

    {error ? <ErrorBox message={error} onRetry={retry} />
      : !items ? <Skeleton className="h-72" />
      : !equipo.length ? <Vacio icono={UserX} titulo="Ningún FED coincide con los filtros" />
      : modo === 'dia' ? <VistaDia equipo={equipo} fecha={iso(fecha)} esHoy={iso(fecha) === hoy} deDia={deDia} onSelect={onSelect} />
      : modo === 'semana' ? <VistaSemana equipo={equipo} lunes={lunes} hoy={hoy} deDia={deDia} feriados={feriados} onCelda={(fed, dia) => setCelda({ fed, dia })} />
      : <VistaProximas equipo={equipo} delFed={delFed} feds={feds} onSelect={onSelect} />}

    <Dialog open={!!celda} onOpenChange={o => !o && setCelda(null)}>
      <DialogContent className="bg-white">
        <DialogHeader><DialogTitle className="text-lg">{celda?.fed.nombre_completo}</DialogTitle><DialogDescription>{celda ? cap(fmt(celda.dia, { weekday: 'long', day: 'numeric', month: 'long' })) : ''}</DialogDescription></DialogHeader>
        {celda && (deDia(celda.fed, iso(celda.dia)).length
          ? <ul className="flex flex-col gap-2">{deDia(celda.fed, iso(celda.dia)).map(i => <li key={i.id}><ItemCard item={i} viewer={celda.fed.id} onClick={() => { setCelda(null); onSelect(i) }} /></li>)}</ul>
          : <p className="text-sm text-dte-gris">Sin acciones{soloTerritorio ? ' en territorio' : ''} ese día.</p>)}
      </DialogContent>
    </Dialog>
  </div>
}

function Bloque({ i, onSelect, className = '' }: { i: AgendaItem, onSelect: (i: AgendaItem) => void, className?: string }) {
  return <button type="button" onClick={() => onSelect(i)} title={`${horario(i)} · ${titleCase(i.accion)} · ${lugar(i)}`}
    className={`flex min-w-0 flex-col overflow-hidden rounded-md px-1.5 py-1 text-left text-xs leading-tight ring-1 ring-inset ring-black/5 transition hover:brightness-95 ${actionStyle[i.accion]?.chip ?? 'bg-dte-fondo'} ${className}`}>
    <span className="truncate font-bold" title={lugar(i)}>{lugar(i)}</span><span className="truncate tabular-nums opacity-80" title={horario(i)}>{horario(i)}</span>
  </button>
}

// Día: en escritorio, línea de tiempo por FED; en mobile, lista agrupada por FED.
function VistaDia({ equipo, fecha, esHoy, deDia, onSelect }: { equipo: Fed[], fecha: string, esHoy: boolean, deDia: (f: Fed, d: string) => AgendaItem[], onSelect: (i: AgendaItem) => void }) {
  const horas = Array.from({ length: H_FIN - H_INICIO + 1 }, (_, k) => H_INICIO + k)
  const ahoraStr = horaAR()
  const orden = [...equipo].sort((a, b) => Number(deDia(b, fecha).length > 0) - Number(deDia(a, fecha).length > 0) || a.nombre_completo.localeCompare(b.nombre_completo))
  return <>
    <div className="hidden overflow-hidden rounded-card border border-dte-linea bg-white md:block">
      <div className="grid grid-cols-[11rem_1fr] border-b border-dte-linea bg-dte-fondo text-xs text-dte-gris">
        <span className="px-3 py-2 font-semibold">FED</span>
        <div className="relative h-8">{horas.slice(0, -1).map(h => <span key={h} className="absolute top-2 -translate-x-1/2 tabular-nums" style={{ left: `${pos(`${String(h).padStart(2, '0')}:00`)}%` }}>{h}</span>)}</div>
      </div>
      <ul className="divide-y divide-dte-linea">{orden.map(f => {
        const l = deDia(f, fecha), aus = l.filter(ausencia), conHora = l.filter(i => !ausencia(i) && i.hora_inicio), sinHora = l.filter(i => !ausencia(i) && !i.hora_inicio)
        return <li key={f.id} className={`grid grid-cols-[11rem_1fr] ${l.length ? '' : 'opacity-55'}`}>
          <div className="flex min-w-0 flex-col justify-center gap-1 px-3 py-2">
            <span className="truncate text-sm font-semibold" title={f.nombre_completo}>{f.nombre_completo}</span>
            {aus.map(i => <span key={i.id} className="w-fit rounded-full bg-aviso-fondo-fuerte px-2 py-0.5 text-xs font-semibold text-aviso-fuerte">{titleCase(i.accion)}</span>)}
            {sinHora.map(i => <Bloque key={i.id} i={i} onSelect={onSelect} className="max-w-full" />)}
            {!l.length && <span className="text-xs text-dte-gris">Sin acciones</span>}
          </div>
          {(() => {
            // Carriles: cada acción va al primer carril libre; la fila crece con los solapamientos.
            const rangos = [...conHora].sort((a, b) => hhmm(a.hora_inicio).localeCompare(hhmm(b.hora_inicio))).map(i => { const ini = hhmm(i.hora_inicio); return { i, ini, fin: hhmm(i.hora_fin) || `${String(Math.min(H_FIN, Number(ini.slice(0, 2)) + 1)).padStart(2, '0')}:${ini.slice(3)}` } })
            const finCarril: string[] = []
            const ubicados = rangos.map(r => { let c = finCarril.findIndex(f => f <= r.ini); if (c < 0) c = finCarril.length; finCarril[c] = r.fin; return { ...r, c } })
            return <div className="relative border-l border-dte-linea" style={{ minHeight: `${Math.max(1, finCarril.length) * 3 + 0.5}rem` }}>
              {horas.map(h => <span key={h} aria-hidden className="absolute inset-y-0 w-px bg-dte-linea/60" style={{ left: `${pos(`${String(h).padStart(2, '0')}:00`)}%` }} />)}
              {esHoy && <span aria-hidden className="absolute inset-y-0 z-[1] w-0.5 bg-dte-magenta" style={{ left: `${pos(ahoraStr)}%` }} title="Ahora" />}
              {ubicados.map(({ i, ini, fin, c }) => <div key={i.id} className="absolute h-12 p-0.5" style={{ top: `${c * 3 + 0.25}rem`, left: `${pos(ini)}%`, width: `${Math.max(4, pos(fin) - pos(ini))}%` }}><Bloque i={i} onSelect={onSelect} className="h-full w-full" /></div>)}
            </div>
          })()}
        </li>
      })}</ul>
    </div>

    <ul className="flex flex-col gap-3 md:hidden">{orden.map(f => {
      const l = deDia(f, fecha)
      // Con licencia o paro todo el día: una fila compacta, sin el detalle de horario.
      if (l.length > 0 && l.every(ausencia)) return <li key={f.id} className="flex items-center justify-between gap-2 rounded-card border border-dte-linea bg-white px-3 py-2.5">
        <span className="truncate font-semibold" title={f.nombre_completo}>{f.nombre_completo}</span>
        <span className="shrink-0 rounded-full bg-aviso-fondo-fuerte px-2.5 py-0.5 text-xs font-semibold text-aviso-fuerte">{l[0].accion === 'PARO' ? 'Paro' : 'Licencia'}</span>
      </li>
      return <li key={f.id} className={`rounded-card border border-dte-linea bg-white p-3 ${l.length ? '' : 'opacity-60'}`}>
        <p className="mb-1.5 flex items-center justify-between gap-2 font-semibold"><span className="truncate" title={f.nombre_completo}>{f.nombre_completo}</span><span className="shrink-0 text-xs font-normal text-dte-gris">{l.length ? `${l.length} ${l.length === 1 ? 'acción' : 'acciones'}` : 'Sin acciones'}</span></p>
        {l.length > 0 && <ul className="flex flex-col divide-y divide-dte-linea">{l.map(i => <li key={i.id}>
          <button type="button" onClick={() => onSelect(i)} className="grid min-h-11 w-full grid-cols-[4.25rem_1fr] items-center gap-2 py-1.5 text-left text-sm">
            <span className="tabular-nums text-dte-gris">{i.hora_inicio ? hhmm(i.hora_inicio) : '—'}</span>
            <span className="min-w-0"><span className="block truncate font-semibold" title={ausencia(i) ? titleCase(i.accion) : lugar(i)}>{ausencia(i) ? titleCase(i.accion) : lugar(i)}</span>{!ausencia(i) && <span className="flex items-center gap-1.5 text-xs text-dte-gris"><span className={`size-2 shrink-0 rounded-full ${actionStyle[i.accion]?.dot}`} />{titleCase(i.accion)}{i.hora_fin ? ` · hasta ${hhmm(i.hora_fin)}` : ''}</span>}</span>
          </button>
        </li>)}</ul>}
      </li>
    })}</ul>
  </>
}

// Semana: grilla FED × día con un punto por acción y, en pantallas anchas, la primera visita.
function VistaSemana({ equipo, lunes, hoy, deDia, feriados, onCelda }: { equipo: Fed[], lunes: Date, hoy: string, deDia: (f: Fed, d: string) => AgendaItem[], feriados: Map<string, { nombre: string, tipo: string }[]>, onCelda: (f: Fed, d: Date) => void }) {
  const dias = Array.from({ length: 5 }, (_, k) => addDays(lunes, k))
  return <div className="overflow-hidden rounded-card border border-dte-linea bg-white">
    <div className="grid grid-cols-[3rem_repeat(5,minmax(0,1fr))] border-b border-dte-linea bg-dte-fondo text-center text-xs font-semibold text-dte-gris sm:grid-cols-[10rem_repeat(5,minmax(0,1fr))]">
      <span className="py-2 text-left sm:px-3">FED</span>
      {dias.map(d => <span key={iso(d)} className={`py-2 ${iso(d) === hoy ? 'text-dte-petroleo' : ''}`}><span className="block uppercase">{fmt(d, { weekday: 'short' }).replace('.', '')}</span><span className={`mx-auto mt-0.5 flex size-6 items-center justify-center rounded-full text-sm ${iso(d) === hoy ? 'bg-pba-celeste text-white' : 'text-dte-tinta'}`}>{d.getDate()}</span></span>)}
    </div>
    <ul className="divide-y divide-dte-linea">{equipo.map(f => <li key={f.id} className="grid grid-cols-[3rem_repeat(5,minmax(0,1fr))] sm:grid-cols-[10rem_repeat(5,minmax(0,1fr))]">
      <span className="flex items-center truncate px-1 text-xs font-semibold sm:px-3 sm:text-sm" title={f.nombre_completo}><span className="sm:hidden">{f.nombre_completo.split(' ').map(p => p[0]).slice(0, 2).join('')}</span><span className="hidden truncate sm:inline">{firstName(f.nombre_completo)} {f.nombre_completo.split(' ').slice(1, 2).join('')}</span></span>
      {dias.map(d => {
        const l = deDia(f, iso(d)), aus = l.find(ausencia), fer = (feriados.get(iso(d)) ?? []).some(x => x.tipo !== 'distrital'), prim = l.find(i => !ausencia(i))
        return <button key={iso(d)} type="button" onClick={() => onCelda(f, d)} aria-label={`${f.nombre_completo}, ${fmt(d, { weekday: 'long', day: 'numeric' })}: ${aus ? titleCase(aus.accion) : l.length ? `${l.length} ${l.length === 1 ? 'acción' : 'acciones'}` : 'sin acciones'}`}
          className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 border-l border-dte-linea p-1 transition hover:bg-dte-tinte sm:items-start sm:px-2 ${fer ? 'bg-feriado-fondo' : iso(d) === hoy ? 'bg-info-fondo' : ''}`}>
          {aus ? <span className="rounded-full bg-aviso-fondo-fuerte px-1.5 text-xs font-semibold text-aviso-fuerte">{aus.accion === 'PARO' ? 'Paro' : 'Lic.'}</span>
            : <><span className="flex flex-wrap justify-center gap-0.5">{l.slice(0, 6).map(i => <span key={i.id} className={`size-2 rounded-full ${actionStyle[i.accion]?.dot}`} />)}</span>
              {prim && <span className="hidden w-full truncate text-left text-xs lg:block" title={lugar(prim)}>{lugar(prim)}</span>}</>}
        </button>
      })}
    </li>)}</ul>
  </div>
}

// Próximas visitas: las acciones de los próximos 7 días agrupadas por día.
function VistaProximas({ equipo, delFed, feds, onSelect }: { equipo: Fed[], delFed: Map<string, AgendaItem[]>, feds: Fed[], onSelect: (i: AgendaItem) => void }) {
  const ids = new Set(equipo.map(f => f.id))
  const vistos = new Set<string>()
  const lista = [...delFed.entries()].filter(([id]) => ids.has(id)).flatMap(([, l]) => l).filter(i => !ausencia(i) && !vistos.has(i.id) && vistos.add(i.id))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio ?? '99').localeCompare(b.hora_inicio ?? '99'))
  const porDia = new Map<string, AgendaItem[]>()
  for (const i of lista) porDia.set(i.fecha, [...(porDia.get(i.fecha) ?? []), i])
  const nombre = (id: string) => feds.find(f => f.id === id)?.nombre_completo ?? ''
  if (!lista.length) return <Vacio icono={CalendarClock} titulo="No hay visitas planificadas en los próximos 7 días" texto="Cuando el equipo cargue acciones en escuelas, van a aparecer acá." />
  return <div className="flex flex-col gap-4">{[...porDia.entries()].map(([d, l]) => <section key={d} aria-label={fmt(parse(d), { weekday: 'long', day: 'numeric', month: 'long' })}>
    <h4 className="mb-2 text-sm font-bold capitalize">{fmt(parse(d), { weekday: 'long', day: 'numeric', month: 'long' })} <span className="font-normal text-dte-gris">· {l.length}</span></h4>
    <ul className="divide-y divide-dte-linea overflow-hidden rounded-card border border-dte-linea bg-white">{l.map(i => <li key={i.id}>
      <button type="button" onClick={() => onSelect(i)} className="grid w-full grid-cols-[3.5rem_1fr] gap-x-3 gap-y-1 p-3 text-left transition hover:bg-dte-tinte sm:grid-cols-[4rem_1fr_auto] sm:items-center">
        <span className="row-span-2 text-sm font-semibold tabular-nums sm:row-span-1">{i.hora_inicio ? hhmm(i.hora_inicio) : '—'}</span>
        <span className="min-w-0"><span className="block truncate font-semibold" title={lugar(i)}>{lugar(i)}</span><span className="flex items-center gap-1 truncate text-xs text-dte-gris">{i.school?.distrito && <><MapPin className="size-3 shrink-0" />{titleCase(i.school.distrito)} · </>}{[nombre(i.fed_id), ...i.participantes.filter(p => p.respuesta !== 'rechaza').map(p => firstName(nombre(p.fed_id)))].filter(Boolean).join(', ')}</span></span>
        <span className="flex flex-wrap gap-1 sm:justify-self-end"><EtiquetasAccion item={i} /></span>
      </button>
    </li>)}</ul>
  </section>)}</div>
}
