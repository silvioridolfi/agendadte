'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, ChevronDown, Copy, Eye, Loader2, Mail, Phone, RefreshCw, Search, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { type Fed } from '@/lib/agenda'
import { ESTADOS_SEGUIMIENTO, ESTADO_SEGUIMIENTO_LABEL, FILTROS_VACIOS, avisoDe, mensajeEscuela, puedeAvisarJefatura, MAX_NOTA, PIDE_MOTIVO, SIN_FED, esDelFed, estadoDe, etiquetaTipo, filtrarCronogramas, puedeMarcar, resumenCronogramas, ventanaDe, type AvisoCronograma, type Cronograma, type EstadoSeguimiento, type FiltrosCronogramas, type PestanaCronogramas } from '@/lib/cronogramas'
import { hoyAR } from '@/lib/hora'
import { gmailAppUrl, gmailUrl, plataformaDe } from '@/lib/reclamos'
import type { ContactoEscuela } from '@/lib/mis-escuelas'
import { siglaNombre } from '@/lib/siglas'
import { titleCase } from '@/lib/format'
import { ErrorBox, Skeleton, eyebrow, errMsg, avisarCronograma, getContactosCronograma, getCronogramas, marcarCronograma, selectClass, sincronizarCronogramasAhora } from '@/components/app/comun'

const ZONA = 'America/Argentina/Buenos_Aires'
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const PESTANAS: [PestanaCronogramas, string][] = [['proximos', 'Próximos'], ['pasados', 'Pasados'], ['todos', 'Todos']]
const esEnlace = (t: string) => /^https?:\/\//i.test(t.trim())
const ESTADO_CLASE: Record<EstadoSeguimiento, string> = { realizado: 'border-exito/30 bg-exito/10 text-exito', no_realizado: 'border-peligro/30 bg-peligro-fondo text-peligro', reprogramado: 'border-aviso-borde bg-aviso-fondo text-aviso-fuerte' }
const unicos = (l: (string | null | undefined)[]) => [...new Set(l.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'es'))

