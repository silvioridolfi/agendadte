'use client'

import { Segmented } from '@/components/ui/segmented'
import { exportarPlanilla } from '@/lib/exportar'
import { useEffect, useMemo, useState } from 'react'
import { CalendarX2, Check, ClipboardCheck, Clock, ListChecks, Loader2, Plus, Users, WifiOff, FileSpreadsheet } from 'lucide-react'
import { BarraSeleccion, PanelFinDeSemana } from '@/components/app/seleccion'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CON_ENCUENTRO, ESTADOS, type AgendaItem, type Feriado, type EventoDte, type Estado, type Fed } from '@/lib/agenda'
import { FotosChip } from '@/components/app/fotosconteo'
import { EventoTag, useEventos } from '@/components/app/eventos'
import { agruparVisitas } from '@/lib/visita'
import { Confirmar } from '@/components/ui/confirmar'
import { cambiarEstadoVarias, errMsg, BotonRealizar, puedeRealizar, EtiquetasAccion, actionStyle, eyebrow, iso, parse, addDays, fmt, cap, hhmm, timeRange, weekTitle, schoolName, ddjjFor, itemTitle, itemCorto, cueLugar, firstName, getFedItems, storage, StatusBadge, ErrorBox, Skeleton, Vacio, useItems, WeekNav, CalView, CAL_VIEWS, CAL_KEY, DIAS_HABILES, isWeekday, toWeekday, monthStart, calBounds, calShift, monthWeeks, useFeriados, FeriadoTag } from '@/components/app/comun'
import { hoyAR, fechaHoyAR } from '@/lib/hora'

