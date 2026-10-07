'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Building2, Map as MapIcono, CalendarClock, ChevronRight, FileSpreadsheet, Loader2, Mail, Phone, School as SchoolIcon, Search, TriangleAlert, Wifi, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { type AgendaItem, type Fed, type School } from '@/lib/agenda'
import { ESTADO_SEGUIMIENTO_LABEL, SIN_FED, estadoDe, etiquetaTipo, ventanaDe } from '@/lib/cronogramas'
import { FAMILIAS } from '@/lib/ayuda/estilo'
import { FILTROS_ESCUELAS_VACIOS, filtrarEscuelas, nombreContacto, ordenarEscuelas, resumenEscuelas, type ColumnaEscuelas, type FiltrosEscuelas, type ResumenEscuela } from '@/lib/mis-escuelas'
import { ESTADO_RECLAMO_CLASE, ESTADO_RECLAMO_LABEL } from '@/lib/reclamos-registro'
import type { FichaEscuela } from '@/lib/escuela'
import { titleCase } from '@/lib/format'
import { siglaNombre } from '@/lib/siglas'
import { BotonVolver, ErrorBox, Skeleton, errMsg, eyebrow, fmt, getExtrasEscuela, getFichaEscuela, getMisEscuelas, nombreHermana, parse, selectClass, storage } from '@/components/app/comun'
import { Ficha } from '@/components/app/escuelas'

const POR_PAGINA = 60
const fechaCorta = (f: string) => fmt(parse(f), { day: 'numeric', month: 'short' }).replace(/\./g, '')
const unicos = (l: (string | null | undefined)[]) => [...new Set(l.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'es'))

// Las escuelas que tiene a cargo cada FED, con el buscador como protagonista, en lista (para comparar con un registro propio) o en tarjetas, y su ficha completa.
// La coordinación y la administración ven todas.
const VISTA_KEY = 'agenda-territorial:vista-escuelas'
const COLUMNAS: [ColumnaEscuelas, string][] = [['nombre', 'Escuela'], ['cue', 'CUE'], ['direccion', 'Dirección'], ['ciudad', 'Localidad'], ['distrito', 'Distrito']]

