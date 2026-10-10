'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Check, CheckCircle2, ChevronDown, Copy, ExternalLink, FileSpreadsheet, GraduationCap, Loader2, TriangleAlert, Undo2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type Fed } from '@/lib/agenda'
import { FORMULARIO_NC } from '@/lib/jornadas-campos'
import { camposDeJornada, estaPendiente, fechaJornada, filtrarJornadas, FILTROS_JORNADAS, textoDeJornada, type EstadoCarga, type FiltrosJornadas, type Jornada } from '@/lib/jornadas'
import { hoyAR } from '@/lib/hora'
import { SelectorFecha } from '@/components/app/selectorfecha'
import { BotonVolver, ErrorBox, Skeleton, eyebrow, errMsg, getJornadas, marcarJornada, selectClass, Toast } from '@/components/app/comun'

const TIPOS: [FiltrosJornadas['tipo'], string][] = [['', 'Todo tipo'], ['CLUB DE TECNOLOGÍA', 'Clubes de Tecnología'], ['PRÁCTICAS PROFESIONALIZANTES', 'PEAT'], ['TALLER/CAPACITACIÓN', 'Talleres y capacitaciones']]
const ETIQUETA_TIPO: Record<Jornada['tipo'], string> = { 'CLUB DE TECNOLOGÍA': 'Club de Tecnología', 'PRÁCTICAS PROFESIONALIZANTES': 'PEAT', 'TALLER/CAPACITACIÓN': 'Taller / capacitación' }

const ESTADOS: [EstadoCarga, string][] = [['pendientes', 'Pendientes'], ['cargadas', 'Cargadas'], ['todas', 'Todas']]
const diaAR = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit' })

