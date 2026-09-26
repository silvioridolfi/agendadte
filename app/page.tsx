'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, LayoutDashboard, Loader2, MapPin, PartyPopper, Pencil, Plus, School as SchoolIcon, Search, Trash2, UserRound, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import * as api from '@/app/actions'
import { ClubesView } from '@/components/clubes'
import { MetricsView, CAT_COLOR } from '@/components/metrics'
import { titleCase } from '@/lib/format'
import { ACCIONES, CATEGORIAS, CATEGORIA, CATEGORIA_LABEL, CON_ENCUENTRO, ESTADOS, SUB_ACCIONES, type Accion, type AgendaItem, type AgendaItemInput, type Encuentro, type Feriado, type Estado, type Fed, type School, type Club, type Modalidad, type TipoJornada, MODALIDADES, TIPOS_JORNADA, CLUB_MIN_ENCUENTROS, CLUB_MAX_PARTICIPANTES, clubEstado, clubEncuentrosRealizados, NIVELES, SECCIONES, nivelDeEscuela, esTrayecto, TRAYECTO_MARCA, RECORDATORIO_LICENCIA } from '@/lib/agenda'

// ---- estilos por categoría ----
// Colores de acción: distinguibles entre sí, texto con contraste AA sobre su fondo. `dot` se usa como acento.
const actionStyle: Record<Accion, { chip: string, dot: string }> = {
  'VISITA TÉCNICA': { chip: 'bg-[#dcebf5] text-[#1d5a7d]', dot: 'bg-[#2f7fae]' },
  'VISITA PEDAGÓGICA': { chip: 'bg-[#e8e2f6] text-[#553f86]', dot: 'bg-[#705ccb]' },
  'REUNIÓN': { chip: 'bg-[#f8ebc6] text-[#7a5a0c]', dot: 'bg-[#d9a520]' },
  'CLUB DE TECNOLOGÍA': { chip: 'bg-[#dbefe2] text-[#2c6644]', dot: 'bg-[#3f9a64]' },
  'PRÁCTICAS PROFESIONALIZANTES': { chip: 'bg-[#f8dfe9] text-[#8e3b61]', dot: 'bg-[#d576ab]' },
  'TALLER/CAPACITACIÓN': { chip: 'bg-[#f9e2d3] text-[#86491f]', dot: 'bg-[#e0874a]' },
  'ASISTENCIA REMOTA': { chip: 'bg-[#d9f1f5] text-[#0d6573]', dot: 'bg-[#00aec3]' },
  'CONECTIVIDAD': { chip: 'bg-[#e7ebcb] text-[#5a661b]', dot: 'bg-[#99a832]' },
  'ADMINISTRATIVO': { chip: 'bg-[#eaeaee] text-[#4f5461]', dot: 'bg-[#8d95a3]' },
  'OFICINA R1': { chip: 'bg-[#e1e9f1] text-[#2f5577]', dot: 'bg-[#417099]' },
  'PARO': { chip: 'bg-[#fbdde8] text-[#a3164f]', dot: 'bg-[#e81f76]' },
  'ENTREGA DE EQUIPAMIENTO': { chip: 'bg-[#dbe6f4] text-[#244f86]', dot: 'bg-[#2a6fb0]' },
  'PLANIFICACIÓN': { chip: 'bg-[#ece9f7] text-[#4e4390]', dot: 'bg-[#6f5fc2]' },
  'LICENCIA': { chip: 'bg-[#eeeaee] text-[#5c5160]', dot: 'bg-[#9a8f9d]' },
}
const statusStyle: Record<Estado, { badge: string, label: string }> = {
  planificada: { badge: 'border-pba-azul/40 bg-pba-azul/10 text-pba-azul', label: 'Planificada' },
  realizada: { badge: 'border-pba-celeste/50 bg-pba-celeste/10 text-pba-celeste-texto', label: 'Realizada' },
  reprogramada: { badge: 'border-[#e6c98b] bg-[#fff6dd] text-[#7a5a0c]', label: 'Reprogramada' },
  cancelada: { badge: 'border-pba-fucsia/40 bg-pba-fucsia/10 text-[#b8155c]', label: 'Cancelada' },
}
const avatarColors = ['bg-[#dff3f8]', 'bg-[#e9e5f8]', 'bg-[#fbe3ee]', 'bg-[#dde8f0]', 'bg-[#f1e4f0]', 'bg-[#fde8f1]']
const selectClass = 'h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm text-dte-tinta outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
const eyebrow = 'text-xs font-bold uppercase tracking-[0.15em] text-dte-magenta'
const PROFILE_KEY = 'agenda-territorial:fed'

// ---- fechas (siempre en hora local, formato YYYY-MM-DD) ----
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))
const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString('es-AR', opts)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')
const timeRange = (i: AgendaItem) => (i.hora_inicio ? `${hhmm(i.hora_inicio)}${i.hora_fin ? ` a ${hhmm(i.hora_fin)}` : ''}` : 'Sin horario')
// "21 – 27 de septiembre de 2026" o "29 de septiembre – 5 de octubre de 2026"
function weekTitle(from: Date, to: Date) {
  const sameMonth = from.getMonth() === to.getMonth()
  return `${sameMonth ? from.getDate() : fmt(from, { day: 'numeric', month: 'long' })} – ${fmt(to, { day: 'numeric', month: 'long', year: 'numeric' })}`
}

const schoolName = (s: School | null) => (s?.nombre ? titleCase(s.nombre) : 'Sin escuela asignada')
// Siglas usuales de la DGCyE para las tarjetas angostas (el nombre completo se ve en el detalle).
const siglas: [RegExp, string][] = [
  [/^Escuela de Educación Secundaria Técnica/i, 'EEST'], [/^Escuela de Educación Secundaria Agraria/i, 'EESA'], [/^Escuela de Educación Secundaria/i, 'EES'],
  [/^Escuela de Educación Primaria/i, 'EP'], [/^Escuela de Educación Especial/i, 'EEE'], [/^Jardín de Infantes/i, 'JI'],
  [/^Instituto Superior de Formación Docente/i, 'ISFD'], [/^Instituto Superior de Formación Técnica/i, 'ISFT'], [/^Centro de Educación Física/i, 'CEF'],
]
const shortSchoolName = (s: School | null) => { const n = schoolName(s); const m = siglas.find(([re]) => re.test(n)); return m ? n.replace(m[0], m[1]) : n }
const schoolPlace = (s: School | null) => (s ? [s.ciudad && s.ciudad !== s.distrito ? titleCase(s.ciudad) : null, s.distrito ? titleCase(s.distrito) : null].filter(Boolean).join(', ') : '')

const ddjjFor = (fed: Fed, fecha: string) => { const d = parse(fecha).getDay(); return d >= 1 && d <= 5 ? fed.ddjj?.find(x => x.dia === d) : undefined }
const itemTitle = (i: AgendaItem) => (i.school ? schoolName(i.school) : i.lugar || i.sub_accion || cap(i.accion.toLowerCase()))
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const firstName = (name: string) => name.split(/\s+/)[0]
const fedColor = (feds: Fed[], id: string) => avatarColors[Math.max(0, feds.findIndex(f => f.id === id)) % avatarColors.length]
const districtsLabel = (f: Fed) => (f.distritos_a_cargo.length ? f.distritos_a_cargo.map(titleCase).join(' · ') : 'Sin distritos asignados')

// Desenvuelve el Result de las server actions: lanza con el mensaje real del servidor.
const call = <A extends unknown[], T>(fn: (...a: A) => Promise<api.Result<T>>) => async (...a: A): Promise<T> => { const r = await fn(...a); if (!r.ok) throw new Error(r.error); return r.data }
const getFeds = call(api.getFeds), searchSchools = call(api.searchSchools), getFedItems = call(api.getFedItems), getAllItems = call(api.getAllItems), getEncuentros = call(api.getEncuentros), getFeriados = call(api.getFeriados), getClubes = call(api.getClubes), setClubCierre = call(api.setClubCierre)
const saveItem = call(api.saveItem), setItemStatus = call(api.setItemStatus), deleteItem = call(api.deleteItem)
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Error inesperado')

function storage<T>(fn: () => T): T | null { try { return fn() } catch { return null } }

// ---- piezas chicas ----
function ActionChip({ label, className = '' }: { label: Accion, className?: string }) {
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase leading-tight tracking-[0.04em] ${actionStyle[label]?.chip ?? 'bg-muted text-muted-foreground'} ${className}`}><span className={`size-1.5 shrink-0 rounded-full ${actionStyle[label]?.dot ?? 'bg-current'}`} />{label}</span>
}
function StatusBadge({ status }: { status: Estado }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyle[status]?.badge ?? ''}`}>{statusStyle[status]?.label ?? status}</span>
}
function ErrorBox({ message, onRetry }: { message: string, onRetry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f1b8cd] bg-[#fff1f6] p-4 text-sm text-[#a3164f]"><p><span className="font-semibold">No se pudo completar la operación.</span> {message}</p>{onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>}</div>
}
function Skeleton({ className = '' }: { className?: string }) { return <div className={`animate-pulse rounded-xl bg-[#e9e6f0] ${className}`} /> }

function Toast({ message, onDone }: { message: string, onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [message, onDone])
  return <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 sm:bottom-8"><div className="flex items-center gap-2 rounded-full bg-dte-tinta px-4 py-2.5 text-sm font-medium text-white shadow-lg"><Check className="size-4 text-dte-celeste" />{message}</div></div>
}

function useItems(load: () => Promise<AgendaItem[]>, deps: unknown[]) {
  const [items, setItems] = useState<AgendaItem[] | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let alive = true
    setItems(null); setError('')
    load().then(r => alive && setItems(r)).catch(e => alive && setError(errMsg(e)))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, retry])
  return { items, error, retry: () => setRetry(n => n + 1) }
}