export function AgendaView({ fed, feds, reloadKey, onNew, onSelect, onCambio, onRealizar }: { fed: Fed, feds: Fed[], reloadKey: number, onNew?: (fecha?: string) => void, onSelect: (item: AgendaItem) => void, onCambio?: (msg: string) => void, onRealizar?: (item: AgendaItem) => void }) {
  // Selección múltiple (null = apagada): sólo acciones propias, para cambiar estado o eliminar en bloque.
  const [sel, setSel] = useState<string[] | null>(null)
  const editable = !!onNew && !!onCambio
  const toggleSel = (id: string) => setSel(l => (l ? (l.includes(id) ? l.filter(x => x !== id) : [...l, id]) : l))
  // Una visita (varias acciones en el mismo lugar y horario) se muestra en una sola tarjeta; al seleccionarla, entran todas.
  const card = (item: AgendaItem) => { const ids = item.visita?.map(v => v.id) ?? [item.id]; return sel && item.fed_id === fed.id
    ? <ItemCard key={item.id} item={item} viewer={fed.id} seleccionado={ids.every(id => sel.includes(id))} onClick={() => setSel(l => (l ? (ids.every(id => l.includes(id)) ? l.filter(x => !ids.includes(x)) : [...new Set([...l, ...ids])]) : l))} />
    : <ItemCard key={item.id} item={item} viewer={fed.id} onClick={() => onSelect(item)} onRealizar={onRealizar} /> }
  const selDia = (key: string) => { const ids = (byDay.get(key) ?? []).filter(i => i.fed_id === fed.id).map(i => i.id); setSel(l => { const base = l ?? []; const todos = ids.every(id => base.includes(id)); return todos ? base.filter(id => !ids.includes(id)) : [...new Set([...base, ...ids])] }) }
  const [exportando, setExportando] = useState(false)
  // Planilla del período visible: las acciones propias (las compartidas figuran en la planilla de quien las creó).
  async function exportar() {
    if (!items) return
    setExportando(true)
    try {
      const propias = items.filter(i => i.fed_id === fed.id)
      await exportarPlanilla({ titulo: `Planilla ${fed.nombre_completo}`, desde: iso(from), hasta: iso(to), items: propias, feds, porFed: false,
        encuentros: propias.flatMap(i => (i.encuentros ?? []).map(e => ({ ...e, school: e.school ?? i.school }))) })
    } finally { setExportando(false) }
  }
  const [view, setViewState] = useState<CalView>(() => (storage(() => localStorage.getItem(CAL_KEY)) as CalView) || 'week')
  const setView = (v: CalView) => { setViewState(v); storage(() => localStorage.setItem(CAL_KEY, v)) }
  const [anchor, setAnchor] = useState(() => toWeekday(fechaHoyAR()))
  const [from, to] = calBounds(anchor, view)
  const { items, error, retry, desdeCache } = useItems(() => getFedItems(fed.id, iso(from), iso(to)), [fed.id, iso(from), iso(to), reloadKey], `${fed.id}:${iso(from)}:${iso(to)}`)
  const feriados = useFeriados(iso(from), iso(to), fed.rol === 'coordinacion' ? null : fed.distritos_a_cargo)
  // Eventos DTE: en la agenda propia de un FED se puede registrar la participación desde la marca del evento.
  const eventos = useEventos(iso(from), iso(to)), registrar = !!onNew
  const today = hoyAR()
  const byDay = useMemo(() => { const m = new Map<string, AgendaItem[]>(); for (const i of items ?? []) m.set(i.fecha, [...(m.get(i.fecha) ?? []), i]); return m }, [items])
  const weekendItems = useMemo(() => (items ?? []).filter(i => !isWeekday(parse(i.fecha))), [items])
  const counts = useMemo(() => Object.fromEntries(ESTADOS.map(e => [e, (items ?? []).filter(i => i.estado === e).length])) as Record<Estado, number>, [items])
  const inRange = today >= iso(from) && today <= iso(to)
  const puedeAgregar = (d: Date) => habil(d, feriados.get(iso(d)) ?? [])
  const suggested = view === 'day' ? iso(anchor) : inRange ? iso(toWeekday(fechaHoyAR())) : iso(toWeekday(from))
  const goDay = (d: Date) => { setAnchor(d); setView('day') }
  const periodo = { day: 'este día', week: 'esta semana', month: 'este mes', semester: 'estos 6 meses', list: 'este año' }[view]
  const title = view === 'day' ? cap(fmt(anchor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    : view === 'week' ? weekTitle(from, addDays(from, 4))
    : view === 'month' ? cap(fmt(from, { month: 'long', year: 'numeric' }))
    : view === 'list' ? `Mis acciones ${from.getFullYear()}`
    : `${cap(fmt(from, { month: 'long' }))} – ${fmt(to, { month: 'long', year: 'numeric' })}`

  const dayHeader = (d: Date, big = false) => {
    const key = iso(d), isToday = key === today
    return <div className="flex items-baseline gap-1.5" aria-current={isToday ? 'date' : undefined}>
      <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-pba-celeste-texto' : 'text-dte-gris'}`}>{fmt(d, { weekday: big ? 'long' : 'short' }).replace('.', '')}</span>
      <span className={`flex size-7 items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-pba-celeste text-white' : 'text-dte-tinta'}`}>{d.getDate()}</span>
      {isToday && <span className="text-xs font-semibold text-pba-celeste-texto">Hoy</span>}
    </div>
  }

  return <main className={`mx-auto w-full min-w-0 max-w-[1440px] px-4 pt-6 lg:px-10 ${sel ? 'pb-64 md:pb-40' : 'pb-8 lg:pb-10'}`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className={eyebrow}>Mi agenda · {CAL_VIEWS.find(v => v[0] === view)?.[1]}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl lg:text-2xl 2xl:text-3xl">{title}</h2>
        <p className="mt-1.5 text-sm text-dte-gris">Hola, {firstName(fed.nombre_completo)}. {items ? (items.length ? `Tenés ${items.length} ${items.length === 1 ? 'acción' : 'acciones'} en ${periodo}${counts.realizada ? `, ${counts.realizada} ${counts.realizada === 1 ? 'realizada' : 'realizadas'}` : ''}.` : `No hay acciones cargadas en ${periodo}.`) : 'Cargando…'}{ddjjFor(fed, today) && <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-dte-linea"><Clock className="size-3" />Hoy DTE {ddjjFor(fed, today)!.dte}</span>}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
        <Segmented label="Vista" value={view} options={CAL_VIEWS} onChange={setView} />
        <WeekNav prevLabel="Anterior" nextLabel="Siguiente" onPrev={() => setAnchor(calShift(anchor, view, -1))} onToday={() => setAnchor(toWeekday(fechaHoyAR()))} onNext={() => setAnchor(calShift(anchor, view, 1))} />
        <Button size="lg" variant="outline" disabled={!items?.length || exportando} onClick={exportar} title="Descargar la planilla del período en Excel" aria-label="Exportar la planilla del período a Excel" className="px-3 md:h-10"><FileSpreadsheet />{exportando && <Loader2 className="animate-spin" />}</Button>
        {editable && ['day', 'week', 'list'].includes(view) && <Button size="lg" variant={sel ? 'default' : 'outline'} onClick={() => setSel(s => (s ? null : []))} aria-pressed={!!sel} className={`px-3 md:h-10 ${sel ? 'bg-dte-petroleo hover:bg-dte-petroleo-oscuro' : ''}`}><ListChecks data-icon="inline-start" />Seleccionar</Button>}
        {onNew && <Button size="lg" variant="marca" onClick={() => onNew(suggested)} className="hidden px-4 md:inline-flex"><Plus data-icon="inline-start" />Nueva acción</Button>}
      </div>
    </div>

    <div className="mt-6">
      {desdeCache && <p role="status" className="mb-3 flex items-center gap-2 rounded-tile border border-aviso-borde bg-aviso-fondo px-3 py-2 text-sm text-aviso"><WifiOff className="size-4 shrink-0" />Sin conexión: estás viendo la copia guardada el {new Date(desdeCache).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Lo que cargues se envía al volver la señal.</p>}
      {error ? <ErrorBox message={error} onRetry={retry} />
        : !items ? <Skeleton className="h-72" />
        : view === 'day' ? <section className="rounded-card border border-dte-linea bg-white p-4">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">{dayHeader(anchor, true)}{sel && (byDay.get(iso(anchor)) ?? []).some(i => i.fed_id === fed.id) && <Button variant="outline" size="sm" onClick={() => selDia(iso(anchor))}><ListChecks data-icon="inline-start" />Todo el día</Button>}<div className="flex flex-wrap gap-1.5">{(feriados.get(iso(anchor)) ?? []).map(f => <FeriadoTag key={f.nombre} f={f} />)}{(eventos.get(iso(anchor)) ?? []).map(e => <EventoTag key={e.id} e={e} registrar={registrar} />)}</div></header>
            {(byDay.get(iso(anchor)) ?? []).length
              ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{agruparVisitas(byDay.get(iso(anchor)) ?? []).map(card)}</div>
              : !onNew || !puedeAgregar(anchor) ? <p className="rounded-tile border border-dashed border-dte-linea py-10 text-center text-sm text-dte-gris">Sin acciones</p> : <button onClick={() => onNew(iso(anchor))} className="flex w-full flex-col items-center gap-2 rounded-tile border border-dashed border-dte-linea py-10 text-sm text-dte-gris hover:border-dte-magenta hover:text-dte-magenta"><Plus />Sin acciones · agregar una</button>}
          </section>
        : view === 'week' ? <div className="grid gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => addDays(from, i)).map(d => {
              const key = iso(d), list = byDay.get(key) ?? [], fer = feriados.get(key) ?? []
              return <section key={key} aria-label={cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))} className={`group/day flex flex-col rounded-card border p-2.5 lg:min-h-72 ${key === today ? 'border-pba-celeste bg-white shadow-[0_0_0_1px] shadow-pba-celeste' : fer.length ? 'border-feriado-borde bg-feriado-fondo' : 'border-dte-linea bg-white'}`}>
                <header className="mb-2 flex items-center justify-between px-1">{dayHeader(d)}{sel ? (list.some(i => i.fed_id === fed.id) && <Button variant="ghost" size="sm" onClick={() => selDia(key)} className="text-dte-petroleo">Todo el día</Button>) : onNew && puedeAgregar(d) && <Button variant="ghost" size="icon-sm" aria-label={`Agregar acción el ${fmt(d, { weekday: 'long', day: 'numeric' })}`} onClick={() => onNew(key)} className="text-dte-gris hover:text-dte-magenta lg:opacity-0 lg:group-hover/day:opacity-100 lg:focus-visible:opacity-100"><Plus /></Button>}</header>
                {fer.length > 0 && <div className="mb-2 flex flex-col gap-1 px-1">{fer.map(f => <FeriadoTag key={f.nombre} f={f} />)}</div>}
                {(eventos.get(key) ?? []).length > 0 && <div className="mb-2 flex flex-col gap-1 px-1">{eventos.get(key)!.map(e => <EventoTag key={e.id} e={e} registrar={registrar} />)}</div>}
                <div className="flex flex-1 flex-col gap-2">
                  {agruparVisitas(list).map(card)}
                  {!list.length && <p className="px-1 pb-1 text-xs text-dte-gris-claro">{fer.length ? 'No laborable' : 'Sin acciones'}</p>}
                </div>
              </section>
            })}
          </div>
        : view === 'month' ? <MonthGrid month={from} byDay={byDay} feriados={feriados} eventos={eventos} registrar={registrar} today={today} onDay={goDay} onSelect={onSelect} onNew={onNew} viewer={fed.id} onRealizar={onRealizar} />
        : view === 'list' ? <ListaAcciones items={items} viewer={fed.id} onSelect={onSelect} sel={sel} onToggle={toggleSel} onRealizar={onRealizar} />
        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => monthStart(from, i)).map(m => <MiniMonth key={iso(m)} month={m} byDay={byDay} feriados={feriados} today={today} onDay={goDay} />)}</div>}
    </div>

    {editable && onRealizar && <PendientesCerrar fed={fed} reloadKey={reloadKey} onSelect={onSelect} onRealizar={onRealizar} onCambio={m => onCambio?.(m)} />}
    {items && weekendItems.length > 0 && view !== 'semester' && view !== 'list' && <PanelFinDeSemana key={iso(from)} items={weekendItems} viewer={fed.id} editable={editable} onSelect={onSelect} onCambio={m => onCambio?.(m)} />}
    {sel && <BarraSeleccion ids={sel} onListo={() => setSel(null)} onCambio={m => onCambio?.(m)} />}

    {(view === 'month' || view === 'semester') && <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-dte-gris"><span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-feriado-marca ring-1 ring-pba-fucsia/40" />Feriado nacional</span><span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-aniversario-marca ring-1 ring-cat-institucional/40" />Aniversario distrital</span><span>* fecha a confirmar</span><span>Tocá un día para verlo en detalle.</span></p>}

  </main>
}

