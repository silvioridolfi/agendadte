'use client'

import { PuntoTipo } from '@/components/app/tipocrono'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, ClipboardList, Copy, Eye, FileSpreadsheet, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SelectorFecha } from '@/components/app/selectorfecha'
import { Textarea } from '@/components/ui/textarea'
import { type Fed } from '@/lib/agenda'
import { ESTADOS_RECLAMO, ESTADO_RECLAMO_CLASE, ESTADO_RECLAMO_LABEL, ESTADO_RECLAMO_PLURAL, filtrarReclamos, origenDeNumero, puedeResolverReclamo, resumenReclamos, sumarNota, type EstadoReclamo, type FiltrosReclamo, type Reclamo } from '@/lib/reclamos-registro'
import { titleCase } from '@/lib/format'
import { esDelFed, etiquetaTipo, ventanaDe } from '@/lib/cronogramas'
import type { CruceReclamo } from '@/lib/cruce'
import { BotonVolver, ErrorBox, Skeleton, actualizarReclamo, eliminarBorradorReclamo, enviarBorradorReclamo, eyebrow, errMsg, getBorradoresReclamo, getCruceReclamos, getReclamos, resolverReclamo, selectClass } from '@/components/app/comun'
import type { Borrador } from '@/app/actions'
import { hoyAR } from '@/lib/hora'
import { Field } from '@/components/app/formulario'

const ZONA = 'America/Argentina/Buenos_Aires'
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' })

