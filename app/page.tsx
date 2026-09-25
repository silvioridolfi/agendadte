'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, LayoutDashboard, Loader2, Plus, Search, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import * as api from '@/app/actions'
import { ACCIONES, ESTADOS, type Accion, type AgendaItem, type AgendaItemInput, type Estado, type Fed, type School } from '@/lib/agenda'

const actionStyle: Record<Accion, string> = {
  'VISITA TÉCNICA': 'bg-[#d9eaf5] text-[#246182]', 'VISITA PEDAGÓGICA': 'bg-[#e5def4] text-[#644c91]', 'REUNIÓN': 'bg-[#f8e8bd] text-[#8a6714]', 'CLUB DE TECNOLOGÍA': 'bg-[#d8eedf] text-[#34734d]', 'PRÁCTICAS PROFESIONALIZANTES': 'bg-[#f5d9e2] text-[#97506b]', 'TALLER/CAPACITACIÓN': 'bg-[#f8dfcf] text-[#955932]', 'ASISTENCIA REMOTA': 'bg-[#d6e9ee] text-[#3c707a]', 'CONECTIVIDAD': 'bg-[#e4e8c5] text-[#667323]', 'ADMINISTRATIVO': 'bg-[#e7e7e7] text-[#626262]', 'CHECKLIST': 'bg-[#e2e0ee] text-[#625c89]', 'OFICINA R1': 'bg-[#f0ded9] text-[#8d5148]', 'PARO': 'bg-[#f2d4d4] text-[#9b4040]',
}
const statusStyle: Record<Estado, string> = { planificada: 'border-[#9bbbd2] bg-[#eaf3f8] text-[#246182]', realizada: 'border-[#a8d0b4] bg-[#eaf5eb] text-[#34734d]', reprogramada: 'border-[#e6c98b] bg-[#fff6dd] text-[#8a6714]', cancelada: 'border-[#e3aaaa] bg-[#fff0f0] text-[#9b4040]' }
const avatarColors = ['bg-pba-celeste-claro', 'bg-[#e3ebf3]', 'bg-[#fce4ef]', 'bg-[#e6f1dc]', 'bg-[#fdf0d5]', 'bg-[#ece6f4]']
const selectClass = 'h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm md:w-44'

// ---- fechas (siempre en hora local, formato YYYY-MM-DD) ----
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))
const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString('es-AR', opts)
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')
const timeRange = (i: AgendaItem) => (i.hora_inicio ? `${hhmm(i.hora_inicio)}${i.hora_fin ? ` — ${hhmm(i.hora_fin)}` : ''}` : 'Sin horario')

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const fedColor = (feds: Fed[], id: string) => avatarColors[Math.max(0, feds.findIndex(f => f.id === id)) % avatarColors.length]
const schoolLabel = (s: School | null) => (s ? `${s.nombre || 'Escuela'}${s.cue ? ` (CUE: ${s.cue})` : ''}` : 'Sin escuela')

function ActionChip({ label }: { label: Accion }) { return <span className={`inline-flex max-w-full items-center rounded-md px-2 py-1 text-[10px] font-bold tracking-[0.04em] ${actionStyle[label] || 'bg-muted text-muted-foreground'}`}>{label}</span> }
function StatusBadge({ status }: { status: Estado }) { return <Badge variant="outline" className={`rounded-md text-[10px] font-semibold capitalize ${statusStyle[status] || ''}`}>{status}</Badge> }
function ErrorBox({ message }: { message: string }) { return <p className="rounded-lg border border-[#e3aaaa] bg-[#fff0f0] p-3 text-sm text-[#9b4040]">{message}</p> }
function Loading() { return <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="animate-spin" />Cargando…</div> }
// Desenvuelve el Result de las server actions: lanza con el mensaje real del servidor.
const call = <A extends unknown[], T>(fn: (...a: A) => Promise<api.Result<T>>) => async (...a: A): Promise<T> => { const r = await fn(...a); if (!r.ok) throw new Error(r.error); return r.data }
const getFeds = call(api.getFeds), searchSchools = call(api.searchSchools), getFedItems = call(api.getFedItems), getAllItems = call(api.getAllItems), saveItem = call(api.saveItem)
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Error inesperado')

