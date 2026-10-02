'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ClipboardList, Eye, Loader2, Pencil, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { type Fed } from '@/lib/agenda'
import { ESTADOS_RECLAMO, ESTADO_RECLAMO_CLASE, ESTADO_RECLAMO_LABEL, filtrarReclamos, origenDeNumero, resumenReclamos, type EstadoReclamo, type FiltrosReclamo, type Reclamo } from '@/lib/reclamos-registro'
import { titleCase } from '@/lib/format'
import { ErrorBox, Skeleton, actualizarReclamo, eyebrow, errMsg, getReclamos, selectClass } from '@/components/app/comun'
import { Field } from '@/components/app/formulario'

const ZONA = 'America/Argentina/Buenos_Aires'
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' })

// Registro de reclamos de conectividad. El CED anota el N° de ticket (PBA) o de incidencia (Educar) y si se resolvió; la administración y los FED lo ven en modo lectura.
export function RegistroReclamos({ profile, feds, esAdmin }: { profile: Fed, feds: Fed[], esAdmin: boolean }) {
  const [lista, setLista] = useState<Reclamo[] | null>(null)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState<FiltrosReclamo>({ estado: 'abiertos', fedId: '', conexion: '', busqueda: '' })
  const [soloMios, setSoloMios] = useState(profile.rol === 'fed' && !esAdmin)
  const [editando, setEditando] = useState<Reclamo | null>(null)
  const puedeEditar = profile.rol === 'coordinacion'
  const cargar = useCallback(() => { getReclamos().then(setLista).catch(e => setError(errMsg(e))) }, [])
  useEffect(() => { cargar() }, [cargar])
  const nombreFed = useCallback((id: string | null) => feds.find(f => f.id === id)?.nombre_completo ?? 'Ex integrante', [feds])
  const propios = useMemo(() => (lista ?? []).filter(r => !soloMios || r.fed_id === profile.id), [lista, soloMios, profile.id])
  const visibles = useMemo(() => filtrarReclamos(propios, filtros, nombreFed), [propios, filtros, nombreFed])
  const resumen = resumenReclamos(propios)
  const conexiones = useMemo(() => [...new Set((lista ?? []).map(r => r.conexion).filter((x): x is string => !!x))].sort(), [lista])
  const set = <K extends keyof FiltrosReclamo>(k: K, v: FiltrosReclamo[K]) => setFiltros(f => ({ ...f, [k]: v }))

  return <main className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-32 pt-6 lg:px-10">
    <p className={eyebrow}>Conectividad</p>
    <h2 className="text-2xl font-bold">Registro de reclamos</h2>
    <p className="mt-1 text-sm text-dte-gris">Los reclamos que el equipo armó y mandó al CED, con el número de ticket o de incidencia que llega de Nivel Central.</p>
    {!puedeEditar && <p className="mt-3 flex items-center gap-1.5 rounded-control bg-dte-fondo px-3 py-2 text-xs font-semibold text-dte-gris"><Eye className="size-3.5" aria-hidden />Modo lectura: el CED es quien anota los números y marca los reclamos resueltos.</p>}

    {error ? <div className="mt-4"><ErrorBox message={error} onRetry={() => { setError(''); cargar() }} /></div>
      : !lista ? <div className="mt-4 flex flex-col gap-3"><Skeleton className="h-16" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      : <>
        <ul className="mt-4 grid grid-cols-3 gap-2">{([['enviado', resumen.enviados], ['en_proceso', resumen.enProceso], ['resuelto', resumen.resueltos]] as [EstadoReclamo, number][]).map(([e, n]) =>
          <li key={e}><button type="button" aria-pressed={filtros.estado === e} onClick={() => set('estado', filtros.estado === e ? 'abiertos' : e)} className={`w-full rounded-card border px-3 py-2.5 text-left transition hover:shadow-e2 ${filtros.estado === e ? 'ring-2 ring-dte-petroleo/30' : ''} ${ESTADO_RECLAMO_CLASE[e]}`}><span className="block text-xl font-bold tabular-nums">{n}</span><span className="block text-xs leading-snug">{ESTADO_RECLAMO_LABEL[e]}</span></button></li>)}</ul>

        <div className="mt-4 flex flex-col gap-2 rounded-card border border-dte-linea bg-white p-3 shadow-e1 md:flex-row md:flex-wrap md:items-center">
          <div className="relative min-w-0 flex-1 md:min-w-56"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dte-gris-claro" aria-hidden /><Input value={filtros.busqueda} onChange={e => set('busqueda', e.target.value)} placeholder="Buscar CUE, escuela, número o FED…" aria-label="Buscar" className="h-11 bg-dte-fondo pl-9 md:h-9" /></div>
          <select aria-label="Estado" className={`${selectClass} md:w-40`} value={filtros.estado} onChange={e => set('estado', e.target.value as FiltrosReclamo['estado'])}><option value="abiertos">Abiertos</option><option value="todos">Todos</option>{ESTADOS_RECLAMO.map(e => <option key={e} value={e}>{ESTADO_RECLAMO_LABEL[e]}</option>)}</select>
          <select aria-label="FED" className={`${selectClass} md:w-44`} value={filtros.fedId} onChange={e => set('fedId', e.target.value)}><option value="">Todo el equipo</option>{feds.map(f => <option key={f.id} value={f.id}>{f.nombre_completo}</option>)}</select>
          <select aria-label="Tipo de conexión" className={`${selectClass} md:w-52`} value={filtros.conexion} onChange={e => set('conexion', e.target.value)}><option value="">Toda conexión</option>{conexiones.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-0"><input type="checkbox" checked={soloMios} onChange={e => setSoloMios(e.target.checked)} className="size-4" />Solo los míos</label>
        </div>

        <p className="mt-3 text-xs text-dte-gris" aria-live="polite">{visibles.length} {visibles.length === 1 ? 'reclamo' : 'reclamos'}</p>
        {visibles.length ? <ul className="mt-2 flex flex-col gap-2">{visibles.map(r => {
          const origen = origenDeNumero(r.nro_incidencia)
          return <li key={r.id} className="rounded-card border border-dte-linea bg-white p-3.5 shadow-e1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${ESTADO_RECLAMO_CLASE[r.estado]}`}>{ESTADO_RECLAMO_LABEL[r.estado]}</span>
              {puedeEditar && <Button type="button" variant="outline" size="sm" onClick={() => setEditando(r)}><Pencil data-icon="inline-start" />Actualizar</Button>}
            </div>
            <p className="mt-2 break-words font-mono text-[0.8125rem] font-medium">{r.asunto}</p>
            <p className="mt-1 text-sm font-semibold">{r.school?.nombre ? titleCase(r.school.nombre) : `CUE ${r.cue ?? '—'}`}{r.school?.distrito && <span className="font-normal text-dte-gris"> · {titleCase(r.school.distrito)}</span>}</p>
            <p className="mt-0.5 text-xs text-dte-gris">{[nombreFed(r.fed_id), `enviado el ${fechaCorta(r.enviado_at)}`, r.conexion].filter(Boolean).join(' · ')}</p>
            {(r.nro_incidencia || r.notas) && <div className="mt-2 rounded-control bg-dte-fondo px-3 py-2 text-sm">
              {r.nro_incidencia && <p><span className="text-xs font-semibold text-dte-gris">{origen ? `Número (${origen}): ` : 'Número: '}</span><b className="break-words tabular-nums">{r.nro_incidencia}</b></p>}
              {r.notas && <p className="mt-0.5 break-words text-dte-tinta">{r.notas}</p>}
            </div>}
            {r.estado === 'resuelto' && r.resuelto_at && <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-exito"><Check className="size-3.5" aria-hidden />Resuelto el {fechaCorta(r.resuelto_at)}</p>}
          </li>
        })}</ul> : <div className="mt-2 flex flex-col items-center gap-2 rounded-card border border-dashed border-dte-linea px-4 py-10 text-center text-sm text-dte-gris"><ClipboardList className="size-6" aria-hidden />{propios.length ? 'No hay reclamos con esos filtros.' : 'Todavía no hay reclamos registrados.'}</div>}
      </>}

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