// =====================================================================

export default function Page() {
  const [feds, setFeds] = useState<Fed[] | null>(null)
  const [fedsError, setFedsError] = useState('')
  const [profile, setProfile] = useState<Fed | null>(null)
  const [section, setSection] = useState<'agenda' | 'board'>('agenda')
  const [editing, setEditing] = useState<{ item: AgendaItem | null, fecha?: string } | null>(null)
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState('')

  const loadFeds = useCallback(() => {
    setFedsError(''); setFeds(null)
    getFeds().then(list => {
      setFeds(list)
      // Recordar el último perfil usado en este navegador.
      const saved = storage(() => localStorage.getItem(PROFILE_KEY))
      const fed = saved ? list.find(f => f.id === saved) : undefined
      if (fed) setProfile(fed)
    }).catch(e => setFedsError(errMsg(e)))
  }, [])
  useEffect(loadFeds, [loadFeds])

  const choose = (fed: Fed | null) => {
    setProfile(fed); setSection('agenda')
    storage(() => (fed ? localStorage.setItem(PROFILE_KEY, fed.id) : localStorage.removeItem(PROFILE_KEY)))
  }
  const changed = (message: string) => { setReloadKey(k => k + 1); setToast(message) }
  const hideToast = useCallback(() => setToast(''), [])

  if (!profile) return <ProfileSelect feds={feds} error={fedsError} onRetry={loadFeds} onSelect={choose} />

  return <div className="min-h-screen bg-dte-fondo text-dte-tinta">
    <header className="sticky top-0 z-40 border-b border-dte-linea bg-white/95 backdrop-blur">
      <div className="bg-dte-degradado h-1" />
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-dte-degradado text-white"><ClipboardList className="size-5" /></div>
          <div className="hidden min-w-0 sm:block"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-dte-magenta">Equipo FED · DTE</p><h1 className="truncate text-base font-bold leading-tight">Agenda Territorial</h1></div>
        </div>
        <nav aria-label="Secciones" className="flex rounded-full border border-dte-linea bg-dte-fondo p-1">
          {([['agenda', 'Mi agenda', CalendarDays], ['board', 'Tablero', LayoutDashboard]] as const).map(([key, label, Icon]) =>
            <button key={key} onClick={() => setSection(key)} aria-current={section === key ? 'page' : undefined} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${section === key ? 'bg-dte-petroleo text-white shadow-sm' : 'text-dte-gris hover:text-dte-tinta'}`}><Icon className="size-4" />{label}</button>)}
        </nav>
        <button onClick={() => choose(null)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-left transition hover:bg-dte-fondo" aria-label={`Perfil: ${profile.nombre_completo}. Cambiar de perfil`}>
          <Avatar className="size-9"><AvatarFallback className={`${fedColor(feds ?? [], profile.id)} text-xs font-bold text-dte-petroleo-oscuro`}>{initials(profile.nombre_completo)}</AvatarFallback></Avatar>
          <span className="hidden md:block"><span className="block text-sm font-semibold leading-tight">{profile.nombre_completo}</span><span className="block text-[11px] text-dte-gris">Cambiar de perfil</span></span>
          <ChevronDown className="hidden size-4 text-dte-gris md:block" />
        </button>
      </div>
    </header>

    {section === 'agenda'
      ? <AgendaView fed={profile} reloadKey={reloadKey} onNew={fecha => setEditing({ item: null, fecha })} onSelect={setSelected} />
      : <CoordinatorView feds={feds ?? []} reloadKey={reloadKey} onSelect={setSelected} />}

    <DetailDialog item={selected} feds={feds ?? []} profile={profile} onClose={() => setSelected(null)}
      onEdit={item => { setSelected(null); setEditing({ item }) }}
      onChanged={(msg, updated) => { changed(msg); setSelected(updated) }} />

    <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-lg">{editing?.item ? 'Editar acción' : 'Nueva acción'}</DialogTitle><DialogDescription>{editing?.item ? 'Actualizá los datos de la acción.' : `Se agrega a la agenda de ${firstName(profile.nombre_completo)}.`}</DialogDescription></DialogHeader>
        {editing && <ItemForm key={editing.item?.id ?? `new-${editing.fecha}`} fed={profile} item={editing.item} defaultFecha={editing.fecha} onCancel={() => setEditing(null)} onSaved={() => { changed(editing.item ? 'Acción actualizada' : 'Acción agregada a tu agenda'); setEditing(null) }} />}
      </DialogContent>
    </Dialog>

    {toast && <Toast message={toast} onDone={hideToast} />}
  </div>
}

// =====================================================================

function ProfileSelect({ feds, error, onRetry, onSelect }: { feds: Fed[] | null, error: string, onRetry: () => void, onSelect: (fed: Fed) => void }) {
  return <main className="bg-dte-degradado relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12 text-white">
    <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-44 rotate-45 rounded-[2.5rem] border-[22px] border-dte-rosa" />
    <span aria-hidden className="pointer-events-none absolute right-40 top-4 size-10 rounded-full bg-dte-celeste" />
    <span aria-hidden className="pointer-events-none absolute right-8 top-40 size-8 rounded-full bg-dte-lila" />
    <div className="relative w-full max-w-3xl">
      <div className="mb-10 flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30"><ClipboardList /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-dte-celeste">Equipo FED</p><h1 className="text-xl font-bold">Agenda Territorial</h1></div></div>
      <div className="mb-8"><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">¿Con quién vas a trabajar hoy?</h2><span className="mt-4 inline-flex rounded-full bg-dte-magenta px-4 py-1.5 text-sm font-bold">Dirección de Tecnología Educativa</span><p className="mt-4 text-white/85">Seleccioná tu perfil para entrar a la agenda. Lo vamos a recordar en este dispositivo.</p></div>
      {error ? <ErrorBox message={error} onRetry={onRetry} />
        : !feds ? <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-white/15" />)}</div>
        : !feds.length ? <p className="rounded-2xl border border-dashed border-white/40 p-8 text-center text-sm text-white/90">Todavía no hay FEDs cargados en la tabla <code>feds</code>.</p>
        : <div className="grid gap-3 sm:grid-cols-2">{feds.map((fed, i) =>
          <button key={fed.id} onClick={() => onSelect(fed)} className="group flex items-center gap-4 rounded-2xl bg-white p-4 text-left text-dte-tinta shadow-sm ring-2 ring-transparent transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-pba-celeste focus-visible:ring-pba-celeste focus-visible:outline-none">
            <Avatar className="size-12"><AvatarFallback className={`${avatarColors[i % avatarColors.length]} font-bold text-dte-petroleo-oscuro`}>{initials(fed.nombre_completo)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{fed.nombre_completo}</p><p className="mt-0.5 flex items-center gap-1 truncate text-sm text-dte-gris"><MapPin className="size-3.5 shrink-0" />{districtsLabel(fed)}</p></div>
            <ChevronRight className="text-dte-gris-claro transition group-hover:translate-x-1 group-hover:text-dte-magenta" />
          </button>)}</div>}
    </div>
  </main>
}

// =====================================================================

function WeekNav({ onPrev, onToday, onNext, prevLabel, nextLabel }: { onPrev: () => void, onToday: () => void, onNext: () => void, prevLabel: string, nextLabel: string }) {
  return <div className="flex items-center rounded-lg border border-dte-linea bg-white shadow-xs">
    <Button variant="ghost" size="icon-lg" aria-label={prevLabel} onClick={onPrev}><ChevronLeft /></Button>
    <Button variant="ghost" size="lg" className="border-x border-dte-linea rounded-none px-4 font-semibold" onClick={onToday}>Hoy</Button>
    <Button variant="ghost" size="icon-lg" aria-label={nextLabel} onClick={onNext}><ChevronRight /></Button>
  </div>
}

// ---- calendario: sólo días hábiles (lunes a viernes) ----
type CalView = 'day' | 'week' | 'month' | 'semester'
const CAL_VIEWS: [CalView, string][] = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['semester', '6 meses']]
const CAL_KEY = 'agenda-territorial:vista'
const DIAS_HABILES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const isWeekday = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5
const toWeekday = (d: Date, dir = 1) => { let x = d; while (!isWeekday(x)) x = addDays(x, dir); return x }
const monthStart = (d: Date, plus = 0) => new Date(d.getFullYear(), d.getMonth() + plus, 1)
const monthEnd = (d: Date, plus = 0) => new Date(d.getFullYear(), d.getMonth() + plus + 1, 0)
function calBounds(anchor: Date, view: CalView): [Date, Date] {
  if (view === 'day') return [anchor, anchor]
  if (view === 'week') { const s = startOfWeek(anchor); return [s, addDays(s, 4)] }
  if (view === 'month') return [monthStart(anchor), monthEnd(anchor)]
  return [monthStart(anchor), monthEnd(anchor, 5)]
}
function calShift(anchor: Date, view: CalView, dir: number) {
  if (view === 'day') return toWeekday(addDays(anchor, dir), dir)
  if (view === 'week') return addDays(anchor, 7 * dir)
  return monthStart(anchor, view === 'month' ? dir : 6 * dir)
}
// Semanas (lunes a viernes) que cubren un mes; los días de otros meses quedan en null.
function monthWeeks(month: Date): (Date | null)[][] {
  const weeks: (Date | null)[][] = []
  for (let w = startOfWeek(monthStart(month)); w <= monthEnd(month); w = addDays(w, 7)) {
    const row = Array.from({ length: 5 }, (_, i) => { const d = addDays(w, i); return d.getMonth() === month.getMonth() ? d : null })
    if (row.some(Boolean)) weeks.push(row)
  }
  return weeks
}

function useFeriados(from: string, to: string, distritos: string[] | null) {
  const [list, setList] = useState<Feriado[]>([])
  useEffect(() => {
    let alive = true
    getFeriados(from, to).then(r => alive && setList(r)).catch(() => alive && setList([]))
    return () => { alive = false }
  }, [from, to])
  // Nacionales para todos; distritales sólo para quien tiene ese distrito a cargo (null = todos los distritos).
  return useMemo(() => {
    const m = new Map<string, Feriado[]>()
    for (const f of list) if (!f.distrito || !distritos || distritos.includes(f.distrito)) m.set(f.fecha, [...(m.get(f.fecha) ?? []), f])
    return m
  }, [list, distritos])
}

function FeriadoTag({ f, compact = false }: { f: Feriado, compact?: boolean }) {
  const distrital = f.tipo === 'distrital'
  return <span title={`${f.nombre}${f.confirmado ? '' : ' (fecha a confirmar)'}`} className={`inline-flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${distrital ? 'bg-[#efeafa] text-[#4e4390]' : 'bg-[#fbe3ee] text-[#a3164f]'}`}>
    <PartyPopper className="size-3 shrink-0" />{compact ? (distrital ? 'Aniv. distrital' : 'Feriado') : f.nombre}{!f.confirmado && ' *'}
  </span>
}

function AgendaView({ fed, reloadKey, onNew, onSelect }: { fed: Fed, reloadKey: number, onNew: (fecha?: string) => void, onSelect: (item: AgendaItem) => void }) {
  const [view, setViewState] = useState<CalView>(() => (storage(() => localStorage.getItem(CAL_KEY)) as CalView) || 'week')
  const setView = (v: CalView) => { setViewState(v); storage(() => localStorage.setItem(CAL_KEY, v)) }
  const [anchor, setAnchor] = useState(() => toWeekday(new Date()))
  const [from, to] = calBounds(anchor, view)
  const { items, error, retry } = useItems(() => getFedItems(fed.id, iso(from), iso(to)), [fed.id, iso(from), iso(to), reloadKey])
  const feriados = useFeriados(iso(from), iso(to), fed.distritos_a_cargo)
  const today = iso(new Date())
  const byDay = useMemo(() => { const m = new Map<string, AgendaItem[]>(); for (const i of items ?? []) m.set(i.fecha, [...(m.get(i.fecha) ?? []), i]); return m }, [items])
  const weekendItems = useMemo(() => (items ?? []).filter(i => !isWeekday(parse(i.fecha))), [items])
  const counts = useMemo(() => Object.fromEntries(ESTADOS.map(e => [e, (items ?? []).filter(i => i.estado === e).length])) as Record<Estado, number>, [items])
  const inRange = today >= iso(from) && today <= iso(to)
  const suggested = view === 'day' ? iso(anchor) : inRange && isWeekday(new Date()) ? today : iso(toWeekday(from))
  const goDay = (d: Date) => { setAnchor(d); setView('day') }
  const periodo = { day: 'este día', week: 'esta semana', month: 'este mes', semester: 'estos 6 meses' }[view]
  const title = view === 'day' ? cap(fmt(anchor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    : view === 'week' ? weekTitle(from, addDays(from, 4))
    : view === 'month' ? cap(fmt(from, { month: 'long', year: 'numeric' }))
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
      <div>
        <p className={eyebrow}>Mi agenda · {CAL_VIEWS.find(v => v[0] === view)?.[1]}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-1.5 text-sm text-dte-gris">Hola, {firstName(fed.nombre_completo)}. {items ? (items.length ? `Tenés ${items.length} ${items.length === 1 ? 'acción' : 'acciones'} en ${periodo}${counts.realizada ? `, ${counts.realizada} ${counts.realizada === 1 ? 'realizada' : 'realizadas'}` : ''}.` : `No hay acciones cargadas en ${periodo}.`) : 'Cargando…'}{ddjjFor(fed, today) && <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-dte-linea"><Clock className="size-3" />Hoy DTE {ddjjFor(fed, today)!.dte}</span>}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Vista" className="flex rounded-lg border border-dte-linea bg-white p-1 shadow-xs">{CAL_VIEWS.map(([v, l]) => <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-md px-3 py-1 text-sm font-semibold transition ${view === v ? 'bg-dte-petroleo text-white' : 'text-dte-gris hover:text-dte-tinta'}`}>{l}</button>)}</div>
        <WeekNav prevLabel="Anterior" nextLabel="Siguiente" onPrev={() => setAnchor(calShift(anchor, view, -1))} onToday={() => setAnchor(toWeekday(new Date()))} onNext={() => setAnchor(calShift(anchor, view, 1))} />
        <Button size="lg" onClick={() => onNew(suggested)} className="hidden h-10 bg-dte-magenta px-4 font-semibold text-white hover:bg-[#b8155c] sm:inline-flex"><Plus data-icon="inline-start" />Nueva acción</Button>
      </div>
    </div>

    <div className="mt-6">
      {error ? <ErrorBox message={error} onRetry={retry} />
        : !items ? <Skeleton className="h-72" />
        : view === 'day' ? <section className="rounded-2xl border border-dte-linea bg-white p-4">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">{dayHeader(anchor, true)}<div className="flex flex-wrap gap-1.5">{(feriados.get(iso(anchor)) ?? []).map(f => <FeriadoTag key={f.nombre} f={f} />)}</div></header>
            {(byDay.get(iso(anchor)) ?? []).length
              ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{(byDay.get(iso(anchor)) ?? []).map(item => <ItemCard key={item.id} item={item} onClick={() => onSelect(item)} />)}</div>
              : <button onClick={() => onNew(iso(anchor))} className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-dte-linea py-10 text-sm text-dte-gris hover:border-dte-magenta hover:text-dte-magenta"><Plus />Sin acciones · agregar una</button>}
          </section>
        : view === 'week' ? <div className="grid gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => addDays(from, i)).map(d => {
              const key = iso(d), list = byDay.get(key) ?? [], fer = feriados.get(key) ?? []
              return <section key={key} aria-label={cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))} className={`group/day flex flex-col rounded-2xl border p-2.5 lg:min-h-72 ${key === today ? 'border-pba-celeste bg-white shadow-[0_0_0_1px] shadow-pba-celeste' : fer.length ? 'border-[#f1c6d8] bg-[#fff7fa]' : 'border-dte-linea bg-white'}`}>
                <header className="mb-2 flex items-center justify-between px-1">{dayHeader(d)}<Button variant="ghost" size="icon-sm" aria-label={`Agregar acción el ${fmt(d, { weekday: 'long', day: 'numeric' })}`} onClick={() => onNew(key)} className="text-dte-gris hover:text-dte-magenta lg:opacity-0 lg:group-hover/day:opacity-100 lg:focus-visible:opacity-100"><Plus /></Button></header>
                {fer.length > 0 && <div className="mb-2 flex flex-col gap-1 px-1">{fer.map(f => <FeriadoTag key={f.nombre} f={f} />)}</div>}
                <div className="flex flex-1 flex-col gap-2">
                  {list.map(item => <ItemCard key={item.id} item={item} onClick={() => onSelect(item)} />)}
                  {!list.length && <p className="px-1 pb-1 text-xs text-dte-gris-claro">{fer.length ? 'No laborable' : 'Sin acciones'}</p>}
                </div>
              </section>
            })}
          </div>
        : view === 'month' ? <MonthGrid month={from} byDay={byDay} feriados={feriados} today={today} onDay={goDay} onSelect={onSelect} onNew={onNew} />
        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => monthStart(from, i)).map(m => <MiniMonth key={iso(m)} month={m} byDay={byDay} feriados={feriados} today={today} onDay={goDay} />)}</div>}
    </div>

    {items && weekendItems.length > 0 && view !== 'semester' && <details className="mt-4 rounded-2xl border border-dte-linea bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-dte-gris">{weekendItems.length} {weekendItems.length === 1 ? 'acción cargada' : 'acciones cargadas'} en fin de semana</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{weekendItems.map(item => <ItemCard key={item.id} item={item} onClick={() => onSelect(item)} />)}</div>
    </details>}

    {(view === 'month' || view === 'semester') && <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-dte-gris"><span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[#fbe3ee] ring-1 ring-[#e81f76]/40" />Feriado nacional</span><span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[#efeafa] ring-1 ring-[#6f5fc2]/40" />Aniversario distrital</span><span>* fecha a confirmar</span><span>Tocá un día para verlo en detalle.</span></p>}

    <Button onClick={() => onNew(suggested)} aria-label="Nueva acción" className="fixed bottom-5 right-4 z-30 h-14 gap-2 rounded-full bg-dte-magenta px-5 text-base font-semibold text-white shadow-lg hover:bg-[#b8155c] sm:hidden"><Plus className="size-5" />Nueva</Button>
  </main>
}

function MonthGrid({ month, byDay, feriados, today, onDay, onSelect, onNew }: { month: Date, byDay: Map<string, AgendaItem[]>, feriados: Map<string, Feriado[]>, today: string, onDay: (d: Date) => void, onSelect: (i: AgendaItem) => void, onNew: (fecha: string) => void }) {
  return <div className="overflow-hidden rounded-2xl border border-dte-linea bg-white">
    <div className="grid grid-cols-5 border-b border-dte-linea bg-dte-fondo text-center text-xs font-bold uppercase tracking-wider text-dte-gris">{DIAS_HABILES.map(d => <div key={d} className="py-2">{d}</div>)}</div>
    {monthWeeks(month).map((week, wi) => <div key={wi} className="grid grid-cols-5 border-b border-dte-linea last:border-b-0">
      {week.map((d, di) => {
        if (!d) return <div key={di} className="min-h-24 border-r border-dte-linea bg-dte-fondo/60 last:border-r-0 sm:min-h-32" />
        const key = iso(d), list = byDay.get(key) ?? [], fer = feriados.get(key) ?? []
        return <div key={di} className={`group relative flex min-h-24 flex-col gap-1 border-r border-dte-linea p-1.5 last:border-r-0 sm:min-h-32 ${fer.some(f => f.tipo !== 'distrital') ? 'bg-[#fff7fa]' : fer.length ? 'bg-[#f8f6fd]' : ''}`}>
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

function MiniMonth({ month, byDay, feriados, today, onDay }: { month: Date, byDay: Map<string, AgendaItem[]>, feriados: Map<string, Feriado[]>, today: string, onDay: (d: Date) => void }) {
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
          className={`relative flex h-9 flex-col items-center justify-center rounded-md text-xs transition hover:ring-2 hover:ring-pba-celeste ${key === today ? 'font-bold ring-2 ring-pba-celeste' : ''} ${nacional ? 'bg-[#fbe3ee] text-[#a3164f]' : fer.length ? 'bg-[#efeafa] text-[#4e4390]' : n ? 'bg-dte-petroleo/10' : 'bg-dte-fondo'}`}>
          <span>{d.getDate()}</span>
          {n > 0 && <span className="text-[9px] font-bold leading-none text-dte-petroleo">{n}</span>}
        </button>
      })}
    </div>)}
  </section>
}

function ItemCard({ item, onClick }: { item: AgendaItem, onClick: () => void }) {
  const muted = item.estado === 'cancelada'
  return <button onClick={onClick} title={item.school ? schoolName(item.school) : undefined} className={`relative w-full overflow-hidden rounded-xl border border-dte-linea bg-white p-2.5 pl-3.5 text-left transition hover:border-pba-celeste hover:shadow-md focus-visible:border-pba-celeste focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-pba-celeste/30 ${muted ? 'opacity-65' : ''}`}>
    <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${actionStyle[item.accion]?.dot}`} />
    <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-dte-gris"><Clock className="size-3 shrink-0" />{timeRange(item)}</span>
    <p className={`mt-1 line-clamp-3 text-sm font-semibold leading-snug ${muted ? 'line-through decoration-1' : ''}`}>{item.school ? shortSchoolName(item.school) : itemTitle(item)}</p>
    {item.school && <p className="mt-0.5 truncate text-xs text-dte-gris">{schoolPlace(item.school)}</p>}
    <div className="mt-2 flex flex-wrap items-center gap-1.5"><ActionChip label={item.accion} /><StatusBadge status={item.estado} /></div>
  </button>
}

// =====================================================================

function DetailDialog({ item, feds, profile, onClose, onEdit, onChanged }: { item: AgendaItem | null, feds: Fed[], profile: Fed, onClose: () => void, onEdit: (item: AgendaItem) => void, onChanged: (msg: string, updated: AgendaItem | null) => void }) {
  const [busy, setBusy] = useState<string>('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => { setError(''); setConfirmDelete(false); setBusy('') }, [item?.id])
  if (!item) return <Dialog open={false} />
  const own = item.fed_id === profile.id
  const fed = feds.find(f => f.id === item.fed_id)

  async function changeStatus(estado: Estado) {
    if (!item) return
    setBusy(estado); setError('')
    try { await setItemStatus(item.id, profile.id, estado); onChanged(`Marcada como ${statusStyle[estado].label.toLowerCase()}`, { ...item, estado }) } catch (e) { setError(errMsg(e)) } finally { setBusy('') }
  }
  async function remove() {
    if (!item) return
    setBusy('delete'); setError('')
    try { await deleteItem(item.id, profile.id); onChanged('Acción eliminada', null) } catch (e) { setError(errMsg(e)); setBusy('') }
  }

  const row = (Icon: typeof Clock, label: string, value: React.ReactNode) => value ? <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-dte-gris-claro" /><div className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-wider text-dte-gris">{label}</dt><dd className="text-sm">{value}</dd></div></div> : null

  return <Dialog open onOpenChange={o => !o && onClose()}>
    <DialogContent className="bg-white sm:max-w-lg">
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2"><ActionChip label={item.accion} /><StatusBadge status={item.estado} /></div>
        <DialogTitle className="pt-1 text-lg leading-snug">{itemTitle(item)}</DialogTitle>
        <DialogDescription>{cap(fmt(parse(item.fecha), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · {timeRange(item)}</DialogDescription>
      </DialogHeader>
      <dl className="flex flex-col gap-3 rounded-xl bg-dte-fondo p-4">
        {row(MapPin, 'Lugar', !item.school && item.lugar)}
        {row(SchoolIcon, 'Escuela', item.school && <>CUE {item.school.cue ?? '—'}{schoolPlace(item.school) ? ` · ${schoolPlace(item.school)}` : ''}</>)}
        {row(ClipboardList, 'Sub-acción', item.sub_accion && <>{item.sub_accion}{item.cantidad ? <span className="text-dte-gris"> · {item.cantidad} equipos</span> : null}</>)}
        {row(UserRound, item.encuentros?.length > 1 ? `Encuentros (${item.encuentros.length})` : 'Encuentro', item.encuentros?.length ? <ul className="flex flex-col gap-1.5">{item.encuentros.map(e => <li key={e.id}>{[e.propuesta, e.encuentro_n ? `Encuentro N° ${e.encuentro_n}` : null, e.modalidad].filter(Boolean).join(' · ')}<span className="block text-xs text-dte-gris">{[e.destinatarios, e.inscriptos != null ? `${e.inscriptos} inscriptos` : null, e.asistentes != null ? `${e.asistentes} asistentes` : null].filter(Boolean).join(' · ')}{e.fotos_url && <> · <a href={e.fotos_url} target="_blank" rel="noreferrer" className="text-dte-petroleo underline">fotos</a></>}</span></li>)}</ul> : null)}
        {row(Pencil, 'Detalle', item.detalle && <span className="whitespace-pre-wrap">{item.detalle}</span>)}
        {row(UserRound, 'FED responsable', fed?.nombre_completo ?? '—')}
      </dl>
      {own && <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dte-gris">Cambiar estado</p>
        <div className="flex flex-wrap gap-2">{ESTADOS.map(e => <button key={e} disabled={!!busy || item.estado === e} onClick={() => changeStatus(e)} aria-pressed={item.estado === e} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${item.estado === e ? statusStyle[e].badge : 'border-dte-linea text-dte-gris hover:border-dte-gris-claro hover:text-dte-tinta'}`}>{busy === e ? <Loader2 className="size-3 animate-spin" /> : item.estado === e ? <Check className="size-3" /> : null}{statusStyle[e].label}</button>)}</div>
      </div>}
      {error && <ErrorBox message={error} />}
      <div className="flex flex-col-reverse gap-2 border-t border-dte-linea pt-4 sm:flex-row sm:items-center sm:justify-between">
        {own ? (confirmDelete
          ? <div className="flex items-center gap-2"><span className="text-sm text-[#a3164f]">¿Eliminar definitivamente?</span><Button variant="destructive" size="sm" disabled={busy === 'delete'} onClick={remove}>{busy === 'delete' && <Loader2 className="animate-spin" />}Sí, eliminar</Button><Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>No</Button></div>
          : <Button variant="ghost" className="justify-start text-[#a3164f] hover:bg-[#fff1f6] hover:text-[#a3164f]" onClick={() => setConfirmDelete(true)}><Trash2 data-icon="inline-start" />Eliminar</Button>)
          : <p className="text-xs text-dte-gris">Sólo {fed ? firstName(fed.nombre_completo) : 'el FED responsable'} puede modificar esta acción.</p>}
        <div className="flex gap-2 sm:justify-end"><Button variant="outline" className="flex-1 sm:flex-none" onClick={onClose}>Cerrar</Button>{own && <Button className="flex-1 bg-dte-petroleo hover:bg-dte-petroleo-oscuro sm:flex-none" onClick={() => onEdit(item)}><Pencil data-icon="inline-start" />Editar</Button>}</div>
      </div>
    </DialogContent>
  </Dialog>
}