export default function Page() {
  const [feds, setFeds] = useState<Fed[] | null>(null)
  const [fedsError, setFedsError] = useState('')
  const [profile, setProfile] = useState<Fed | null>(null)
  const [section, setSection] = useState<'agenda' | 'board'>('agenda')
  const [editing, setEditing] = useState<AgendaItem | 'new' | null>(null)
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => { getFeds().then(setFeds).catch(e => setFedsError(errMsg(e))) }, [])

  if (!profile) return <ProfileSelect feds={feds} error={fedsError} onSelect={setProfile} />
  return <div className="min-h-screen bg-pba-fondo text-pba-tinta">
    <header className="border-b border-pba-linea border-t-4 border-t-pba-celeste bg-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-10"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-pba-azul text-white"><ClipboardList /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-pba-celeste-texto">Equipo FED</p><h1 className="text-lg font-bold tracking-tight">Agenda Territorial</h1></div></div><div className="flex items-center gap-3"><Button variant="ghost" size="sm" className="text-pba-gris" onClick={() => setSection(section === 'agenda' ? 'board' : 'agenda')}><LayoutDashboard data-icon="inline-start" /><span className="hidden sm:inline">{section === 'agenda' ? 'Tablero coordinador' : 'Mi agenda'}</span></Button><Avatar className="size-9"><AvatarFallback className={`${fedColor(feds ?? [], profile.id)} text-xs font-bold text-pba-azul-oscuro`}>{initials(profile.nombre_completo)}</AvatarFallback></Avatar><div className="hidden text-right sm:block"><p className="text-xs font-semibold">{profile.nombre_completo}</p><p className="text-[11px] text-muted-foreground">FED · {profile.distritos_a_cargo.join(', ') || 'Sin distritos'}</p></div><Button variant="ghost" size="icon" aria-label="Cambiar perfil" onClick={() => { setProfile(null); setSection('agenda') }}><ChevronDown /></Button></div></div></header>
    {section === 'agenda'
      ? <AgendaView fed={profile} reloadKey={reloadKey} onNew={() => setEditing('new')} onSelect={setSelected} />
      : <CoordinatorView feds={feds ?? []} reloadKey={reloadKey} onSelect={setSelected} />}
    <Dialog open={!!selected} onOpenChange={() => setSelected(null)}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Detalle de la acción</DialogTitle></DialogHeader>{selected && <div className="flex flex-col gap-4"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fmt(parse(selected.fecha), { weekday: 'long', day: 'numeric', month: 'long' })} · {timeRange(selected)}</p><h3 className="mt-1 text-lg font-bold">{schoolLabel(selected.school)}</h3>{selected.school?.distrito && <p className="text-sm text-muted-foreground">Distrito {selected.school.distrito}</p>}<p className="mt-1 text-xs text-muted-foreground">FED: {feds?.find(f => f.id === selected.fed_id)?.nombre_completo ?? '—'}</p></div><StatusBadge status={selected.estado} /></div><Separator /><div className="flex flex-col gap-3"><ActionChip label={selected.accion} />{selected.sub_accion && <p className="text-sm font-semibold">{selected.sub_accion}</p>}{selected.detalle && <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{selected.detalle}</p>}</div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelected(null)}>Cerrar</Button>{selected.fed_id === profile.id && <Button onClick={() => { setEditing(selected); setSelected(null) }}>Editar acción</Button>}</div></div>}</DialogContent></Dialog>
    <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editing === 'new' ? 'Nueva acción' : 'Editar acción'}</DialogTitle></DialogHeader>{editing && <ItemForm key={editing === 'new' ? 'new' : editing.id} fed={profile} item={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setReloadKey(k => k + 1) }} />}</DialogContent></Dialog>
  </div>
}