// Cronogramas de Nivel Central (mantenimiento y reparación de pisos, instalaciones…) tal como figuran en la planilla del consolidado.
// Los datos de la planilla no se modifican; el equipo anota acá cómo salió cada uno (realizado, no se realizó, reprogramado).
export function Cronogramas({ profile, feds, esAdmin, cuenta }: { profile: Fed, feds: Fed[], esAdmin: boolean, cuenta: string }) {
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof getCronogramas>> | null>(null)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState<FiltrosCronogramas>(FILTROS_VACIOS)
  const [soloMios, setSoloMios] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const hoy = hoyAR()
  const veTodos = esAdmin || profile.rol === 'coordinacion'
  const quien = { esAdmin, rol: profile.rol, nombre: profile.nombre_completo }
  const avisaJefatura = puedeAvisarJefatura(quien)
  const cargar = useCallback(() => { getCronogramas().then(setDatos).catch(e => setError(errMsg(e))) }, [])
  useEffect(() => { cargar() }, [cargar])
  const lista = datos?.lista
  const propios = useMemo(() => (lista ?? []).filter(c => !soloMios || esDelFed(c.school?.fed_a_cargo, profile.nombre_completo)), [lista, soloMios, profile.nombre_completo])
  const visibles = useMemo(() => filtrarCronogramas(propios, filtros, hoy), [propios, filtros, hoy])
  const resumen = resumenCronogramas(propios, hoy)
  const nombreFed = (id: string | null) => feds.find(f => f.id === id)?.nombre_completo ?? 'Ex integrante'
  const anotado = (id: string, h: Cronograma['historial'][number]) => setDatos(d => d && ({ ...d, lista: d.lista.map(c => (c.id === id ? { ...c, historial: [h, ...c.historial] } : c)) }))
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
    <p className="mt-3 flex items-center gap-1.5 rounded-control bg-dte-fondo px-3 py-2 text-xs font-semibold text-dte-gris"><Eye className="size-3.5 shrink-0" aria-hidden />Los datos vienen de la planilla de Nivel Central y se actualizan solos cada madrugada. El estado que anotás acá es el que cuenta; el de la planilla es sólo de referencia.</p>
    {veTodos && <p className="mt-2 text-xs text-dte-gris">{textoUltima}</p>}
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
          {veTodos && <select aria-label="FED a cargo" className={`${selectClass} md:w-44`} value={filtros.fed} onChange={e => set('fed', e.target.value)}><option value="">Todo el equipo</option>{feds.filter(f => f.rol === 'fed').map(f => <option key={f.id} value={f.nombre_completo}>{f.nombre_completo}</option>)}<option value={SIN_FED}>{SIN_FED}</option></select>}
          <select aria-label="Estado" className={`${selectClass} md:w-40`} value={filtros.estado} onChange={e => set('estado', e.target.value as FiltrosCronogramas['estado'])}><option value="">Todo estado</option><option value="sin_marcar">Sin marcar</option>{ESTADOS_SEGUIMIENTO.map(e => <option key={e} value={e}>{ESTADO_SEGUIMIENTO_LABEL[e]}</option>)}</select>
          <select aria-label="Avisos" className={`${selectClass} md:w-48`} value={filtros.aviso} onChange={e => set('aviso', e.target.value as FiltrosCronogramas['aviso'])}><option value="">Todo aviso</option><option value="sin_escuela">Escuela sin avisar</option>{avisaJefatura && <option value="sin_jefatura">Jefatura sin avisar</option>}</select>
          <select aria-label="Tipo" className={`${selectClass} md:w-52`} value={filtros.tipo} onChange={e => set('tipo', e.target.value)}><option value="">Todo tipo</option>{tipos.map(t => <option key={t} value={t}>{etiquetaTipo(t)}</option>)}</select>
          <select aria-label="Proveedor" className={`${selectClass} md:w-40`} value={filtros.proveedor} onChange={e => set('proveedor', e.target.value)}><option value="">Todo proveedor</option>{proveedores.map(p => <option key={p} value={p}>{p}</option>)}</select>
          {veTodos && <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-0"><input type="checkbox" checked={soloMios} onChange={e => setSoloMios(e.target.checked)} className="size-4" />Solo los míos</label>}
        </div>

        {(resumen.sinCerrar > 0 || resumen.sinAvisarEscuela > 0 || (veTodos && resumen.sinFed > 0)) && <p className="mt-3 text-xs text-dte-gris">{[resumen.sinAvisarEscuela > 0 && <span key="a">Próximos con la escuela sin avisar: <b className="tabular-nums">{resumen.sinAvisarEscuela}</b></span>, resumen.sinCerrar > 0 && <span key="c">Pasados sin marcar: <b className="tabular-nums">{resumen.sinCerrar}</b></span>, veTodos && resumen.sinFed > 0 && <span key="f">Próximos sin FED asignado: <b className="tabular-nums">{resumen.sinFed}</b></span>].filter(Boolean).flatMap((x, i) => (i ? [' · ', x] : [x]))}</p>}
        <p className="mt-3 text-xs text-dte-gris" aria-live="polite">{visibles.length} {visibles.length === 1 ? 'cronograma' : 'cronogramas'}</p>
        {visibles.length ? <ul className="mt-2 flex flex-col gap-2">{visibles.map(c => <Tarjeta key={c.id} c={c} hoy={hoy} abierta={abierto === c.id} onAbrir={() => setAbierto(a => (a === c.id ? null : c.id))} puedeMarcar={puedeMarcar(quien, c)} avisaJefatura={avisaJefatura} nombre={profile.nombre_completo} cuenta={cuenta} nombreFed={nombreFed} onAnotado={h => anotado(c.id, h)} />)}</ul>
          : <div className="mt-2 flex flex-col items-center gap-2 rounded-card border border-dashed border-dte-linea px-4 py-10 text-center text-sm text-dte-gris"><CalendarClock className="size-6" aria-hidden />{propios.length ? 'No hay cronogramas con esos filtros.' : 'Todavía no hay cronogramas cargados.'}</div>}
      </>}
  </main>
}

