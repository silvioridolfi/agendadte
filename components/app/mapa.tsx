'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, MapPinOff, Navigation, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type AgendaItem, type Fed, type School } from '@/lib/agenda'
import { esDelFed } from '@/lib/cronogramas'
import { FILTROS_MAPA_VACIOS, SIN_FED_MAPA, filtrarPuntos, sinTildes, type FiltrosMapa, type PuntoMapa, type PuntosMapa } from '@/lib/mapa'
import { titleCase } from '@/lib/format'
import { gruposPorPredio, hermanasDe } from '@/lib/predio'
import { BotonVolver, ErrorBox, Skeleton, errMsg, eyebrow, getPuntosMapa, nombreHermana, selectClass } from '@/components/app/comun'
import { FichaCompleta } from '@/components/app/misescuelas'
import { FichaJefatura } from '@/components/app/jefatura'
import { MapaBase } from '@/components/app/mapabase'

const nombreDe = (p: { nombre: string }) => titleCase(p.nombre.replace(/^JEFATURA (DISTRITAL|REGIONAL) \| /i, 'Jefatura $1 · ').replace(/\|/g, '·'))

// Mapa de la región con todas las escuelas y las jefaturas. El FED entra viendo las suyas; con los filtros se ve el resto.
export function SeccionMapa({ profile, feds, esAdmin, puedeAgendar, onAgendar, onReclamo, onOpen, volver }: { volver?: { destino: string, ir: () => void }, profile: Fed, feds: Fed[], esAdmin: boolean, puedeAgendar: boolean, onAgendar: (s: School) => void, onReclamo: (s: School) => void, onOpen: (i: AgendaItem) => void }) {
  const soloFed = profile.rol === 'fed' && !esAdmin
  const [datos, setDatos] = useState<PuntosMapa | null>(null)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState<FiltrosMapa>({ ...FILTROS_MAPA_VACIOS, fed: soloFed ? profile.nombre_completo : '' })
  const [elegido, setElegido] = useState<PuntoMapa | null>(null)
  const [ficha, setFicha] = useState<{ tipo: 'escuela' | 'jefatura', id: string } | null>(null)
  const [verSin, setVerSin] = useState(false)
  const cargar = useCallback(() => { getPuntosMapa().then(setDatos).catch(e => setError(errMsg(e))) }, [])
  useEffect(() => { cargar() }, [cargar])
  const set = <K extends keyof FiltrosMapa>(k: K, v: FiltrosMapa[K]) => { setFiltros(f => ({ ...f, [k]: v })); setElegido(null) }
  const distritos = useMemo(() => [...new Set((datos?.puntos ?? []).filter(p => p.tipo === 'escuela').map(p => p.distrito).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b, 'es')), [datos])
  const visibles = useMemo(() => filtrarPuntos(datos?.puntos ?? [], filtros, esDelFed), [datos, filtros])
  const propios = useMemo(() => new Set((datos?.puntos ?? []).filter(p => p.tipo === 'escuela' && esDelFed(p.fed, profile.nombre_completo)).map(p => p.id)), [datos, profile.nombre_completo])
  // Las escuelas sin ubicación, con los mismos filtros de distrito, FED y búsqueda.
  const sinUbicacion = useMemo(() => {
    const palabras = sinTildes(filtros.q).split(/\s+/).filter(Boolean)
    return (datos?.sinUbicacion ?? []).filter(e => {
      if (!filtros.escuelas) return false
      if (filtros.distrito && e.distrito !== filtros.distrito) return false
      if (filtros.fed === SIN_FED_MAPA ? !!e.fed : filtros.fed && !esDelFed(e.fed, filtros.fed)) return false
      const texto = sinTildes(`${e.nombre} ${e.cue ?? ''}`)
      return palabras.every(w => texto.includes(w))
    })
  }, [datos, filtros])
  // Escuelas que comparten edificio con la elegida (con o sin ubicación en el mapa).
  const grupos = useMemo(() => gruposPorPredio([...(datos?.puntos ?? []).filter(p => p.tipo === 'escuela'), ...(datos?.sinUbicacion ?? [])].map(p => ({ id: p.id, cue: p.cue, nombre: p.nombre, predio: p.predio }))), [datos])
  const hermanas = elegido?.tipo === 'escuela' ? hermanasDe(grupos, elegido.id, elegido.predio) : []
  const nEsc = visibles.filter(p => p.tipo === 'escuela').length, nJef = visibles.length - nEsc
  const firma = JSON.stringify([filtros.distrito, filtros.fed, filtros.escuelas, filtros.jefaturas, filtros.q])
  const hayFiltros = !!(filtros.distrito || filtros.q || filtros.fed !== (soloFed ? profile.nombre_completo : '') || !filtros.escuelas || !filtros.jefaturas)

  return <main className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-32 pt-6 lg:px-10">
    {volver && <BotonVolver onClick={volver.ir} destino={volver.destino} />}
    <p className={eyebrow}>Territorio</p>
    <h2 className="text-2xl font-bold">Mapa de la región</h2>
    <p className="mt-1 text-sm text-dte-gris">Las escuelas y las jefaturas de Región 1. Tocá un punto para ver sus datos; los números son lugares agrupados: tocalos para acercar.</p>

    {error ? <div className="mt-4"><ErrorBox message={error} onRetry={() => { setError(''); cargar() }} /></div>
      : !datos ? <div className="mt-4 flex flex-col gap-3"><Skeleton className="h-14" /><Skeleton className="h-[50dvh]" /></div>
      : <>
        <div className="relative mt-4">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-dte-gris-claro" aria-hidden />
          <Input value={filtros.q} onChange={e => set('q', e.target.value)} placeholder="Buscar una escuela por nombre, sigla, CUE o dirección…" aria-label="Buscar en el mapa" className="h-12 rounded-card border-2 border-dte-petroleo/30 bg-white pl-12 pr-12 text-base" />
          {filtros.q && <button type="button" onClick={() => set('q', '')} aria-label="Borrar búsqueda" className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-dte-gris hover:bg-dte-fondo"><X className="size-5" aria-hidden /></button>}
        </div>
        <div className="mt-2 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <select aria-label="Distrito" className={`${selectClass} md:w-40`} value={filtros.distrito} onChange={e => set('distrito', e.target.value)}><option value="">Todo distrito</option>{distritos.map(d => <option key={d} value={d}>{titleCase(d)}</option>)}</select>
          <select aria-label="FED a cargo" className={`${selectClass} md:w-56`} value={filtros.fed} onChange={e => set('fed', e.target.value)}>
            <option value="">Todas las escuelas</option>
            {profile.rol === 'fed' && <option value={profile.nombre_completo}>{soloFed ? 'Mis escuelas' : 'Las mías'}</option>}
            {feds.filter(f => f.rol === 'fed' && f.id !== profile.id).map(f => <option key={f.id} value={f.nombre_completo}>{f.nombre_completo}</option>)}
            <option value={SIN_FED_MAPA}>Sin FED asignado</option>
          </select>
          <div className="flex flex-wrap gap-x-4">
            <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-9"><input type="checkbox" checked={filtros.escuelas} onChange={e => set('escuelas', e.target.checked)} className="size-4" />Escuelas</label>
            <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-9"><input type="checkbox" checked={filtros.jefaturas} onChange={e => set('jefaturas', e.target.checked)} className="size-4" />Jefaturas</label>
          </div>
          {hayFiltros && <Button type="button" variant="ghost" size="sm" onClick={() => { setFiltros({ ...FILTROS_MAPA_VACIOS, fed: soloFed ? profile.nombre_completo : '' }); setElegido(null) }}>Quitar filtros</Button>}
        </div>
        <p className="mt-2 text-sm text-dte-gris" role="status">{nEsc} {nEsc === 1 ? 'escuela' : 'escuelas'}{filtros.jefaturas && ` · ${nJef} ${nJef === 1 ? 'jefatura' : 'jefaturas'}`}{sinUbicacion.length > 0 && ` · ${sinUbicacion.length} sin ubicación en el mapa`}</p>

        <div className="mt-2">
          <MapaBase key={firma} puntos={visibles} propios={propios} seleccionId={elegido?.id} onSelect={setElegido} etiqueta="Mapa de la región con las escuelas y las jefaturas" />
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dte-gris">
            {profile.rol === 'fed' && <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-dte-magenta" aria-hidden />Mis escuelas</span>}
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-dte-petroleo" aria-hidden />{profile.rol === 'fed' ? 'Otras escuelas' : 'Escuelas'}</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rotate-45 rounded-sm bg-dte-violeta" aria-hidden />Jefaturas</span>
          </p>
        </div>

        {elegido && <section aria-label="Lugar elegido" className="mt-3 rounded-card border border-dte-linea bg-white p-3.5 shadow-sm">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words font-bold leading-snug">{nombreDe(elegido)}</p>
            <p className="mt-0.5 text-sm text-dte-gris">{[elegido.cue ? `CUE ${elegido.cue}` : null, elegido.distrito && titleCase(elegido.distrito), elegido.nivel].filter(Boolean).join(' · ')}</p></div>
            <button type="button" onClick={() => setElegido(null)} aria-label="Cerrar" className="-mr-1 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full text-dte-gris hover:bg-dte-fondo"><X className="size-5" aria-hidden /></button></div>
          {elegido.direccion && <p className="mt-1 break-words text-sm">{titleCase(elegido.direccion)}</p>}
          {elegido.tipo === 'escuela' && <p className="mt-0.5 text-sm text-dte-gris">FED a cargo: {elegido.fed ?? 'sin asignar'}</p>}
          {elegido.crono && <p className="mt-0.5 break-words text-sm font-medium text-pba-celeste-texto">Cronograma próximo: {elegido.crono}</p>}
          {hermanas.length > 0 && <div className="mt-1.5 text-sm"><p className="text-dte-gris">{hermanas.length === 1 ? 'Comparte el predio' : 'Comparten el predio'} {elegido.predio} con:</p>
            <ul className="flex flex-col">{hermanas.map(h => <li key={h.id}><button type="button" onClick={() => setFicha({ tipo: 'escuela', id: h.id })} className="min-h-9 text-left font-semibold text-dte-petroleo underline underline-offset-2">{nombreHermana(h)}</button></li>)}</ul></div>}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={() => setFicha({ tipo: elegido.tipo, id: elegido.id })} className="w-full bg-dte-petroleo hover:bg-dte-petroleo-oscuro sm:w-auto">Ver ficha</Button>
            <Button type="button" variant="outline" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${elegido.lat},${elegido.lon}`, '_blank', 'noopener,noreferrer')} className="w-full sm:w-auto"><Navigation data-icon="inline-start" />Cómo llegar</Button>
          </div>
        </section>}

        {sinUbicacion.length > 0 && <section className="mt-5">
          <button type="button" onClick={() => setVerSin(v => !v)} aria-expanded={verSin} className="flex min-h-11 w-full items-center gap-2 rounded-tile border border-dte-linea bg-white px-3 text-left text-sm font-semibold">
            <MapPinOff className="size-4 text-dte-gris" aria-hidden />Sin ubicación en el mapa ({sinUbicacion.length})<ChevronDown className={`ml-auto size-4 transition-transform ${verSin ? 'rotate-180' : ''}`} aria-hidden /></button>
          {verSin && <>
            <p className="mt-2 text-sm text-dte-gris">Estas escuelas todavía no tienen ubicación. Abrí la ficha y, desde <strong>Editar datos</strong>, cargá la latitud y la longitud (el FED a cargo, el CED y la administración pueden).</p>
            <ul className="mt-2 divide-y divide-dte-linea overflow-hidden rounded-tile border border-dte-linea bg-white">{sinUbicacion.map(e => <li key={e.id}>
              <button type="button" onClick={() => setFicha({ tipo: 'escuela', id: e.id })} className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-dte-tinte">
                <span className="break-words text-sm font-semibold">{titleCase(e.nombre)}</span>
                <span className="text-xs text-dte-gris">{[e.cue ? `CUE ${e.cue}` : null, e.distrito && titleCase(e.distrito), e.fed ?? 'Sin FED asignado'].filter(Boolean).join(' · ')}</span>
              </button></li>)}</ul>
          </>}
        </section>}
      </>}

    {ficha?.tipo === 'escuela' && <FichaCompleta key={ficha.id} volverA="al mapa" id={ficha.id} feds={feds} puedeAgendar={puedeAgendar} onClose={() => setFicha(null)} onAgendar={onAgendar} onReclamo={onReclamo} onOpen={onOpen} onCambio={cargar} />}
    {ficha?.tipo === 'jefatura' && <FichaJefatura key={ficha.id} id={ficha.id} onClose={() => { setFicha(null); cargar() }} />}
  </main>
}