function ProfileSelect({ feds, error, onSelect }: { feds: Fed[] | null, error: string, onSelect: (fed: Fed) => void }) {
  return <main className="flex min-h-screen items-center justify-center border-t-4 border-pba-celeste bg-pba-fondo px-5 py-10"><div className="w-full max-w-3xl"><div className="mb-10 flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-pba-azul text-white"><ClipboardList /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-pba-celeste-texto">Equipo FED</p><h1 className="text-xl font-bold">Agenda Territorial</h1></div></div><div className="mb-8"><p className="mb-2 text-sm font-semibold text-pba-celeste-texto">Bienvenido/a</p><h2 className="text-3xl font-bold tracking-tight text-pba-tinta">¿Con quién vas a trabajar hoy?</h2><p className="mt-2 text-muted-foreground">Seleccioná tu perfil para entrar a la agenda.</p></div>
    {error ? <ErrorBox message={`No se pudieron cargar los FEDs: ${error}`} /> : !feds ? <Loading /> : !feds.length
      ? <p className="rounded-2xl border border-dashed border-pba-linea p-8 text-center text-sm text-pba-gris">Todavía no hay FEDs cargados en la tabla <code>feds</code>.</p>
      : <div className="grid gap-4 sm:grid-cols-2">{feds.map((fed, i) => <button key={fed.id} onClick={() => onSelect(fed)} className="group flex items-center gap-4 rounded-2xl border border-pba-linea bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-pba-celeste hover:shadow-md"><Avatar className="size-12"><AvatarFallback className={`${avatarColors[i % avatarColors.length]} font-bold text-pba-azul-oscuro`}>{initials(fed.nombre_completo)}</AvatarFallback></Avatar><div className="flex-1"><p className="font-semibold">{fed.nombre_completo}</p><p className="mt-1 text-sm text-muted-foreground">{fed.distritos_a_cargo.length ? `Distritos: ${fed.distritos_a_cargo.join(', ')}` : 'Sin distritos asignados'}</p></div><ChevronRight className="text-pba-gris-claro transition group-hover:translate-x-1" /></button>)}</div>}
  </div></main>
}

function useItems(load: () => Promise<AgendaItem[]>, deps: unknown[]) {
  const [items, setItems] = useState<AgendaItem[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    setItems(null); setError('')
    load().then(r => alive && setItems(r)).catch(e => alive && setError(errMsg(e)))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { items, error }
}

function AgendaView({ fed, reloadKey, onNew, onSelect }: { fed: Fed, reloadKey: number, onNew: () => void, onSelect: (item: AgendaItem) => void }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const weekEnd = addDays(weekStart, 6)
  const { items, error } = useItems(() => getFedItems(fed.id, iso(weekStart), iso(weekEnd)), [fed.id, iso(weekStart), reloadKey])
  const today = iso(new Date())
  return <main className="mx-auto max-w-[1440px] px-5 py-7 lg:px-10"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-pba-celeste-texto">Mi agenda</p><h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Semana del {fmt(weekStart, { day: 'numeric', month: 'long' })} al {fmt(weekEnd, { day: 'numeric', month: 'long' })}</h2><p className="mt-2 text-sm text-muted-foreground">{fed.nombre_completo.split(' ')[0]}, acá está tu territorio.</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft /></Button><Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Hoy</Button><Button variant="outline" size="icon" aria-label="Semana siguiente" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight /></Button><Button onClick={onNew} className="hidden bg-pba-azul hover:bg-pba-azul-oscuro sm:flex"><Plus data-icon="inline-start" />Nueva acción</Button></div></div>
    <div className="mt-8">{error ? <ErrorBox message={error} /> : !items ? <Loading /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{items.map(item => { const d = parse(item.fecha); return <button key={item.id} onClick={() => onSelect(item)} className="text-left"><Card className={`h-full border-pba-linea shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.fecha === today ? 'ring-2 ring-pba-celeste ring-offset-2' : ''}`}><CardHeader className="flex-row items-start justify-between pb-3"><div><p className="text-xs font-bold uppercase tracking-wider text-pba-celeste-texto">{fmt(d, { weekday: 'short' }).replace('.', '')}</p><p className="mt-1 text-3xl font-bold text-pba-tinta">{d.getDate()}</p></div><StatusBadge status={item.estado} /></CardHeader><CardContent><div className="flex flex-col gap-3"><p className="text-xs font-medium text-pba-celeste-texto">{timeRange(item)}</p><p className="line-clamp-3 text-sm font-semibold leading-snug">{item.school?.distrito ? `${item.school.distrito} | ` : ''}{schoolLabel(item.school)}</p><ActionChip label={item.accion} />{item.sub_accion && <p className="text-xs text-muted-foreground">{item.sub_accion}</p>}</div></CardContent></Card></button> })}<Card className="border-dashed border-pba-linea bg-transparent shadow-none md:col-span-2 xl:col-span-4"><CardContent className="flex min-h-28 flex-col items-center justify-center gap-2 text-center"><CalendarDays className="text-pba-celeste" /><p className="text-sm font-medium text-pba-gris">{items.length ? 'No hay más acciones esta semana' : 'No hay acciones cargadas esta semana'}</p><Button variant="link" className="text-pba-azul" onClick={onNew}>Agregar una acción</Button></CardContent></Card></div>}</div>
    <Button onClick={onNew} size="icon" aria-label="Nueva acción" className="fixed bottom-6 right-5 size-14 rounded-full bg-pba-azul shadow-lg hover:bg-pba-azul-oscuro sm:hidden"><Plus /></Button></main>
}

type Range = 'day' | 'week' | 'month'
function rangeBounds(anchor: Date, range: Range): [Date, Date] {
  if (range === 'day') return [anchor, anchor]
  if (range === 'week') { const s = startOfWeek(anchor); return [s, addDays(s, 6)] }
  return [new Date(anchor.getFullYear(), anchor.getMonth(), 1), new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)]
}
function shift(anchor: Date, range: Range, dir: number) {
  if (range === 'day') return addDays(anchor, dir)
  if (range === 'week') return addDays(anchor, 7 * dir)
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1)
}

