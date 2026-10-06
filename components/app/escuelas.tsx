'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, CalendarClock, CalendarPlus, History, Loader2, MapPin, Navigation, Search, School as SchoolIcon, Trophy, Users, Wifi, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { type Accion, type AgendaItem, type Estado, type Fed, type School } from '@/lib/agenda'
import { FAMILIAS, type Familia } from '@/lib/ayuda/estilo'
import { resumenHistorial, separarHistorial, type FichaEscuela, type FilaHistorial } from '@/lib/escuela'
import { hoyAR } from '@/lib/hora'
import { titleCase } from '@/lib/format'
import { ActionChip, Skeleton, StatusBadge, ErrorBox, cap, errMsg, fmt, parse, schoolName, schoolPlace, searchSchools, getFichaEscuela, az } from '@/components/app/comun'

const num = new Intl.NumberFormat('es-AR')
const fechaCorta = (f: string) => cap(fmt(parse(f), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, ''))

// Color por tipo de dato (las mismas familias de la ayuda): ubicación, institución, alumnado y cada sección del historial.
type Tono = { familia: Familia, Icono: LucideIcon }
const TONO = {
  ubicacion: { familia: 'celeste', Icono: MapPin }, institucion: { familia: 'violeta', Icono: Building2 }, alumnado: { familia: 'amarillo', Icono: Users },
  proximas: { familia: 'celeste', Icono: CalendarClock }, clubes: { familia: 'violeta', Icono: Trophy }, historial: { familia: 'azul', Icono: History },
} satisfies Record<string, Tono>
const sinComillas = (t: string | null) => (t ? titleCase(t.replace(/["“”]/g, '').trim()) : null)

function Dato({ label, children }: { label: string, children: React.ReactNode }) {
  return children ? <div className="min-w-0"><dt className="text-xs font-semibold text-dte-gris">{label}</dt><dd className="text-sm font-medium">{children}</dd></div> : null
}

function Tarjeta({ tono, titulo, children }: { tono: Tono, titulo: string, children: React.ReactNode }) {
  const f = FAMILIAS[tono.familia]
  return <section className={`min-w-0 rounded-card border-l-4 p-3.5 ${f.fondo} ${f.borde}`}>
    <h3 className={`mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${f.texto}`}><tono.Icono className="size-4" aria-hidden />{titulo}</h3>
    <dl className="flex flex-col gap-2">{children}</dl>
  </section>
}

function Fila({ f, feds, onOpen }: { f: FilaHistorial, feds: Fed[], onOpen: (i: AgendaItem) => void }) {
  const quien = feds.find(x => x.id === f.fed_id)?.nombre_completo ?? 'Un integrante'
  const cuerpo = <>
    <span className="min-w-0 flex-1"><span className="block text-xs text-dte-gris">{fechaCorta(f.fecha)} · {quien}</span><span className="mt-0.5 flex flex-wrap items-center gap-1.5"><ActionChip label={f.accion as Accion} />{f.sub_accion && <span className="truncate text-xs text-dte-gris">{f.sub_accion}</span>}</span></span>
    <StatusBadge status={f.estado as Estado} />
  </>
  const base = 'flex w-full items-center gap-3 px-3 py-2.5 text-left'
  return <li>{f.item ? <button type="button" onClick={() => onOpen(f.item!)} className={`${base} transition hover:bg-dte-tinte`}>{cuerpo}</button> : <div className={base}>{cuerpo}</div>}</li>
}

// Sección con título de color y contador. Muestra las primeras `inicial` filas y el resto con "Ver más" (sin scroll interno: la ficha tiene uno solo).
function Seccion({ tono, titulo, cantidad, children }: { tono: Tono, titulo: string, cantidad: number, children: React.ReactNode }) {
  const f = FAMILIAS[tono.familia]
  return <section>
    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><span className={`flex size-6 items-center justify-center rounded-md ${f.fondo} ${f.texto}`}><tono.Icono className="size-3.5" aria-hidden /></span>{titulo}<span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${f.fondo} ${f.texto}`}>{cantidad}</span></h3>
    {children}
  </section>
}

function Filas({ filas, feds, onOpen, inicial }: { filas: FilaHistorial[], feds: Fed[], onOpen: (i: AgendaItem) => void, inicial: number }) {
  const [visibles, setVisibles] = useState(inicial)
  return <>
    <ul className="divide-y divide-dte-linea overflow-hidden rounded-tile border border-dte-linea">{filas.slice(0, visibles).map(f => <Fila key={f.id} f={f} feds={feds} onOpen={onOpen} />)}</ul>
    {filas.length > visibles && <Button type="button" variant="ghost" size="sm" onClick={() => setVisibles(v => v + 15)} className="mt-1 w-full text-dte-petroleo">Ver más ({filas.length - visibles})</Button>}
  </>
}

export function Ficha({ ficha, feds, puedeAgendar, onAgendar, onReclamo, onOpen }: { ficha: FichaEscuela, feds: Fed[], puedeAgendar: boolean, onAgendar: (s: School) => void, onReclamo: (s: School) => void, onOpen: (i: AgendaItem) => void }) {
  const { escuela: e, historial, clubes } = ficha
  const { proximas, anteriores } = separarHistorial(historial, hoyAR())
  const r = resumenHistorial(historial)
  const fedDe = (id: string) => feds.find(x => x.id === id)?.nombre_completo ?? ''
  const stats: [string | number, string, Familia][] = [[r.realizadas, 'acciones realizadas', 'azul'], [r.feds, r.feds === 1 ? 'FED las hizo' : 'FED distintos', 'violeta'], [r.ultima ? fmt(parse(r.ultima), { day: 'numeric', month: 'short' }).replace(/\./g, '') : '—', 'última visita', 'celeste']]
  return <div className="flex flex-col gap-5">
    <header className="rounded-card bg-dte-degradado p-4 text-white">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15"><SchoolIcon className="size-5" aria-hidden /></span>
        <div className="min-w-0"><p className="font-bold leading-snug">{schoolName(e)}</p><p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/85"><span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">CUE {e.cue ?? '—'}</span>{schoolPlace(e)}</p></div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {puedeAgendar && <Button type="button" onClick={() => onAgendar({ id: e.id, cue: e.cue, nombre: e.nombre, distrito: e.distrito, ciudad: e.ciudad })} className="w-full bg-white text-dte-petroleo hover:bg-white/90 sm:w-auto"><CalendarPlus data-icon="inline-start" />Agendar acá</Button>}
        <Button type="button" variant="outline" onClick={() => onReclamo({ id: e.id, cue: e.cue, nombre: e.nombre, distrito: e.distrito, ciudad: e.ciudad })} className="w-full border-white/60 bg-transparent text-white hover:bg-white/15 hover:text-white sm:w-auto"><Wifi data-icon="inline-start" />Reclamo de conectividad</Button>
      </div>
    </header>
    <ul className="grid grid-cols-3 gap-2 text-center">
      {stats.map(([v, l, fam]) => <li key={l} className={`rounded-tile px-2 py-2.5 ${FAMILIAS[fam].fondo}`}><p className={`text-xl font-bold tabular-nums leading-tight ${FAMILIAS[fam].texto}`}>{v}</p><p className="text-xs text-dte-gris">{l}</p></li>)}
    </ul>
    <div className="grid gap-3 sm:grid-cols-2">
      <Tarjeta tono={TONO.ubicacion} titulo="Ubicación">
        <Dato label="Dirección">{e.direccion && <>{titleCase(e.direccion)}{e.mapa && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.mapa)}`} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 font-semibold text-dte-petroleo underline underline-offset-2"><Navigation className="size-3.5" aria-hidden />Cómo llegar</a>}</>}</Dato>
        <Dato label="Ámbito">{e.ambito}</Dato>
      </Tarjeta>
      <Tarjeta tono={TONO.institucion} titulo="Institución">
        <Dato label="Nivel y modalidad">{[e.nivel, e.modalidad].filter(Boolean).join(' · ')}</Dato>
        <Dato label="Turnos">{sinComillas(e.turnos)}</Dato>
        <Dato label="FED a cargo">{e.fed_a_cargo}</Dato>
      </Tarjeta>
      {(e.matricula != null || e.secciones != null) && <Tarjeta tono={TONO.alumnado} titulo="Alumnado">
        <Dato label="Matrícula">{e.matricula != null && <>{num.format(e.matricula)}{e.varones != null && e.mujeres != null && <span className="font-normal text-dte-gris"> · {num.format(e.varones)} varones, {num.format(e.mujeres)} mujeres</span>}</>}</Dato>
        <Dato label="Secciones">{e.secciones != null && num.format(e.secciones)}</Dato>
      </Tarjeta>}
    </div>
    {proximas.length > 0 && <Seccion tono={TONO.proximas} titulo="Próximas acciones" cantidad={proximas.length}><Filas filas={proximas} feds={feds} onOpen={onOpen} inicial={5} /></Seccion>}
    {clubes.length > 0 && <Seccion tono={TONO.clubes} titulo="Clubes y prácticas" cantidad={clubes.length}>
      <ul className="divide-y divide-dte-linea overflow-hidden rounded-tile border border-dte-linea">{clubes.map(c => <li key={c.id} className="px-3 py-2.5 text-sm">
        <p className="font-semibold">{cap(c.tipo.toLowerCase())}{c.grupo ? ` · ${c.grupo}` : ''}{c.esOrigen && <span className="ml-1.5 text-xs font-normal text-dte-gris">(escuela de origen)</span>}</p>
        <p className="text-xs text-dte-gris">{[c.propuesta, fedDe(c.fed_id), `${c.realizados} ${c.realizados === 1 ? 'encuentro realizado' : 'encuentros realizados'}`, c.fecha_cierre ? 'cerrado' : 'en curso'].filter(Boolean).join(' · ')}</p>
      </li>)}</ul>
    </Seccion>}
    {anteriores.length > 0 ? <Seccion tono={TONO.historial} titulo="Historial" cantidad={anteriores.length}><Filas filas={anteriores} feds={feds} onOpen={onOpen} inicial={8} /></Seccion>
      : !proximas.length && <p className="rounded-tile border border-dashed border-dte-linea px-3 py-4 text-center text-sm text-dte-gris">Todavía no hay acciones agendadas en esta escuela.</p>}
  </div>
}

// Buscador de escuelas: escribís el nombre, la sigla o el CUE y se abre la ficha con lo que se hizo ahí.
export function BuscadorEscuelas({ open, onClose, feds, puedeAgendar, onAgendar, onReclamo, onOpen }: { open: boolean, onClose: () => void, feds: Fed[], puedeAgendar: boolean, onAgendar: (s: School) => void, onReclamo: (s: School) => void, onOpen: (i: AgendaItem) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<School[]>([])
  const [buscando, setBuscando] = useState(false)
  const [elegida, setElegida] = useState<School | null>(null)
  const [ficha, setFicha] = useState<FichaEscuela | null>(null)
  const [error, setError] = useState('')
  const escribir = (q: string) => {
    setQuery(q); setError('')
    if (q.trim().length < 2) { setResults([]); setBuscando(false) } else setBuscando(true)
  }
  useEffect(() => {
    if (query.trim().length < 2) return
    let vigente = true
    const t = setTimeout(() => searchSchools(query)
      .then(r => { if (vigente) setResults([...r].sort((a, b) => az(a.nombre ?? '', b.nombre ?? ''))) })
      .catch(e => { if (vigente) { setResults([]); setError(errMsg(e)) } })
      .finally(() => { if (vigente) setBuscando(false) }), 250)
    return () => { vigente = false; clearTimeout(t) }
  }, [query])
  const abrir = (s: School) => {
    setElegida(s); setFicha(null); setError('')
    getFichaEscuela(s.id).then(setFicha).catch(e => setError(errMsg(e)))
  }
  const volver = () => { setElegida(null); setFicha(null); setError('') }
  const cerrar = () => { onClose(); volver(); escribir('') }
  return <Dialog open={open} onOpenChange={o => !o && cerrar()}>
    {/* En el celular se ancla arriba: abajo el teclado taparía el campo. La búsqueda se limita a lo que queda visible sobre el teclado. */}
    <DialogContent className={`overflow-y-auto bg-white max-sm:top-[calc(env(safe-area-inset-top,0px)+0.5rem)]! max-sm:bottom-auto! max-sm:rounded-b-2xl! max-sm:pb-4! ${elegida ? 'max-sm:max-h-[calc(100dvh-1rem)]!' : 'max-sm:max-h-[45dvh]!'} sm:max-w-xl`}>
      <DialogTitle className="flex items-center gap-2"><SchoolIcon className="size-5 text-dte-petroleo" aria-hidden />{elegida ? 'Ficha de la escuela' : 'Buscar escuela'}</DialogTitle>
      <DialogDescription className="sr-only">Buscá una escuela por nombre, sigla o CUE para ver sus datos y las acciones realizadas.</DialogDescription>
      {elegida ? <>
        <Button type="button" variant="ghost" size="sm" onClick={volver} className="-mt-1 self-start"><ArrowLeft data-icon="inline-start" />Volver a la búsqueda</Button>
        {error ? <ErrorBox message={error} onRetry={() => abrir(elegida)} />
          : !ficha ? <div className="flex flex-col gap-3"><Skeleton className="h-12" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
          : <Ficha ficha={ficha} feds={feds} puedeAgendar={puedeAgendar} onAgendar={s => { cerrar(); onAgendar(s) }} onReclamo={s => { cerrar(); onReclamo(s) }} onOpen={i => { cerrar(); onOpen(i) }} />}
      </> : <>
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dte-gris-claro" aria-hidden /><Input autoFocus value={query} onChange={e => escribir(e.target.value)} placeholder="Nombre, sigla o CUE (ej.: EP 4, ees 31)" aria-label="Buscar escuela" className="h-11 pl-9" />{buscando && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-dte-gris" aria-hidden />}</div>
        {error && <ErrorBox message={error} />}
        {query.trim().length >= 2 && !buscando && !error && !results.length && <p className="px-1 text-sm text-dte-gris">No encontramos escuelas con ese dato.</p>}
        {results.length > 0 && <ul className="divide-y divide-dte-linea rounded-tile border border-dte-linea">{results.map(s => <li key={s.id}>
          <button type="button" onClick={() => abrir(s)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-dte-tinte">
            <MapPin className="size-4 shrink-0 text-dte-gris-claro" aria-hidden />
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{schoolName(s)}</span><span className="block truncate text-xs text-dte-gris">CUE {s.cue ?? '—'}{schoolPlace(s) ? ` · ${schoolPlace(s)}` : ''}</span></span>
          </button></li>)}</ul>}
      </>}
    </DialogContent>
  </Dialog>
}
