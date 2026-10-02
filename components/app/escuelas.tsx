'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarPlus, Loader2, MapPin, Navigation, Search, School as SchoolIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { type Accion, type AgendaItem, type Estado, type Fed, type School } from '@/lib/agenda'
import { resumenHistorial, separarHistorial, type FichaEscuela, type FilaHistorial } from '@/lib/escuela'
import { hoyAR } from '@/lib/hora'
import { titleCase } from '@/lib/format'
import { ActionChip, Skeleton, StatusBadge, ErrorBox, cap, errMsg, fmt, parse, schoolName, schoolPlace, searchSchools, getFichaEscuela, az } from '@/components/app/comun'

const num = new Intl.NumberFormat('es-AR')
const fechaCorta = (f: string) => cap(fmt(parse(f), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, ''))

function Dato({ label, children }: { label: string, children: React.ReactNode }) {
  return children ? <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wider text-dte-gris">{label}</dt><dd className="text-sm">{children}</dd></div> : null
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

function Lista({ titulo, filas, feds, onOpen }: { titulo: string, filas: FilaHistorial[], feds: Fed[], onOpen: (i: AgendaItem) => void }) {
  return filas.length ? <section>
    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-dte-gris">{titulo} ({filas.length})</h3>
    <ul className="max-h-80 divide-y divide-dte-linea overflow-y-auto rounded-tile border border-dte-linea">{filas.map(f => <Fila key={f.id} f={f} feds={feds} onOpen={onOpen} />)}</ul>
  </section> : null
}

function Ficha({ ficha, feds, puedeAgendar, onAgendar, onOpen }: { ficha: FichaEscuela, feds: Fed[], puedeAgendar: boolean, onAgendar: (s: School) => void, onOpen: (i: AgendaItem) => void }) {
  const { escuela: e, historial, clubes } = ficha
  const { proximas, anteriores } = separarHistorial(historial, hoyAR())
  const r = resumenHistorial(historial)
  const fedDe = (id: string) => feds.find(x => x.id === id)?.nombre_completo ?? ''
  const alumnos = e.matricula != null ? `${num.format(e.matricula)}${e.varones != null && e.mujeres != null ? ` (${num.format(e.varones)} varones, ${num.format(e.mujeres)} mujeres)` : ''}` : null
  return <div className="flex flex-col gap-5">
    <div>
      <p className="font-bold leading-snug">{schoolName(e)}</p>
      <p className="text-sm text-dte-gris">CUE {e.cue ?? '—'}{schoolPlace(e) ? ` · ${schoolPlace(e)}` : ''}</p>
    </div>
    <dl className="grid gap-3 sm:grid-cols-2">
      <Dato label="Dirección">{e.direccion && <>{titleCase(e.direccion)}{e.mapa && <> · <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.mapa)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-dte-petroleo underline underline-offset-2"><Navigation className="size-3.5" aria-hidden />Cómo llegar</a></>}</>}</Dato>
      <Dato label="FED a cargo">{e.fed_a_cargo}</Dato>
      <Dato label="Nivel y modalidad">{[e.nivel, e.modalidad].filter(Boolean).join(' · ')}</Dato>
      <Dato label="Turnos">{e.turnos && titleCase(e.turnos)}</Dato>
      <Dato label="Matrícula">{alumnos}</Dato>
      <Dato label="Secciones">{e.secciones != null && num.format(e.secciones)}</Dato>
      <Dato label="Ámbito">{e.ambito}</Dato>
    </dl>
    <ul className="grid grid-cols-3 gap-2 text-center">
      {[[r.realizadas, 'acciones realizadas'], [r.feds, r.feds === 1 ? 'FED las hizo' : 'FED distintos'], [r.ultima ? fmt(parse(r.ultima), { day: 'numeric', month: 'short' }).replace(/\./g, '') : '—', 'última visita']].map(([v, l]) => <li key={l} className="rounded-tile bg-dte-fondo px-2 py-2"><p className="text-base font-bold tabular-nums leading-tight sm:text-lg">{v}</p><p className="text-xs text-dte-gris">{l}</p></li>)}
    </ul>
    {puedeAgendar && <Button type="button" onClick={() => onAgendar({ id: e.id, cue: e.cue, nombre: e.nombre, distrito: e.distrito, ciudad: e.ciudad })} className="self-start"><CalendarPlus data-icon="inline-start" />Agendar acá</Button>}
    <Lista titulo="Próximas acciones" filas={proximas} feds={feds} onOpen={onOpen} />
    {clubes.length > 0 && <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-dte-gris">Clubes y prácticas ({clubes.length})</h3>
      <ul className="divide-y divide-dte-linea rounded-tile border border-dte-linea">{clubes.map(c => <li key={c.id} className="px-3 py-2.5 text-sm">
        <p className="font-semibold">{cap(c.tipo.toLowerCase())}{c.grupo ? ` · ${c.grupo}` : ''}{c.esOrigen && <span className="ml-1.5 text-xs font-normal text-dte-gris">(escuela de origen)</span>}</p>
        <p className="text-xs text-dte-gris">{[c.propuesta, fedDe(c.fed_id), `${c.realizados} ${c.realizados === 1 ? 'encuentro realizado' : 'encuentros realizados'}`, c.fecha_cierre ? 'cerrado' : 'en curso'].filter(Boolean).join(' · ')}</p>
      </li>)}</ul>
    </section>}
    {anteriores.length ? <Lista titulo="Historial" filas={anteriores} feds={feds} onOpen={onOpen} /> : !proximas.length && <p className="rounded-tile border border-dashed border-dte-linea px-3 py-4 text-center text-sm text-dte-gris">Todavía no hay acciones agendadas en esta escuela.</p>}
  </div>
}

// Buscador de escuelas: escribís el nombre, la sigla o el CUE y se abre la ficha con lo que se hizo ahí.
export function BuscadorEscuelas({ open, onClose, feds, puedeAgendar, onAgendar, onOpen }: { open: boolean, onClose: () => void, feds: Fed[], puedeAgendar: boolean, onAgendar: (s: School) => void, onOpen: (i: AgendaItem) => void }) {
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
    <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white sm:max-w-xl">
      <DialogTitle className="flex items-center gap-2"><SchoolIcon className="size-5 text-dte-petroleo" aria-hidden />{elegida ? 'Ficha de la escuela' : 'Buscar escuela'}</DialogTitle>
      <DialogDescription className="sr-only">Buscá una escuela por nombre, sigla o CUE para ver sus datos y las acciones realizadas.</DialogDescription>
      {elegida ? <>
        <Button type="button" variant="ghost" size="sm" onClick={volver} className="-mt-1 self-start"><ArrowLeft data-icon="inline-start" />Volver a la búsqueda</Button>
        {error ? <ErrorBox message={error} onRetry={() => abrir(elegida)} />
          : !ficha ? <div className="flex flex-col gap-3"><Skeleton className="h-12" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
          : <Ficha ficha={ficha} feds={feds} puedeAgendar={puedeAgendar} onAgendar={s => { cerrar(); onAgendar(s) }} onOpen={i => { cerrar(); onOpen(i) }} />}
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