function CoordinatorView({ feds, reloadKey, onSelect }: { feds: Fed[], reloadKey: number, onSelect: (item: AgendaItem) => void }) {
  const [range, setRange] = useState<Range>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [search, setSearch] = useState('')
  const [distrito, setDistrito] = useState('')
  const [fedId, setFedId] = useState('')
  const [accion, setAccion] = useState('')
  const [estado, setEstado] = useState('')
  const [from, to] = rangeBounds(anchor, range)
  const { items, error } = useItems(() => getAllItems(iso(from), iso(to)), [iso(from), iso(to), reloadKey])

  const fedName = useCallback((id: string) => feds.find(f => f.id === id)?.nombre_completo ?? 'FED desconocido', [feds])
  const distritos = useMemo(() => [...new Set([...feds.flatMap(f => f.distritos_a_cargo), ...(items ?? []).map(i => i.school?.distrito).filter((d): d is string => !!d)])].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })), [feds, items])
  const filtered = useMemo(() => (items ?? []).filter(i =>
    (!distrito || i.school?.distrito === distrito) && (!fedId || i.fed_id === fedId) && (!accion || i.accion === accion) && (!estado || i.estado === estado) &&
    (!search || `${fedName(i.fed_id)} ${i.school?.nombre ?? ''} ${i.school?.ciudad ?? ''} ${i.school?.cue ?? ''} ${i.accion} ${i.sub_accion ?? ''}`.toLowerCase().includes(search.toLowerCase()))), [items, distrito, fedId, accion, estado, search, fedName])
  const groups = useMemo(() => { const m = new Map<string, AgendaItem[]>(); for (const i of filtered) m.set(i.fed_id, [...(m.get(i.fed_id) ?? []), i]); return [...m.entries()].sort((a, b) => fedName(a[0]).localeCompare(fedName(b[0]))) }, [filtered, fedName])
  const title = range === 'day' ? fmt(from, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : range === 'week' ? `Semana del ${fmt(from, { day: 'numeric', month: 'short' })} al ${fmt(to, { day: 'numeric', month: 'short', year: 'numeric' })}` : fmt(from, { month: 'long', year: 'numeric' })

  return <main className="mx-auto max-w-[1440px] px-5 py-7 lg:px-10"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-pba-celeste-texto">Tablero del coordinador</p><h2 className="mt-1 text-3xl font-bold tracking-tight">Seguimiento territorial</h2><p className="mt-2 text-sm capitalize text-muted-foreground">{title} · {items ? `${filtered.length} acciones` : '…'}</p></div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="icon" aria-label="Anterior" onClick={() => setAnchor(shift(anchor, range, -1))}><ChevronLeft /></Button><div className="flex rounded-lg border border-pba-linea bg-white p-0.5">{([['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']] as const).map(([v, l]) => <button key={v} onClick={() => setRange(v)} className={`rounded-md px-3 py-1 text-sm ${range === v ? 'bg-pba-azul text-white' : 'text-pba-gris'}`}>{l}</button>)}</div><Button variant="outline" size="icon" aria-label="Siguiente" onClick={() => setAnchor(shift(anchor, range, 1))}><ChevronRight /></Button><Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Hoy</Button></div></div>
    <div className="mt-7 flex flex-col gap-3 rounded-xl border border-pba-linea bg-white p-3 shadow-sm md:flex-row md:flex-wrap"><div className="relative min-w-52 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-pba-gris-claro" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por escuela, CUE o FED..." className="border-0 bg-pba-fondo pl-10 shadow-none" /></div>
      <select aria-label="Distrito" className={selectClass} value={distrito} onChange={e => setDistrito(e.target.value)}><option value="">Todos los distritos</option>{distritos.map(d => <option key={d} value={d}>{d}</option>)}</select>
      <select aria-label="FED" className={selectClass} value={fedId} onChange={e => setFedId(e.target.value)}><option value="">Todos los FEDs</option>{feds.map(f => <option key={f.id} value={f.id}>{f.nombre_completo}</option>)}</select>
      <select aria-label="Acción" className={selectClass} value={accion} onChange={e => setAccion(e.target.value)}><option value="">Todas las acciones</option>{ACCIONES.map(a => <option key={a} value={a}>{a}</option>)}</select>
      <select aria-label="Estado" className={selectClass} value={estado} onChange={e => setEstado(e.target.value)}><option value="">Todos los estados</option>{ESTADOS.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}</select></div>
    <div className="mt-8 flex flex-col gap-6">{error ? <ErrorBox message={error} /> : !items ? <Loading /> : !groups.length ? <p className="rounded-xl border border-dashed border-pba-linea p-8 text-center text-sm text-pba-gris">No hay acciones para este período y filtros.</p> : groups.map(([id, group]) => <section key={id}><div className="mb-3 flex items-center gap-3"><Avatar className="size-9"><AvatarFallback className={`${fedColor(feds, id)} text-xs font-bold text-pba-azul-oscuro`}>{initials(fedName(id))}</AvatarFallback></Avatar><div><h3 className="text-sm font-bold">{fedName(id)}</h3><p className="text-xs text-muted-foreground">{group.length} {group.length === 1 ? 'acción' : 'acciones'}</p></div></div><div className="divide-y divide-pba-linea overflow-hidden rounded-xl border border-pba-linea bg-white shadow-sm">{group.map(item => <button key={item.id} className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-pba-celeste-claro sm:flex-row sm:items-center" onClick={() => onSelect(item)}><span className="w-28 text-sm font-semibold text-pba-celeste-texto">{range !== 'day' && <span className="block text-xs capitalize">{fmt(parse(item.fecha), { weekday: 'short', day: 'numeric', month: 'short' })}</span>}{item.hora_inicio ? hhmm(item.hora_inicio) : '—'}</span><div className="flex-1"><p className="font-semibold">{schoolLabel(item.school)}</p><p className="mt-1 text-xs text-muted-foreground">{item.school?.distrito ? `Distrito ${item.school.distrito}` : ''}{item.sub_accion ? `${item.school?.distrito ? ' · ' : ''}${item.sub_accion}` : ''}</p></div><ActionChip label={item.accion} /><StatusBadge status={item.estado} /></button>)}</div></section>)}</div></main>
}

function SchoolPicker({ value, onChange }: { value: School | null, onChange: (s: School | null) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<School[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const seq = useRef(0)
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const n = ++seq.current
    setLoading(true)
    const t = setTimeout(() => searchSchools(query).then(r => { if (n === seq.current) setResults(r) }).catch(() => { if (n === seq.current) setResults([]) }).finally(() => { if (n === seq.current) setLoading(false) }), 250)
    return () => clearTimeout(t)
  }, [query])
  if (value) return <div className="flex min-h-9 items-center justify-between gap-2 rounded-lg border border-input px-3 py-1.5 text-sm font-normal"><span className="line-clamp-2">{value.distrito ? `${value.distrito} | ` : ''}{schoolLabel(value)}</span><Button type="button" variant="ghost" size="icon" aria-label="Quitar escuela" onClick={() => onChange(null)}><X /></Button></div>
  return <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10 font-normal" placeholder="Nombre, localidad o CUE..." value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
    {open && query.trim().length >= 2 && <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-pba-linea bg-white text-sm font-normal shadow-lg">{loading ? <p className="p-3 text-muted-foreground">Buscando…</p> : !results.length ? <p className="p-3 text-muted-foreground">Sin resultados</p> : results.map(s => <button key={s.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(s); setQuery(''); setOpen(false) }} className="block w-full px-3 py-2 text-left hover:bg-pba-fondo"><span className="font-semibold">{s.nombre}</span><span className="block text-xs text-muted-foreground">CUE {s.cue ?? '—'}{s.distrito ? ` · ${s.distrito}` : ''}{s.ciudad && s.ciudad !== s.distrito ? ` · ${s.ciudad}` : ''}</span></button>)}</div>}</div>
}

function ItemForm({ fed, item, onCancel, onSaved }: { fed: Fed, item: AgendaItem | null, onCancel: () => void, onSaved: () => void }) {
  const [school, setSchool] = useState<School | null>(item?.school ?? null)
  const [form, setForm] = useState({ fecha: item?.fecha ?? iso(new Date()), hora_inicio: hhmm(item?.hora_inicio ?? null), hora_fin: hhmm(item?.hora_fin ?? null), accion: item?.accion ?? ('VISITA TÉCNICA' as Accion), estado: item?.estado ?? ('planificada' as Estado), sub_accion: item?.sub_accion ?? '', detalle: item?.detalle ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.hora_inicio && form.hora_fin && form.hora_fin < form.hora_inicio) { setError('La hora de fin es anterior a la de inicio.'); return }
    setSaving(true); setError('')
    const input: AgendaItemInput = { ...form, fed_id: fed.id, school_id: school?.id ?? null, hora_inicio: form.hora_inicio || null, hora_fin: form.hora_fin || null }
    try { await saveItem(input, item?.id); onSaved() } catch (err) { setError(errMsg(err)); setSaving(false) }
  }
  return <form onSubmit={submit} className="flex flex-col gap-5"><div className="grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2 text-sm font-semibold">Fecha<Input type="date" required value={form.fecha} onChange={e => set('fecha', e.target.value)} /></label><div className="flex flex-col gap-2 text-sm font-semibold">Escuela (opcional)<SchoolPicker value={school} onChange={setSchool} /></div></div>
    <div className="flex flex-col gap-2"><p className="text-sm font-semibold">Tipo de acción</p><div className="flex flex-wrap gap-2">{ACCIONES.map(name => <button key={name} type="button" onClick={() => set('accion', name)} className={`rounded-md px-2.5 py-1.5 text-left text-[10px] font-bold transition ${actionStyle[name]} ${form.accion === name ? 'ring-2 ring-pba-azul ring-offset-1' : 'opacity-70 hover:opacity-100'}`}>{name}</button>)}</div></div>
    <div className="grid gap-4 sm:grid-cols-3"><label className="flex flex-col gap-2 text-sm font-semibold">Hora de inicio<Input type="time" value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} /></label><label className="flex flex-col gap-2 text-sm font-semibold">Hora de fin<Input type="time" value={form.hora_fin} onChange={e => set('hora_fin', e.target.value)} /></label><label className="flex flex-col gap-2 text-sm font-semibold">Estado<select className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm font-normal capitalize" value={form.estado} onChange={e => set('estado', e.target.value as Estado)}>{ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}</select></label></div>
    <label className="flex flex-col gap-2 text-sm font-semibold">Sub-acción (opcional)<Input placeholder="Ej. Revisión de equipamiento" value={form.sub_accion} onChange={e => set('sub_accion', e.target.value)} /></label>
    <label className="flex flex-col gap-2 text-sm font-semibold">Detalle (opcional)<Textarea placeholder="Agregá información útil para el seguimiento..." rows={3} value={form.detalle} onChange={e => set('detalle', e.target.value)} /></label>
    {error && <ErrorBox message={error} />}
    <div className="flex justify-end gap-2 border-t border-pba-linea pt-4"><Button variant="outline" type="button" onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={saving} className="bg-pba-azul hover:bg-pba-azul-oscuro">{saving && <Loader2 className="animate-spin" data-icon="inline-start" />}Guardar acción</Button></div></form>
}