// Sólo se agregan acciones en días hábiles (los aniversarios distritales no cortan para todos).
const habil = (d: Date, fer: Feriado[]) => isWeekday(d) && !fer.some(f => f.tipo !== 'distrital')

export function MonthGrid({ month, byDay, feriados, eventos, registrar = false, today, onDay, onSelect, onNew, viewer, onRealizar }: { viewer?: string, onRealizar?: (item: AgendaItem) => void,  month: Date, byDay: Map<string, AgendaItem[]>, feriados: Map<string, Feriado[]>, eventos?: Map<string, EventoDte[]>, registrar?: boolean, today: string, onDay: (d: Date) => void, onSelect: (i: AgendaItem) => void, onNew?: (fecha: string) => void }) {
  // En móvil, tocar un día abre una hoja con sus acciones y el atajo para agregar.
  const [dia, setDia] = useState<Date | null>(null)
  const diaKey = dia ? iso(dia) : '', diaList = dia ? byDay.get(diaKey) ?? [] : [], diaFer = dia ? feriados.get(diaKey) ?? [] : []
  return <><div className="overflow-hidden rounded-card border border-dte-linea bg-white">
    <div className="grid grid-cols-5 border-b border-dte-linea bg-dte-fondo text-center text-xs font-bold uppercase tracking-wider text-dte-gris">{DIAS_HABILES.map(d => <div key={d} className="py-2">{d}</div>)}</div>
    {monthWeeks(month).map((week, wi) => <div key={wi} className="grid grid-cols-5 border-b border-dte-linea last:border-b-0">
      {week.map((d, di) => {
        if (!d) return <div key={di} className="min-h-24 border-r border-dte-linea bg-dte-fondo/60 last:border-r-0 sm:min-h-32" />
        const key = iso(d), list = byDay.get(key) ?? [], fer = feriados.get(key) ?? []
        return <div key={di} className={`group relative flex min-h-24 flex-col gap-1 border-r border-dte-linea p-1.5 last:border-r-0 sm:min-h-32 ${fer.some(f => f.tipo !== 'distrital') ? 'bg-feriado-fondo' : fer.length ? 'bg-aniversario-fondo' : ''}`}>
          <span aria-hidden className={`flex size-7 items-center justify-center self-start rounded-full text-sm font-bold sm:hidden ${key === today ? 'bg-pba-celeste text-white ring-2 ring-pba-celeste/30 ring-offset-1' : ''}`}>{d.getDate()}</span>
          <button onClick={() => onDay(d)} aria-label={cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))} className={`hidden sm:flex size-7 items-center justify-center self-start rounded-full text-sm font-bold hover:bg-dte-tinte ${key === today ? 'bg-pba-celeste text-white ring-2 ring-pba-celeste/30 ring-offset-1 hover:bg-pba-celeste' : ''}`}>{d.getDate()}</button>
          {onNew && habil(d, fer) && <button onClick={() => onNew(key)} aria-label={`Agregar acción el ${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}`} title="Agregar acción" className="absolute right-1.5 top-1.5 hidden size-7 sm:flex items-center justify-center rounded-full text-dte-gris transition hover:bg-dte-magenta hover:text-white focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><Plus className="size-4" /></button>}
          {fer.map(f => <span key={f.nombre} className="hidden sm:block"><FeriadoTag f={f} /></span>)}
          {fer.length > 0 && <span className="sm:hidden"><FeriadoTag f={fer[0]} compact /></span>}
          {(eventos?.get(key) ?? []).map(e => <span key={e.id} className="hidden sm:block"><EventoTag e={e} registrar={registrar} /></span>)}
          {!fer.length && (eventos?.get(key) ?? []).length > 0 && <span className="sm:hidden"><EventoTag e={eventos!.get(key)![0]} compact registrar={registrar} /></span>}
          {agruparVisitas(list).slice(0, 3).map(i => <button key={i.id} onClick={() => onSelect(i)} title={itemTitle(i)} className={`hidden items-center gap-1 truncate rounded px-1 py-0.5 text-left text-xs hover:bg-dte-tinte sm:flex ${i.estado === 'cancelada' ? 'opacity-60 line-through' : ''}`}><span className={`size-1.5 shrink-0 rounded-full ${actionStyle[i.accion]?.dot}`} /><span className="truncate">{i.hora_inicio ? `${hhmm(i.hora_inicio)} ` : ''}{itemCorto(i)}</span></button>)}
          {agruparVisitas(list).length > 3 && <button onClick={() => onDay(d)} className="hidden px-1 text-left text-xs font-semibold text-dte-petroleo sm:block">+{agruparVisitas(list).length - 3} más</button>}
          {list.length > 0 && <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>{list.slice(0, 6).map(i => <span key={i.id} className={`size-2 rounded-full ${actionStyle[i.accion]?.dot}`} />)}</span>}
          <button onClick={() => setDia(d)} className="absolute inset-0 sm:hidden" aria-label={`${cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))}: ${list.length ? `${list.length} ${list.length === 1 ? 'acción' : 'acciones'}` : 'sin acciones'}`} />
        </div>
      })}
    </div>)}
  </div>
  <Dialog open={!!dia} onOpenChange={o => !o && setDia(null)}>
    <DialogContent className="bg-white">
      <DialogHeader><DialogTitle className="text-lg">{dia ? cap(fmt(dia, { weekday: 'long', day: 'numeric', month: 'long' })) : ''}</DialogTitle><DialogDescription>{diaList.length ? `${diaList.length} ${diaList.length === 1 ? 'acción' : 'acciones'}` : 'Sin acciones cargadas.'}</DialogDescription></DialogHeader>
      {diaFer.length > 0 && <div className="flex flex-wrap gap-1">{diaFer.map(f => <FeriadoTag key={f.nombre} f={f} />)}</div>}
      {(eventos?.get(diaKey) ?? []).length > 0 && <div className="flex flex-wrap gap-1">{eventos!.get(diaKey)!.map(e => <EventoTag key={e.id} e={e} registrar={registrar} />)}</div>}
      {diaList.length > 0 && <ul className="flex flex-col gap-2">{agruparVisitas([...diaList].sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))).map(i => <li key={i.id}><ItemCard item={i} viewer={viewer} onRealizar={onRealizar} onClick={() => { setDia(null); onSelect(i) }} /></li>)}</ul>}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => { const d = dia; setDia(null); if (d) onDay(d) }}>Ver día completo</Button>
        {onNew && dia && habil(dia, diaFer) && <Button variant="marca" onClick={() => { setDia(null); onNew(diaKey) }}><Plus />Agregar acción</Button>}
      </div>
    </DialogContent>
  </Dialog></>
}

