'use client'

import { EtiquetaTipo } from '@/components/app/tipocrono'
import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, CalendarClock, CalendarPlus, ChevronDown, Contact, History, Loader2, Mail, MapPin, Navigation, Phone, Search, School as SchoolIcon, Trophy, TriangleAlert, Wifi, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { type Accion, type AgendaItem, type Estado, type Fed, type School } from '@/lib/agenda'
import { FAMILIAS, type Familia } from '@/lib/ayuda/estilo'
import { CAMPOS_ESCUELA, CLAVES_CONECTIVIDAD } from '@/lib/escuelas-edicion'
import { nombreContacto } from '@/lib/mis-escuelas'
import { ESTADO_SEGUIMIENTO_LABEL, estadoDe, ventanaDe } from '@/lib/cronogramas'
import { resumenProximos } from '@/lib/cruce'
import { ESTADO_RECLAMO_CLASE, ESTADO_RECLAMO_LABEL, esAbierto } from '@/lib/reclamos-registro'
import type { ExtrasEscuela } from '@/app/actions'
import { resumenHistorial, separarHistorial, type FichaEscuela, type FilaHistorial } from '@/lib/escuela'
import { hoyAR } from '@/lib/hora'
import { titleCase } from '@/lib/format'
import { BotonEditar } from '@/components/app/editarescuela'
import { FichaJefatura } from '@/components/app/jefatura'
import { MapaChico } from '@/components/app/mapabase'
import { ActionChip, Skeleton, StatusBadge, ErrorBox, cap, errMsg, fmt, parse, schoolName, schoolPlace, searchSchools, getFichaEscuela, az, lineaPredio, nombreHermana, storage } from '@/components/app/comun'

const num = new Intl.NumberFormat('es-AR')
const fechaCorta = (f: string) => cap(fmt(parse(f), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, ''))