function Tarjeta({ c, hoy, abierta, onAbrir, puedeMarcar, avisaJefatura, nombre: miNombre, cuenta, nombreFed, onAnotado }: { c: Cronograma, hoy: string, abierta: boolean, onAbrir: () => void, puedeMarcar: boolean, avisaJefatura: boolean, nombre: string, cuenta: string, nombreFed: (id: string | null) => string, onAnotado: (h: Cronograma['historial'][number]) => void }) {
  const [copiado, setCopiado] = useState(false)
  const nombre = c.school?.nombre ? titleCase(c.school.nombre) : c.nombre_planilla ? titleCase(c.nombre_planilla) : `CUE ${c.cue}`
  const fed = c.school?.fed_a_cargo
  const enCurso = c.fecha_inicio <= hoy && c.fecha_fin >= hoy
  const estado = estadoDe(c)
  const instaladores = c.instaladores?.split('\n') ?? []
  const copiar = async () => { try { await navigator.clipboard.writeText(c.instaladores ?? ''); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { setCopiado(false) } }
  return <li className="rounded-card border border-dte-linea bg-white shadow-e1">
    <button type="button" onClick={onAbrir} aria-expanded={abierta} className="flex w-full items-start gap-3 p-3.5 text-left">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-dte-petroleo/30 bg-dte-tinte px-2 py-0.5 text-xs font-semibold tabular-nums text-dte-petroleo-oscuro">{ventanaDe(c)}</span>
          {enCurso && <span className="inline-flex items-center rounded-full border border-exito/30 bg-exito/10 px-2 py-0.5 text-xs font-semibold text-exito">En curso</span>}
          <span className="inline-flex items-center rounded-full border border-dte-linea px-2 py-0.5 text-xs font-semibold">{etiquetaTipo(c.tipo)}</span>
          {estado && <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${ESTADO_CLASE[estado]}`}>{ESTADO_SEGUIMIENTO_LABEL[estado]}</span>}
          {avisoDe(c, 'jefatura_avisada') && <span className="inline-flex items-center gap-1 rounded-full border border-dte-linea bg-dte-fondo px-2 py-0.5 text-xs font-semibold text-dte-gris"><Check className="size-3" aria-hidden />Jefatura avisada</span>}
          {avisoDe(c, 'escuela_avisada') && <span className="inline-flex items-center gap-1 rounded-full border border-dte-linea bg-dte-fondo px-2 py-0.5 text-xs font-semibold text-dte-gris"><Check className="size-3" aria-hidden />Escuela avisada</span>}
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
      <Avisos c={c} puedeMarcar={puedeMarcar} avisaJefatura={avisaJefatura} nombre={miNombre} cuenta={cuenta} nombreFed={nombreFed} onAnotado={onAnotado} />
      <Seguimiento c={c} puedeMarcar={puedeMarcar} nombreFed={nombreFed} onAnotado={onAnotado} />
      {c.descripcion && <p><span className="text-xs font-semibold text-dte-gris">Descripción: </span><span className="break-words">{c.descripcion}</span></p>}
      {c.observaciones && <p><span className="text-xs font-semibold text-dte-gris">Observaciones de territorio: </span><span className="break-words">{c.observaciones}</span></p>}
      <p className="text-xs text-dte-gris">{[c.semana && `Informado: ${c.semana}`, `Visto por primera vez el ${fechaHora(c.primera_vez_at)}`, `Última actualización ${fechaHora(c.actualizado_at)}`].filter(Boolean).join(' · ')}</p>
    </div>}
  </li>
}

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit' })

// Estado anotado en la agenda: botones para marcarlo (el FED a cargo, el CED y la administración) e historial.
function Seguimiento({ c, puedeMarcar, nombreFed, onAnotado }: { c: Cronograma, puedeMarcar: boolean, nombreFed: (id: string | null) => string, onAnotado: (h: Cronograma['historial'][number]) => void }) {
  const [eligiendo, setEligiendo] = useState<EstadoSeguimiento | null>(null)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const pideMotivo = !!eligiendo && PIDE_MOTIVO.includes(eligiendo)
  const resultados = c.historial.filter(h => (ESTADOS_SEGUIMIENTO as readonly string[]).includes(h.estado))
  async function guardar() {
    if (!eligiendo) return
    setGuardando(true); setError('')
    try { onAnotado(await marcarCronograma(c.id, eligiendo, nota)); setEligiendo(null); setNota('') }
    catch (e) { setError(errMsg(e)) } finally { setGuardando(false) }
  }
  return <div className="rounded-control border border-dte-linea px-3 py-2">
    <p className="text-xs font-semibold text-dte-gris">Cómo salió</p>
    {puedeMarcar && !eligiendo && <div className="mt-1.5 flex flex-wrap gap-1.5">{ESTADOS_SEGUIMIENTO.map(e => <Button key={e} type="button" variant="outline" size="sm" onClick={() => { setEligiendo(e); setError('') }}>{ESTADO_SEGUIMIENTO_LABEL[e]}</Button>)}</div>}
    {eligiendo && <div className="mt-1.5 flex flex-col gap-2">
      <p className="text-sm font-semibold">{ESTADO_SEGUIMIENTO_LABEL[eligiendo]}</p>
      <Textarea value={nota} onChange={e => setNota(e.target.value)} maxLength={MAX_NOTA} placeholder={pideMotivo ? 'Motivo (obligatorio)' : 'Nota (opcional)'} aria-label="Motivo o nota" className="min-h-16" />
      {error && <ErrorBox message={error} />}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" size="sm" onClick={() => { setEligiendo(null); setError('') }}>Cancelar</Button><Button type="button" size="sm" onClick={guardar} disabled={guardando || (pideMotivo && !nota.trim())}>{guardando && <Loader2 className="animate-spin" data-icon="inline-start" />}Guardar</Button></div>
    </div>}
    {resultados.length ? <ul className="mt-2 flex flex-col gap-1">{resultados.map((h, i) => <li key={`${h.created_at}-${i}`} className="text-sm"><b className={i === 0 ? '' : 'font-semibold text-dte-gris'}>{ESTADO_SEGUIMIENTO_LABEL[h.estado as EstadoSeguimiento]}</b><span className="text-xs text-dte-gris"> · {nombreFed(h.fed_id)} · {fechaCorta(h.created_at)}</span>{h.nota && <span className="block break-words text-dte-tinta">{h.nota}</span>}</li>)}</ul>
      : !eligiendo && <p className="mt-1 text-sm text-dte-gris">Todavía sin marcar{puedeMarcar ? '.' : ': lo anota el FED a cargo o el CED.'}</p>}
  </div>
}

// Avisos de la visita: la jefatura (la avisa el CED) y la escuela (la avisa el FED a cargo, con el mensaje armado desde acá).
function Avisos({ c, puedeMarcar, avisaJefatura, nombre, cuenta, nombreFed, onAnotado }: { c: Cronograma, puedeMarcar: boolean, avisaJefatura: boolean, nombre: string, cuenta: string, nombreFed: (id: string | null) => string, onAnotado: (h: Cronograma['historial'][number]) => void }) {
  const [guardando, setGuardando] = useState<AvisoCronograma | null>(null)
  const [error, setError] = useState('')
  const [armando, setArmando] = useState(false)
  const jef = avisoDe(c, 'jefatura_avisada'), esc = avisoDe(c, 'escuela_avisada')
  async function marcar(a: AvisoCronograma) {
    setGuardando(a); setError('')
    try { onAnotado(await avisarCronograma(c.id, a)) } catch (e) { setError(errMsg(e)) } finally { setGuardando(null) }
  }
  const fila = (titulo: string, a: Cronograma['historial'][number] | null, aviso: AvisoCronograma, puede: boolean, extra?: React.ReactNode) => <li className="flex flex-wrap items-center justify-between gap-2">
    <span className="min-w-0 text-sm"><b>{titulo}</b>{a ? <span className="flex items-center gap-1 text-xs text-exito"><Check className="size-3.5" aria-hidden />Avisada el {fechaCorta(a.created_at)} · {nombreFed(a.fed_id)}</span> : <span className="block text-xs text-dte-gris">Sin avisar</span>}</span>
    {puede && !a && <span className="flex flex-wrap gap-1.5">{extra}<Button type="button" variant="outline" size="sm" disabled={guardando === aviso} onClick={() => marcar(aviso)}>{guardando === aviso && <Loader2 className="animate-spin" data-icon="inline-start" />}Marcar avisada</Button></span>}
  </li>
  return <div className="rounded-control border border-dte-linea px-3 py-2">
    <p className="text-xs font-semibold text-dte-gris">Avisos</p>
    <ul className="mt-1.5 flex flex-col gap-2">
      {fila('Jefatura distrital', jef, 'jefatura_avisada', avisaJefatura)}
      {fila('Escuela', esc, 'escuela_avisada', puedeMarcar, <Button type="button" size="sm" onClick={() => setArmando(true)}><Send data-icon="inline-start" />Armar mensaje</Button>)}
    </ul>
    {puedeMarcar && esc && <Button type="button" variant="ghost" size="sm" onClick={() => setArmando(true)} className="mt-1.5 text-dte-petroleo"><Send data-icon="inline-start" />Ver el mensaje</Button>}
    {error && <div className="mt-2"><ErrorBox message={error} /></div>}
    {armando && <MensajeEscuela c={c} nombre={nombre} cuenta={cuenta} avisada={!!esc} onClose={() => setArmando(false)} onAvisada={onAnotado} />}
  </div>
}

// Mensaje para el directivo: se copia o se abre en el correo, con los contactos de la escuela a mano. Al final se anota que la escuela quedó avisada.
function MensajeEscuela({ c, nombre, cuenta, avisada, onClose, onAvisada }: { c: Cronograma, nombre: string, cuenta: string, avisada: boolean, onClose: () => void, onAvisada: (h: Cronograma['historial'][number]) => void }) {
  const [contactos, setContactos] = useState<ContactoEscuela[] | null>(null)
  const [error, setError] = useState('')
  const [elegido, setElegido] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [marcando, setMarcando] = useState(false)
  const [ahora] = useState(() => new Date())
  useEffect(() => {
    let vigente = true
    getContactosCronograma(c.id).then(l => { if (vigente) { setContactos(l); setElegido(l.map(k => k.correo_laboral || k.correo).find(Boolean) ?? '') } }).catch(e => { if (vigente) setError(errMsg(e)) })
    return () => { vigente = false }
  }, [c.id])
  const msg = mensajeEscuela(c, nombre, ahora)
  const borrador = { asunto: msg.asunto, para: elegido || null, cuerpo: msg.cuerpo }
  const copiar = async () => { try { await navigator.clipboard.writeText(msg.cuerpo); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { setCopiado(false) } }
  async function yaAvise() {
    setMarcando(true); setError('')
    try { onAvisada(await avisarCronograma(c.id, 'escuela_avisada')); onClose() } catch (e) { setError(errMsg(e)); setMarcando(false) }
  }
  return <Dialog open onOpenChange={o => !o && onClose()}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white max-sm:top-[calc(env(safe-area-inset-top,0px)+0.5rem)]! max-sm:bottom-auto! max-sm:max-h-[calc(100dvh-1rem)]! max-sm:rounded-b-2xl! sm:max-w-lg">
      <DialogTitle>Avisar a la escuela</DialogTitle>
      <DialogDescription>Mensaje informativo para el directivo con el trabajo, la fecha y el responsable.</DialogDescription>
      <div className="flex flex-col gap-1"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-dte-gris">Mensaje</span><Button type="button" variant="ghost" size="sm" onClick={copiar}>{copiado ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado ? 'Copiado' : 'Copiar'}</Button></div>
        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-control bg-dte-fondo px-3 py-2 font-sans text-sm">{msg.cuerpo}</pre></div>
      <div className="flex flex-col gap-1.5"><span className="text-xs font-semibold text-dte-gris">Contactos de la escuela</span>
        {error ? <ErrorBox message={error} /> : !contactos ? <Skeleton className="h-16" />
          : contactos.length ? <ul className="divide-y divide-dte-linea overflow-hidden rounded-tile border border-dte-linea">{contactos.map((k, i) => { const mail = k.correo_laboral || k.correo; return <li key={i} className="flex flex-col gap-1 px-3 py-2">
            <span className="text-sm font-semibold">{[k.nombre, k.apellido].filter(Boolean).join(' ') || 'Sin nombre'}{k.cargo && <span className="font-normal text-dte-gris"> · {k.cargo}</span>}</span>
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">{k.telefono && <a href={`tel:${k.telefono}`} className="inline-flex min-h-8 items-center gap-1 font-semibold text-dte-petroleo underline underline-offset-2"><Phone className="size-3.5" aria-hidden />{k.telefono}</a>}
              {mail && <label className="inline-flex min-h-8 items-center gap-1.5 break-all"><input type="radio" name="para" checked={elegido === mail} onChange={() => setElegido(mail)} className="size-4" /><Mail className="size-3.5 text-dte-petroleo" aria-hidden />{mail}</label>}</span></li> })}</ul>
            : <p className="rounded-tile border border-dashed border-dte-linea px-3 py-3 text-center text-sm text-dte-gris">No hay contactos cargados para esta escuela: copiá el mensaje y mandalo por el medio que tengas.</p>}
      </div>
      {error && contactos && <ErrorBox message={error} />}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a href={gmailUrl(borrador, cuenta)} target="_blank" rel="noopener noreferrer" onClick={e => { const p = plataformaDe(navigator.userAgent); if (p === 'otra') return; e.preventDefault(); window.location.href = gmailAppUrl(borrador, p, cuenta) }} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control bg-dte-petroleo px-4 text-sm font-semibold text-white transition hover:bg-dte-petroleo-oscuro md:min-h-9"><Mail className="size-4" aria-hidden />Abrir en mi correo</a>
        {!avisada && <Button type="button" variant="outline" onClick={yaAvise} disabled={marcando} className="min-h-11 md:min-h-9">{marcando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}Ya avisé a la escuela</Button>}
        <Button type="button" variant="ghost" onClick={onClose} className="min-h-11 md:min-h-9">Cerrar</Button>
      </div>
      {!avisada && <p className="text-xs text-dte-gris">Cuando lo hayas mandado (o hayas llamado), tocá Ya avisé a la escuela para dejarlo anotado.</p>}
    </DialogContent>
  </Dialog>
}