export function MiniMonth({ month, byDay, feriados, today, onDay }: { month: Date, byDay: Map<string, AgendaItem[]>, feriados: Map<string, Feriado[]>, today: string, onDay: (d: Date) => void }) {
  const total = monthWeeks(month).flat().reduce((a, d) => a + (d ? (byDay.get(iso(d))?.length ?? 0) : 0), 0)
  return <section className="rounded-card border border-dte-linea bg-white p-3">
    <header className="mb-2 flex items-baseline justify-between"><h3 className="font-bold capitalize">{fmt(month, { month: 'long', year: 'numeric' })}</h3><span className="text-xs text-dte-gris">{total} {total === 1 ? 'acción' : 'acciones'}</span></header>
    <div className="grid grid-cols-5 gap-1 text-center text-xs font-bold uppercase text-dte-gris-claro">{DIAS_HABILES.map(d => <div key={d}>{d}</div>)}</div>
    {monthWeeks(month).map((week, wi) => <div key={wi} className="mt-1 grid grid-cols-5 gap-1">
      {week.map((d, di) => {
        if (!d) return <div key={di} />
        const key = iso(d), n = byDay.get(key)?.length ?? 0, fer = feriados.get(key) ?? []
        const nacional = fer.some(f => f.tipo !== 'distrital')
        return <button key={di} onClick={() => onDay(d)} title={[cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })), ...fer.map(f => f.nombre + (f.confirmado ? '' : ' (a confirmar)')), n ? `${n} ${n === 1 ? 'acción' : 'acciones'}` : ''].filter(Boolean).join(' · ')}
          className={`relative flex h-9 flex-col items-center justify-center rounded-md text-xs transition hover:ring-2 hover:ring-pba-celeste ${key === today ? 'font-bold ring-2 ring-pba-celeste' : ''} ${nacional ? 'bg-peligro-suave text-peligro' : fer.length ? 'bg-aniversario-marca text-aniversario-texto' : n ? 'bg-dte-petroleo/10' : 'bg-dte-fondo'}`}>
          <span>{d.getDate()}</span>
          {n > 0 && <span className="text-xs font-bold leading-none text-dte-petroleo">{n}</span>}
        </button>
      })}
    </div>)}
  </section>
}

