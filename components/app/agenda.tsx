'use client'

import { exportarPlanilla } from '@/lib/exportar'
import { useMemo, useState } from 'react'
import { Clock, Plus, Users, WifiOff, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ESTADOS, type AgendaItem, type Feriado, type Estado, type Fed } from '@/lib/agenda'
import { actionStyle, eyebrow, iso, parse, addDays, fmt, cap, hhmm, timeRange, weekTitle, schoolName, shortSchoolName, schoolPlace, ddjjFor, itemTitle, firstName, getFedItems, storage, ActionChip, StatusBadge, ErrorBox, Skeleton, useItems, WeekNav, CalView, CAL_VIEWS, CAL_KEY, DIAS_HABILES, isWeekday, toWeekday, monthStart, calBounds, calShift, monthWeeks, useFeriados, FeriadoTag } from '@/components/app/comun'

export function AgendaView({ fed, feds, reloadKey, onNew, onSelect }: { fed: Fed, feds: Fed[], reloadKey: number, onNew: (fecha?: string) => void, onSelect: (item: AgendaItem) => void }) {
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
  const [anchor, setAnchor] = useState(() => toWeekday(new Date()))
  const [from, to] = calBounds(anchor, view)
  const { items, error, retry, desdeCache } = useItems(() => getFedItems(fed.id, iso(from), iso(to)), [fed.id, iso(from), iso(to), reloadKey], `${fed.id}:${iso(from)}:${iso(to)}`)
  const feriados = useFeriados(iso(from), iso(to), fed.distritos_a_cargo)
  const today = iso(new Date())
  const byDay = useMemo(() => { const m = new Map<string, AgendaItem[]>(); for (const i of items ?? []) m.set(i.fecha, [...(m.get(i.fecha) ?? []), i]); return m }, [items])
  const weekendItems = useMemo(() => (items ?? []).filter(i => !isWeekday(parse(i.fecha))), [items])
  const counts = useMemo(() => Object.fromEntries(ESTADOS.map(e => [e, (items ?? []).filter(i => i.estado === e).length])) as Record<Estado, number>, [items])
  const inRange = today >= iso(from) && today <= iso(to)
  const suggested = view === 'day' ? iso(anchor) : inRange ? iso(toWeekday(new Date())) : iso(toWeekday(from))
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
      {isToday && <span className="text-[11px] font-semibold text-pba-celeste-texto">Hoy</span>}
    </div>
  }

  return <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 lg:px-10 lg:pb-10">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className={eyebrow}>Mi agenda · {CAL_VIEWS.find(v => v[0] === view)?.[1]}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-1.5 text-sm text-dte-gris">Hola, {firstName(fed.nombre_completo)}. {items ? (items.length ? `Tenés ${items.length} ${items.length === 1 ? 'acción' : 'acciones'} en ${periodo}${counts.realizada ? `, ${counts.realizada} ${counts.realizada === 1 ? 'realizada' : 'realizadas'}` : ''}.` : `No hay acciones cargadas en ${periodo}.`) : 'Cargando…'}{ddjjFor(fed, today) && <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-dte-linea"><Clock className="size-3" />Hoy DTE {ddjjFor(fed, today)!.dte}</span>}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
        <div role="group" aria-label="Vista" className="flex rounded-lg border border-dte-linea bg-white p-1 shadow-xs">{CAL_VIEWS.map(([v, l]) => <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-md px-3 py-1 text-sm font-semibold transition ${view === v ? 'bg-dte-petroleo text-white' : 'text-dte-gris hover:text-dte-tinta'}`}>{l}</button>)}</div>
        <WeekNav prevLabel="Anterior" nextLabel="Siguiente" onPrev={() => setAnchor(calShift(anchor, view, -1))} onToday={() => setAnchor(toWeekday(new Date()))} onNext={() => setAnchor(calShift(anchor, view, 1))} />
        <Button size="lg" variant="outline" disabled={!items?.length || exportando} onClick={exportar} title="Descargar la planilla del período en Excel" aria-label="Exportar la planilla del período a Excel" className="h-10 px-3"><FileSpreadsheet />{exportando && <span className="text-xs">…</span>}</Button>
        <Button size="lg" onClick={() => onNew(suggested)} className="hidden h-10 bg-dte-magenta px-4 font-semibold text-white hover:bg-dte-magenta-oscuro sm:inline-flex"><Plus data-icon="inline-start" />Nueva acción</Button>
      </div>
    </div>

    <div className="mt-6">
      {desdeCache && <p role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-aviso-borde bg-aviso-fondo px-3 py-2 text-sm text-aviso"><WifiOff className="size-4 shrink-0" />Sin conexión: estás viendo la copia guardada el {new Date(desdeCache).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Lo que cargues se envía al volver la señal.</p>}
      {error ? <ErrorBox message={error} onRetry={retry} />
        : !items ? <Skeleton className="h-72" />
        : view === 'day' ? <section className="rounded-2xl border border-dte-linea bg-white p-4">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">{dayHeader(anchor, true)}<div className="flex flex-wrap gap-1.5">{(feriados.get(iso(anchor)) ?? []).map(f => <FeriadoTag key={f.nombre} f={f} />)}</div></header>
            {(byDay.get(iso(anchor)) ?? []).length
              ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{(byDay.get(iso(anchor)) ?? []).map(item => <ItemCard key={item.id} item={item} viewer={fed.id} onClick={() => onSelect(item)} />)}</div>
              : <button onClick={() => onNew(iso(anchor))} className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-dte-linea py-10 text-sm text-dte-gris hover:border-dte-magenta hover:text-dte-magenta"><Plus />Sin acciones · agregar una</button>}
          </section>
        : view === 'week' ? <div className="grid gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => addDays(from, i)).map(d => {
              const key = iso(d), list = byDay.get(key) ?? [], fer = feriados.get(key) ?? []
              return <section key={key} aria-label={cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))} className={`group/day flex flex-col rounded-2xl border p-2.5 lg:min-h-72 ${key === today ? 'border-pba-celeste bg-white shadow-[0_0_0_1px] shadow-pba-celeste' : fer.length ? 'border-feriado-borde bg-feriado-fondo' : 'border-dte-linea bg-white'}`}>
                <header className="mb-2 flex items-center justify-between px-1">{dayHeader(d)}<Button variant="ghost" size="icon-sm" aria-label={`Agregar acción el ${fmt(d, { weekday: 'long', day: 'numeric' })}`} onClick={() => onNew(key)} className="text-dte-gris hover:text-dte-magenta lg:opacity-0 lg:group-hover/day:opacity-100 lg:focus-visible:opacity-100"><Plus /></Button></header>
                {fer.length > 0 && <div className="mb-2 flex flex-col gap-1 px-1">{fer.map(f => <FeriadoTag key={f.nombre} f={f} />)}</div>}
                <div className="flex flex-1 flex-col gap-2">
                  {list.map(item => <ItemCard key={item.id} item={item} viewer={fed.id} onClick={() => onSelect(item)} />)}
                  {!list.length && <p className="px-1 pb-1 text-xs text-dte-gris-claro">{fer.length ? 'No laborable' : 'Sin acciones'}</p>}
                </div>
              </section>
            })}
          </div>
        : view === 'month' ? <MonthGrid month={from} byDay={byDay} feriados={feriados} today={today} onDay={goDay} onSelect={onSelect} onNew={onNew} />
        : view === 'list' ? <ListaAcciones items={items} viewer={fed.id} onSelect={onSelect} />
        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => monthStart(from, i)).map(m => <MiniMonth key={iso(m)} month={m} byDay={byDay} feriados={feriados} today={today} onDay={goDay} />)}</div>}
    </div>

    {items && weekendItems.length > 0 && view !== 'semester' && view !== 'list' && <details className="mt-4 rounded-2xl border border-dte-linea bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-dte-gris">{weekendItems.length} {weekendItems.length === 1 ? 'acción cargada' : 'acciones cargadas'} en fin de semana</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{weekendItems.map(item => <ItemCard key={item.id} item={item} viewer={fed.id} onClick={() => onSelect(item)} />)}</div>
    </details>}

    {(view === 'month' || view === 'semester') && <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-dte-gris"><span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-feriado-marca ring-1 ring-pba-fucsia/40" />Feriado nacional</span><span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-aniversario-marca ring-1 ring-cat-institucional/40" />Aniversario distrital</span><span>* fecha a confirmar</span><span>Tocá un día para verlo en detalle.</span></p>}

    <Button onClick={() => onNew(suggested)} aria-label="Nueva acción" className="fixed bottom-5 right-4 z-30 h-14 gap-2 rounded-full bg-dte-magenta px-5 text-base font-semibold text-white shadow-lg hover:bg-dte-magenta-oscuro sm:hidden"><Plus className="size-5" />Nueva</Button>
  </main>
}

export function MonthGrid({ month, byDay, feriados, today, onDay, onSelect, onNew }: { month: Date, byDay: Map<string, AgendaItem[]>, feriados: Map<string, Feriado[]>, today: string, onDay: (d: Date) => void, onSelect: (i: AgendaItem) => void, onNew: (fecha: string) => void }) {
  return <div className="overflow-hidden rounded-2xl border border-dte-linea bg-white">
    <div className="grid grid-cols-5 border-b border-dte-linea bg-dte-fondo text-center text-xs font-bold uppercase tracking-wider text-dte-gris">{DIAS_HABILES.map(d => <div key={d} className="py-2">{d}</div>)}</div>
    {monthWeeks(month).map((week, wi) => <div key={wi} className="grid grid-cols-5 border-b border-dte-linea last:border-b-0">
      {week.map((d, di) => {
        if (!d) return <div key={di} className="min-h-24 border-r border-dte-linea bg-dte-fondo/60 last:border-r-0 sm:min-h-32" />
        const key = iso(d), list = byDay.get(key) ?? [], fer = feriados.get(key) ?? []
        return <div key={di} className={`group relative flex min-h-24 flex-col gap-1 border-r border-dte-linea p-1.5 last:border-r-0 sm:min-h-32 ${fer.some(f => f.tipo !== 'distrital') ? 'bg-feriado-fondo' : fer.length ? 'bg-aniversario-fondo' : ''}`}>
          <button onClick={() => onDay(d)} aria-label={cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))} className={`flex size-7 items-center justify-center self-start rounded-full text-sm font-bold hover:bg-dte-tinte ${key === today ? 'bg-pba-celeste text-white hover:bg-pba-celeste' : ''}`}>{d.getDate()}</button>
          <button onClick={() => onNew(key)} aria-label={`Agregar acción el ${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}`} title="Agregar acción" className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full text-dte-gris transition hover:bg-dte-magenta hover:text-white focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><Plus className="size-4" /></button>
          {fer.map(f => <span key={f.nombre} className="hidden sm:block"><FeriadoTag f={f} /></span>)}
          {fer.length > 0 && <span className="sm:hidden"><FeriadoTag f={fer[0]} compact /></span>}
          {list.slice(0, 3).map(i => <button key={i.id} onClick={() => onSelect(i)} title={itemTitle(i)} className={`hidden items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-dte-tinte sm:flex ${i.estado === 'cancelada' ? 'opacity-60 line-through' : ''}`}><span className={`size-1.5 shrink-0 rounded-full ${actionStyle[i.accion]?.dot}`} /><span className="truncate">{i.hora_inicio ? `${hhmm(i.hora_inicio)} ` : ''}{i.school ? shortSchoolName(i.school) : itemTitle(i)}</span></button>)}
          {list.length > 3 && <button onClick={() => onDay(d)} className="hidden px-1 text-left text-[11px] font-semibold text-dte-petroleo sm:block">+{list.length - 3} más</button>}
          {list.length > 0 && <button onClick={() => onDay(d)} className="flex flex-wrap gap-0.5 sm:hidden" aria-label={`${list.length} acciones`}>{list.slice(0, 6).map(i => <span key={i.id} className={`size-2 rounded-full ${actionStyle[i.accion]?.dot}`} />)}</button>}
        </div>
      })}
    </div>)}
  </div>
}

export function MiniMonth({ month, byDay, feriados, today, onDay }: { month: Date, byDay: Map<string, AgendaItem[]>, feriados: Map<string, Feriado[]>, today: string, onDay: (d: Date) => void }) {
  const total = monthWeeks(month).flat().reduce((a, d) => a + (d ? (byDay.get(iso(d))?.length ?? 0) : 0), 0)
  return <section className="rounded-2xl border border-dte-linea bg-white p-3">
    <header className="mb-2 flex items-baseline justify-between"><h3 className="font-bold capitalize">{fmt(month, { month: 'long', year: 'numeric' })}</h3><span className="text-xs text-dte-gris">{total} {total === 1 ? 'acción' : 'acciones'}</span></header>
    <div className="grid grid-cols-5 gap-1 text-center text-[10px] font-bold uppercase text-dte-gris-claro">{DIAS_HABILES.map(d => <div key={d}>{d}</div>)}</div>
    {monthWeeks(month).map((week, wi) => <div key={wi} className="mt-1 grid grid-cols-5 gap-1">
      {week.map((d, di) => {
        if (!d) return <div key={di} />
        const key = iso(d), n = byDay.get(key)?.length ?? 0, fer = feriados.get(key) ?? []
        const nacional = fer.some(f => f.tipo !== 'distrital')
        return <button key={di} onClick={() => onDay(d)} title={[cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })), ...fer.map(f => f.nombre + (f.confirmado ? '' : ' (a confirmar)')), n ? `${n} ${n === 1 ? 'acción' : 'acciones'}` : ''].filter(Boolean).join(' · ')}
          className={`relative flex h-9 flex-col items-center justify-center rounded-md text-xs transition hover:ring-2 hover:ring-pba-celeste ${key === today ? 'font-bold ring-2 ring-pba-celeste' : ''} ${nacional ? 'bg-peligro-suave text-peligro' : fer.length ? 'bg-aniversario-marca text-aniversario-texto' : n ? 'bg-dte-petroleo/10' : 'bg-dte-fondo'}`}>
          <span>{d.getDate()}</span>
          {n > 0 && <span className="text-[9px] font-bold leading-none text-dte-petroleo">{n}</span>}
        </button>
      })}
    </div>)}
  </section>
}

// Vista Lista de Mi agenda: de la acción más nueva a la más antigua, de a 20.
export function ListaAcciones({ items, viewer, onSelect }: { items: AgendaItem[], viewer: string, onSelect: (i: AgendaItem) => void }) {
  const [n, setN] = useState(20)
  const orden = useMemo(() => [...items].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.hora_inicio ?? '').localeCompare(a.hora_inicio ?? '') || b.created_at.localeCompare(a.created_at)), [items])
  if (!orden.length) return <p className="rounded-2xl border border-dashed border-dte-linea bg-white/60 p-10 text-center text-sm text-dte-gris">No hay acciones cargadas en este año.</p>
  return <div className="flex flex-col gap-3">
    <ul className="divide-y divide-dte-linea overflow-hidden rounded-2xl border border-dte-linea bg-white shadow-xs">{orden.slice(0, n).map(item =>
      <li key={item.id}><button onClick={() => onSelect(item)} className="grid w-full grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 p-3.5 text-left transition hover:bg-dte-tinte sm:grid-cols-[6.5rem_1fr_auto] sm:items-center">
        <span className="row-span-2 text-sm sm:row-span-1"><span className="block font-semibold capitalize">{fmt(parse(item.fecha), { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')}</span><span className="block text-xs text-dte-gris">{hhmm(item.hora_inicio) || 'Sin horario'}</span></span>
        <span className={`min-w-0 ${item.estado === 'cancelada' ? 'opacity-65' : ''}`}><span className="line-clamp-2 font-semibold leading-snug">{itemTitle(item)}</span><span className="block truncate text-xs text-dte-gris">{[schoolPlace(item.school), item.sub_accion].filter(Boolean).join(' · ') || ' '}</span></span>
        <span className="flex flex-wrap items-center gap-2 sm:justify-end"><ActionChip label={item.accion} /><StatusBadge status={item.estado} />{item.fed_id !== viewer && <span className="inline-flex items-center gap-0.5 rounded-full bg-dte-tinte px-1.5 py-0.5 text-[10px] font-semibold text-dte-petroleo"><Users className="size-3" />Compartida</span>}</span>
      </button></li>)}</ul>
    {orden.length > n && <div className="flex items-center justify-center gap-2"><Button variant="outline" size="sm" onClick={() => setN(n + 20)}>Ver {Math.min(20, orden.length - n)} más</Button><span className="text-xs text-dte-gris">Mostrando {n} de {orden.length}</span></div>}
  </div>
}

export function ItemCard({ item, onClick, viewer }: { item: AgendaItem, onClick: () => void, viewer?: string }) {
  const muted = item.estado === 'cancelada'
  return <button onClick={onClick} title={item.school ? schoolName(item.school) : undefined} className={`relative w-full overflow-hidden rounded-xl border border-dte-linea bg-white p-2.5 pl-3.5 text-left transition hover:border-pba-celeste hover:shadow-md focus-visible:border-pba-celeste focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-pba-celeste/30 ${muted ? 'opacity-65' : ''}`}>
    <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${actionStyle[item.accion]?.dot}`} />
    <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-dte-gris"><Clock className="size-3 shrink-0" />{timeRange(item)}</span>
    <p className={`mt-1 line-clamp-3 text-sm font-semibold leading-snug ${muted ? 'line-through decoration-1' : ''}`}>{item.school ? shortSchoolName(item.school) : itemTitle(item)}</p>
    {item.school && <p className="mt-0.5 truncate text-xs text-dte-gris">{schoolPlace(item.school)}</p>}
    <div className="mt-2 flex flex-wrap items-center gap-1.5"><ActionChip label={item.accion} /><StatusBadge status={item.estado} />{(item.participantes?.length > 0 || (viewer && item.fed_id !== viewer)) && <span title={viewer && item.fed_id !== viewer ? 'Te etiquetaron en esta acción' : 'Con compañeros'} className="inline-flex items-center gap-0.5 rounded-full bg-dte-tinte px-1.5 py-0.5 text-[10px] font-semibold text-dte-petroleo"><Users className="size-3" />{viewer && item.fed_id !== viewer ? 'Compartida' : `+${item.participantes.length}`}</span>}</div>
  </button>
}
