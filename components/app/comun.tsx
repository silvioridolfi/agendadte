'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as api from '@/app/actions'
import { guardarCache, leerCache } from '@/components/app/offline'
import { titleCase } from '@/lib/format'
import { type Accion, type AgendaItem, type Feriado, type Estado, type Fed, type School } from '@/lib/agenda'

// ---- estilos por categoría ----
// Colores de acción: distinguibles entre sí, texto con contraste AA sobre su fondo. `dot` se usa como acento.
export const actionStyle: Record<Accion, { chip: string, dot: string }> = {
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
export const statusStyle: Record<Estado, { badge: string, label: string }> = {
  planificada: { badge: 'border-pba-azul/40 bg-pba-azul/10 text-pba-azul', label: 'Planificada' },
  realizada: { badge: 'border-pba-celeste/50 bg-pba-celeste/10 text-pba-celeste-texto', label: 'Realizada' },
  reprogramada: { badge: 'border-[#e6c98b] bg-[#fff6dd] text-[#7a5a0c]', label: 'Reprogramada' },
  cancelada: { badge: 'border-pba-fucsia/40 bg-pba-fucsia/10 text-[#b8155c]', label: 'Cancelada' },
}
export const avatarColors = ['bg-[#dff3f8]', 'bg-[#e9e5f8]', 'bg-[#fbe3ee]', 'bg-[#dde8f0]', 'bg-[#f1e4f0]', 'bg-[#fde8f1]']
// Orden alfabético de la A a la Z para todas las listas (con números en orden natural: N° 2 antes que N° 10).
export const az = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
export const azOtroAlFinal = (a: string, b: string) => (a === 'Otro' ? 1 : b === 'Otro' ? -1 : az(a, b))
export const selectClass = 'h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm text-dte-tinta outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
export const eyebrow = 'text-xs font-bold uppercase tracking-[0.15em] text-dte-magenta'
export const PROFILE_KEY = 'agenda-territorial:fed'

// ---- fechas (siempre en hora local, formato YYYY-MM-DD) ----
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))
export const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString('es-AR', opts)
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')
export const timeRange = (i: AgendaItem) => (i.hora_inicio ? `${hhmm(i.hora_inicio)}${i.hora_fin ? ` a ${hhmm(i.hora_fin)}` : ''}` : 'Sin horario')
// "21 – 27 de septiembre de 2026" o "29 de septiembre – 5 de octubre de 2026"
export function weekTitle(from: Date, to: Date) {
  const sameMonth = from.getMonth() === to.getMonth()
  return `${sameMonth ? from.getDate() : fmt(from, { day: 'numeric', month: 'long' })} – ${fmt(to, { day: 'numeric', month: 'long', year: 'numeric' })}`
}

export const schoolName = (s: School | null) => (s?.nombre ? titleCase(s.nombre) : 'Sin escuela asignada')
// Siglas usuales de la DGCyE para las tarjetas angostas (el nombre completo se ve en el detalle).
export const siglas: [RegExp, string][] = [
  [/^Escuela de Educación Secundaria Técnica/i, 'EEST'], [/^Escuela de Educación Secundaria Agraria/i, 'EESA'], [/^Escuela de Educación Secundaria/i, 'EES'],
  [/^Escuela de Educación Primaria/i, 'EP'], [/^Escuela de Educación Especial/i, 'EEE'], [/^Jardín de Infantes/i, 'JI'],
  [/^Instituto Superior de Formación Docente/i, 'ISFD'], [/^Instituto Superior de Formación Técnica/i, 'ISFT'], [/^Centro de Educación Física/i, 'CEF'],
]
export const shortSchoolName = (s: School | null) => { const n = schoolName(s); const m = siglas.find(([re]) => re.test(n)); return m ? n.replace(m[0], m[1]) : n }
export const schoolPlace = (s: School | null) => (s ? [s.ciudad && s.ciudad !== s.distrito ? titleCase(s.ciudad) : null, s.distrito ? titleCase(s.distrito) : null].filter(Boolean).join(', ') : '')