// Jornadas pedagógicas para completar el formulario "Registro de Acciones Pedagógicas" de Nivel Central: una fila por encuentro, con los datos en el orden del formulario y
// listos para copiar, y la marca de los que ya se cargaron (compartida, para no cargar dos veces). Cada FED ve los que creó él; la coordinación y la administración, todos.
export function JornadasReporte({ feds, volver, veTodos }: { feds: Fed[], volver?: { destino: string, ir: () => void }, veTodos: boolean }) {
  const [lista, setLista] = useState<Jornada[] | null>(null)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState<FiltrosJornadas>(() => ({ ...FILTROS_JORNADAS, desde: `${hoyAR().slice(0, 8)}01`, hasta: hoyAR() }))
  const [abierta, setAbierta] = useState<string | null>(null)
  const [copiado, setCopiado] = useState('')
  const [exportando, setExportando] = useState(false)
  const [marcando, setMarcando] = useState('')
  // Al marcar o desmarcar, la fila que dejaría de verse en este filtro se queda un momento con la confirmación y recién después sale con una transición;
  // y un aviso permite deshacer. Así se entiende adónde fue y no parece que desapareció sola.
  const [retenidas, setRetenidas] = useState<Record<string, 'queda' | 'sale'>>({})
  const [aviso, setAviso] = useState<{ j: Jornada, cargada: boolean } | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const cerrarAviso = useCallback(() => setAviso(null), [])
  const cargar = useCallback(() => getJornadas().then(setLista).catch(e => setError(errMsg(e))), [])
  useEffect(() => { cargar() }, [cargar])
  const set = <K extends keyof FiltrosJornadas>(k: K, v: FiltrosJornadas[K]) => setFiltros(f => ({ ...f, [k]: v }))
  const filtradas = useMemo(() => filtrarJornadas(lista ?? [], filtros), [lista, filtros])
  const visibles = useMemo(() => {
    const claves = new Set(filtradas.map(j => j.clave))
    const retenidasFuera = (lista ?? []).filter(j => retenidas[j.clave] && !claves.has(j.clave))
    return retenidasFuera.length ? [...filtradas, ...retenidasFuera].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.lugar.localeCompare(b.lugar) || a.clave.localeCompare(b.clave)) : filtradas
  }, [filtradas, lista, retenidas])
  const pendientes = useMemo(() => filtrarJornadas(lista ?? [], { ...filtros, estado: 'pendientes' }).length, [lista, filtros])
  const distritos = useMemo(() => [...new Set((lista ?? []).map(j => j.distrito).filter(Boolean))].sort(), [lista])
  const fedsConJornadas = useMemo(() => feds.filter(f => (lista ?? []).some(j => j.fedId === f.id)), [feds, lista])
  const copiar = async (texto: string, clave: string) => { try { await navigator.clipboard.writeText(texto); setCopiado(clave); setTimeout(() => setCopiado(c => (c === clave ? '' : c)), 2000) } catch { setError('No se pudo copiar: seleccioná el texto y copialo a mano.') } }
  async function marcar(j: Jornada, cargada: boolean) {
    setMarcando(j.clave); setError('')
    try {
      await marcarJornada(j.encuentroId, cargada)
      setRetenidas(r => ({ ...r, [j.clave]: 'queda' })); setAbierta(a => (a === j.clave ? null : a))
      await cargar()
      setAviso({ j, cargada })
      timers.current.push(setTimeout(() => setRetenidas(r => (r[j.clave] ? { ...r, [j.clave]: 'sale' } : r)), 1400))
      timers.current.push(setTimeout(() => setRetenidas(r => { const { [j.clave]: _fuera, ...resto } = r; return resto }), 1750))
    } catch (e) { setError(errMsg(e)) } finally { setMarcando('') }
  }
  async function excel() {
    setExportando(true); setError('')
    try { const { exportarJornadas } = await import('@/lib/exportar'); await exportarJornadas(filtradas) } catch (e) { setError(errMsg(e)) } finally { setExportando(false) }
  }

  return <main className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-32 pt-6 lg:px-10">
    {volver && <BotonVolver onClick={volver.ir} destino={volver.destino} />}
    <p className={eyebrow}>Acciones pedagógicas</p>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold">{veTodos ? 'Reporte de jornadas' : 'Mis jornadas'}</h2>
      <span className="flex flex-wrap items-center gap-2"><a href={FORMULARIO_NC} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-dte-petroleo px-3 text-sm font-semibold text-white hover:opacity-90"><ExternalLink className="size-4" aria-hidden />Abrir el formulario</a>
      {lista && <Button type="button" variant="outline" size="sm" disabled={exportando || !filtradas.length} onClick={excel}>{exportando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <FileSpreadsheet data-icon="inline-start" />}Excel ({filtradas.length})</Button>}</span>
    </div>
    <p className="mt-1 text-sm text-dte-gris">Una fila por encuentro, con los datos en el orden del formulario de Nivel Central (Registro de Acciones Pedagógicas), para copiar y pegar. {veTodos ? 'Ves los de todo el equipo.' : 'Ves los que creaste vos: si te acompañó alguien, lo carga quien lo creó.'} Solo clubes, PEAT y talleres o capacitaciones con participantes. Marcá cada uno cuando lo cargues, así no se repite.</p>

    {error && !lista ? <div className="mt-4"><ErrorBox message={error} onRetry={() => { setError(''); cargar() }} /></div>
      : !lista ? <div className="mt-4 flex flex-col gap-3"><Skeleton className="h-16" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      : <>
        <div className="mt-4 flex flex-col gap-2 rounded-card border border-dte-linea bg-white p-3 shadow-e1 md:flex-row md:flex-wrap md:items-center">
          <div role="group" aria-label="Estado de carga" className="flex gap-1 rounded-control border border-dte-linea bg-dte-fondo p-0.5">{ESTADOS.map(([v, l]) => <button key={v} type="button" aria-pressed={filtros.estado === v} onClick={() => set('estado', v)} className={`min-h-10 flex-1 rounded-control px-3 text-sm font-semibold md:min-h-8 ${filtros.estado === v ? 'bg-dte-petroleo text-white' : 'text-dte-gris hover:bg-white'}`}>{l}</button>)}</div>
          <div role="group" aria-label="Período" className="flex flex-col gap-1 rounded-control border border-dte-linea bg-dte-fondo px-2.5 py-1.5 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center justify-between gap-2 text-sm font-semibold text-dte-gris">Desde<SelectorFecha ariaLabel="Dictadas desde" value={filtros.desde} max={filtros.hasta || undefined} onChange={v => set('desde', v)} className="w-40" /></div>
            <div className="flex items-center justify-between gap-2 text-sm font-semibold text-dte-gris">Hasta<SelectorFecha ariaLabel="Dictadas hasta" value={filtros.hasta} min={filtros.desde || undefined} onChange={v => set('hasta', v)} className="w-40" /></div>
          </div>
          {veTodos && <select aria-label="FED" className={`${selectClass} md:w-48`} value={filtros.fedId} onChange={e => set('fedId', e.target.value)}><option value="">Todo el equipo</option>{fedsConJornadas.map(f => <option key={f.id} value={f.id}>{f.nombre_completo}</option>)}</select>}
          <select aria-label="Distrito" className={`${selectClass} md:w-40`} value={filtros.distrito} onChange={e => set('distrito', e.target.value)}><option value="">Todo distrito</option>{distritos.map(d => <option key={d} value={d}>{d}</option>)}</select>
          <select aria-label="Tipo" className={`${selectClass} md:w-56`} value={filtros.tipo} onChange={e => set('tipo', e.target.value as FiltrosJornadas['tipo'])}>{TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <p className="mt-3 text-xs text-dte-gris" aria-live="polite"><b>{pendientes}</b> {pendientes === 1 ? 'pendiente de cargar' : 'pendientes de cargar'} en este período · {filtradas.length} {filtradas.length === 1 ? 'encuentro' : 'encuentros'} a la vista, del más antiguo al más nuevo.</p>
        {error && <div className="mt-2"><ErrorBox message={error} /></div>}

        {visibles.length ? <ul className="mt-3 flex flex-col">{visibles.map(j => {
          const abre = abierta === j.clave, ocupada = marcando === j.clave, ret = retenidas[j.clave], fuera = !filtradas.some(f => f.clave === j.clave)
          const sale = fuera && ret === 'sale'
          return <li key={j.clave} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${sale ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]'}`}><div className={`min-h-0 ${sale ? 'overflow-hidden' : ''}`}><div className="pb-2"><div className={`rounded-card border bg-white p-3.5 shadow-e1 transition-colors duration-300 ${ret ? 'border-exito/60 bg-exito-fondo/40' : 'border-dte-linea'}`}>
            <button type="button" aria-expanded={abre} onClick={() => setAbierta(abre ? null : j.clave)} className="flex w-full items-start justify-between gap-2 text-left">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold"><span className="inline-flex items-center gap-1 rounded-full bg-dte-tinte px-2 py-0.5 text-dte-petroleo"><GraduationCap className="size-3" aria-hidden />{ETIQUETA_TIPO[j.tipo]}{j.grupo ? ` · ${j.grupo}` : ''}{j.nro ? ` · encuentro ${j.nro}` : ''}</span>
                  {j.cargada && !j.cargada.modificada && <span className="inline-flex items-center gap-1 rounded-full bg-exito-fondo px-2 py-0.5 text-exito"><CheckCircle2 className="size-3" aria-hidden />Cargada · {j.cargada.por} · {diaAR(j.cargada.cuando)}</span>}
                  {j.cargada?.modificada && <span className="inline-flex items-center gap-1 rounded-full bg-aviso-fondo px-2 py-0.5 text-aviso-fuerte"><TriangleAlert className="size-3" aria-hidden />Modificada después de cargarla</span>}</span>
                <span className="mt-1 block break-words text-sm font-semibold">{j.propuesta} · {j.lugar}</span>
                <span className="mt-0.5 block text-xs text-dte-gris">{[j.aCargo.join(', '), j.distrito, fechaJornada(j.fecha)].filter(Boolean).join(' · ')}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-dte-gris"><Users className="size-3" aria-hidden />{j.participantes} participantes{j.inscriptos != null ? ` de ${j.inscriptos} inscriptos` : ''}{j.foto && <><Camera className="ml-2 size-3" aria-hidden />{j.foto.n} {j.foto.n === 1 ? 'foto' : 'fotos'}</>}</span>
              </span>
              <ChevronDown className={`mt-1 size-5 shrink-0 text-dte-gris transition ${abre ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {abre && <div className="mt-3 flex flex-col gap-3 border-t border-dte-linea pt-3">
              {j.cargada?.modificada && <p role="status" className="rounded-control bg-aviso-fondo px-3 py-2 text-sm text-aviso-fuerte">Este encuentro se modificó después de marcarlo como cargado ({j.cargada.por}, {diaAR(j.cargada.cuando)}). Revisá si hay que corregirlo en el formulario y volvé a marcarlo.</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={() => copiar(textoDeJornada(j), `t${j.clave}`)}>{copiado === `t${j.clave}` ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado === `t${j.clave}` ? 'Copiado' : 'Copiar todos los datos'}</Button>
                <a href={FORMULARIO_NC} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-input bg-white px-2.5 text-sm font-medium hover:bg-dte-tinte"><ExternalLink className="size-4" aria-hidden />Abrir el formulario</a>
                {estaPendiente(j) && <Button type="button" size="sm" variant="outline" disabled={ocupada} onClick={() => marcar(j, true)}>{ocupada ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <CheckCircle2 data-icon="inline-start" />}{j.cargada ? 'Ya la actualicé en el formulario' : 'Ya la cargué'}</Button>}
                {j.cargada && <Button type="button" size="sm" variant="ghost" disabled={ocupada} onClick={() => marcar(j, false)}><Undo2 data-icon="inline-start" />Deshacer marca</Button>}
              </div>
              <dl className="flex flex-col divide-y divide-dte-linea rounded-tile border border-dte-linea">{camposDeJornada(j).map(c => <div key={c.clave} className="flex items-start justify-between gap-2 px-3 py-2">
                <div className="min-w-0"><dt className="text-xs font-semibold text-dte-gris">{c.etiqueta}</dt><dd className="break-words text-sm font-medium">{c.valor || <span className="font-normal text-dte-gris">—</span>}</dd></div>
                {c.valor && <Button type="button" variant="ghost" size="sm" aria-label={`Copiar: ${c.etiqueta}`} onClick={() => copiar(c.valor, `${j.clave}${c.clave}`)}>{copiado === `${j.clave}${c.clave}` ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado === `${j.clave}${c.clave}` ? 'Copiado' : 'Copiar'}</Button>}
              </div>)}</dl>
              <div><h4 className="text-xs font-bold uppercase tracking-wider text-dte-gris">Fotos</h4>
                {j.foto ? <a href={j.foto.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-9 items-center gap-1 rounded-full border border-dte-petroleo/30 bg-white px-3 text-xs font-semibold text-dte-petroleo hover:bg-dte-tinte">{j.foto.n} {j.foto.n === 1 ? 'foto' : 'fotos'} del {fechaJornada(j.foto.fecha).slice(0, 5)}{j.foto.de ? ` · de ${j.foto.de}` : ''}<ExternalLink className="size-3" aria-hidden /></a>
                  : <p className="mt-1 text-sm text-dte-gris">Todavía no hay fotos ordenadas de este encuentro.</p>}
                {j.foto?.de && <p role="status" className="mt-1 rounded-control bg-aviso-fondo px-3 py-2 text-xs text-aviso-fuerte">Estas fotos están en el Drive de {j.foto.de}, no en el tuyo: si el enlace pide acceso, pedile que te comparta la carpeta.</p>}
                <p className="mt-1 text-xs text-dte-gris">Abre la carpeta de Drive de la acción (o la del día si las fotos no se asignaron a una acción).</p></div>
            </div>}
          </div></div></div></li>
        })}</ul> : <div className="mt-2 flex flex-col items-center gap-2 rounded-card border border-dashed border-dte-linea px-4 py-10 text-center text-sm text-dte-gris"><GraduationCap className="size-6" aria-hidden />{filtros.estado === 'pendientes' ? 'No tenés encuentros pendientes de cargar en este período.' : 'No hay encuentros con esos filtros.'} Podés ampliar el período.</div>}
      </>}
    {aviso && <Toast message={`${aviso.cargada ? 'Marcada como cargada' : 'Marca quitada'}: ${aviso.j.propuesta}, ${fechaJornada(aviso.j.fecha).slice(0, 5)}`} onDone={cerrarAviso} acciones={[{ label: 'Deshacer', onClick: () => marcar(aviso.j, !aviso.cargada) }]} />}
  </main>
}
