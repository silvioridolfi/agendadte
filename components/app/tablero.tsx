'use client'

import { exportarPlanilla } from '@/lib/exportar'
import { ConfiguracionView } from '@/components/app/configuracion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Users, X, FileSpreadsheet, SlidersHorizontal } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ClubesView } from '@/components/clubes'
import { MetricsView } from '@/components/metrics'
import { titleCase } from '@/lib/format'
import { ACCIONES, ESTADOS, type AgendaItem, type Encuentro, type Estado, type Fed, type Club } from '@/lib/agenda'
import { getFeriados, statusStyle, az, selectClass, eyebrow, iso, parse, addDays, startOfWeek, fmt, cap, hhmm, weekTitle, shortSchoolName, schoolPlace, itemTitle, initials, fedColor, getAllItems, getEncuentros, getClubes, setClubCierre, ActionChip, StatusBadge, ErrorBox, Skeleton, useItems, WeekNav } from '@/components/app/comun'

// =====================================================================

export type Range = 'day' | 'week' | 'month' | 'year'
export function rangeBounds(anchor: Date, range: Range): [Date, Date] {
  if (range === 'day') return [anchor, anchor]
  if (range === 'week') { const s = startOfWeek(anchor); return [s, addDays(s, 6)] }
  if (range === 'year') return [new Date(anchor.getFullYear(), 0, 1), new Date(anchor.getFullYear(), 11, 31)]
  return [new Date(anchor.getFullYear(), anchor.getMonth(), 1), new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)]
}
export function shift(anchor: Date, range: Range, dir: number) {
  if (range === 'day') return addDays(anchor, dir)
  if (range === 'week') return addDays(anchor, 7 * dir)
  if (range === 'year') return new Date(anchor.getFullYear() + dir, 0, 1)
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1)
}
export const rangeNames: Record<Range, [string, string, string]> = { day: ['Día', 'día', 'este día'], week: ['Semana', 'semana', 'esta semana'], month: ['Mes', 'mes', 'este mes'], year: ['Año', 'año', 'este año'] }

export const LISTA_INICIAL = 5, LISTA_PASO = 20