export const ddjjFor = (fed: Fed, fecha: string) => { const d = parse(fecha).getDay(); return d >= 1 && d <= 5 ? fed.ddjj?.find(x => x.dia === d) : undefined }
export const itemTitle = (i: AgendaItem) => (i.school ? schoolName(i.school) : i.lugar || i.sub_accion || cap(i.accion.toLowerCase()))
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
export const firstName = (name: string) => name.split(/\s+/)[0]
export const fedColor = (feds: Fed[], id: string) => avatarColors[Math.max(0, feds.findIndex(f => f.id === id)) % avatarColors.length]
export const districtsLabel = (f: Fed) => (f.distritos_a_cargo.length ? f.distritos_a_cargo.map(titleCase).join(' · ') : 'Sin distritos asignados')

// Desenvuelve el Result de las server actions: lanza con el mensaje real del servidor.
export const call = <A extends unknown[], T>(fn: (...a: A) => Promise<api.Result<T>>) => async (...a: A): Promise<T> => { const r = await fn(...a); if (!r.ok) throw new Error(r.error); return r.data }
export const getFeds = call(api.getFeds)
export const searchSchools = call(api.searchSchools)
export const getFedItems = call(api.getFedItems)
export const getAllItems = call(api.getAllItems)
export const getEncuentros = call(api.getEncuentros)
export const getFeriados = call(api.getFeriados)
export const getClubes = call(api.getClubes)
export const getNotificaciones = call(api.getNotificaciones)
export const marcarLeidas = call(api.marcarLeidas)
export const setClubCierre = call(api.setClubCierre)
export const saveItem = call(api.saveItem)
export const responder = call(api.responder)
export const getHistorial = call(api.getHistorial)
export const updateFed = call(api.updateFed)
export const addFeriado = call(api.addFeriado)
export const deleteFeriado = call(api.deleteFeriado)
export const setItemStatus = call(api.setItemStatus)
export const deleteItem = call(api.deleteItem)
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Error inesperado')

export function storage<T>(fn: () => T): T | null { try { return fn() } catch { return null } }