// Color por tipo de dato (las mismas familias de la ayuda): ubicación, institución, alumnado y cada sección del historial.
type Tono = { familia: Familia, Icono: LucideIcon }
const TONO = {
  ubicacion: { familia: 'celeste', Icono: MapPin }, escuela: { familia: 'violeta', Icono: Building2 }, reclamos: { familia: 'amarillo', Icono: TriangleAlert }, cronogramas: { familia: 'violeta', Icono: CalendarClock },
  proximas: { familia: 'celeste', Icono: CalendarClock }, proximos: { familia: 'celeste', Icono: CalendarClock }, conectividad: { familia: 'amarillo', Icono: Wifi }, contactos: { familia: 'azul', Icono: Contact }, clubes: { familia: 'violeta', Icono: Trophy }, historial: { familia: 'azul', Icono: History },
} satisfies Record<string, Tono>
const sinComillas = (t: string | null) => (t ? titleCase(t.replace(/["“”]/g, '').trim()) : null)

function Dato({ label, children }: { label: string, children: React.ReactNode }) {
  return children ? <div className="min-w-0"><dt className="text-xs font-semibold text-dte-gris">{label}</dt><dd className="text-sm font-medium">{children}</dd></div> : null
}

function Tarjeta({ tono, titulo, children, columnas, lista }: { tono: Tono, titulo: string, children: React.ReactNode, columnas?: boolean, lista?: boolean }) {
  const f = FAMILIAS[tono.familia]
  return <section className={`min-w-0 rounded-card border-l-4 p-3.5 ${f.fondo} ${f.borde}`}>
    <h3 className={`mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${f.texto}`}><tono.Icono className="size-4" aria-hidden />{titulo}</h3>
    {lista ? <div>{children}</div> : <dl className={columnas ? 'grid gap-x-4 gap-y-2 sm:grid-cols-2' : 'flex flex-col gap-2'}>{children}</dl>}
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

function Filas({ filas, feds, onOpen, inicial }: { filas: FilaHistorial[], feds: Fed[], onOpen: (i: AgendaItem) => void, inicial: number }) {
  const [visibles, setVisibles] = useState(inicial)
  return <>
    <ul className="divide-y divide-dte-linea overflow-hidden rounded-tile border border-dte-linea">{filas.slice(0, visibles).map(f => <Fila key={f.id} f={f} feds={feds} onOpen={onOpen} />)}</ul>
    {filas.length > visibles && <Button type="button" variant="ghost" size="sm" onClick={() => setVisibles(v => v + 15)} className="mt-1 w-full text-dte-petroleo">Ver más ({filas.length - visibles})</Button>}
  </>
}

// Los bloques de abajo de la ficha se abren cuando hacen falta; los que quedaron abiertos se recuerdan en este navegador.
const ABIERTOS_KEY = 'agenda-territorial:ficha-abiertos'
const leerAbiertos = (): string[] => { try { const v = JSON.parse(storage(() => localStorage.getItem(ABIERTOS_KEY)) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [] } catch { return [] } }
function Desplegable({ id, tono, titulo, cantidad, destacado, children }: { id: string, tono: Tono, titulo: string, cantidad: string | number, destacado?: boolean, children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(() => leerAbiertos().includes(id))
  const f = FAMILIAS[tono.familia]
  const alternar = () => { const ahora = !abierto; setAbierto(ahora); storage(() => localStorage.setItem(ABIERTOS_KEY, JSON.stringify(ahora ? [...new Set([...leerAbiertos(), id])] : leerAbiertos().filter(x => x !== id)))) }
  return <section className="overflow-hidden rounded-tile border border-dte-linea bg-white">
    <button type="button" onClick={alternar} aria-expanded={abierto} className="flex min-h-12 w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-dte-tinte">
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${f.fondo} ${f.texto}`}><tono.Icono className="size-4" aria-hidden /></span>
      <span className="text-sm font-bold">{titulo}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${destacado ? 'bg-aviso-fondo text-aviso-fuerte' : 'bg-dte-fondo text-dte-gris'}`}>{cantidad}</span>
      <ChevronDown className={`ml-auto size-4 shrink-0 text-dte-gris transition ${abierto ? 'rotate-180' : ''}`} aria-hidden />
    </button>
    {abierto && <div className="border-t border-dte-linea px-3.5 py-3">{children}</div>}
  </section>
}
const Vacio = ({ children }: { children: React.ReactNode }) => <p className="rounded-tile border border-dashed border-dte-linea px-3 py-3 text-center text-sm text-dte-gris">{children}</p>

// Ficha de la escuela: cabecera con lo esencial, alertas, dos columnas de tarjetas (contactos y ubicación / la escuela y conectividad) y bloques desplegables.
export function Ficha({ ficha, feds, extras, puedeAgendar, onAgendar, onReclamo, onOpen, onEditado, onEscuela }: { onEscuela?: (id: string) => void, extras?: ExtrasEscuela | null, ficha: FichaEscuela, feds: Fed[], puedeAgendar: boolean, onAgendar: (s: School) => void, onReclamo: (s: School) => void, onOpen: (i: AgendaItem) => void, onEditado: () => void }) {
  const { escuela: e, historial, clubes, conectividad, jefatura, contactos, proximos } = ficha
  const [verJefatura, setVerJefatura] = useState(false)
  const filasConectividad = CAMPOS_ESCUELA.filter(c => CLAVES_CONECTIVIDAD.includes(c.clave) && conectividad[c.clave])
  const { proximas, anteriores } = separarHistorial(historial, hoyAR())
  const r = resumenHistorial(historial)
  const fedDe = (id: string) => feds.find(x => x.id === id)?.nombre_completo ?? 'Ex integrante'
  const abiertos = extras ? extras.reclamos.filter(x => esAbierto(x.estado)) : []
  const proximoCrono = resumenProximos(proximos)
  const link = 'font-semibold text-dte-petroleo underline underline-offset-2'
  const pill = 'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dte-petroleo/40 bg-white px-3 text-sm font-semibold text-dte-petroleo transition hover:bg-dte-tinte'
  const esc: School = { id: e.id, cue: e.cue, nombre: e.nombre, distrito: e.distrito, ciudad: e.ciudad }
  return <div className="flex flex-col gap-4">
    {verJefatura && jefatura && <FichaJefatura id={jefatura.id} onClose={() => setVerJefatura(false)} />}
    <header className="rounded-card bg-dte-degradado p-4 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-lg font-bold leading-snug">{schoolName(e)}</p>
          <p className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
            <span className="rounded-full bg-white/20 px-2.5 py-0.5">CUE {e.cue ?? '—'}</span>
            {schoolPlace(e) && <span className="rounded-full bg-white/20 px-2.5 py-0.5">{schoolPlace(e)}</span>}
            <span className="rounded-full bg-white/20 px-2.5 py-0.5">FED: {e.fed_a_cargo ?? 'sin asignar'}</span>
            {e.predio != null && <span className="rounded-full bg-white/20 px-2.5 py-0.5">Predio {e.predio}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 max-sm:w-full max-sm:flex-col">
          {puedeAgendar && <Button type="button" onClick={() => onAgendar(esc)} className="bg-white text-dte-petroleo hover:bg-white/90"><CalendarPlus data-icon="inline-start" />Agendar acá</Button>}
          <Button type="button" variant="outline" onClick={() => onReclamo(esc)} className="border-white/60 bg-transparent text-white hover:bg-white/15 hover:text-white"><Wifi data-icon="inline-start" />Reclamo de conectividad</Button>
          {ficha.puedeEditar && <BotonEditar id={e.id} nombre={schoolName(e)} onCambio={onEditado} />}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-white/90">
        <span><b>{r.realizadas}</b> {r.realizadas === 1 ? 'acción realizada' : 'acciones realizadas'}</span>
        <span><b>{r.feds}</b> {r.feds === 1 ? 'FED la hizo' : 'FED distintos'}</span>
        <span>Última visita <b>{r.ultima ? fmt(parse(r.ultima), { day: 'numeric', month: 'short' }).replace(/\./g, '') : '—'}</b></span>
      </p>
    </header>
    {(abiertos.length > 0 || proximoCrono) && <div role="status" className="flex flex-col gap-1 rounded-card border border-aviso-borde bg-aviso-fondo px-3.5 py-2.5 text-sm font-semibold text-aviso-fuerte sm:flex-row sm:flex-wrap sm:gap-x-6">
      {abiertos.length > 0 && <span className="flex items-start gap-1.5"><Wifi className="mt-0.5 size-4 shrink-0" aria-hidden /><span><b>{abiertos.length} {abiertos.length === 1 ? 'reclamo abierto' : 'reclamos abiertos'}</b> · {abiertos[0].tipo_label}</span></span>}
      {proximoCrono && <span className="flex items-start gap-1.5"><CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden /><span><b>Cronograma próximo:</b> {proximoCrono}</span></span>}
    </div>}
    <div className="grid items-start gap-3 md:grid-cols-[1.25fr_1fr]">
      <div className="flex min-w-0 flex-col gap-3">
        <Tarjeta tono={TONO.contactos} titulo={`Contactos${contactos.length ? ` (${contactos.length})` : ''}`} lista>
          {contactos.length ? <ul className="flex flex-col divide-y divide-black/10">{contactos.map((k, i) => <li key={i} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
            <span className="break-words text-sm font-semibold">{nombreContacto(k) || 'Sin nombre'}{k.cargo && <span className="font-normal text-dte-gris"> · {k.cargo}</span>}{k.es_principal && <span className="ml-1.5 text-xs font-normal text-dte-gris">(principal)</span>}</span>
            <span className="flex flex-wrap gap-2">
              {k.telefono && <a href={`tel:${k.telefono}`} className={pill}><Phone className="size-3.5" aria-hidden />{k.telefono}</a>}
              {k.correo_laboral && <a href={`mailto:${k.correo_laboral}`} className={`${pill} break-all`}><Mail className="size-3.5 shrink-0" aria-hidden />{k.correo_laboral}{k.correo && <span className="text-xs font-normal text-dte-gris">(directivo)</span>}</a>}
              {k.correo && <a href={`mailto:${k.correo}`} className={`${pill} break-all`}><Mail className="size-3.5 shrink-0" aria-hidden />{k.correo}{k.correo_laboral && <span className="text-xs font-normal text-dte-gris">(escuela)</span>}</a>}
              {!k.telefono && !k.correo && !k.correo_laboral && <span className="text-xs text-dte-gris">Sin teléfono ni correo</span>}
            </span>
          </li>)}</ul> : <p className="text-sm text-dte-gris">Sin datos de contacto cargados.</p>}
        </Tarjeta>
        <Tarjeta tono={TONO.ubicacion} titulo="Ubicación">
          <Dato label="Dirección">{e.direccion && <>{titleCase(e.direccion)}{e.mapa && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.mapa)}`} target="_blank" rel="noopener noreferrer" className={`mt-1 flex items-center gap-1 ${link}`}><Navigation className="size-3.5" aria-hidden />Cómo llegar</a>}</>}</Dato>
          <Dato label="Ámbito">{e.ambito}</Dato>
          {e.lat != null && e.lon != null && <div className="mt-1"><MapaChico lat={e.lat} lon={e.lon} nombre={schoolName(e)} /></div>}
        </Tarjeta>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <Tarjeta tono={TONO.escuela} titulo="La escuela" columnas>
          <Dato label="Nivel y modalidad">{[e.nivel, e.modalidad].filter(Boolean).join(' · ')}</Dato>
          <Dato label="Turnos">{sinComillas(e.turnos)}</Dato>
          <Dato label="Matrícula">{e.matricula != null && <>{num.format(e.matricula)}{e.varones != null && e.mujeres != null && <span className="font-normal text-dte-gris"> · {num.format(e.varones)} varones, {num.format(e.mujeres)} mujeres</span>}</>}</Dato>
          <Dato label="Secciones">{e.secciones != null && num.format(e.secciones)}</Dato>
          {jefatura && <Dato label="Jefatura distrital"><button type="button" onClick={() => setVerJefatura(true)} className={`text-left ${link}`}>{titleCase(jefatura.nombre.replace(/^JEFATURA DISTRITAL \| /i, ''))}</button></Dato>}
          {e.comparte.length > 0 && <div className="min-w-0 sm:col-span-2"><Dato label={e.comparte.length === 1 ? 'Comparte el predio con' : 'Comparten el predio'}>
            <ul className="flex flex-col gap-0.5">{e.comparte.map(h => <li key={h.id}>{onEscuela ? <button type="button" onClick={() => onEscuela(h.id)} className={`text-left ${link}`}>{nombreHermana(h)}</button> : <span>{nombreHermana(h)}</span>}</li>)}</ul></Dato></div>}
        </Tarjeta>
        <Tarjeta tono={TONO.conectividad} titulo="Conectividad" columnas>
          {filasConectividad.length ? filasConectividad.map(c => <Dato key={c.clave} label={c.label}>{conectividad[c.clave]}</Dato>) : <p className="text-sm text-dte-gris sm:col-span-2">Sin datos de conectividad cargados.</p>}
        </Tarjeta>
      </div>
    </div>
    <div className="flex flex-col gap-2">
      {extras && <Desplegable id="reclamos" tono={TONO.reclamos} titulo="Reclamos de conectividad" cantidad={abiertos.length ? `${abiertos.length} ${abiertos.length === 1 ? 'abierto' : 'abiertos'}${abiertos.length < extras.reclamos.length ? ` de ${extras.reclamos.length}` : ''}` : extras.reclamos.length} destacado={abiertos.length > 0}>
        {extras.reclamos.length ? <ul className="divide-y divide-dte-linea overflow-hidden rounded-tile border border-dte-linea">{extras.reclamos.map(x => <li key={x.id} className="flex flex-col gap-1 px-3 py-2.5">
          <span className="flex flex-wrap items-center gap-1.5"><span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${ESTADO_RECLAMO_CLASE[x.estado]}`}>{ESTADO_RECLAMO_LABEL[x.estado]}</span><span className="text-xs text-dte-gris">{fechaCorta(x.enviado_at.slice(0, 10))} · {fedDe(x.fed_id as string)}</span></span>
          <span className="break-words text-sm">{x.tipo_label}{x.nro_incidencia && <span className="text-dte-gris"> · N° {x.nro_incidencia}</span>}</span>
        </li>)}</ul> : <Vacio>Sin reclamos registrados.</Vacio>}
      </Desplegable>}
      <Desplegable id="cronogramas" tono={TONO.cronogramas} titulo="Cronogramas de conectividad" cantidad={extras ? extras.cronogramas.length : proximos.length}>
        {extras ? (extras.cronogramas.length ? <ul className="divide-y divide-dte-linea overflow-hidden rounded-tile border border-dte-linea">{extras.cronogramas.map(cr => { const est = estadoDe(cr); return <li key={cr.id} className="flex flex-col gap-0.5 px-3 py-2.5">
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">{ventanaDe(cr)}<EtiquetaTipo tipo={cr.tipo} /></span>
          <span className="text-xs text-dte-gris">{[cr.proveedor, cr.nro && `N° ${cr.nro}`, est ? ESTADO_SEGUIMIENTO_LABEL[est] : 'Sin marcar'].filter(Boolean).join(' · ')}</span>
        </li> })}</ul> : <Vacio>Sin cronogramas en los últimos días.</Vacio>)
          : proximos.length ? <ul className="flex flex-col gap-1">{proximos.map(c => <li key={c.id} className="break-words text-sm"><span className="font-semibold tabular-nums">{ventanaDe(c)}</span> · <EtiquetaTipo tipo={c.tipo} />{c.proveedor && <span className="text-dte-gris"> · {c.proveedor}</span>}</li>)}</ul> : <Vacio>Sin cronogramas próximos de conectividad.</Vacio>}
      </Desplegable>
      <Desplegable id="acciones" tono={TONO.proximas} titulo="Próximas acciones" cantidad={proximas.length}>
        {proximas.length ? <Filas filas={proximas} feds={feds} onOpen={onOpen} inicial={5} /> : <Vacio>No hay acciones planificadas en esta escuela.</Vacio>}
      </Desplegable>
      <Desplegable id="clubes" tono={TONO.clubes} titulo="Clubes y prácticas" cantidad={clubes.length}>
        {clubes.length ? <ul className="divide-y divide-dte-linea overflow-hidden rounded-tile border border-dte-linea">{clubes.map(c => <li key={c.id} className="px-3 py-2.5 text-sm">
          <p className="font-semibold">{cap(c.tipo.toLowerCase())}{c.grupo ? ` · ${c.grupo}` : ''}{c.esOrigen && <span className="ml-1.5 text-xs font-normal text-dte-gris">(escuela de origen)</span>}</p>
          <p className="text-xs text-dte-gris">{[c.propuesta, fedDe(c.fed_id), `${c.realizados} ${c.realizados === 1 ? 'encuentro realizado' : 'encuentros realizados'}`, c.fecha_cierre ? 'cerrado' : 'en curso'].filter(Boolean).join(' · ')}</p>
        </li>)}</ul> : <Vacio>Esta escuela no tiene clubes ni prácticas.</Vacio>}
      </Desplegable>
      <Desplegable id="historial" tono={TONO.historial} titulo="Historial de visitas" cantidad={anteriores.length}>
        {anteriores.length ? <Filas filas={anteriores} feds={feds} onOpen={onOpen} inicial={8} /> : <Vacio>Todavía no hay acciones registradas en esta escuela.</Vacio>}
      </Desplegable>
    </div>
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
    <DialogContent className={`overflow-y-auto bg-white max-sm:top-[calc(env(safe-area-inset-top,0px)+0.5rem)]! max-sm:bottom-auto! max-sm:rounded-b-2xl! max-sm:pb-4! ${elegida ? 'max-sm:max-h-[calc(100dvh-1rem)]! sm:max-w-5xl' : 'max-sm:max-h-[45dvh]! sm:max-w-xl'}`}>
      <DialogTitle className="flex items-center gap-2"><SchoolIcon className="size-5 text-dte-petroleo" aria-hidden />{elegida ? 'Ficha de la escuela' : 'Buscar escuela'}</DialogTitle>
      <DialogDescription className="sr-only">Buscá una escuela por nombre, sigla o CUE para ver sus datos y las acciones realizadas.</DialogDescription>
      {elegida ? <>
        <Button type="button" variant="ghost" size="sm" onClick={volver} className="-mt-1 self-start"><ArrowLeft data-icon="inline-start" />Volver a la búsqueda</Button>
        {error ? <ErrorBox message={error} onRetry={() => abrir(elegida)} />
          : !ficha ? <div className="flex flex-col gap-3"><Skeleton className="h-12" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
          : <Ficha ficha={ficha} feds={feds} puedeAgendar={puedeAgendar} onAgendar={s => { cerrar(); onAgendar(s) }} onReclamo={s => { cerrar(); onReclamo(s) }} onOpen={i => { cerrar(); onOpen(i) }} onEditado={() => { getFichaEscuela(elegida.id).then(setFicha).catch(() => {}) }} onEscuela={id => abrir({ id, cue: null, nombre: null, distrito: null, ciudad: null })} />}
      </> : <>
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dte-gris-claro" aria-hidden /><Input autoFocus value={query} onChange={e => escribir(e.target.value)} placeholder="Nombre, sigla o CUE (ej.: EP 4, ees 31)" aria-label="Buscar escuela" className="h-11 pl-9" />{buscando && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-dte-gris" aria-hidden />}</div>
        {error && <ErrorBox message={error} />}
        {query.trim().length >= 2 && !buscando && !error && !results.length && <p className="px-1 text-sm text-dte-gris">No encontramos escuelas con ese dato.</p>}
        {results.length > 0 && <ul className="divide-y divide-dte-linea rounded-tile border border-dte-linea">{results.map(s => <li key={s.id}>
          <button type="button" onClick={() => abrir(s)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-dte-tinte">
            <MapPin className="size-4 shrink-0 text-dte-gris-claro" aria-hidden />
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{schoolName(s)}</span><span className="block truncate text-xs text-dte-gris">CUE {s.cue ?? '—'}{schoolPlace(s) ? ` · ${schoolPlace(s)}` : ''}</span>{lineaPredio(s) && <span className="block break-words text-xs font-medium text-club-violeta">{lineaPredio(s)}</span>}{s.crono && <span className="flex items-center gap-1 break-words text-xs font-medium text-pba-celeste-texto"><CalendarClock className="size-3 shrink-0" aria-hidden />Cronograma próximo: {s.crono}</span>}</span>
          </button></li>)}</ul>}
      </>}
    </DialogContent>
  </Dialog>
}