// Vista Lista de Mi agenda: de la acción más nueva a la más antigua, de a 20.
export function ListaAcciones({ items, viewer, onSelect, sel, onToggle, onRealizar }: { items: AgendaItem[], viewer: string, onSelect: (i: AgendaItem) => void, sel?: string[] | null, onToggle?: (id: string) => void, onRealizar?: (item: AgendaItem) => void }) {
  // Orden cronológico hacia adelante: arranca en hoy y sigue con lo próximo; lo anterior se despliega arriba a pedido.
  const hoy = hoyAR()
  const orden = useMemo(() => agruparVisitas([...items].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio ?? '99').localeCompare(b.hora_inicio ?? '99') || a.created_at.localeCompare(b.created_at))), [items])
  const inicioHoy = useMemo(() => { const i = orden.findIndex(x => x.fecha >= hoy); return i === -1 ? orden.length : i }, [orden, hoy])
  const [anteriores, setAnteriores] = useState(0)
  const [n, setN] = useState(20)
  if (!orden.length) return <Vacio icono={CalendarX2} titulo="No hay acciones cargadas en este año" texto="Las acciones que agregues van a aparecer acá, de hoy en adelante." />
  const desde = Math.max(0, inicioHoy - anteriores), visibles = orden.slice(desde, inicioHoy + n)
  return <div className="flex flex-col gap-3">
    {desde > 0 && <div className="flex items-center justify-center gap-2"><Button variant="outline" size="sm" onClick={() => setAnteriores(a => a + 20)}>Ver {Math.min(20, desde)} anteriores</Button><span className="text-xs text-dte-gris">{desde} acciones antes de hoy</span></div>}
    {!visibles.length ? <p className="rounded-card border border-dashed border-dte-linea bg-white/60 p-6 text-center text-sm text-dte-gris">No hay acciones de hoy en adelante.</p>
    : <ul className="divide-y divide-dte-linea overflow-hidden rounded-card border border-dte-linea bg-white shadow-e1">{visibles.map(item =>
      <li key={item.id} className="group/check relative"><button onClick={() => (sel && onToggle && item.fed_id === viewer ? onToggle(item.id) : onSelect(item))} aria-pressed={sel && item.fed_id === viewer ? sel.includes(item.id) : undefined} className={`grid w-full grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 p-3.5 text-left transition hover:bg-dte-tinte sm:grid-cols-[6.5rem_1fr_auto] sm:items-center ${sel?.includes(item.id) ? 'bg-dte-tinte ring-2 ring-inset ring-dte-petroleo' : ''}`}>
        <span className="row-span-2 text-sm sm:row-span-1"><span className="block font-semibold capitalize">{fmt(parse(item.fecha), { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')}</span><span className="block text-xs text-dte-gris">{hhmm(item.hora_inicio) || 'Sin horario'}</span></span>
        <span className={`min-w-0 ${item.estado === 'cancelada' ? 'opacity-65' : ''}`}><span className="line-clamp-2 font-semibold leading-snug">{itemCorto(item)}</span><span className="block truncate text-xs text-dte-gris" title={[cueLugar(item.school), item.sub_accion].filter(Boolean).join(' · ') || undefined}>{[cueLugar(item.school), item.sub_accion].filter(Boolean).join(' · ') || ' '}</span></span>
        <span className="flex flex-wrap items-center gap-2 sm:justify-end"><ChipsVisita item={item} /><FotosChip item={item} />{item.fed_id !== viewer && <span className="inline-flex items-center gap-0.5 rounded-full bg-dte-tinte px-1.5 py-0.5 text-xs font-semibold text-dte-petroleo"><Users className="size-3" />Compartida</span>}</span>
      </button>{onRealizar && !sel && puedeRealizar(item, viewer) && <BotonRealizar item={item} onRealizar={onRealizar} className="absolute right-1 top-1 md:opacity-0 md:group-hover/check:opacity-100" />}</li>)}</ul>}
    {orden.length > inicioHoy + n && <div className="flex items-center justify-center gap-2"><Button variant="outline" size="sm" onClick={() => setN(n + 20)}>Ver {Math.min(20, orden.length - inicioHoy - n)} próximas</Button><span className="text-xs text-dte-gris">Mostrando {visibles.length} de {orden.length}</span></div>}
  </div>
}

// `seleccionado` (definido): la tarjeta está en modo selección y muestra su casilla.
export function ItemCard({ item, onClick, viewer, seleccionado, onRealizar }: { item: AgendaItem, onClick: () => void, viewer?: string, seleccionado?: boolean, onRealizar?: (item: AgendaItem) => void }) {
  const muted = item.estado === 'cancelada'
  const conCheck = !!onRealizar && seleccionado === undefined && puedeRealizar(item, viewer)
  const tarjeta = <button onClick={onClick} aria-pressed={seleccionado} title={item.school ? schoolName(item.school) : undefined} className={`relative w-full ${seleccionado ? 'ring-2 ring-dte-petroleo border-dte-petroleo' : ''} overflow-hidden rounded-tile border border-dte-linea bg-white p-2.5 pl-3.5 text-left transition hover:border-pba-celeste hover:shadow-e2 focus-visible:border-pba-celeste focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-pba-celeste/30 ${muted ? 'opacity-65' : ''}`}>
    {seleccionado !== undefined && <span aria-hidden className={`absolute right-2 top-2 flex size-5 items-center justify-center rounded-md border ${seleccionado ? 'border-dte-petroleo bg-dte-petroleo text-white' : 'border-dte-gris-claro bg-white'}`}>{seleccionado && <Check className="size-3.5" />}</span>}
    <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${actionStyle[item.accion]?.dot}`} />
    <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-dte-gris"><Clock className="size-3 shrink-0" />{timeRange(item)}</span>
    <p className={`mt-1 line-clamp-3 text-sm font-semibold leading-snug ${muted ? 'line-through decoration-1' : ''}`}>{itemCorto(item)}</p>
    {item.school && <p className="mt-0.5 truncate text-xs text-dte-gris" title={cueLugar(item.school)}>{cueLugar(item.school)}</p>}
    <div className="mt-2 flex flex-wrap items-center gap-1.5"><ChipsVisita item={item} /><FotosChip item={item} />{(item.participantes?.length > 0 || (viewer && item.fed_id !== viewer)) && <span title={viewer && item.fed_id !== viewer ? 'Te etiquetaron en esta acción' : 'Con compañeros'} className="inline-flex items-center gap-0.5 rounded-full bg-dte-tinte px-1.5 py-0.5 text-xs font-semibold text-dte-petroleo"><Users className="size-3" />{viewer && item.fed_id !== viewer ? 'Compartida' : `+${item.participantes.length}`}</span>}</div>
  </button>
  if (!conCheck) return tarjeta
  return <div className="group/check relative">{tarjeta}<BotonRealizar item={item} onRealizar={onRealizar!} className="absolute right-0.5 top-0.5 md:right-1 md:top-1 md:opacity-0 md:group-hover/check:opacity-100" /></div>
}

// Etiquetas de una acción o de todas las de su visita; el estado se muestra una vez si coincide.
function ChipsVisita({ item }: { item: AgendaItem }) {
  const vs = item.visita ?? [item], mismoEstado = vs.every(v => v.estado === item.estado)
  return <><EtiquetasAccion item={item} />{mismoEstado ? <StatusBadge status={item.estado} /> : <span className="text-xs font-semibold text-dte-gris">Estados distintos</span>}</>
}

// Pendientes de cerrar: acciones propias de los últimos 7 días (sin contar hoy) que siguen planificadas o reprogramadas.
function PendientesCerrar({ fed, reloadKey, onSelect, onRealizar, onCambio }: { fed: Fed, reloadKey: number, onSelect: (i: AgendaItem) => void, onRealizar: (i: AgendaItem) => void, onCambio: (msg: string) => void }) {
  const hoy = fechaHoyAR(), desde = iso(addDays(hoy, -7)), hasta = iso(addDays(hoy, -1))
  const clave = `${fed.id}:${desde}:${reloadKey}`
  const [res, setRes] = useState<{ clave: string, items: AgendaItem[] } | null>(null)
  useEffect(() => {
    let vivo = true
    getFedItems(fed.id, desde, hasta).then(l => vivo && setRes({ clave, items: l.filter(i => i.fed_id === fed.id && (i.estado === 'planificada' || i.estado === 'reprogramada')) })).catch(() => {})
    return () => { vivo = false }
  }, [clave, fed.id, desde, hasta])
  const [abierto, setAbierto] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState('')
  // Mientras recarga se mantiene la lista anterior del mismo período, para que el aviso no parpadee.
  const base = `${fed.id}:${desde}:`
  const pendientes = useMemo(() => agruparVisitas([...(res?.clave.startsWith(base) ? res.items : [])].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))), [res, base])
  if (!pendientes.length) return null
  const ids = pendientes.flatMap(i => i.visita?.map(v => v.id) ?? [i.id])
  async function todas() {
    setError('')
    try {
      const r = await cambiarEstadoVarias(ids, 'realizada')
      const conEncuentro = pendientes.some(i => (i.visita ?? [i]).some(v => CON_ENCUENTRO.includes(v.accion)))
      onCambio(`Se marcaron ${r.actualizadas} ${r.actualizadas === 1 ? 'acción' : 'acciones'} como realizadas${conEncuentro ? '. Completá los asistentes de los encuentros de clubes, prácticas y talleres.' : ''}`)
    } catch (e) { setError(errMsg(e)) }
  }
  return <section aria-label="Pendientes de cerrar" className="mb-4 rounded-card border border-aviso-borde bg-aviso-fondo p-3 text-sm text-aviso">
    <div className="flex flex-wrap items-center gap-2">
      <ClipboardCheck className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 font-semibold">{pendientes.length === 1 ? 'Tenés 1 acción' : `Tenés ${pendientes.length} acciones`} de los últimos 7 días sin marcar como realizada{pendientes.length === 1 ? '' : 's'}.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="bg-white" aria-expanded={abierto} onClick={() => setAbierto(a => !a)}>{abierto ? 'Ocultar' : 'Revisar'}</Button>
        <Button size="sm" className="bg-dte-petroleo hover:bg-dte-petroleo-oscuro" onClick={() => setConfirmar(true)}><Check data-icon="inline-start" />Marcar todas</Button>
      </div>
    </div>
    {abierto && <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{pendientes.map(i => <li key={i.id}>
      <p className="mb-1 text-xs font-semibold capitalize text-aviso">{fmt(parse(i.fecha), { weekday: 'long', day: 'numeric', month: 'short' }).replace(/\./g, '')}</p>
      <ItemCard item={i} viewer={fed.id} onClick={() => onSelect(i)} onRealizar={onRealizar} />
    </li>)}</ul>}
    {error && <div className="mt-2"><ErrorBox message={error} /></div>}
    <Confirmar abierto={confirmar} titulo="¿Marcar todas como realizadas?" accion="Marcar todas" onCerrar={() => setConfirmar(false)} onConfirmar={todas}
      descripcion={<>Se marcan como realizadas las {pendientes.length} {pendientes.length === 1 ? 'acción' : 'acciones'} pendientes de los últimos 7 días. Si alguna no se hizo, cancelala o reprogramala después.</>} />
  </section>
}