// =====================================================================

type Range = 'day' | 'week' | 'month' | 'year'
function rangeBounds(anchor: Date, range: Range): [Date, Date] {
  if (range === 'day') return [anchor, anchor]
  if (range === 'week') { const s = startOfWeek(anchor); return [s, addDays(s, 6)] }
  if (range === 'year') return [new Date(anchor.getFullYear(), 0, 1), new Date(anchor.getFullYear(), 11, 31)]
  return [new Date(anchor.getFullYear(), anchor.getMonth(), 1), new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)]
}
function shift(anchor: Date, range: Range, dir: number) {
  if (range === 'day') return addDays(anchor, dir)
  if (range === 'week') return addDays(anchor, 7 * dir)
  if (range === 'year') return new Date(anchor.getFullYear() + dir, 0, 1)
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1)
}
const rangeNames: Record<Range, [string, string, string]> = { day: ['Día', 'día', 'este día'], week: ['Semana', 'semana', 'esta semana'], month: ['Mes', 'mes', 'este mes'], year: ['Año', 'año', 'este año'] }

function CoordinatorView({ feds, reloadKey, onSelect }: { feds: Fed[], reloadKey: number, onSelect: (item: AgendaItem) => void }) {
  const [tab, setTab] = useState<'resumen' | 'clubes' | 'practicas' | 'acciones'>('resumen')
  const [range, setRange] = useState<Range>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [search, setSearch] = useState('')
  const [distrito, setDistrito] = useState('')
  const [fedId, setFedId] = useState('')
  const [accion, setAccion] = useState('')
  const [estado, setEstado] = useState('')
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
  const fedName = useCallback((id: string) => feds.find(f => f.id === id)?.nombre_completo ?? 'FED desconocido', [feds])
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
    (!q || `${fedName(c.fed_id)} ${c.school?.nombre ?? ''} ${c.school?.ciudad ?? ''} ${c.school?.cue ?? ''} ${c.grupo ?? ''} ${c.lugar ?? ''}`.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(q))), [clubes, distrito, fedId, q, fedName])
  const counts = useMemo(() => Object.fromEntries(ESTADOS.map(e => [e, base.filter(i => i.estado === e).length])) as Record<Estado, number>, [base])
  const groups = useMemo(() => { const m = new Map<string, AgendaItem[]>(); for (const i of filtered) m.set(i.fed_id, [...(m.get(i.fed_id) ?? []), i]); return [...m.entries()].sort((a, b) => fedName(a[0]).localeCompare(fedName(b[0]))) }, [filtered, fedName])
  const anyFilter = !!(search || distrito || fedId || accion || estado)
  const fedsSinAcciones = useMemo(() => (items && !anyFilter ? feds.filter(f => !items.some(i => i.fed_id === f.id)) : []), [items, feds, anyFilter])
  const clear = () => { setSearch(''); setDistrito(''); setFedId(''); setAccion(''); setEstado('') }
  const title = range === 'day' ? cap(fmt(from, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : range === 'week' ? weekTitle(from, to) : range === 'year' ? `Año ${from.getFullYear()}` : cap(fmt(from, { month: 'long', year: 'numeric' }))

  return <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 lg:px-10">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className={eyebrow}>Tablero del coordinador</p><h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2><p className="mt-1.5 text-sm text-dte-gris">Seguimiento territorial de todo el equipo.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Período" className="flex rounded-lg border border-dte-linea bg-white p-1 shadow-xs">{(Object.keys(rangeNames) as Range[]).map(v => <button key={v} onClick={() => setRange(v)} aria-pressed={range === v} className={`rounded-md px-3 py-1 text-sm font-semibold transition ${range === v ? 'bg-dte-petroleo text-white' : 'text-dte-gris hover:text-dte-tinta'}`}>{rangeNames[v][0]}</button>)}</div>
        <WeekNav prevLabel={`${cap(rangeNames[range][1])} anterior`} nextLabel={`${cap(rangeNames[range][1])} siguiente`} onPrev={() => setAnchor(shift(anchor, range, -1))} onToday={() => setAnchor(new Date())} onNext={() => setAnchor(shift(anchor, range, 1))} />
      </div>
    </div>

    <div role="tablist" aria-label="Vista del tablero" className="mt-6 flex gap-1 border-b border-dte-linea">
      {([['resumen', 'Resumen y métricas'], ['clubes', 'Clubes de Tecnología'], ['practicas', 'Prácticas (PEAT)'], ['acciones', 'Acciones del equipo']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm font-semibold transition ${tab === k ? 'border-dte-magenta text-dte-tinta' : 'border-transparent text-dte-gris hover:text-dte-tinta'}`}>{l}</button>)}
    </div>

    {tab === 'acciones' && <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {ESTADOS.map(e => <button key={e} onClick={() => setEstado(estado === e ? '' : e)} aria-pressed={estado === e} className={`rounded-2xl border bg-white px-4 py-3 text-left transition hover:shadow-md ${estado === e ? 'border-dte-petroleo ring-2 ring-dte-petroleo/20' : 'border-dte-linea'}`}>
        <span className="text-xs font-semibold text-dte-gris">{statusStyle[e].label}s</span>
        <span className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-bold tabular-nums sm:text-3xl">{items ? counts[e] : '–'}</span>{estado === e && <span className="text-[11px] font-semibold text-dte-petroleo">Filtrando</span>}</span>
      </button>)}
    </div>}

    <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-dte-linea bg-white p-3 shadow-xs md:flex-row md:flex-wrap md:items-center">
      <div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dte-gris-claro" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar escuela, localidad, CUE o FED…" aria-label="Buscar" className="h-9 bg-dte-fondo pl-9" /></div>
      <select aria-label="Distrito" className={`${selectClass} md:w-44`} value={distrito} onChange={e => setDistrito(e.target.value)}><option value="">Todos los distritos</option>{distritos.map(d => <option key={d} value={d}>{titleCase(d)}</option>)}</select>
      <select aria-label="FED" className={`${selectClass} md:w-52`} value={fedId} onChange={e => setFedId(e.target.value)}><option value="">Todos los FEDs</option>{feds.map(f => <option key={f.id} value={f.id}>{f.nombre_completo}</option>)}</select>
      <select aria-label="Tipo de acción" className={`${selectClass} md:w-56`} value={accion} onChange={e => setAccion(e.target.value)}><option value="">Todas las acciones</option>{ACCIONES.map(a => <option key={a} value={a}>{cap(a.toLowerCase())}</option>)}</select>
      {anyFilter && <Button variant="ghost" onClick={clear} className="text-dte-magenta hover:text-dte-magenta"><X data-icon="inline-start" />Limpiar</Button>}
    </div>

    {tab === 'clubes' || tab === 'practicas' ? <div className="mt-6">{!clubes ? <Skeleton className="h-64" /> : <ClubesView key={tab} tipo={tab === 'clubes' ? 'CLUB DE TECNOLOGÍA' : 'PRÁCTICAS PROFESIONALIZANTES'} clubes={clubBase} feds={feds} desde={iso(from)} hasta={iso(to)} periodo={title} schoolLabel={c => (c.school ? shortSchoolName(c.school) : c.lugar ?? 'Sin lugar')} onCierre={async (c, f) => { await setClubCierre(c.id, f); setClubKey(k => k + 1) }} />}</div>
    : tab === 'resumen' ? <div className="mt-6">{error ? <ErrorBox message={error} onRetry={retry} /> : !items ? <div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-40" />)}</div> : <MetricsView items={base} encuentros={encBase} feds={fedId ? feds.filter(f => f.id === fedId) : feds} onSelect={onSelect} />}</div>
    : <div className="mt-6 flex flex-col gap-6">
      {error ? <ErrorBox message={error} onRetry={retry} />
        : !items ? [0, 1, 2].map(i => <Skeleton key={i} className="h-40" />)
        : !groups.length ? <div className="rounded-2xl border border-dashed border-dte-linea bg-white/60 p-10 text-center"><p className="font-semibold">{anyFilter ? 'Ninguna acción coincide con los filtros' : `No hay acciones cargadas en ${rangeNames[range][2]}`}</p>{anyFilter && <Button variant="link" onClick={clear} className="mt-1 text-dte-magenta">Limpiar filtros</Button>}</div>
        : groups.map(([id, group]) => <section key={id} aria-label={fedName(id)}>
          <div className="mb-2 flex items-center gap-3">
            <Avatar className="size-9"><AvatarFallback className={`${fedColor(feds, id)} text-xs font-bold text-dte-petroleo-oscuro`}>{initials(fedName(id))}</AvatarFallback></Avatar>
            <div className="min-w-0"><h3 className="truncate text-sm font-bold">{fedName(id)}</h3><p className="text-xs text-dte-gris">{group.length} {group.length === 1 ? 'acción' : 'acciones'} · {group.filter(i => i.estado === 'realizada').length} realizadas</p></div>
          </div>
          <ul className="divide-y divide-dte-linea overflow-hidden rounded-2xl border border-dte-linea bg-white shadow-xs">{group.map(item =>
            <li key={item.id}><button className="grid w-full grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 p-3.5 text-left transition hover:bg-dte-tinte focus-visible:bg-dte-tinte focus-visible:outline-none sm:grid-cols-[6.5rem_1fr_auto] sm:items-center" onClick={() => onSelect(item)}>
              <span className="row-span-2 text-sm sm:row-span-1"><span className="block font-semibold capitalize text-dte-tinta">{range === 'day' ? (hhmm(item.hora_inicio) || '—') : fmt(parse(item.fecha), range === 'week' ? { weekday: 'short', day: 'numeric' } : { day: 'numeric', month: 'short' }).replace('.', '')}</span>{range !== 'day' && <span className="block text-xs text-dte-gris">{hhmm(item.hora_inicio) || 'Sin horario'}</span>}</span>
              <span className={`min-w-0 ${item.estado === 'cancelada' ? 'opacity-65' : ''}`}><span className="line-clamp-2 font-semibold leading-snug">{itemTitle(item)}</span><span className="block truncate text-xs text-dte-gris">{[schoolPlace(item.school), item.school ? item.sub_accion : null].filter(Boolean).join(' · ') || ' '}</span></span>
              <span className="flex flex-wrap items-center gap-2 sm:justify-end"><ActionChip label={item.accion} /><StatusBadge status={item.estado} /></span>
            </button></li>)}</ul>
        </section>)}
      {fedsSinAcciones.length > 0 && <div className="rounded-2xl border border-dashed border-dte-linea bg-white/60 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-dte-gris">Sin acciones cargadas en {rangeNames[range][2]}</p><div className="mt-2 flex flex-wrap gap-2">{fedsSinAcciones.map(f => <span key={f.id} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-dte-linea">{f.nombre_completo}</span>)}</div></div>}
    </div>}
  </main>
}

// =====================================================================

function SchoolPicker({ value, onChange }: { value: School | null, onChange: (s: School | null) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<School[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const seq = useRef(0)
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setLoading(false); return }
    const n = ++seq.current
    setLoading(true); setFailed(false)
    const t = setTimeout(() => searchSchools(query)
      .then(r => { if (n === seq.current) { setResults(r); setActive(0) } })
      .catch(() => { if (n === seq.current) { setResults([]); setFailed(true) } })
      .finally(() => { if (n === seq.current) setLoading(false) }), 250)
    return () => clearTimeout(t)
  }, [query])
  const pick = (s: School) => { onChange(s); setQuery(''); setOpen(false) }

  if (value) return <div className="flex items-center gap-3 rounded-lg border border-pba-celeste/60 bg-pba-celeste/5 p-2.5 pl-3 font-normal">
    <SchoolIcon className="size-4 shrink-0 text-pba-celeste-texto" />
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{schoolName(value)}</p><p className="truncate text-xs text-dte-gris">CUE {value.cue ?? '—'}{schoolPlace(value) ? ` · ${schoolPlace(value)}` : ''}</p></div>
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>Cambiar</Button>
  </div>

  const showList = open && query.trim().length >= 2
  return <div className="relative">
    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dte-gris-claro" />
    <Input role="combobox" aria-expanded={showList} aria-controls="school-results" aria-autocomplete="list" className="h-10 pl-9 font-normal" placeholder="Nombre, localidad o CUE…" value={query}
      onChange={e => { setQuery(e.target.value); setOpen(true) }} onFocus={e => { setOpen(true); e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' }) }} onBlur={() => setTimeout(() => setOpen(false), 150)}
      onKeyDown={e => {
        if (!showList || !results.length) return
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
        else if (e.key === 'Enter') { e.preventDefault(); pick(results[active]) }
        else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
      }} />
    {showList && <div id="school-results" role="listbox" className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-dte-linea bg-white p-1 text-sm font-normal text-dte-tinta shadow-xl">
      {loading ? <p className="flex items-center gap-2 p-3 text-dte-gris"><Loader2 className="size-4 animate-spin" />Buscando…</p>
        : failed ? <p className="p-3 text-[#a3164f]">No se pudo buscar. Probá de nuevo.</p>
        : !results.length ? <p className="p-3 text-dte-gris">Sin resultados para “{query.trim()}”.</p>
        : results.map((s, i) => <button key={s.id} type="button" role="option" aria-selected={i === active} onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => pick(s)} className={`block w-full rounded-lg px-3 py-2 text-left ${i === active ? 'bg-dte-tinte' : ''}`}>
          <span className="block font-semibold leading-snug">{schoolName(s)}</span>
          <span className="block text-xs text-dte-gris">CUE {s.cue ?? '—'}{schoolPlace(s) ? ` · ${schoolPlace(s)}` : ''}</span>
        </button>)}
    </div>}
  </div>
}

function Field({ label, hint, required, children, className = '' }: { label: string, hint?: string, required?: boolean, children: React.ReactNode, className?: string }) {
  return <label className={`flex flex-col gap-1.5 ${className}`}><span className="text-sm font-semibold text-dte-tinta">{label}{required && <span className="text-dte-magenta"> *</span>}{hint && <span className="ml-1 font-normal text-dte-gris">{hint}</span>}</span>{children}</label>
}

function ItemForm({ fed, item, defaultFecha, onCancel, onSaved }: { fed: Fed, item: AgendaItem | null, defaultFecha?: string, onCancel: () => void, onSaved: () => void }) {
  const [school, setSchool] = useState<School | null>(item?.school ?? null)
  // Encuentro editable desde la app: el propio (origen app) o, si no hay, el primero importado.
  const enc0 = item?.encuentros?.find(e => e.origen === 'app') ?? item?.encuentros?.[0]
  const [form, setForm] = useState({ fecha: item?.fecha ?? defaultFecha ?? iso(new Date()), hora_inicio: hhmm(item?.hora_inicio ?? null), hora_fin: hhmm(item?.hora_fin ?? null), accion: item?.accion ?? null as Accion | null, estado: item?.estado ?? ('planificada' as Estado), sub_accion: item?.sub_accion ?? '', detalle: item?.detalle ?? '', lugar: item?.lugar ?? '', cantidad: item?.cantidad?.toString() ?? '', encuentro_n: enc0?.encuentro_n?.toString() ?? '', propuesta: enc0?.propuesta ?? '', destinatarios: enc0?.destinatarios ?? '', modalidad: enc0?.modalidad ?? ('Presencial' as Modalidad), inscriptos: enc0?.inscriptos?.toString() ?? '', asistentes: enc0?.asistentes?.toString() ?? '', tipo_jornada: enc0?.tipo_jornada ?? ('' as TipoJornada | ''), descripcion: enc0?.descripcion ?? '', club_id: enc0?.club_id ?? '', nivel: '', curso: '', seccion: '', encuentros_previstos: '', es_cierre: enc0?.es_cierre ?? false })
  // Clubes y prácticas: registro por grupo con inicio y cierre (cada uno con su identidad visual).
  const esClub = esTrayecto(form.accion)
  const marca = esClub ? TRAYECTO_MARCA[form.accion as keyof typeof TRAYECTO_MARCA] : TRAYECTO_MARCA['CLUB DE TECNOLOGÍA']
  const esParo = form.accion === 'PARO', esLicencia = form.accion === 'LICENCIA'
  const conSubAccion = !!form.accion && !esClub && !esParo && !esLicencia
  // Clubes del FED (para elegir a cuál corresponde el encuentro). Los finalizados sólo si es el del encuentro que se edita.
  const [clubes, setClubes] = useState<Club[] | null>(null)
  useEffect(() => { if (esClub && !clubes) getClubes(fed.id).then(setClubes).catch(() => setClubes([])) }, [esClub, clubes, fed.id])
  const hoy = iso(new Date())
  const clubOpts = (clubes ?? []).filter(c => c.tipo === form.accion && (c.id === form.club_id || clubEstado(c, hoy) !== 'finalizado'))
  const club = clubOpts.find(c => c.id === form.club_id) ?? null
  const clubLabel = (c: Club) => `${c.grupo ? `${c.grupo} · ` : ''}${c.school ? shortSchoolName(c.school) : c.lugar ?? 'Sin lugar'} · desde ${fmt(parse(c.fecha_inicio), { day: 'numeric', month: 'short' })}${clubEstado(c, hoy) === 'sin_actividad' ? ' (sin actividad)' : ''}`
  // Grado/curso del club nuevo: nivel sugerido por el nombre de la escuela, editable (cualquier nivel o modalidad).
  const nivelId = form.nivel || nivelDeEscuela(school?.nombre)
  const nivel = NIVELES.find(n => n.id === nivelId) ?? NIVELES[0]
  const grupo = form.curso ? `${form.curso}${form.seccion ? ` ${form.seccion}` : ''}` : ''
  function pickClub(id: string) {
    const c = clubes?.find(x => x.id === id)
    setForm(f => ({ ...f, club_id: id, encuentros_previstos: c?.encuentros_previstos?.toString() ?? f.encuentros_previstos,
      encuentro_n: !item && c ? String(clubEncuentrosRealizados(c) + 1) : f.encuentro_n }))
    if (c?.school) setSchool(c.school)
  }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))
  const toNum = (v: string) => (v.trim() === '' ? null : Number(v))
  const cat = form.accion ? CATEGORIA[form.accion] : null
  const conEncuentro = !!form.accion && CON_ENCUENTRO.includes(form.accion)
  const timeError = form.hora_inicio && form.hora_fin && form.hora_fin <= form.hora_inicio ? 'La hora de fin tiene que ser posterior a la de inicio.' : ''
  // Horario DTE declarado para ese día (DD.JJ.). Sólo avisa, no impide guardar.
  const ddjjDia = ddjjFor(fed, form.fecha)
  const fueraDeHorario = !!ddjjDia?.dte_desde && !!ddjjDia?.dte_hasta && ((!!form.hora_inicio && form.hora_inicio < ddjjDia.dte_desde) || (!!form.hora_fin && form.hora_fin > ddjjDia.dte_hasta))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.accion) { setError('Elegí el tipo de acción.'); return }
    if (timeError) { setError(timeError); return }
    if (esClub && !form.club_id) { setError(`Elegí a qué ${marca.corto} corresponde el encuentro, o iniciá uno nuevo.`); return }
    if (esClub && form.club_id === 'nuevo' && !form.curso) { setError(`Indicá el grado o curso (y sección): cada grupo es un ${marca.corto}.`); return }
    setSaving(true); setError('')
    const input: AgendaItemInput = {
      fed_id: fed.id, school_id: esLicencia || esParo ? null : school?.id ?? null, lugar: school || esLicencia || esParo ? null : form.lugar || null, fecha: form.fecha, accion: form.accion, estado: form.estado,
      hora_inicio: esParo ? null : form.hora_inicio || null, hora_fin: esParo ? null : form.hora_fin || null, sub_accion: conSubAccion ? form.sub_accion : null, detalle: form.detalle,
      cantidad: cat === 'tecnica' ? toNum(form.cantidad) : null,
      encuentro: conEncuentro ? { id: enc0?.id, propuesta: form.propuesta, encuentro_n: toNum(form.encuentro_n), modalidad: form.modalidad, destinatarios: form.destinatarios, inscriptos: toNum(form.inscriptos), asistentes: toNum(form.asistentes),
        ...(esClub ? { tipo_jornada: form.tipo_jornada || null, descripcion: form.descripcion, club_id: form.club_id && form.club_id !== 'nuevo' ? form.club_id : null, nuevo_club: form.club_id === 'nuevo', grupo: grupo, encuentros_previstos: toNum(form.encuentros_previstos), es_cierre: form.es_cierre } : {}) } : null,
    }
    try { await saveItem(input, item?.id); onSaved() } catch (err) { setError(errMsg(err)); setSaving(false) }
  }

  return <form onSubmit={submit} className="flex flex-col gap-5">
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Tipo de acción <span className="text-dte-magenta">*</span></legend>
      <div className="flex flex-col gap-3">{CATEGORIAS.map(c => <div key={c}>
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-dte-gris"><span className="size-2 rounded-sm" style={{ background: CAT_COLOR[c] }} />{CATEGORIA_LABEL[c]}</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">{ACCIONES.filter(name => CATEGORIA[name] === c).map(name => {
          const on = form.accion === name
          return <button key={name} type="button" aria-pressed={on} onClick={() => setForm(f => ({ ...f, accion: name, club_id: f.accion === name ? f.club_id : '', tipo_jornada: f.tipo_jornada && f.accion === name ? f.tipo_jornada : name === 'CLUB DE TECNOLOGÍA' ? 'Taller' : name === 'PRÁCTICAS PROFESIONALIZANTES' ? 'Formación' : f.tipo_jornada }))} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-bold uppercase leading-tight transition ${on ? `${actionStyle[name].chip} border-current ring-1 ring-current` : 'border-dte-linea bg-white text-dte-gris hover:border-dte-gris-claro hover:text-dte-tinta'}`}>
            <span className={`flex size-4 shrink-0 items-center justify-center rounded-full ${on ? actionStyle[name].dot : 'border border-dte-linea'}`}>{on && <Check className="size-3 text-white" />}</span>{name}
          </button>
        })}</div>
      </div>)}</div>
    </fieldset>

    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Fecha" required><Input type="date" required value={form.fecha} onChange={e => set('fecha', e.target.value)} className="h-10" /></Field>
      {!esParo && <><Field label="Desde" hint="(opcional)"><Input type="time" value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} className="h-10" /></Field>
      <Field label="Hasta" hint="(opcional)"><Input type="time" value={form.hora_fin} onChange={e => set('hora_fin', e.target.value)} aria-invalid={!!timeError} className="h-10" /></Field></>}
    </div>
    {esParo && <p className="-mt-2 rounded-lg border border-dte-linea bg-dte-fondo px-3 py-2 text-sm text-dte-gris">Adhesión a paro gremial/docente. Se registra en la <b className="text-dte-tinta">Dirección de Tecnología Educativa</b> (lugar de trabajo); no hace falta completar nada más.</p>}
    {esLicencia && <p className="-mt-2 rounded-lg border border-[#e9d8a6] bg-[#fdf6e3] px-3 py-2 text-sm text-[#6b5210]"><b>Recordatorio:</b> {RECORDATORIO_LICENCIA}</p>}
    {timeError && <p className="-mt-3 text-xs text-[#a3164f]">{timeError}</p>}
    {ddjjDia && !esParo && !esLicencia && <p className={`-mt-3 flex items-start gap-1.5 text-xs ${fueraDeHorario ? 'text-[#7a5a0c]' : 'text-dte-gris'}`}><Clock className="mt-px size-3.5 shrink-0" /><span>Tu horario DTE ese día (DD.JJ.): <b>{ddjjDia.dte}</b>{ddjjDia.externo ? ` · Otro cargo: ${ddjjDia.externo}` : ''}{fueraDeHorario ? '. La acción queda fuera de ese horario.' : ''}</span></p>}

    {!esParo && !esLicencia && <div className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Escuela <span className="font-normal text-dte-gris">(opcional)</span></span><SchoolPicker value={school} onChange={setSchool} />{!school && <Input placeholder="…o lugar, si no es una escuela (ej.: Jefatura Distrital, Feria de Ciencias)" value={form.lugar} onChange={e => set('lugar', e.target.value)} className="h-10" aria-label="Lugar" />}</div>}

    {conSubAccion && <div className={`grid gap-4 ${cat === 'tecnica' ? 'sm:grid-cols-[1fr_9rem]' : ''}`}>
      <Field label="Sub-acción" hint="(opcional)"><Input list="sub-acciones" placeholder={form.accion && SUB_ACCIONES[form.accion] ? `Ej.: ${SUB_ACCIONES[form.accion]!.slice(0, 2).join(', ')}` : 'Ej.: revisión de equipamiento'} value={form.sub_accion} onChange={e => set('sub_accion', e.target.value)} className="h-10" /></Field>
      {cat === 'tecnica' && <Field label="Cantidad" hint="(equipos)"><Input type="number" min={0} inputMode="numeric" placeholder="0" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} className="h-10" /></Field>}
    </div>}
    <datalist id="sub-acciones">{(form.accion ? SUB_ACCIONES[form.accion] ?? [] : []).map(o => <option key={o} value={o} />)}</datalist>
    {conSubAccion && form.accion && SUB_ACCIONES[form.accion] && <div className="-mt-3 flex flex-wrap items-center gap-1.5"><span className="mr-0.5 text-[11px] font-semibold uppercase tracking-wider text-dte-gris">Sugerencias</span>{SUB_ACCIONES[form.accion]!.map(o => { const on = form.sub_accion.split(',').map(x => x.trim()).includes(o); return <button key={o} type="button" aria-pressed={on} onClick={() => { const cur = form.sub_accion.split(',').map(x => x.trim()).filter(Boolean); set('sub_accion', (on ? cur.filter(x => x !== o) : [...cur, o]).join(', ')) }} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${on ? 'border-dte-petroleo bg-dte-petroleo text-white shadow-xs' : 'border-dte-petroleo/20 bg-dte-petroleo/[0.06] text-dte-petroleo hover:border-dte-petroleo/40 hover:bg-dte-petroleo/[0.12]'}`}>{on ? <Check className="size-3" /> : <Plus className="size-3 opacity-70" />}{o}</button> })}</div>}

    {esClub && <fieldset className="grid gap-4 overflow-hidden rounded-xl border border-dte-linea bg-dte-fondo p-3 sm:grid-cols-6">
      <legend className="sr-only">Registro: {marca.nombre}</legend>
      <div className={`-m-3 mb-0 flex items-center gap-3 px-3 py-2.5 sm:col-span-6 ${marca.degradado}`}><img src={marca.logo} alt={marca.nombre} className="h-10 w-auto" /><span className="text-xs font-semibold text-white/95">{marca.nota}</span></div>
      <Field label={`¿A qué ${marca.corto} corresponde?`} required className="sm:col-span-6"><select className={`${selectClass} h-10`} value={form.club_id} onChange={e => pickClub(e.target.value)} disabled={!clubes}>
        <option value="">{clubes ? `Elegí ${marca.corto === 'club' ? 'un club' : 'una práctica'}…` : 'Cargando…'}</option>
        {clubOpts.map(c => <option key={c.id} value={c.id}>{clubLabel(c)}</option>)}
        <option value="nuevo">{marca.corto === 'club' ? '+ Iniciar un club nuevo' : '+ Iniciar una práctica nueva'} (comienza en esta fecha)</option>
      </select></Field>
      {form.club_id === 'nuevo' && <div className="grid gap-3 rounded-lg border border-dashed border-[#7d5a95]/50 bg-white p-3 sm:col-span-6 sm:grid-cols-6">
        <p className="text-xs text-dte-gris sm:col-span-6">Cada grado o curso es {marca.corto === 'club' ? 'un club' : 'una práctica'} en sí mismo. {school ? 'El nivel se sugiere según la escuela; podés cambiarlo.' : 'Elegí primero la escuela para sugerir el nivel.'}</p>
        <Field label="Nivel / modalidad" className="sm:col-span-3"><select className={`${selectClass} h-10`} value={nivel.id} onChange={e => setForm(f => ({ ...f, nivel: e.target.value, curso: '' }))}>{NIVELES.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></Field>
        <Field label={nivel.cursoLabel} required className="sm:col-span-2"><select className={`${selectClass} h-10`} value={form.curso} onChange={e => set('curso', e.target.value)}><option value="">Elegí…</option>{nivel.cursos.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Sección" className="sm:col-span-1"><select className={`${selectClass} h-10`} value={form.seccion} onChange={e => set('seccion', e.target.value)}><option value="">—</option>{SECCIONES.map(x => <option key={x}>{x}</option>)}</select></Field>
        {grupo && <p className="text-xs sm:col-span-6">Se va a registrar como <b>{grupo}</b>{school ? ` · ${shortSchoolName(school)}` : ''}.</p>}
      </div>}
      {club && <p className="-mt-2 text-xs text-dte-gris sm:col-span-6">{clubEncuentrosRealizados(club)} encuentros registrados{club.encuentros_previstos ? ` de ${club.encuentros_previstos} previstos` : ''}. El lugar del encuentro es el del club{club.school ? '' : ' (arriba)'}.</p>}
      <Field label="Propuesta dictada" hint={marca.corto === 'club' ? '(ej.: taller de redes dentro del club)' : undefined} className="sm:col-span-4"><Input placeholder={marca.propuesta} value={form.propuesta} onChange={e => set('propuesta', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Encuentros de la propuesta" hint="(previstos)" className="sm:col-span-2"><Input type="number" min={1} inputMode="numeric" placeholder={String(CLUB_MIN_ENCUENTROS)} value={form.encuentros_previstos} onChange={e => set('encuentros_previstos', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Encuentro N°" className="sm:col-span-2"><Input type="number" min={1} inputMode="numeric" value={form.encuentro_n} onChange={e => set('encuentro_n', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Tipo de jornada" className="sm:col-span-2"><select className={`${selectClass} h-10`} value={form.tipo_jornada} onChange={e => set('tipo_jornada', e.target.value as TipoJornada | '')}><option value="">Elegí…</option>{TIPOS_JORNADA.map(t => <option key={t} value={t}>{t === 'Otro' ? 'Otro (aclarar en la descripción)' : t}</option>)}</select></Field>
      <Field label="Formato de participación" className="sm:col-span-2"><select className={`${selectClass} h-10`} value={form.modalidad} onChange={e => set('modalidad', e.target.value as Modalidad)}>{MODALIDADES.map(m => <option key={m}>{m}</option>)}</select></Field>
      <Field label="Destinatarios" className="sm:col-span-6"><Input placeholder="Ej.: estudiantes de 5° y 6°, familias" value={form.destinatarios} onChange={e => set('destinatarios', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Cantidad de inscriptos" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={form.inscriptos} onChange={e => set('inscriptos', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Participantes reales" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={form.asistentes} onChange={e => set('asistentes', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Breve descripción de lo realizado" className="sm:col-span-6"><Textarea rows={3} placeholder="Qué se trabajó, con qué recursos, cómo participó el grupo…" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} className="bg-white" /></Field>
      <label className="flex items-start gap-2.5 rounded-lg border border-dte-linea bg-white p-2.5 text-sm sm:col-span-6"><input type="checkbox" checked={form.es_cierre} onChange={e => set('es_cierre', e.target.checked)} className="mt-0.5 size-4" style={{ accentColor: marca.acento }} /><span><b>Este es el encuentro de cierre {marca.corto === 'club' ? 'del club' : 'de la práctica'}</b><span className="block text-xs text-dte-gris">{marca.corto === 'club' ? 'El club queda finalizado' : 'La práctica queda finalizada'} con esta fecha y deja de figurar entre los activos.</span></span></label>
    </fieldset>}
    {conEncuentro && !esClub && <fieldset className="grid gap-4 rounded-xl border border-dte-linea bg-dte-fondo p-3 sm:grid-cols-6">
      <legend className="px-1 text-sm font-semibold">Datos del encuentro <span className="font-normal text-dte-gris">(para las métricas de participación)</span></legend>
      <Field label="Propuesta" className="sm:col-span-4"><Input placeholder={form.accion === 'CLUB DE TECNOLOGÍA' ? 'Club de Tecnología' : 'Ej.: Ciudadanía digital en el aula'} value={form.propuesta} onChange={e => set('propuesta', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Encuentro N°" className="sm:col-span-2"><Input type="number" min={1} inputMode="numeric" value={form.encuentro_n} onChange={e => set('encuentro_n', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Destinatarios" className="sm:col-span-4"><Input placeholder="Ej.: estudiantes de 6° A, docentes" value={form.destinatarios} onChange={e => set('destinatarios', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Modalidad" className="sm:col-span-2"><select className={`${selectClass} h-10`} value={form.modalidad} onChange={e => set('modalidad', e.target.value as Modalidad)}>{MODALIDADES.map(m => <option key={m}>{m}</option>)}</select></Field>
      <Field label="Inscriptos" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={form.inscriptos} onChange={e => set('inscriptos', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Asistentes" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={form.asistentes} onChange={e => set('asistentes', e.target.value)} className="h-10 bg-white" /></Field>
    </fieldset>}
    {!esParo && <Field label={esLicencia ? 'Motivo' : 'Detalle'} hint="(opcional)"><Textarea placeholder={esLicencia ? 'Ej.: enfermedad, razones particulares (sin datos sensibles)' : 'Información útil para el seguimiento: con quién, qué se acordó, pendientes…'} rows={3} value={form.detalle} onChange={e => set('detalle', e.target.value)} /></Field>}

    {item && <fieldset><legend className="mb-2 text-sm font-semibold">Estado</legend><div className="flex flex-wrap gap-2">{ESTADOS.map(e => <button key={e} type="button" aria-pressed={form.estado === e} onClick={() => set('estado', e)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${form.estado === e ? statusStyle[e].badge : 'border-dte-linea text-dte-gris hover:text-dte-tinta'}`}>{form.estado === e && <Check className="size-3" />}{statusStyle[e].label}</button>)}</div></fieldset>}

    {error && <ErrorBox message={error} />}
    <div className="sticky bottom-0 -mx-4 -mb-4 flex gap-2 border-t border-dte-linea bg-white px-4 py-3 sm:justify-end">
      <Button variant="outline" type="button" size="lg" className="flex-1 sm:flex-none" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" size="lg" disabled={saving} className="flex-1 bg-dte-petroleo px-4 sm:flex-none font-semibold hover:bg-dte-petroleo-oscuro">{saving && <Loader2 className="animate-spin" data-icon="inline-start" />}{item ? 'Guardar cambios' : 'Agregar a mi agenda'}</Button>
    </div>
  </form>
}