// Registro de reclamos de conectividad. El CED anota el N° de ticket (PBA) o de incidencia (Educar) y si se resolvió; la administración y los FED lo ven en modo lectura.
// `onNuevo`: abre el armado de un reclamo nuevo; `recargar` cambia cuando ese armado se cierra, para traer de nuevo la lista y los borradores.
export function RegistroReclamos({ profile, feds, esAdmin, soloMiosInicial, volver, onNuevo, recargar = 0 }: { profile: Fed, feds: Fed[], esAdmin: boolean, soloMiosInicial?: boolean, volver?: { destino: string, ir: () => void }, onNuevo?: () => void, recargar?: number }) {
  const [lista, setLista] = useState<Reclamo[] | null>(null)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState<FiltrosReclamo>({ estado: 'abiertos', fedId: '', conexion: '', busqueda: '' })
  // Cronogramas de la misma escuela (próximos, o el último posterior al reclamo), por reclamo abierto.
  const [cruce, setCruce] = useState<Record<string, CruceReclamo>>({})
  const [conCrono, setConCrono] = useState<'' | 'proximo' | 'posterior'>('')
  const [soloMios, setSoloMios] = useState((profile.rol === 'fed' && !esAdmin) || !!soloMiosInicial)
  const [editando, setEditando] = useState<Reclamo | null>(null)
  const [resolviendo, setResolviendo] = useState<Reclamo | null>(null)
  const puedeEditar = profile.rol === 'coordinacion'
  const [exportando, setExportando] = useState(false)
  const [errorExcel, setErrorExcel] = useState('')
  const cargar = useCallback(() => { getReclamos().then(setLista).catch(e => setError(errMsg(e))); getCruceReclamos().then(setCruce).catch(() => {}) }, [])
  useEffect(() => { cargar() }, [cargar, recargar])
  const nombreFed = useCallback((id: string | null) => feds.find(f => f.id === id)?.nombre_completo ?? 'Ex integrante', [feds])
  const propios = useMemo(() => (lista ?? []).filter(r => !soloMios || r.fed_id === profile.id || esDelFed(r.school?.fed_a_cargo, profile.nombre_completo)), [lista, soloMios, profile.id, profile.nombre_completo])
  const visibles = useMemo(() => filtrarReclamos(propios, filtros, nombreFed).filter(r => !conCrono || (conCrono === 'proximo' ? !!cruce[r.id]?.proximos.length : !!cruce[r.id]?.pasado)), [propios, filtros, nombreFed, conCrono, cruce])
  const resumen = resumenReclamos(propios)
  const conexiones = useMemo(() => [...new Set((lista ?? []).map(r => r.conexion).filter((x): x is string => !!x))].sort(), [lista])
  const set = <K extends keyof FiltrosReclamo>(k: K, v: FiltrosReclamo[K]) => setFiltros(f => ({ ...f, [k]: v }))

  return <main className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-32 pt-6 lg:px-10">
    {volver && <BotonVolver onClick={volver.ir} destino={volver.destino} />}
    <p className={eyebrow}>Conectividad</p>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold">Registro de reclamos</h2>
      <div className="flex flex-wrap items-center gap-2">
      {onNuevo && <Button type="button" size="sm" onClick={onNuevo}><Plus data-icon="inline-start" />Nuevo reclamo</Button>}
      {lista && <Button type="button" variant="outline" size="sm" disabled={exportando || !visibles.length} onClick={async () => { setExportando(true); setErrorExcel(''); try { const { exportarReclamos } = await import('@/lib/exportar'); await exportarReclamos(visibles, nombreFed) } catch (e) { setErrorExcel(errMsg(e)) } finally { setExportando(false) } }}>{exportando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <FileSpreadsheet data-icon="inline-start" />}Excel ({visibles.length})</Button>}
      </div>
    </div>
    {errorExcel && <div className="mt-2"><ErrorBox message={errorExcel} /></div>}
    <p className="mt-1 text-sm text-dte-gris">Los reclamos que el equipo armó y mandó al CED, con el número de ticket o de incidencia que llega de Nivel Central.</p>
    {!puedeEditar && <p className="mt-3 flex items-center gap-1.5 rounded-control bg-dte-fondo px-3 py-2 text-xs font-semibold text-dte-gris"><Eye className="size-3.5" aria-hidden />Modo lectura: el CED es quien anota los números y marca los reclamos resueltos.</p>}

    {error ? <div className="mt-4"><ErrorBox message={error} onRetry={() => { setError(''); cargar() }} /></div>
      : !lista ? <div className="mt-4 flex flex-col gap-3"><Skeleton className="h-16" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      : <>
        <BorradoresReclamos key={recargar} onEnviado={cargar} />
        <ul className="mt-4 grid grid-cols-3 gap-2">{([['enviado', resumen.enviados], ['en_proceso', resumen.enProceso], ['resuelto', resumen.resueltos]] as [EstadoReclamo, number][]).map(([e, n]) =>
          <li key={e} className="flex"><button type="button" aria-pressed={filtros.estado === e} onClick={() => set('estado', filtros.estado === e ? 'abiertos' : e)} className={`flex h-full w-full flex-col justify-between gap-1 rounded-control border px-3 py-2.5 text-left transition hover:shadow-e2 ${filtros.estado === e ? 'ring-2 ring-dte-petroleo/30' : ''} ${ESTADO_RECLAMO_CLASE[e]}`}><span className="block text-xl font-bold tabular-nums">{n}</span><span className="block text-xs leading-snug">{ESTADO_RECLAMO_PLURAL[e]}</span></button></li>)}</ul>

        <div className="mt-4 flex flex-col gap-2 rounded-card border border-dte-linea bg-white p-3 shadow-e1 md:flex-row md:flex-wrap md:items-center">
          <div className="relative min-w-0 flex-1 md:min-w-56"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dte-gris-claro" aria-hidden /><Input value={filtros.busqueda} onChange={e => set('busqueda', e.target.value)} placeholder="Buscar CUE, escuela, número o FED…" aria-label="Buscar" className="h-11 bg-dte-fondo pl-9 md:h-9" /></div>
          <select aria-label="Estado" className={`${selectClass} md:w-40`} value={filtros.estado} onChange={e => set('estado', e.target.value as FiltrosReclamo['estado'])}><option value="abiertos">Abiertos</option><option value="todos">Todos</option>{ESTADOS_RECLAMO.map(e => <option key={e} value={e}>{ESTADO_RECLAMO_LABEL[e]}</option>)}</select>
          <select aria-label="FED" className={`${selectClass} md:w-44`} value={filtros.fedId} onChange={e => set('fedId', e.target.value)}><option value="">Todo el equipo</option>{feds.map(f => <option key={f.id} value={f.id}>{f.nombre_completo}</option>)}</select>
          <select aria-label="Tipo de conexión" className={`${selectClass} md:w-52`} value={filtros.conexion} onChange={e => set('conexion', e.target.value)}><option value="">Toda conexión</option>{conexiones.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <select aria-label="Cronogramas" className={`${selectClass} md:w-60`} value={conCrono} onChange={e => setConCrono(e.target.value as typeof conCrono)}><option value="">Con o sin cronograma</option><option value="proximo">Con cronograma próximo</option><option value="posterior">Cronograma posterior (¿se resolvió?)</option></select>
          <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-0"><input type="checkbox" checked={soloMios} onChange={e => setSoloMios(e.target.checked)} className="size-4" />Solo los míos y de mis escuelas</label>
        </div>

        <p className="mt-3 text-xs text-dte-gris" aria-live="polite">{visibles.length} {visibles.length === 1 ? 'reclamo' : 'reclamos'}</p>
        {visibles.length ? <ul className="mt-2 flex flex-col gap-2">{visibles.map(r => {
          const origen = origenDeNumero(r.nro_incidencia), x = cruce[r.id], prox = x?.proximos[0], pasado = x?.pasado
          return <li key={r.id} className="rounded-card border border-dte-linea bg-white p-3.5 shadow-e1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${ESTADO_RECLAMO_CLASE[r.estado]}`}>{ESTADO_RECLAMO_LABEL[r.estado]}</span>
              {puedeEditar ? <Button type="button" variant="outline" size="sm" onClick={() => setEditando(r)}><Pencil data-icon="inline-start" />Actualizar</Button>
                : puedeResolverReclamo({ id: profile.id, nombre: profile.nombre_completo }, r) && <Button type="button" variant="outline" size="sm" onClick={() => setResolviendo(r)}><Check data-icon="inline-start" />Marcar resuelto</Button>}
            </div>
            <p className="mt-2 break-words font-mono text-[0.8125rem] font-medium">{r.asunto}</p>
            <p className="mt-1 text-sm font-semibold">{r.school?.nombre ? titleCase(r.school.nombre) : `CUE ${r.cue ?? '—'}`}{r.school?.distrito && <span className="font-normal text-dte-gris"> · {titleCase(r.school.distrito)}</span>}</p>
            <p className="mt-0.5 text-xs text-dte-gris">{[nombreFed(r.fed_id), `enviado el ${fechaCorta(r.enviado_at)}`, r.conexion].filter(Boolean).join(' · ')}</p>
            {prox ? <p className="mt-2 flex items-start gap-2 rounded-control border border-dte-petroleo/30 bg-dte-tinte px-3 py-2 text-sm"><CalendarClock className="mt-0.5 size-4 shrink-0 text-dte-petroleo" aria-hidden /><span className="min-w-0 break-words"><b>Cronograma próximo en la escuela:</b> <PuntoTipo tipo={prox.tipo} />{etiquetaTipo(prox.tipo)} · {ventanaDe(prox)}{prox.proveedor ? ` · ${prox.proveedor}` : ''}{x.proximos.length > 1 ? ` (+${x.proximos.length - 1})` : ''}</span></p> : null}
            {pasado ? <p className="mt-2 flex items-start gap-2 rounded-control border border-aviso-borde bg-aviso-fondo px-3 py-2 text-sm text-aviso-fuerte"><CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden /><span className="min-w-0 break-words"><b>Hubo un cronograma posterior al reclamo:</b> <PuntoTipo tipo={pasado.tipo} />{etiquetaTipo(pasado.tipo)} · {ventanaDe(pasado)}{pasado.estado === 'realizado' ? ' (anotado como realizado)' : ''}. ¿Se resolvió? Si ya funciona, marcalo como resuelto.</span></p> : null}
            {(r.nro_incidencia || r.notas) && <div className="mt-2 rounded-control bg-dte-fondo px-3 py-2 text-sm">
              {r.nro_incidencia && <p><span className="text-xs font-semibold text-dte-gris">{origen ? `Número (${origen}): ` : 'Número: '}</span><b className="break-words tabular-nums">{r.nro_incidencia}</b></p>}
              {r.notas && <p className="mt-0.5 break-words text-dte-tinta">{r.notas}</p>}
            </div>}
            {r.estado === 'resuelto' && r.resuelto_at && <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-exito"><Check className="size-3.5" aria-hidden />Resuelto el {fechaCorta(r.resuelto_at)}{r.actualizado_por && ` · lo marcó ${nombreFed(r.actualizado_por)}`}</p>}
          </li>
        })}</ul> : <div className="mt-2 flex flex-col items-center gap-2 rounded-card border border-dashed border-dte-linea px-4 py-10 text-center text-sm text-dte-gris"><ClipboardList className="size-6" aria-hidden />{propios.length ? 'No hay reclamos con esos filtros.' : 'Todavía no hay reclamos registrados.'}</div>}
      </>}

    {resolviendo && <ResolverReclamo key={resolviendo.id} reclamo={resolviendo} onClose={() => setResolviendo(null)} onResuelto={(r, nota) => { setLista(l => l && l.map(x => (x.id === r.id ? { ...x, estado: 'resuelto', notas: sumarNota(x.notas, nota), resuelto_at: new Date().toISOString(), actualizado_por: profile.id } : x))); setResolviendo(null) }} />}
    {editando && <EditarReclamo key={editando.id} reclamo={editando} onClose={() => setEditando(null)} onGuardado={r => { setLista(l => l && l.map(x => (x.id === r.id ? r : x))); setEditando(null) }} />}
  </main>
}

function EditarReclamo({ reclamo, onClose, onGuardado }: { reclamo: Reclamo, onClose: () => void, onGuardado: (r: Reclamo) => void }) {
  const [estado, setEstado] = useState<EstadoReclamo>(reclamo.estado)
  const [numero, setNumero] = useState(reclamo.nro_incidencia ?? '')
  const [notas, setNotas] = useState(reclamo.notas ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  async function guardar() {
    setGuardando(true); setError('')
    try {
      // Llegó el número y el reclamo seguía como enviado: pasa a "en proceso" (el servidor aplica la misma regla).
      const nuevoEstado = estado === reclamo.estado && estado === 'enviado' && numero.trim() && !reclamo.nro_incidencia ? 'en_proceso' : estado
      await actualizarReclamo(reclamo.id, { estado, nro_incidencia: numero, notas })
      onGuardado({ ...reclamo, estado: nuevoEstado, nro_incidencia: numero.trim() || null, notas: notas.trim() || null, resuelto_at: nuevoEstado === 'resuelto' ? new Date().toISOString() : null })
    } catch (e) { setError(errMsg(e)); setGuardando(false) }
  }
  return <Dialog open onOpenChange={o => !o && onClose()}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white max-sm:top-[calc(env(safe-area-inset-top,0px)+0.5rem)]! max-sm:bottom-auto! max-sm:rounded-b-2xl! sm:max-w-lg">
      <DialogTitle>Actualizar reclamo</DialogTitle>
      <DialogDescription className="break-words font-mono text-[0.75rem]">{reclamo.asunto}</DialogDescription>
      <Field label="Estado"><select className={`${selectClass} h-11 md:h-10`} value={estado} onChange={e => setEstado(e.target.value as EstadoReclamo)}>{ESTADOS_RECLAMO.map(e => <option key={e} value={e}>{ESTADO_RECLAMO_LABEL[e]}</option>)}</select></Field>
      <Field label="N° de ticket (PBA) o de incidencia (Educar)" hint="(cuando llega de Nivel Central)"><Input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ej.: ticket 337918 · NI-000234800" className="h-11 md:h-10" /></Field>
      <Field label="Notas" hint="(opcional)"><Textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Respuesta de Nivel Central u otra información" className="min-h-20" /></Field>
      {error && <ErrorBox message={error} />}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="button" onClick={guardar} disabled={guardando}>{guardando && <Loader2 className="animate-spin" data-icon="inline-start" />}Guardar</Button></div>
    </DialogContent>
  </Dialog>
}

// Un FED marca como resuelto un reclamo de una escuela a su cargo (por lo general, porque la escuela le avisó). No se avisa a nadie.
function ResolverReclamo({ reclamo, onClose, onResuelto }: { reclamo: Reclamo, onClose: () => void, onResuelto: (r: Reclamo, nota: string | null) => void }) {
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  async function guardar() {
    setGuardando(true); setError('')
    try { await resolverReclamo(reclamo.id, nota); onResuelto(reclamo, nota.trim() || null) } catch (e) { setError(errMsg(e)); setGuardando(false) }
  }
  return <Dialog open onOpenChange={o => !o && onClose()}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white max-sm:top-[calc(env(safe-area-inset-top,0px)+0.5rem)]! max-sm:bottom-auto! max-sm:rounded-b-2xl! sm:max-w-md">
      <DialogTitle>Marcar como resuelto</DialogTitle>
      <DialogDescription className="break-words">{reclamo.school?.nombre ? titleCase(reclamo.school.nombre) : `CUE ${reclamo.cue ?? '—'}`} · {reclamo.tipo_label}. No se envía ningún aviso; el CED lo ve en el registro.</DialogDescription>
      <Field label="Nota" hint="(opcional)"><Textarea value={nota} onChange={e => setNota(e.target.value)} maxLength={500} placeholder="Ej.: la escuela confirmó por teléfono que ya funciona" className="min-h-20" /></Field>
      {error && <ErrorBox message={error} />}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="button" onClick={guardar} disabled={guardando}>{guardando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}Marcar resuelto</Button></div>
    </DialogContent>
  </Dialog>
}

// Reclamos armados que todavía no salieron (por ejemplo, programados en Gmail para otro momento). Cada uno ve solo los suyos.
// Al marcarlo como enviado pasa al registro con la fecha de envío y recién ahí se avisa al CED.
function BorradoresReclamos({ onEnviado }: { onEnviado: () => void }) {
  const [lista, setLista] = useState<Borrador[]>([])
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [fecha, setFecha] = useState(() => hoyAR())
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState('')
  const [aEliminar, setAEliminar] = useState<string | null>(null)
  useEffect(() => { let vivo = true; getBorradoresReclamo().then(l => { if (vivo) setLista(l) }).catch(() => {}); return () => { vivo = false } }, [])
  if (!lista.length && !error) return null
  const copiar = async (texto: string, clave: string) => { try { await navigator.clipboard.writeText(texto); setCopiado(clave); setTimeout(() => setCopiado(c => (c === clave ? '' : c)), 2000) } catch { setError('No se pudo copiar: seleccioná el texto y copialo a mano.') } }
  async function enviar(b: Borrador) {
    setOcupado(true); setError('')
    try { await enviarBorradorReclamo(b.id, fecha); setLista(l => l.filter(x => x.id !== b.id)); setEnviando(null); onEnviado() } catch (e) { setError(errMsg(e)) } finally { setOcupado(false) }
  }
  async function eliminar(b: Borrador) {
    setOcupado(true); setError('')
    try { await eliminarBorradorReclamo(b.id); setLista(l => l.filter(x => x.id !== b.id)); setAEliminar(null) } catch (e) { setError(errMsg(e)) } finally { setOcupado(false) }
  }
  return <section aria-label="Borradores" className="mt-4 rounded-card border border-aviso-borde bg-aviso-fondo p-3.5">
    <h3 className="flex items-center gap-1.5 text-sm font-bold text-aviso-fuerte"><ClipboardList className="size-4" aria-hidden />Mis borradores ({lista.length})</h3>
    <p className="mt-0.5 text-xs text-dte-gris">Reclamos armados que todavía no salieron. Cuando los mandes, marcalos como enviados: recién ahí pasan al registro y se avisa al CED.</p>
    {error && <div className="mt-2"><ErrorBox message={error} /></div>}
    <ul className="mt-2 flex flex-col gap-2">{lista.map(b => <li key={b.id} className="rounded-control border border-dte-linea bg-white p-3">
      <p className="text-sm font-semibold">{b.tipo_label}</p>
      <p className="break-words text-sm">{b.escuela_nombre ? titleCase(b.escuela_nombre) : 'Establecimiento'}{b.cue ? <span className="text-dte-gris"> · CUE {b.cue}</span> : null}</p>
      <p className="mt-1 break-words font-mono text-[0.8125rem] font-medium">{b.asunto}</p>
      <p className="mt-0.5 text-xs text-dte-gris">Guardado el {fechaCorta(b.created_at)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(abierto === b.id ? null : b.id)} aria-expanded={abierto === b.id}><Eye data-icon="inline-start" />{abierto === b.id ? 'Ocultar mensaje' : 'Ver mensaje'}</Button>
        <Button type="button" size="sm" onClick={() => { setEnviando(enviando === b.id ? null : b.id); setFecha(hoyAR()) }} aria-expanded={enviando === b.id}><Check data-icon="inline-start" />Marcar como enviado</Button>
        {aEliminar === b.id ? <><Button type="button" variant="destructive" size="sm" disabled={ocupado} onClick={() => eliminar(b)}>{ocupado ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}Sí, eliminar</Button><Button type="button" variant="outline" size="sm" onClick={() => setAEliminar(null)}>No</Button></>
          : <Button type="button" variant="outline" size="sm" onClick={() => setAEliminar(b.id)}><Trash2 data-icon="inline-start" />Eliminar</Button>}
      </div>
      {enviando === b.id && <div className="mt-2 flex flex-col gap-2 rounded-control bg-dte-fondo p-2.5 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1 text-xs font-semibold text-dte-gris">Fecha en que se envió<SelectorFecha ariaLabel="Fecha en que se envió" value={fecha} max={hoyAR()} limpiable={false} onChange={setFecha} className="sm:w-48" /></div>
        <Button type="button" disabled={ocupado || !fecha} onClick={() => enviar(b)} className="w-full sm:w-auto">{ocupado ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}Confirmar envío</Button>
      </div>}
      {abierto === b.id && <div className="mt-2 flex flex-col gap-2 text-sm">
        {b.para && <div className="flex items-center justify-between gap-2 rounded-control bg-dte-fondo px-3 py-2"><span className="min-w-0 break-all"><span className="text-xs font-semibold text-dte-gris">Para: </span>{b.para}</span><Button type="button" variant="ghost" size="sm" onClick={() => copiar(b.para!, `p${b.id}`)}>{copiado === `p${b.id}` ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}Copiar</Button></div>}
        <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-dte-gris">Asunto y mensaje</span><span className="flex gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => copiar(b.asunto, `a${b.id}`)}>{copiado === `a${b.id}` ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}Asunto</Button><Button type="button" variant="ghost" size="sm" onClick={() => copiar(b.cuerpo, `c${b.id}`)}>{copiado === `c${b.id}` ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}Mensaje</Button></span></div>
        <pre className="whitespace-pre-wrap break-words rounded-control bg-dte-fondo p-3 font-sans text-[0.8125rem]">{b.cuerpo}</pre>
        {b.adjuntos.length > 0 && <ul className="list-disc pl-5 text-sm">{b.adjuntos.map(a => <li key={a.texto}>{a.texto}</li>)}</ul>}
      </div>}
    </li>)}</ul>
  </section>
}
