'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, Check, ChevronDown, Copy, ExternalLink, FileSpreadsheet, GraduationCap, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type Fed } from '@/lib/agenda'
import { camposDeJornada, fechaJornada, filtrarJornadas, FILTROS_JORNADAS, textoDeJornada, type FiltrosJornadas, type Jornada } from '@/lib/jornadas'
import { hoyAR } from '@/lib/hora'
import { SelectorFecha } from '@/components/app/selectorfecha'
import { BotonVolver, ErrorBox, Skeleton, eyebrow, errMsg, getJornadas, selectClass } from '@/components/app/comun'

const TIPOS: [FiltrosJornadas['tipo'], string][] = [['', 'Todo tipo'], ['CLUB DE TECNOLOGÍA', 'Clubes de Tecnología'], ['PRÁCTICAS PROFESIONALIZANTES', 'PEAT'], ['TALLER/CAPACITACIÓN', 'Talleres y capacitaciones']]
const ETIQUETA_TIPO: Record<Jornada['tipo'], string> = { 'CLUB DE TECNOLOGÍA': 'Club de Tecnología', 'PRÁCTICAS PROFESIONALIZANTES': 'PEAT', 'TALLER/CAPACITACIÓN': 'Taller / capacitación' }

// Reporte de jornadas pedagógicas para completar el formulario "Registro de Acciones Pedagógicas" de Nivel Central: los datos de cada propuesta dictada,
// en el orden del formulario y listos para copiar. Sólo la coordinación y la administración.
export function JornadasReporte({ feds, volver }: { feds: Fed[], volver?: { destino: string, ir: () => void } }) {
  const [lista, setLista] = useState<Jornada[] | null>(null)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState<FiltrosJornadas>(() => ({ ...FILTROS_JORNADAS, desde: `${hoyAR().slice(0, 8)}01`, hasta: hoyAR() }))
  const [abierta, setAbierta] = useState<string | null>(null)
  const [copiado, setCopiado] = useState('')
  const [exportando, setExportando] = useState(false)
  const cargar = useCallback(() => { getJornadas().then(setLista).catch(e => setError(errMsg(e))) }, [])
  useEffect(() => { cargar() }, [cargar])
  const set = <K extends keyof FiltrosJornadas>(k: K, v: FiltrosJornadas[K]) => setFiltros(f => ({ ...f, [k]: v }))
  const visibles = useMemo(() => filtrarJornadas(lista ?? [], filtros), [lista, filtros])
  const distritos = useMemo(() => [...new Set((lista ?? []).map(j => j.distrito).filter(Boolean))].sort(), [lista])
  const fedsConJornadas = useMemo(() => feds.filter(f => (lista ?? []).some(j => j.fedId === f.id)), [feds, lista])
  const copiar = async (texto: string, clave: string) => { try { await navigator.clipboard.writeText(texto); setCopiado(clave); setTimeout(() => setCopiado(c => (c === clave ? '' : c)), 2000) } catch { setError('No se pudo copiar: seleccioná el texto y copialo a mano.') } }
  async function excel() {
    setExportando(true); setError('')
    try { const { exportarJornadas } = await import('@/lib/exportar'); await exportarJornadas(visibles) } catch (e) { setError(errMsg(e)) } finally { setExportando(false) }
  }

  return <main className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-32 pt-6 lg:px-10">
    {volver && <BotonVolver onClick={volver.ir} destino={volver.destino} />}
    <p className={eyebrow}>Acciones pedagógicas</p>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold">Reporte de jornadas</h2>
      {lista && <Button type="button" variant="outline" size="sm" disabled={exportando || !visibles.length} onClick={excel}>{exportando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <FileSpreadsheet data-icon="inline-start" />}Excel ({visibles.length})</Button>}
    </div>
    <p className="mt-1 text-sm text-dte-gris">Los datos de cada propuesta dictada, en el orden del formulario de Nivel Central (Registro de Acciones Pedagógicas), para copiar y pegar. Solo clubes, PEAT y talleres o capacitaciones con participantes: las visitas sin participantes (charlas con EMATP o directivos) no cuentan.</p>

    {error && !lista ? <div className="mt-4"><ErrorBox message={error} onRetry={() => { setError(''); cargar() }} /></div>
      : !lista ? <div className="mt-4 flex flex-col gap-3"><Skeleton className="h-16" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      : <>
        <div className="mt-4 flex flex-col gap-2 rounded-card border border-dte-linea bg-white p-3 shadow-e1 md:flex-row md:flex-wrap md:items-center">
          <div role="group" aria-label="Período de finalización" className="flex flex-col gap-1 rounded-control border border-dte-linea bg-dte-fondo px-2.5 py-1.5 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center justify-between gap-2 text-sm font-semibold text-dte-gris">Desde<SelectorFecha ariaLabel="Finalizadas desde" value={filtros.desde} max={filtros.hasta || undefined} onChange={v => set('desde', v)} className="w-40" /></div>
            <div className="flex items-center justify-between gap-2 text-sm font-semibold text-dte-gris">Hasta<SelectorFecha ariaLabel="Finalizadas hasta" value={filtros.hasta} min={filtros.desde || undefined} onChange={v => set('hasta', v)} className="w-40" /></div>
          </div>
          <select aria-label="FED" className={`${selectClass} md:w-48`} value={filtros.fedId} onChange={e => set('fedId', e.target.value)}><option value="">Todo el equipo</option>{fedsConJornadas.map(f => <option key={f.id} value={f.id}>{f.nombre_completo}</option>)}</select>
          <select aria-label="Distrito" className={`${selectClass} md:w-40`} value={filtros.distrito} onChange={e => set('distrito', e.target.value)}><option value="">Todo distrito</option>{distritos.map(d => <option key={d} value={d}>{d}</option>)}</select>
          <select aria-label="Tipo" className={`${selectClass} md:w-56`} value={filtros.tipo} onChange={e => set('tipo', e.target.value as FiltrosJornadas['tipo'])}>{TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-0"><input type="checkbox" checked={filtros.enCurso} onChange={e => set('enCurso', e.target.checked)} className="size-4" />Incluir los que siguen en curso</label>
        </div>
        <p className="mt-3 text-xs text-dte-gris" aria-live="polite">{visibles.length} {visibles.length === 1 ? 'propuesta dictada' : 'propuestas dictadas'}, por fecha de finalización. {!filtros.enCurso && 'Los clubes y PEAT se cuentan al cerrarse.'}</p>
        {error && <div className="mt-2"><ErrorBox message={error} /></div>}

        {visibles.length ? <ul className="mt-3 flex flex-col gap-2">{visibles.map(j => {
          const abre = abierta === j.clave
          return <li key={j.clave} className="rounded-card border border-dte-linea bg-white p-3.5 shadow-e1">
            <button type="button" aria-expanded={abre} onClick={() => setAbierta(abre ? null : j.clave)} className="flex w-full items-start justify-between gap-2 text-left">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold"><span className="inline-flex items-center gap-1 rounded-full bg-dte-tinte px-2 py-0.5 text-dte-petroleo"><GraduationCap className="size-3" aria-hidden />{ETIQUETA_TIPO[j.tipo]}{j.grupo ? ` · ${j.grupo}` : ''}</span>{!j.finalizada && <span className="rounded-full bg-aviso-fondo px-2 py-0.5 text-aviso-fuerte">En curso</span>}</span>
                <span className="mt-1 block break-words text-sm font-semibold">{j.propuesta} · {j.lugar}</span>
                <span className="mt-0.5 block text-xs text-dte-gris">{[j.fed, j.distrito, `${j.finalizada ? 'finalizó' : 'último encuentro'} el ${fechaJornada(j.fechaFin)}`, `${j.encuentros} ${j.encuentros === 1 ? 'encuentro' : 'encuentros'}`].filter(Boolean).join(' · ')}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-dte-gris"><Users className="size-3" aria-hidden />{j.participantes} participantes{j.inscriptos != null ? ` de ${j.inscriptos} inscriptos` : ''}{j.fotos.length > 0 && <><Camera className="ml-2 size-3" aria-hidden />fotos de {j.fotos.length} {j.fotos.length === 1 ? 'fecha' : 'fechas'}</>}</span>
              </span>
              <ChevronDown className={`mt-1 size-5 shrink-0 text-dte-gris transition ${abre ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {abre && <div className="mt-3 flex flex-col gap-3 border-t border-dte-linea pt-3">
              <Button type="button" size="sm" className="self-start" onClick={() => copiar(textoDeJornada(j), `t${j.clave}`)}>{copiado === `t${j.clave}` ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado === `t${j.clave}` ? 'Copiado' : 'Copiar todos los datos'}</Button>
              <dl className="flex flex-col divide-y divide-dte-linea rounded-tile border border-dte-linea">{camposDeJornada(j).map(c => <div key={c.clave} className="flex items-start justify-between gap-2 px-3 py-2">
                <div className="min-w-0"><dt className="text-xs font-semibold text-dte-gris">{c.etiqueta}</dt><dd className="break-words text-sm font-medium">{c.valor || <span className="font-normal text-dte-gris">—</span>}</dd></div>
                {c.valor && <Button type="button" variant="ghost" size="sm" aria-label={`Copiar: ${c.etiqueta}`} onClick={() => copiar(c.valor, `${j.clave}${c.clave}`)}>{copiado === `${j.clave}${c.clave}` ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado === `${j.clave}${c.clave}` ? 'Copiado' : 'Copiar'}</Button>}
              </div>)}</dl>
              <div><h4 className="text-xs font-bold uppercase tracking-wider text-dte-gris">Fotos</h4>
                {j.fotos.length ? <ul className="mt-1 flex flex-wrap gap-1.5">{j.fotos.map(f => <li key={`${f.fecha}${f.url}`}><a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dte-petroleo/30 bg-white px-3 text-xs font-semibold text-dte-petroleo hover:bg-dte-tinte">{fechaJornada(f.fecha).slice(0, 5)} · {f.n} {f.n === 1 ? 'foto' : 'fotos'}<ExternalLink className="size-3" aria-hidden /></a></li>)}</ul>
                  : <p className="mt-1 text-sm text-dte-gris">Todavía no hay fotos ordenadas de esta propuesta.</p>}
                <p className="mt-1 text-xs text-dte-gris">Cada enlace abre la carpeta de Drive de esa fecha (la de la acción, o la del día si las fotos no se asignaron a una acción).</p></div>
            </div>}
          </li>
        })}</ul> : <div className="mt-2 flex flex-col items-center gap-2 rounded-card border border-dashed border-dte-linea px-4 py-10 text-center text-sm text-dte-gris"><GraduationCap className="size-6" aria-hidden />No hay propuestas dictadas con esos filtros.{!filtros.enCurso && ' Probá incluir las que siguen en curso.'}</div>}
      </>}
  </main>
}