// ---- piezas chicas ----
export function ActionChip({ label, className = '' }: { label: Accion, className?: string }) {
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase leading-tight tracking-[0.04em] ${actionStyle[label]?.chip ?? 'bg-muted text-muted-foreground'} ${className}`}><span className={`size-1.5 shrink-0 rounded-full ${actionStyle[label]?.dot ?? 'bg-current'}`} />{label}</span>
}
export function StatusBadge({ status }: { status: Estado }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyle[status]?.badge ?? ''}`}>{statusStyle[status]?.label ?? status}</span>
}
export function ErrorBox({ message, onRetry }: { message: string, onRetry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f1b8cd] bg-[#fff1f6] p-4 text-sm text-[#a3164f]"><p><span className="font-semibold">No se pudo completar la operación.</span> {message}</p>{onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>}</div>
}
export function Skeleton({ className = '' }: { className?: string }) { return <div className={`animate-pulse rounded-xl bg-[#e9e6f0] ${className}`} /> }

export function Toast({ message, onDone }: { message: string, onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [message, onDone])
  return <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 sm:bottom-8"><div className="flex items-center gap-2 rounded-full bg-dte-tinta px-4 py-2.5 text-sm font-medium text-white shadow-lg"><Check className="size-4 text-dte-celeste" />{message}</div></div>
}

// `cacheKey`: guarda lo cargado en el dispositivo y, si no hay conexión, muestra la última copia.
export function useItems(load: () => Promise<AgendaItem[]>, deps: unknown[], cacheKey?: string) {
  const [items, setItems] = useState<AgendaItem[] | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [desdeCache, setDesdeCache] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    setItems(null); setError(''); setDesdeCache(null)
    load().then(r => { if (!alive) return; setItems(r); if (cacheKey) guardarCache(cacheKey, r) }).catch(e => {
      if (!alive) return
      const c = cacheKey ? leerCache(cacheKey) : null
      if (c) { setItems(c.items); setDesdeCache(c.ts) } else setError(errMsg(e))
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, retry])
  return { items, error, retry: () => setRetry(n => n + 1), desdeCache }
}

// =====================================================================

export type ItemPreset = { accion?: Accion, sub_accion?: string, participantes?: string[] }

// =====================================================================

export function WeekNav({ onPrev, onToday, onNext, prevLabel, nextLabel }: { onPrev: () => void, onToday: () => void, onNext: () => void, prevLabel: string, nextLabel: string }) {
  return <div className="flex items-center rounded-lg border border-dte-linea bg-white shadow-xs">
    <Button variant="ghost" size="icon-lg" aria-label={prevLabel} onClick={onPrev}><ChevronLeft /></Button>
    <Button variant="ghost" size="lg" className="border-x border-dte-linea rounded-none px-4 font-semibold" onClick={onToday}>Hoy</Button>
    <Button variant="ghost" size="icon-lg" aria-label={nextLabel} onClick={onNext}><ChevronRight /></Button>
  </div>
}

// ---- calendario: sólo días hábiles (lunes a viernes) ----
export type CalView = 'day' | 'week' | 'month' | 'semester' | 'list'
export const CAL_VIEWS: [CalView, string][] = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['semester', '6 meses'], ['list', 'Lista']]
export const CAL_KEY = 'agenda-territorial:vista'
export const DIAS_HABILES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
export const isWeekday = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5
export const toWeekday = (d: Date, dir = 1) => { let x = d; while (!isWeekday(x)) x = addDays(x, dir); return x }
export const monthStart = (d: Date, plus = 0) => new Date(d.getFullYear(), d.getMonth() + plus, 1)
export const monthEnd = (d: Date, plus = 0) => new Date(d.getFullYear(), d.getMonth() + plus + 1, 0)
export function calBounds(anchor: Date, view: CalView): [Date, Date] {
  if (view === 'day') return [anchor, anchor]
  if (view === 'week') { const s = startOfWeek(anchor); return [s, addDays(s, 4)] }
  if (view === 'month') return [monthStart(anchor), monthEnd(anchor)]
  if (view === 'list') return [new Date(anchor.getFullYear(), 0, 1), new Date(anchor.getFullYear(), 11, 31)]
  return [monthStart(anchor), monthEnd(anchor, 5)]
}
export function calShift(anchor: Date, view: CalView, dir: number) {
  if (view === 'day') return toWeekday(addDays(anchor, dir), dir)
  if (view === 'week') return addDays(anchor, 7 * dir)
  if (view === 'list') return new Date(anchor.getFullYear() + dir, 0, 1)
  return monthStart(anchor, view === 'month' ? dir : 6 * dir)
}
// Semanas (lunes a viernes) que cubren un mes; los días de otros meses quedan en null.
export function monthWeeks(month: Date): (Date | null)[][] {
  const weeks: (Date | null)[][] = []
  for (let w = startOfWeek(monthStart(month)); w <= monthEnd(month); w = addDays(w, 7)) {
    const row = Array.from({ length: 5 }, (_, i) => { const d = addDays(w, i); return d.getMonth() === month.getMonth() ? d : null })
    if (row.some(Boolean)) weeks.push(row)
  }
  return weeks
}

export function useFeriados(from: string, to: string, distritos: string[] | null) {
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

export function FeriadoTag({ f, compact = false }: { f: Feriado, compact?: boolean }) {
  const distrital = f.tipo === 'distrital'
  return <span title={`${f.nombre}${f.confirmado ? '' : ' (fecha a confirmar)'}`} className={`inline-flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${distrital ? 'bg-[#efeafa] text-[#4e4390]' : 'bg-[#fbe3ee] text-[#a3164f]'}`}>
    <PartyPopper className="size-3 shrink-0" />{compact ? (distrital ? 'Aniv. distrital' : 'Feriado') : f.nombre}{!f.confirmado && ' *'}
  </span>
}

// Pie institucional (mismo texto que el resto de los proyectos DTE). `oscuro`: sobre fondo degradado.
export function PieInstitucional({ oscuro = false }: { oscuro?: boolean }) {
  return <footer className={`px-4 py-6 text-center text-[11px] ${oscuro ? 'text-white/85' : 'mt-auto border-t border-dte-linea bg-white text-dte-gris'}`}>
    <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-3">
      <img src={oscuro ? '/brand/oficial-blanco.png' : '/brand/oficial-color.png'} alt="Dirección de Tecnología Educativa · Dirección General de Cultura y Educación · Gobierno de la Provincia de Buenos Aires" className="h-8 w-auto max-w-full sm:h-10" />
      <p>© {new Date().getFullYear()} Dirección de Tecnología Educativa (DTE), Región 1 · Desarrollado por Silvio Ridolfi, Facilitador de Educación Digital</p>
    </div>
  </footer>
}