// `autorId`: perfil de coordinación que usa el tablero (habilita Configuración); `onChanged`: aviso tras editar equipo o feriados.
export function CoordinatorView({ feds, todos, reloadKey, onSelect, onNuevaReunion, autorId, onChanged }: { feds: Fed[], todos: Fed[], reloadKey: number, onSelect: (item: AgendaItem) => void, onNuevaReunion?: () => void, autorId?: string, onChanged?: (msg: string) => void }) {
  const [tab, setTab] = useState<'resumen' | 'clubes' | 'practicas' | 'acciones' | 'config'>('resumen')
  const [range, setRange] = useState<Range>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [search, setSearch] = useState('')
  const [distrito, setDistrito] = useState('')
  const [fedId, setFedId] = useState('')
  const [accion, setAccion] = useState('')
  const [estado, setEstado] = useState('')
  // Acciones del equipo: primeras LISTA_INICIAL por FED y "ver más" de a LISTA_PASO; con un FED filtrado se muestran todas.
  const [mostrar, setMostrar] = useState<Record<string, number>>({})
  const visibles = (id: string) => (fedId ? Infinity : mostrar[id] ?? LISTA_INICIAL)
  const [from, to] = rangeBounds(anchor, range)
  const { items, error, retry } = useItems(() => getAllItems(iso(from), iso(to)), [iso(from), iso(to), reloadKey])
  // Encuentros del período (incluye los que no están vinculados a una acción), para las métricas de participación.
  const [encs, setEncs] = useState<Encuentro[] | null>(null)
  useEffect(() => {
    let alive = true
    setEncs(null)
    getEncuentros(iso(from), iso(to)).then(r => alive && setEncs(r)).catch(() => alive && setEncs([]))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso(from), iso(to), reloadKey])

  // Clubes del ciclo (no dependen del período elegido).
  const [clubes, setClubesState] = useState<Club[] | null>(null)
  const [clubKey, setClubKey] = useState(0)
  useEffect(() => { let alive = true; getClubes().then(r => alive && setClubesState(r)).catch(() => alive && setClubesState([])); return () => { alive = false } }, [reloadKey, clubKey])
  // Feriados y recesos del año: no cuentan para "sin actividad" de clubes y prácticas.
  const [noHabiles, setNoHabiles] = useState<Set<string>>(new Set())
  useEffect(() => { const y = new Date().getFullYear(); getFeriados(`${y}-01-01`, `${y}-12-31`).then(l => setNoHabiles(new Set(l.filter(f => f.tipo !== 'distrital').map(f => f.fecha)))).catch(() => {}) }, [reloadKey])
  const [exportando, setExportando] = useState(false)
  async function exportar() {
    if (!items) return
    setExportando(true)
    try {
      await exportarPlanilla({ titulo: 'Agenda Territorial Región 1', desde: iso(from), hasta: iso(to), items: base.filter(i => feds.some(f => f.id === i.fed_id) && (!estado || i.estado === estado)),
        encuentros: encBase, feds: todos, clubes: clubes ? clubBase : undefined })
    } finally { setExportando(false) }
  }
  const fedName = useCallback((id: string) => todos.find(f => f.id === id)?.nombre_completo ?? 'FED desconocido', [todos])
  const distritos = useMemo(() => [...new Set([...feds.flatMap(f => f.distritos_a_cargo), ...(items ?? []).map(i => i.school?.distrito).filter((d): d is string => !!d)])].sort((a, b) => a.localeCompare(b, 'es')), [feds, items])
  const q = search.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  // Todos los filtros menos el de estado: así los contadores muestran cuántas hay de cada estado.
  const base = useMemo(() => (items ?? []).filter(i =>
    (!distrito || i.school?.distrito === distrito) && (!fedId || i.fed_id === fedId) && (!accion || i.accion === accion) &&
    (!q || `${fedName(i.fed_id)} ${i.school?.nombre ?? ''} ${i.school?.ciudad ?? ''} ${i.school?.cue ?? ''} ${i.accion} ${i.sub_accion ?? ''} ${i.lugar ?? ''}`.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(q))), [items, distrito, fedId, accion, q, fedName])
  const filtered = useMemo(() => base.filter(i => !estado || i.estado === estado), [base, estado])
  const encBase = useMemo(() => (encs ?? []).filter(e =>
    (!distrito || e.school?.distrito === distrito) && (!fedId || e.fed_id === fedId) && (!accion || e.tipo === accion) &&
    (!q || `${fedName(e.fed_id)} ${e.school?.nombre ?? ''} ${e.school?.ciudad ?? ''} ${e.school?.cue ?? ''} ${e.propuesta ?? ''} ${e.lugar ?? ''}`.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(q))), [encs, distrito, fedId, accion, q, fedName])
  const clubBase = useMemo(() => (clubes ?? []).filter(c => (!distrito || c.school?.distrito === distrito) && (!fedId || c.fed_id === fedId) &&
    (!q || `${fedName(c.fed_id)} ${c.school?.nombre ?? ''} ${c.school?.ciudad ?? ''} ${c.school?.cue ?? ''} ${c.escuela_origen?.nombre ?? ''} ${c.escuela_origen?.cue ?? ''} ${c.grupo ?? ''} ${c.lugar ?? ''}`.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(q))), [clubes, distrito, fedId, q, fedName])
  const counts = useMemo(() => Object.fromEntries(ESTADOS.map(e => [e, base.filter(i => i.estado === e).length])) as Record<Estado, number>, [base])
  // FEDs en orden alfabético; dentro de cada uno, las acciones de la más nueva a la más antigua (fecha, hora y carga).
  const recientePrimero = (a: AgendaItem, b: AgendaItem) => b.fecha.localeCompare(a.fecha) || (b.hora_inicio ?? '').localeCompare(a.hora_inicio ?? '') || b.created_at.localeCompare(a.created_at)
  const groups = useMemo(() => { const m = new Map<string, AgendaItem[]>(); for (const i of filtered) m.set(i.fed_id, [...(m.get(i.fed_id) ?? []), i]); return [...m.entries()].map(([id, l]) => [id, l.sort(recientePrimero)] as [string, AgendaItem[]]).sort((a, b) => fedName(a[0]).localeCompare(fedName(b[0]))) }, [filtered, fedName])
  const anyFilter = !!(search || distrito || fedId || accion || estado)
  // Filtros plegables en mobile (buscador siempre visible).
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const filtrosActivos = [distrito, fedId, accion].filter(Boolean).length
  const fedsSinAcciones = useMemo(() => (items && !anyFilter ? feds.filter(f => !items.some(i => i.fed_id === f.id)) : []), [items, feds, anyFilter])
  const clear = () => { setSearch(''); setDistrito(''); setFedId(''); setAccion(''); setEstado('') }
  const title = range === 'day' ? cap(fmt(from, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : range === 'week' ? weekTitle(from, to) : range === 'year' ? `Año ${from.getFullYear()}` : cap(fmt(from, { month: 'long', year: 'numeric' }))

  return <main className="mx-auto w-full min-w-0 max-w-[1440px] px-4 pb-8 pt-6 lg:px-10 lg:pb-16">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className={eyebrow}>Tablero del coordinador</p><h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2><p className="mt-1.5 text-sm text-dte-gris">Seguimiento territorial de todo el equipo.</p>{onNuevaReunion && <Button onClick={onNuevaReunion} className="mt-3 bg-dte-magenta font-semibold text-white hover:bg-dte-magenta-oscuro"><Users data-icon="inline-start" />Nueva reunión de equipo</Button>}</div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Período" className="grid w-full grid-cols-4 rounded-lg border border-dte-linea bg-white p-1 shadow-xs sm:flex sm:w-auto">{(Object.keys(rangeNames) as Range[]).map(v => <button key={v} onClick={() => setRange(v)} aria-pressed={range === v} className={`whitespace-nowrap rounded-md px-1.5 py-1 text-sm font-semibold transition sm:px-3 ${range === v ? 'bg-dte-petroleo text-white' : 'text-dte-gris hover:text-dte-tinta'}`}>{rangeNames[v][0]}</button>)}</div>
        <Button variant="outline" disabled={!items || exportando} onClick={exportar} title="Descargar planilla regional con los filtros aplicados"><FileSpreadsheet data-icon="inline-start" />{exportando ? 'Generando…' : 'Exportar Excel'}</Button>
        <WeekNav prevLabel={`${cap(rangeNames[range][1])} anterior`} nextLabel={`${cap(rangeNames[range][1])} siguiente`} onPrev={() => setAnchor(shift(anchor, range, -1))} onToday={() => setAnchor(new Date())} onNext={() => setAnchor(shift(anchor, range, 1))} />
      </div>
    </div>

    {/* Pestañas: en mobile se desplazan horizontalmente en una sola línea. */}
    <div role="tablist" aria-label="Vista del tablero" className="-mx-4 mt-6 flex snap-x gap-1 overflow-x-auto border-b border-dte-linea px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      {([['resumen', 'Resumen y métricas'], ['clubes', 'Clubes de Tecnología'], ['practicas', 'Prácticas (PEAT)'], ['acciones', 'Acciones del equipo'], ...(autorId ? [['config', 'Configuración']] as const : [])] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={e => { setTab(k); e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }} className={`-mb-px flex min-h-11 shrink-0 snap-start items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition ${tab === k ? 'border-dte-magenta text-dte-tinta' : 'border-transparent text-dte-gris hover:text-dte-tinta'}`}>{l}</button>)}
    </div>

    {tab === 'acciones' && <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {ESTADOS.map(e => <button key={e} onClick={() => setEstado(estado === e ? '' : e)} aria-pressed={estado === e} className={`rounded-2xl border bg-white px-4 py-3 text-left transition hover:shadow-md ${estado === e ? 'border-dte-petroleo ring-2 ring-dte-petroleo/20' : 'border-dte-linea'}`}>
        <span className="text-xs font-semibold text-dte-gris">{statusStyle[e].label}s</span>
        <span className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-bold tabular-nums sm:text-3xl">{items ? counts[e] : '–'}</span>{estado === e && <span className="text-xs font-semibold text-dte-petroleo">Filtrando</span>}</span>
      </button>)}
    </div>}

    {tab !== 'config' && <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-dte-linea bg-white p-3 shadow-xs md:flex-row md:flex-wrap md:items-center">
      <div className="flex gap-2 md:contents">
      <div className="relative min-w-0 flex-1 md:min-w-56"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dte-gris-claro" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar escuela, localidad, CUE o FED…" aria-label="Buscar" className="h-9 bg-dte-fondo pl-9" /></div>
      <Button type="button" variant="outline" onClick={() => setFiltrosAbiertos(o => !o)} aria-expanded={filtrosAbiertos} aria-controls="filtros-tablero" className="h-9 shrink-0 md:hidden"><SlidersHorizontal data-icon="inline-start" />Filtros{filtrosActivos > 0 && <span className="ml-0.5 rounded-full bg-dte-petroleo px-1.5 text-xs text-white">{filtrosActivos}</span>}</Button>
      </div>
      <div id="filtros-tablero" className={`${filtrosAbiertos ? 'flex' : 'hidden'} flex-col gap-2 md:contents`}>
      <select aria-label="Distrito" className={`${selectClass} md:w-44`} value={distrito} onChange={e => setDistrito(e.target.value)}><option value="">Todos los distritos</option>{distritos.map(d => <option key={d} value={d}>{titleCase(d)}</option>)}</select>
      <select aria-label="FED" className={`${selectClass} md:w-52`} value={fedId} onChange={e => setFedId(e.target.value)}><option value="">Todos los FEDs</option>{[...feds].sort((a, b) => az(a.nombre_completo, b.nombre_completo)).map(f => <option key={f.id} value={f.id}>{f.nombre_completo}</option>)}</select>
      <select aria-label="Tipo de acción" className={`${selectClass} md:w-56`} value={accion} onChange={e => setAccion(e.target.value)}><option value="">Todas las acciones</option>{[...ACCIONES].sort(az).map(a => <option key={a} value={a}>{cap(a.toLowerCase())}</option>)}</select>
      </div>
      {anyFilter && <Button variant="ghost" onClick={clear} className="self-start text-dte-magenta hover:text-dte-magenta md:self-auto"><X data-icon="inline-start" />Limpiar</Button>}
    </div>}

    {tab === 'config' && autorId ? <div className="mt-6"><ConfiguracionView feds={todos} autorId={autorId} onChanged={m => onChanged?.(m)} /></div>
    : tab === 'clubes' || tab === 'practicas' ? <div className="mt-6">{!clubes ? <Skeleton className="h-64" /> : <ClubesView key={tab} noHabiles={noHabiles} tipo={tab === 'clubes' ? 'CLUB DE TECNOLOGÍA' : 'PRÁCTICAS PROFESIONALIZANTES'} clubes={clubBase} feds={feds} desde={iso(from)} hasta={iso(to)} periodo={title} schoolLabel={c => (c.school ? shortSchoolName(c.school) : c.lugar ?? 'Sin lugar')} onCierre={async (c, f) => { await setClubCierre(c.id, f); setClubKey(k => k + 1) }} />}</div>
    : tab === 'resumen' ? <div className="mt-6">{error ? <ErrorBox message={error} onRetry={retry} /> : !items ? <div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-40" />)}</div> : <MetricsView items={base.filter(i => feds.some(f => f.id === i.fed_id))} encuentros={encBase} feds={fedId ? feds.filter(f => f.id === fedId) : feds} onSelect={onSelect} />}</div>
    : <div className="mt-6 flex flex-col gap-6">
      {error ? <ErrorBox message={error} onRetry={retry} />
        : !items ? [0, 1, 2].map(i => <Skeleton key={i} className="h-40" />)
        : !groups.length ? <div className="rounded-2xl border border-dashed border-dte-linea bg-white/60 p-10 text-center"><p className="font-semibold">{anyFilter ? 'Ninguna acción coincide con los filtros' : `No hay acciones cargadas en ${rangeNames[range][2]}`}</p>{anyFilter && <Button variant="link" onClick={clear} className="mt-1 text-dte-magenta">Limpiar filtros</Button>}</div>
        : groups.map(([id, group]) => <section key={id} aria-label={fedName(id)}>
          <div className="mb-2 flex items-center gap-3">
            <Avatar className="size-9"><AvatarFallback className={`${fedColor(feds, id)} text-xs font-bold text-dte-petroleo-oscuro`}>{initials(fedName(id))}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold">{fedName(id)}</h3><p className="text-xs text-dte-gris">{group.length} {group.length === 1 ? 'acción' : 'acciones'} · {group.filter(i => i.estado === 'realizada').length} realizadas</p></div>
            {!fedId && groups.length > 1 && <Button variant="ghost" size="sm" onClick={() => setFedId(id)} className="text-dte-petroleo">Ver sólo este FED</Button>}
          </div>
          <ul className="divide-y divide-dte-linea overflow-hidden rounded-2xl border border-dte-linea bg-white shadow-xs">{group.slice(0, visibles(id)).map(item =>
            <li key={item.id}><button className="grid w-full grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 p-3.5 text-left transition hover:bg-dte-tinte focus-visible:bg-dte-tinte focus-visible:outline-none sm:grid-cols-[6.5rem_1fr_auto] sm:items-center" onClick={() => onSelect(item)}>
              <span className="row-span-2 text-sm sm:row-span-1"><span className="block font-semibold capitalize text-dte-tinta">{range === 'day' ? (hhmm(item.hora_inicio) || '—') : fmt(parse(item.fecha), range === 'week' ? { weekday: 'short', day: 'numeric' } : { day: 'numeric', month: 'short' }).replace('.', '')}</span>{range !== 'day' && <span className="block text-xs text-dte-gris">{hhmm(item.hora_inicio) || 'Sin horario'}</span>}</span>
              <span className={`min-w-0 ${item.estado === 'cancelada' ? 'opacity-65' : ''}`}><span className="line-clamp-2 font-semibold leading-snug">{itemTitle(item)}</span><span className="block truncate text-xs text-dte-gris">{[schoolPlace(item.school), item.school ? item.sub_accion : null].filter(Boolean).join(' · ') || ' '}</span></span>
              <span className="flex flex-wrap items-center gap-2 sm:justify-end"><ActionChip label={item.accion} /><StatusBadge status={item.estado} /></span>
            </button></li>)}</ul>
          {group.length > LISTA_INICIAL && <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm">
            {visibles(id) < group.length && <Button variant="outline" size="sm" onClick={() => setMostrar(m => ({ ...m, [id]: visibles(id) + LISTA_PASO }))}>Ver {Math.min(LISTA_PASO, group.length - visibles(id))} más</Button>}
            {visibles(id) < group.length && group.length - visibles(id) > LISTA_PASO && <Button variant="ghost" size="sm" onClick={() => setMostrar(m => ({ ...m, [id]: group.length }))} className="text-dte-petroleo">Ver todas ({group.length})</Button>}
            {visibles(id) >= group.length && <Button variant="ghost" size="sm" onClick={() => setMostrar(m => ({ ...m, [id]: LISTA_INICIAL }))} className="text-dte-petroleo">Mostrar menos</Button>}
            <span className="text-xs text-dte-gris">Mostrando {Math.min(visibles(id), group.length)} de {group.length}</span>
          </div>}
        </section>)}
      {fedsSinAcciones.length > 0 && <div className="rounded-2xl border border-dashed border-dte-linea bg-white/60 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-dte-gris">Sin acciones cargadas en {rangeNames[range][2]}</p><div className="mt-2 flex flex-wrap gap-2">{fedsSinAcciones.map(f => <span key={f.id} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-dte-linea">{f.nombre_completo}</span>)}</div></div>}
    </div>}
  </main>
}
