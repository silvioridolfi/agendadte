'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, ChevronDown, Copy, Eye, Loader2, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type Fed } from '@/lib/agenda'
import { FILTROS_VACIOS, SIN_FED, esDelFed, etiquetaTipo, filtrarCronogramas, resumenCronogramas, ventanaDe, type Cronograma, type FiltrosCronogramas, type PestanaCronogramas } from '@/lib/cronogramas'
import { hoyAR } from '@/lib/hora'
import { siglaNombre } from '@/lib/siglas'
import { titleCase } from '@/lib/format'
import { ErrorBox, Skeleton, eyebrow, errMsg, getCronogramas, selectClass, sincronizarCronogramasAhora } from '@/components/app/comun'

const ZONA = 'America/Argentina/Buenos_Aires'
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const PESTANAS: [PestanaCronogramas, string][] = [['proximos', 'Próximos'], ['pasados', 'Pasados'], ['todos', 'Todos']]
const esEnlace = (t: string) => /^https?:\/\//i.test(t.trim())
const unicos = (l: (string | null | undefined)[]) => [...new Set(l.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'es'))

// Cronogramas de Nivel Central (mantenimiento y reparación de pisos, instalaciones…) tal como figuran en la planilla del consolidado. Sólo lectura.
export function Cronogramas({ profile, feds, esAdmin }: { profile: Fed, feds: Fed[], esAdmin: boolean }) {
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof getCronogramas>> | null>(null)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState<FiltrosCronogramas>(FILTROS_VACIOS)
  const [soloMios, setSoloMios] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const hoy = hoyAR()
  const cargar = useCallback(() => { getCronogramas().then(setDatos).catch(e => setError(errMsg(e))) }, [])
  useEffect(() => { cargar() }, [cargar])
  const lista = datos?.lista
  const propios = useMemo(() => (lista ?? []).filter(c => !soloMios || esDelFed(c.school?.fed_a_cargo, profile.nombre_completo)), [lista, soloMios, profile.nombre_completo])
  const visibles = useMemo(() => filtrarCronogramas(propios, filtros, hoy), [propios, filtros, hoy])
  const resumen = resumenCronogramas(propios, hoy)
  const set = <K extends keyof FiltrosCronogramas>(k: K, v: FiltrosCronogramas[K]) => setFiltros(f => ({ ...f, [k]: v }))
  const distritos = useMemo(() => unicos((lista ?? []).map(c => c.school?.distrito)), [lista])
  const tipos = useMemo(() => unicos((lista ?? []).map(c => c.tipo)), [lista])
  const proveedores = useMemo(() => unicos((lista ?? []).map(c => c.proveedor)), [lista])
  async function sincronizar() {
    setSincronizando(true); setMensaje(''); setError('')
    try {
      const r = await sincronizarCronogramasAhora()
      setMensaje(`Listo: ${r.filas} cronogramas leídos (${r.nuevas} nuevos, ${r.cambiadas} con cambios, ${r.quitadas} que ya no están en la planilla${r.sinEscuela ? `, ${r.sinEscuela} con un CUE que no está en la agenda` : ''}).`)
      cargar()
    } catch (e) { setError(errMsg(e)) } finally { setSincronizando(false) }
  }
  const ultima = datos?.ultima
  const textoUltima = ultima?.fin ? `Última lectura de la planilla: ${fechaHora(ultima.fin)}${ultima.resultado && 'error' in ultima.resultado ? ' (con error)' : ''}.` : 'Todavía no se leyó la planilla.'

  return <main className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-32 pt-6 lg:px-10">
    <p className={eyebrow}>Conectividad</p>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold">Cronogramas</h2>
      {esAdmin && <Button type="button" variant="outline" size="sm" disabled={sincronizando} onClick={sincronizar}>{sincronizando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}Sincronizar ahora</Button>}
    </div>
    <p className="mt-1 text-sm text-dte-gris">Las visitas de Nivel Central a las escuelas (mantenimiento, instalaciones, reparaciones), tomadas de la pestaña Cronogramas del consolidado de conectividad.</p>
    <p className="mt-3 flex items-center gap-1.5 rounded-control bg-dte-fondo px-3 py-2 text-xs font-semibold text-dte-gris"><Eye className="size-3.5 shrink-0" aria-hidden />Modo lectura: se actualiza sola cada madrugada. El estado que figura es el de la planilla.</p>
    <p className="mt-2 text-xs text-dte-gris">{textoUltima}</p>
    {mensaje && <p className="mt-2 rounded-control bg-exito/10 px-3 py-2 text-sm font-semibold text-exito" role="status">{mensaje}</p>}

    {error ? <div className="mt-4"><ErrorBox message={error} onRetry={() => { setError(''); cargar() }} /></div>
      : !lista ? <div className="mt-4 flex flex-col gap-3"><Skeleton className="h-16" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      : <>
        <div role="tablist" aria-label="Período" className="mt-4 flex gap-1.5">{PESTANAS.map(([id, nombre]) => {
          const n = id === 'proximos' ? resumen.proximos : id === 'pasados' ? resumen.pasados : propios.length
          return <button key={id} role="tab" type="button" aria-selected={filtros.pestana === id} onClick={() => set('pestana', id)} className={`min-h-11 rounded-full border px-3.5 text-sm font-semibold transition md:min-h-9 ${filtros.pestana === id ? 'border-dte-petroleo bg-dte-petroleo text-white' : 'border-dte-linea bg-white hover:bg-dte-tinte'}`}>{nombre} <span className="tabular-nums opacity-80">{n}</span></button>
        })}</div>

        <div className="mt-3 flex flex-col gap-2 rounded-card border border-dte-linea bg-white p-3 shadow-e1 md:flex-row md:flex-wrap md:items-center">
          <div className="relative min-w-0 flex-1 md:min-w-56"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dte-gris-claro" aria-hidden /><Input value={filtros.busqueda} onChange={e => set('busqueda', e.target.value)} placeholder="Buscar CUE, escuela, número o proveedor…" aria-label="Buscar" className="h-11 bg-dte-fondo pl-9 md:h-9" /></div>
          <select aria-label="Distrito" className={`${selectClass} md:w-40`} value={filtros.distrito} onChange={e => set('distrito', e.target.value)}><option value="">Todo distrito</option>{distritos.map(d => <option key={d} value={d}>{titleCase(d)}</option>)}</select>
          <select aria-label="FED a cargo" className={`${selectClass} md:w-44`} value={filtros.fed} onChange={e => set('fed', e.target.value)}><option value="">Todo el equipo</option>{feds.filter(f => f.rol === 'fed').map(f => <option key={f.id} value={f.nombre_completo}>{f.nombre_completo}</option>)}<option value={SIN_FED}>{SIN_FED}</option></select>
          <select aria-label="Tipo" className={`${selectClass} md:w-52`} value={filtros.tipo} onChange={e => set('tipo', e.target.value)}><option value="">Todo tipo</option>{tipos.map(t => <option key={t} value={t}>{etiquetaTipo(t)}</option>)}</select>
          <select aria-label="Proveedor" className={`${selectClass} md:w-40`} value={filtros.proveedor} onChange={e => set('proveedor', e.target.value)}><option value="">Todo proveedor</option>{proveedores.map(p => <option key={p} value={p}>{p}</option>)}</select>
          {esAdmin && <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-0"><input type="checkbox" checked={soloMios} onChange={e => setSoloMios(e.target.checked)} className="size-4" />Solo los míos</label>}
        </div>

        {filtros.pestana !== 'pasados' && (resumen.sinFed > 0 || resumen.sinEscuela > 0) && <p className="mt-3 text-xs text-dte-gris">Próximos sin FED asignado: <b className="tabular-nums">{resumen.sinFed}</b>{resumen.sinEscuela > 0 && <> · con un CUE que no está en la agenda: <b className="tabular-nums">{resumen.sinEscuela}</b></>}</p>}
        <p className="mt-3 text-xs text-dte-gris" aria-live="polite">{visibles.length} {visibles.length === 1 ? 'cronograma' : 'cronogramas'}</p>
        {visibles.length ? <ul className="mt-2 flex flex-col gap-2">{visibles.map(c => <Tarjeta key={c.id} c={c} hoy={hoy} abierta={abierto === c.id} onAbrir={() => setAbierto(a => (a === c.id ? null : c.id))} />)}</ul>
          : <div className="mt-2 flex flex-col items-center gap-2 rounded-card border border-dashed border-dte-linea px-4 py-10 text-center text-sm text-dte-gris"><CalendarClock className="size-6" aria-hidden />{propios.length ? 'No hay cronogramas con esos filtros.' : 'Todavía no hay cronogramas cargados.'}</div>}
      </>}
  </main>
}

function Tarjeta({ c, hoy, abierta, onAbrir }: { c: Cronograma, hoy: string, abierta: boolean, onAbrir: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const nombre = c.school?.nombre ? titleCase(c.school.nombre) : c.nombre_planilla ? titleCase(c.nombre_planilla) : `CUE ${c.cue}`
  const fed = c.school?.fed_a_cargo
  const enCurso = c.fecha_inicio <= hoy && c.fecha_fin >= hoy
  const instaladores = c.instaladores?.split('\n') ?? []
  const copiar = async () => { try { await navigator.clipboard.writeText(c.instaladores ?? ''); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { setCopiado(false) } }
  return <li className="rounded-card border border-dte-linea bg-white shadow-e1">
    <button type="button" onClick={onAbrir} aria-expanded={abierta} className="flex w-full items-start gap-3 p-3.5 text-left">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-dte-petroleo/30 bg-dte-tinte px-2 py-0.5 text-xs font-semibold tabular-nums text-dte-petroleo-oscuro">{ventanaDe(c)}</span>
          {enCurso && <span className="inline-flex items-center rounded-full border border-exito/30 bg-exito/10 px-2 py-0.5 text-xs font-semibold text-exito">En curso</span>}
          <span className="inline-flex items-center rounded-full border border-dte-linea px-2 py-0.5 text-xs font-semibold">{etiquetaTipo(c.tipo)}</span>
          {c.estado_planilla && <span className="inline-flex items-center rounded-full border border-dte-linea bg-dte-fondo px-2 py-0.5 text-xs text-dte-gris">Planilla: {c.estado_planilla}</span>}
        </span>
        <span className="mt-1.5 block break-words text-sm font-semibold">{c.school?.nombre ? siglaNombre(nombre) : nombre}<span className="font-normal text-dte-gris"> · CUE {c.cue}{c.school?.distrito && ` · ${titleCase(c.school.distrito)}`}</span></span>
        <span className="mt-0.5 block text-xs text-dte-gris">{[c.proveedor, c.nro && `N° ${c.nro}`, fed ? `FED: ${fed}` : c.school ? SIN_FED : 'CUE sin cargar en la agenda'].filter(Boolean).join(' · ')}</span>
      </span>
      <ChevronDown className={`mt-1 size-4 shrink-0 text-dte-gris transition ${abierta ? 'rotate-180' : ''}`} aria-hidden />
    </button>
    {abierta && <div className="flex flex-col gap-2 border-t border-dte-linea px-3.5 pb-3.5 pt-3 text-sm">
      <p className="break-words font-semibold">{nombre}</p>
      {instaladores.length > 0 && <div className="rounded-control bg-dte-fondo px-3 py-2">
        <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-dte-gris">Instaladores</span><Button type="button" variant="outline" size="sm" onClick={copiar}>{copiado ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado ? 'Copiado' : 'Copiar'}</Button></div>
        <ul className="mt-1 flex flex-col gap-0.5">{instaladores.map((l, i) => <li key={i} className="break-words">{esEnlace(l) ? <a href={l.trim()} target="_blank" rel="noopener noreferrer" className="font-semibold text-dte-petroleo underline">{l.trim()}</a> : l}</li>)}</ul>
      </div>}
      {c.descripcion && <p><span className="text-xs font-semibold text-dte-gris">Descripción: </span><span className="break-words">{c.descripcion}</span></p>}
      {c.observaciones && <p><span className="text-xs font-semibold text-dte-gris">Observaciones de territorio: </span><span className="break-words">{c.observaciones}</span></p>}
      <p className="text-xs text-dte-gris">{[c.semana && `Informado: ${c.semana}`, `Visto por primera vez el ${fechaHora(c.primera_vez_at)}`, `Última actualización ${fechaHora(c.actualizado_at)}`].filter(Boolean).join(' · ')}</p>
    </div>}
  </li>
}