export function MisEscuelas({ profile, feds, esAdmin, puedeAgendar, onAgendar, onReclamo, onOpen, volver, onMapa }: { onMapa: () => void, volver?: { destino: string, ir: () => void }, profile: Fed, feds: Fed[], esAdmin: boolean, puedeAgendar: boolean, onAgendar: (s: School) => void, onReclamo: (s: School) => void, onOpen: (i: AgendaItem) => void }) {
  const [lista, setLista] = useState<ResumenEscuela[] | null>(null)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState<FiltrosEscuelas>(FILTROS_ESCUELAS_VACIOS)
  const [soloMias, setSoloMias] = useState(profile.rol === 'fed')
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const [abierta, setAbierta] = useState<ResumenEscuela | null>(null)
  const [vista, setVista] = useState<'lista' | 'tarjetas'>(() => (storage(() => localStorage.getItem(VISTA_KEY)) === 'tarjetas' ? 'tarjetas' : 'lista'))
  const [orden, setOrden] = useState<{ col: ColumnaEscuelas, asc: boolean }>({ col: 'nombre', asc: true })
  const [exportando, setExportando] = useState(false)
  const [errorExcel, setErrorExcel] = useState('')
  const veTodos = esAdmin || profile.rol === 'coordinacion'
  const cargar = useCallback(() => { getMisEscuelas().then(setLista).catch(e => setError(errMsg(e))) }, [])
  useEffect(() => { cargar() }, [cargar])
  const set = <K extends keyof FiltrosEscuelas>(k: K, v: FiltrosEscuelas[K]) => { setFiltros(f => ({ ...f, [k]: v })); setVisibles(POR_PAGINA) }
  const elegirVista = (v: 'lista' | 'tarjetas') => { setVista(v); storage(() => localStorage.setItem(VISTA_KEY, v)) }
  const ordenarPor = (col: ColumnaEscuelas) => { setOrden(o => ({ col, asc: o.col === col ? !o.asc : true })); setVisibles(POR_PAGINA) }
  const distritos = useMemo(() => unicos((lista ?? []).map(e => e.distrito)), [lista])
  const niveles = useMemo(() => unicos((lista ?? []).map(e => e.nivel)), [lista])
  const filtradas = useMemo(() => ordenarEscuelas(filtrarEscuelas(lista ?? [], { ...filtros, fed: veTodos && soloMias ? profile.nombre_completo : filtros.fed }), orden.col, orden.asc), [lista, filtros, veTodos, soloMias, profile.nombre_completo, orden])
  const base = useMemo(() => filtrarEscuelas(lista ?? [], { ...FILTROS_ESCUELAS_VACIOS, fed: veTodos && soloMias ? profile.nombre_completo : '' }), [lista, veTodos, soloMias, profile.nombre_completo])
  const resumen = resumenEscuelas(base)
  const titulo = profile.rol === 'fed' && !veTodos ? 'Mis escuelas' : 'Escuelas'
  const hayFiltros = !!(filtros.distrito || filtros.nivel || filtros.fed || filtros.conCronograma || filtros.conReclamo)
  const exportar = async () => { setExportando(true); setErrorExcel(''); try { const { exportarEscuelas } = await import('@/lib/exportar'); await exportarEscuelas(filtradas) } catch (e) { setErrorExcel(errMsg(e)) } finally { setExportando(false) } }

  return <main className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-32 pt-6 lg:px-10">
    {volver && <BotonVolver onClick={volver.ir} destino={volver.destino} />}
    <p className={eyebrow}>Territorio</p>
    <h2 className="text-2xl font-bold">{titulo}</h2>
    <p className="mt-1 text-sm text-dte-gris">{veTodos ? 'Las escuelas de la región con su FED a cargo.' : 'Las escuelas que tenés a cargo, con lo que pasa en cada una.'} Tocá una para ver la ficha completa.</p>

    {error ? <div className="mt-4"><ErrorBox message={error} onRetry={() => { setError(''); cargar() }} /></div>
      : !lista ? <div className="mt-4 flex flex-col gap-3"><Skeleton className="h-14" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      : <>
        <div className="relative mt-4">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-dte-gris-claro" aria-hidden />
          <Input value={filtros.busqueda} onChange={e => set('busqueda', e.target.value)} placeholder="Buscar por escuela, sigla, CUE, dirección o contacto…" aria-label="Buscar escuela" className="h-14 rounded-card border-2 border-dte-petroleo/30 bg-white pl-12 pr-12 text-base shadow-e1 md:text-base" />
          {filtros.busqueda && <button type="button" onClick={() => set('busqueda', '')} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-dte-gris transition hover:bg-dte-fondo"><X className="size-5" aria-hidden /></button>}
        </div>

        <div className="mt-2 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <select aria-label="Distrito" className={`${selectClass} md:w-40`} value={filtros.distrito} onChange={e => set('distrito', e.target.value)}><option value="">Todo distrito</option>{distritos.map(d => <option key={d} value={d}>{titleCase(d)}</option>)}</select>
          <select aria-label="Nivel" className={`${selectClass} md:w-44`} value={filtros.nivel} onChange={e => set('nivel', e.target.value)}><option value="">Todo nivel</option>{niveles.map(n => <option key={n} value={n}>{n}</option>)}</select>
          {veTodos && !soloMias && <select aria-label="FED a cargo" className={`${selectClass} md:w-44`} value={filtros.fed} onChange={e => set('fed', e.target.value)}><option value="">Todo el equipo</option>{feds.filter(f => f.rol === 'fed').map(f => <option key={f.id} value={f.nombre_completo}>{f.nombre_completo}</option>)}<option value={SIN_FED}>{SIN_FED}</option></select>}
          <div className="flex flex-wrap gap-x-4">
            <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-9"><input type="checkbox" checked={filtros.conCronograma} onChange={e => set('conCronograma', e.target.checked)} className="size-4" />Con cronograma</label>
            <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-9"><input type="checkbox" checked={filtros.conReclamo} onChange={e => set('conReclamo', e.target.checked)} className="size-4" />Con reclamo abierto</label>
            {veTodos && profile.rol === 'fed' && <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-9"><input type="checkbox" checked={soloMias} onChange={e => { setSoloMias(e.target.checked); setVisibles(POR_PAGINA) }} className="size-4" />Solo las mías</label>}
          </div>
          {hayFiltros && <Button type="button" variant="ghost" size="sm" onClick={() => setFiltros(f => ({ ...FILTROS_ESCUELAS_VACIOS, busqueda: f.busqueda }))} className="self-start text-dte-petroleo">Quitar filtros</Button>}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-dte-gris" aria-live="polite"><b className="text-dte-tinta tabular-nums">{filtradas.length}</b> de {resumen.total} {resumen.total === 1 ? 'escuela' : 'escuelas'} · {resumen.conCronograma} con cronograma · {resumen.conReclamo} con reclamo abierto</p>
          <div className="flex gap-1.5">
            {(['lista', 'tarjetas'] as const).map(v => <button key={v} type="button" aria-pressed={vista === v} onClick={() => elegirVista(v)} className={`min-h-9 rounded-full border px-3.5 text-sm font-semibold transition ${vista === v ? 'border-dte-petroleo bg-dte-petroleo text-white' : 'border-dte-linea bg-white hover:bg-dte-tinte'}`}>{v === 'lista' ? 'Lista' : 'Tarjetas'}</button>)}
            <Button type="button" variant="outline" size="sm" onClick={onMapa} className="min-h-9"><MapIcono data-icon="inline-start" />Ver en el mapa</Button>
            <Button type="button" variant="outline" size="sm" disabled={exportando || !filtradas.length} onClick={exportar} className="min-h-9">{exportando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <FileSpreadsheet data-icon="inline-start" />}Excel</Button>
          </div>
        </div>
        {errorExcel && <div className="mt-2"><ErrorBox message={errorExcel} /></div>}

        {filtradas.length ? <>
          {vista === 'tarjetas'
            ? <ul className="mt-3 grid gap-2 md:grid-cols-2">{filtradas.slice(0, visibles).map(e => <Tarjeta key={e.id} e={e} veTodos={veTodos} onAbrir={() => setAbierta(e)} />)}</ul>
            : <>
              <div className="mt-3 hidden overflow-x-auto rounded-card border border-dte-linea bg-white shadow-e1 md:block"><table className="w-full min-w-[820px] text-sm">
                <thead className="bg-dte-fondo"><tr>{COLUMNAS.map(([col, nombre]) => <th key={col} scope="col" aria-sort={orden.col === col ? (orden.asc ? 'ascending' : 'descending') : 'none'} className="px-3 py-2 text-left text-xs font-semibold text-dte-gris">
                  <button type="button" onClick={() => ordenarPor(col)} className="inline-flex min-h-8 items-center gap-1 hover:text-dte-tinta">{nombre}<span aria-hidden className="text-[0.625rem]">{orden.col === col ? (orden.asc ? '▲' : '▼') : ''}</span></button></th>)}
                  <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-dte-gris">Contacto</th></tr></thead>
                <tbody>{filtradas.slice(0, visibles).map(e => <FilaLista key={e.id} e={e} onAbrir={() => setAbierta(e)} />)}</tbody></table></div>
              <ul className="mt-3 flex flex-col gap-2 md:hidden">{filtradas.slice(0, visibles).map(e => <FilaCompacta key={e.id} e={e} onAbrir={() => setAbierta(e)} />)}</ul>
            </>}
          {filtradas.length > visibles && <Button type="button" variant="ghost" size="sm" onClick={() => setVisibles(v => v + POR_PAGINA)} className="mt-2 w-full text-dte-petroleo">Ver más ({filtradas.length - visibles})</Button>}
        </> : <div className="mt-3 flex flex-col items-center gap-2 rounded-card border border-dashed border-dte-linea px-4 py-10 text-center text-sm text-dte-gris"><SchoolIcon className="size-6" aria-hidden />{base.length ? 'No hay escuelas con esa búsqueda o esos filtros.' : 'Todavía no tenés escuelas a cargo en la base.'}</div>}
      </>}

    {abierta && <FichaCompleta key={abierta.id} onCambio={cargar} id={abierta.id} feds={feds} puedeAgendar={puedeAgendar} onClose={() => setAbierta(null)} onAgendar={onAgendar} onReclamo={onReclamo} onOpen={onOpen} />}
  </main>
}

// Contacto en pocas líneas: nombre y cargo, teléfono y correo para llamar o escribir, y cuántos más hay.
function ContactoCelda({ e }: { e: ResumenEscuela }) {
  const c = e.contacto
  if (!c) return <span className="text-dte-gris">Sin contacto cargado</span>
  const mail = c.correo_laboral || c.correo
  return <span className="flex flex-col gap-0.5">
    <span className="font-medium">{[nombreContacto(c), c.cargo].filter(Boolean).join(' · ') || 'Sin nombre'}{e.contactosExtra > 0 && <span className="ml-1.5 rounded-full bg-dte-fondo px-1.5 text-xs font-normal text-dte-gris">+{e.contactosExtra} más</span>}</span>
    {(c.telefono || mail) && <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
      {c.telefono && <a href={`tel:${c.telefono}`} onClick={ev => ev.stopPropagation()} className="inline-flex items-center gap-1 text-dte-petroleo underline underline-offset-2"><Phone className="size-3" aria-hidden />{c.telefono}</a>}
      {mail && <a href={`mailto:${mail}`} onClick={ev => ev.stopPropagation()} className="inline-flex items-center gap-1 break-all text-dte-petroleo underline underline-offset-2"><Mail className="size-3" aria-hidden />{mail}</a>}
    </span>}
  </span>
}

const nombreEscuela = (e: ResumenEscuela) => (e.nombre ? titleCase(e.nombre) : `CUE ${e.cue}`)

// Etiqueta de las escuelas que comparten edificio; el detalle (nombres y CUE) va en el título.
function PredioTag({ e }: { e: ResumenEscuela }) {
  if (!e.comparte.length) return null
  return <span title={`Predio ${e.predio}: ${e.comparte.map(nombreHermana).join(', ')}`} className="inline-flex items-center gap-1 rounded-full border border-club-lila/40 bg-club-violeta-fondo px-2 py-0.5 text-xs font-semibold text-club-violeta"><Building2 className="size-3" aria-hidden />Comparte predio con {e.comparte.length}</span>
}

function FilaLista({ e, onAbrir }: { e: ResumenEscuela, onAbrir: () => void }) {
  const nombre = nombreEscuela(e)
  return <tr onClick={onAbrir} className="cursor-pointer border-t border-dte-linea align-top transition hover:bg-dte-tinte">
    <td className="px-3 py-2"><button type="button" onClick={onAbrir} className="text-left"><b className="block">{e.nombre ? siglaNombre(nombre) : nombre}</b>{e.nombre && nombre !== siglaNombre(nombre) && <span className="block text-xs text-dte-gris">{nombre}</span>}</button>{e.comparte.length > 0 && <span className="mt-1 block"><PredioTag e={e} /></span>}</td>
    <td className="px-3 py-2 tabular-nums">{e.cue ?? '—'}</td>
    <td className="px-3 py-2">{e.direccion ? titleCase(e.direccion) : <span className="text-dte-gris">—</span>}</td>
    <td className="px-3 py-2">{e.ciudad ? titleCase(e.ciudad) : '—'}</td>
    <td className="px-3 py-2">{e.distrito ? titleCase(e.distrito) : '—'}</td>
    <td className="px-3 py-2 text-xs"><ContactoCelda e={e} /></td>
  </tr>
}

function FilaCompacta({ e, onAbrir }: { e: ResumenEscuela, onAbrir: () => void }) {
  const nombre = nombreEscuela(e)
  const lugar = [e.direccion ? titleCase(e.direccion) : null, e.ciudad ? titleCase(e.ciudad) : null, e.distrito && e.distrito !== e.ciudad ? titleCase(e.distrito) : null].filter(Boolean).join(' · ')
  return <li onClick={onAbrir} className="cursor-pointer rounded-card border border-dte-linea bg-white p-3 shadow-e1 transition hover:shadow-e2">
    <p className="break-words text-sm font-semibold">{e.nombre ? siglaNombre(nombre) : nombre}<span className="font-normal text-dte-gris"> · CUE {e.cue ?? '—'}</span></p>
    {lugar && <p className="mt-0.5 break-words text-xs text-dte-gris">{lugar}</p>}
    {e.comparte.length > 0 && <p className="mt-1"><PredioTag e={e} /></p>}
    <p className="mt-1.5 rounded-control bg-dte-fondo px-2 py-1.5 text-xs"><ContactoCelda e={e} /></p>
  </li>
}

function Tarjeta({ e, veTodos, onAbrir }: { e: ResumenEscuela, veTodos: boolean, onAbrir: () => void }) {
  const nombre = e.nombre ? titleCase(e.nombre) : `CUE ${e.cue}`
  const lugar = [e.ciudad && e.ciudad !== e.distrito ? titleCase(e.ciudad) : null, e.distrito ? titleCase(e.distrito) : null].filter(Boolean).join(', ')
  const c = e.proximoCronograma
  return <li><button type="button" onClick={onAbrir} className="flex h-full w-full items-start gap-3 rounded-card border border-dte-linea bg-white p-3.5 text-left shadow-e1 transition hover:shadow-e2">
    <span className="min-w-0 flex-1">
      <span className="block break-words text-sm font-semibold">{e.nombre ? siglaNombre(nombre) : nombre}<span className="font-normal text-dte-gris"> · CUE {e.cue ?? '—'}</span></span>
      <span className="mt-0.5 block break-words text-xs text-dte-gris">{[e.nombre && nombre !== siglaNombre(nombre) ? nombre : null, lugar].filter(Boolean).join(' · ')}</span>
      <span className="mt-2 flex flex-wrap gap-1.5">
        <PredioTag e={e} />
        {c && <span className="inline-flex items-center gap-1 rounded-full border border-dte-petroleo/30 bg-dte-tinte px-2 py-0.5 text-xs font-semibold text-dte-petroleo-oscuro"><CalendarClock className="size-3" aria-hidden />{etiquetaTipo(c.tipo)} {ventanaDe(c)}{e.cronogramas > 1 ? ` (+${e.cronogramas - 1})` : ''}</span>}
        {e.reclamosAbiertos > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-aviso-borde bg-aviso-fondo px-2 py-0.5 text-xs font-semibold text-aviso-fuerte"><Wifi className="size-3" aria-hidden />{e.reclamosAbiertos} {e.reclamosAbiertos === 1 ? 'reclamo abierto' : 'reclamos abiertos'}</span>}
        {e.proximaAccion && <span className="inline-flex items-center rounded-full border border-dte-linea px-2 py-0.5 text-xs font-semibold">Próxima acción {fechaCorta(e.proximaAccion)}</span>}
      </span>
      <span className="mt-1.5 block text-xs text-dte-gris">{[e.ultimaVisita ? `Última visita ${fechaCorta(e.ultimaVisita)}` : 'Sin visitas registradas', veTodos && (e.fed_a_cargo && e.fed_a_cargo !== SIN_FED ? `FED: ${e.fed_a_cargo}` : SIN_FED)].filter(Boolean).join(' · ')}</span>
    </span>
    <ChevronRight className="mt-1 size-4 shrink-0 text-dte-gris-claro" aria-hidden />
  </button></li>
}

// Ficha de la escuela (la misma del buscador) con conectividad, reclamos, cronogramas y contactos.
export function FichaCompleta({ volverA = 'al listado', id, feds, puedeAgendar, onClose, onAgendar, onReclamo, onOpen, onCambio }: { volverA?: string, onCambio: () => void, id: string, feds: Fed[], puedeAgendar: boolean, onClose: () => void, onAgendar: (s: School) => void, onReclamo: (s: School) => void, onOpen: (i: AgendaItem) => void }) {
  // La ficha puede pasar a otra escuela del mismo predio sin cerrar el cuadro.
  const [actual, setActual] = useState(id)
  const [ficha, setFicha] = useState<FichaEscuela | null>(null)
  const [extras, setExtras] = useState<Awaited<ReturnType<typeof getExtrasEscuela>> | null>(null)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    // Reclamos, cronogramas y contactos sólo llegan para quien puede editar la escuela (el FED a cargo, el CED y la administración).
    getFichaEscuela(actual).then(async f => { const x = f.puedeEditar ? await getExtrasEscuela(actual) : null; if (vigente) { setFicha(f); setExtras(x) } }).catch(err => { if (vigente) setError(errMsg(err)) })
    return () => { vigente = false }
  }, [actual, intento])
  return <Dialog open onOpenChange={o => !o && onClose()}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white max-sm:top-[calc(env(safe-area-inset-top,0px)+0.5rem)]! max-sm:bottom-auto! max-sm:max-h-[calc(100dvh-1rem)]! max-sm:rounded-b-2xl! max-sm:pb-4! sm:max-w-xl">
      <DialogTitle className="flex items-center gap-2"><SchoolIcon className="size-5 text-dte-petroleo" aria-hidden />Ficha de la escuela</DialogTitle>
      <DialogDescription className="sr-only">Datos, historial, conectividad, reclamos, cronogramas y contactos de la escuela.</DialogDescription>
      <Button type="button" variant="ghost" size="sm" onClick={onClose} className="-mt-1 self-start"><ArrowLeft data-icon="inline-start" />Volver {volverA}</Button>
      {error ? <ErrorBox message={error} onRetry={() => { setError(''); setIntento(n => n + 1) }} />
        : !ficha ? <div className="flex flex-col gap-3"><Skeleton className="h-12" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
        : <div className="flex flex-col gap-5">
          <Ficha ficha={ficha} feds={feds} puedeAgendar={puedeAgendar} onAgendar={s => { onClose(); onAgendar(s) }} onReclamo={s => { onClose(); onReclamo(s) }} onOpen={i => { onClose(); onOpen(i) }} onEditado={() => { onCambio(); setIntento(n => n + 1) }} onEscuela={nid => { setFicha(null); setExtras(null); setActual(nid) }} />
          {extras && <Extras x={extras} feds={feds} />}
        </div>}
    </DialogContent>
  </Dialog>
}

function Bloque({ titulo, icono: Icono, familia, children }: { titulo: string, icono: typeof Wifi, familia: keyof typeof FAMILIAS, children: React.ReactNode }) {
  const f = FAMILIAS[familia]
  return <section><h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><span className={`flex size-6 items-center justify-center rounded-md ${f.fondo} ${f.texto}`}><Icono className="size-3.5" aria-hidden /></span>{titulo}</h3>{children}</section>
}

function Extras({ x, feds }: { x: Awaited<ReturnType<typeof getExtrasEscuela>>, feds: Fed[] }) {
  const nombreFed = (id: string | null) => feds.find(f => f.id === id)?.nombre_completo ?? 'Ex integrante'
  return <>
    <Bloque titulo={`Reclamos (${x.reclamos.length})`} icono={TriangleAlert} familia="amarillo">
      {x.reclamos.length ? <ul className="divide-y divide-dte-linea overflow-hidden rounded-tile border border-dte-linea">{x.reclamos.map(r => <li key={r.id} className="flex flex-col gap-1 px-3 py-2.5">
        <span className="flex flex-wrap items-center gap-1.5"><span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${ESTADO_RECLAMO_CLASE[r.estado]}`}>{ESTADO_RECLAMO_LABEL[r.estado]}</span><span className="text-xs text-dte-gris">{fechaCorta(r.enviado_at.slice(0, 10))} · {nombreFed(r.fed_id)}</span></span>
        <span className="break-words text-sm">{r.tipo_label}{r.nro_incidencia && <span className="text-dte-gris"> · N° {r.nro_incidencia}</span>}</span>
      </li>)}</ul> : <p className="rounded-tile border border-dashed border-dte-linea px-3 py-3 text-center text-sm text-dte-gris">Sin reclamos registrados.</p>}
    </Bloque>
    <Bloque titulo={`Cronogramas (${x.cronogramas.length})`} icono={CalendarClock} familia="violeta">
      {x.cronogramas.length ? <ul className="divide-y divide-dte-linea overflow-hidden rounded-tile border border-dte-linea">{x.cronogramas.map(cr => { const est = estadoDe(cr); return <li key={cr.id} className="flex flex-col gap-0.5 px-3 py-2.5">
        <span className="text-sm font-semibold">{ventanaDe(cr)} · {etiquetaTipo(cr.tipo)}</span>
        <span className="text-xs text-dte-gris">{[cr.proveedor, cr.nro && `N° ${cr.nro}`, est ? ESTADO_SEGUIMIENTO_LABEL[est] : 'Sin marcar'].filter(Boolean).join(' · ')}</span>
      </li> })}</ul> : <p className="rounded-tile border border-dashed border-dte-linea px-3 py-3 text-center text-sm text-dte-gris">Sin cronogramas en los últimos días.</p>}
    </Bloque>
  </>
}
