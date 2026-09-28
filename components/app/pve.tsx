'use client'

import { useEffect, useState } from 'react'
import { Check, Download, ExternalLink, FileCheck2, FileText, FolderOpen, Loader2, RefreshCw, Send, TriangleAlert, Undo2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Confirmar } from '@/components/ui/confirmar'
import type { PveEvento, PveFed, PveMes } from '@/app/actions'
import { abrirCarpetaPve, devolverPve, cap, errMsg, eyebrow, fmt, parse, misPve, pveEquipo, marcarPveEnviadas, ErrorBox, Skeleton } from '@/components/app/comun'
import { fechaHoyAR, ZONA } from '@/lib/hora'

const fecha = (ts: string) => cap(fmt(new Date(ts), { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''))
const fechaCorta = (f: string) => cap(fmt(parse(f), { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''))
const PRIMER_MES = '2026-09-01'
// Devuelta y todavía sin corregir.
const pendienteCorreccion = (x: { devuelta: string | null, reentregada: string | null }) => !!x.devuelta && !x.reentregada
const EVENTO: Record<PveEvento['tipo'], string> = { entregada: 'Entregada', devuelta: 'Devuelta', reentregada: 'Reentregada', enviada: 'Enviada' }
// Historial corto: "Entregada 2/10 · Devuelta 8/10 · Reentregada 9/10".
function Historial({ h }: { h: PveEvento[] }) {
  if (h.length < 2) return null
  return <span className="block text-xs text-dte-gris">{h.map(e => `${EVENTO[e.tipo]} ${new Date(e.fecha).toLocaleDateString('es-AR', { timeZone: ZONA, day: 'numeric', month: 'numeric' })}`).join(' · ')}</span>
}
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Mi perfil (FED): una carpeta por mes para subir el PDF de la PVE ya firmada.
export function SeccionPve() {
  const [datos, setDatos] = useState<{ conectada: boolean, meses: PveMes[], error: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cargar = (revisar = false) => { setBusy(revisar); setError(''); misPve(revisar).then(setDatos).catch(e => setError(errMsg(e))).finally(() => setBusy(false)) }
  useEffect(() => { cargar() }, [])
  // "Subir": la carpeta del mes se crea recién ahora. La ventana se abre antes de esperar al servidor (si no, el navegador la bloquea).
  const [abriendo, setAbriendo] = useState('')
  async function subir(m: PveMes) {
    if (m.carpetaUrl) { window.open(m.carpetaUrl, '_blank', 'noopener'); return }
    const w = window.open('', '_blank')
    setAbriendo(m.mes); setError('')
    try { const url = await abrirCarpetaPve(m.mes); if (w) w.location.href = url; else window.location.href = url; cargar() }
    catch (e) { w?.close(); setError(errMsg(e)) } finally { setAbriendo('') }
  }
  return <section className="rounded-2xl border border-dte-linea bg-white p-4 shadow-xs sm:p-5" aria-labelledby="t-pve">
    <h3 id="t-pve" className="flex items-center gap-1.5 font-bold"><FileText className="size-4 text-dte-petroleo" />Planillas de Visita (PVE)</h3>
    <p className="mb-3 text-sm text-dte-gris">Subí tu PVE del mes, <b>firmada y en un solo PDF</b>, a la carpeta de ese mes. Vence el <b>5.º día hábil del mes siguiente</b>. Tocá <b>Subir</b> en el mes: se crea su carpeta en tu Drive y se abre. La agenda le pone el nombre correcto y se la deja lista a la coordinación.</p>
    {!datos ? (error ? <ErrorBox message={error} /> : <Loader2 className="size-5 animate-spin text-dte-gris" />)
      : !datos.conectada ? <p className="rounded-lg border border-dashed border-dte-linea px-3 py-3 text-sm text-dte-gris">Primero conectá tu carpeta de Drive en “Fotos de las acciones”: las PVE usan la misma carpeta.</p>
      : <>
        <ul className="divide-y divide-dte-linea rounded-xl border border-dte-linea">{datos.meses.map(m => <li key={m.mes} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
          <span className="min-w-0"><b className="capitalize">{m.nombreMes.toLowerCase()}</b>
            {pendienteCorreccion(m) ? <span className="flex items-center gap-1 text-xs font-semibold text-aviso"><Undo2 className="size-3" />Devuelta para corregir</span>
              : <span className={`flex items-center gap-1 text-xs ${m.entregada ? 'text-exito' : 'text-dte-gris'}`}>{m.enviada ? <><Send className="size-3" />Enviada a Nivel Central</> : m.reentregada ? <><Check className="size-3" />Corregida y reentregada el {fecha(m.reentregada)}</> : m.entregada ? <><Check className="size-3" />Entregada el {fecha(m.entregada)}</> : <>Pendiente · vence el {fechaCorta(m.vence)}</>}</span>}
            <Historial h={m.historial} /></span>
          <span className="flex flex-wrap gap-1.5">
            {m.archivoUrl && <a href={m.archivoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-dte-linea px-2.5 text-xs font-semibold text-dte-petroleo hover:bg-dte-tinte md:min-h-8"><ExternalLink className="size-3.5" />Ver</a>}
            {!m.enviada && <button type="button" disabled={abriendo === m.mes} onClick={() => subir(m)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-dte-linea px-2.5 text-xs font-semibold text-dte-petroleo hover:bg-dte-tinte md:min-h-8">{abriendo === m.mes ? <Loader2 className="size-3.5 animate-spin" /> : <FolderOpen className="size-3.5" />}{pendienteCorreccion(m) ? 'Subir corregida' : m.entregada ? 'Carpeta' : 'Subir'}</button>}
          </span>
          {pendienteCorreccion(m) && <p className="w-full rounded-lg bg-aviso-fondo px-3 py-2 text-xs text-aviso"><b>Motivo:</b> {m.motivo}. Subí el PDF corregido a la misma carpeta: la versión anterior queda guardada aparte.</p>}
        </li>)}</ul>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => cargar(true)}>{busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}Revisar ahora</Button>
          <span className="text-xs text-dte-gris">También se revisa sola cada noche. Si subís otra versión, vale la última.</span>
        </div>
        {datos.error && <p className="mt-2 flex items-center gap-1.5 text-xs text-aviso"><TriangleAlert className="size-3.5" />{datos.error}</p>}
      </>}
    {datos && error && <div className="mt-2"><ErrorBox message={error} /></div>}
  </section>
}

// Coordinación: estado de entrega del mes, descarga de todas juntas y marca de enviadas a Nivel Central.
export function PveEquipoView() {
  const hoy = fechaHoyAR()
  // Las PVE se entregan por la agenda desde septiembre de 2026.
  const [mes, setMes] = useState(() => { const d = new Date(hoy.getFullYear(), hoy.getMonth() - (hoy.getDate() <= 15 ? 1 : 0), 1); const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; return m < PRIMER_MES ? PRIMER_MES : m })
  const [lista, setLista] = useState<PveFed[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [aviso, setAviso] = useState('')
  const cargar = () => { setLista(null); setError(''); pveEquipo(mes).then(setLista).catch(e => { setLista([]); setError(errMsg(e)) }) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(cargar, [mes])
  const mover = (n: number) => { const d = parse(mes); d.setMonth(d.getMonth() + n); setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`); setAviso('') }
  const nombreMes = `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`
  const entregadas = (lista ?? []).filter(f => f.entregada), pendientes = (lista ?? []).filter(f => !f.entregada)
  const sinEnviar = entregadas.filter(f => !f.enviada && !pendienteCorreccion(f)), corregidas = entregadas.filter(f => f.reentregada && !f.enviada)
  // Devolución: motivo obligatorio; al FED le llega el aviso.
  const [devolver, setDevolver] = useState<PveFed | null>(null)
  const [motivo, setMotivo] = useState('')
  async function confirmarDevolucion() {
    if (!devolver) return
    setBusy(true); setError('')
    try { await devolverPve(devolver.fedId, mes, motivo); setAviso(`Se devolvió la PVE de ${devolver.nombre}. Le llega el aviso con el motivo.`); setDevolver(null); setMotivo(''); cargar() } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }
  async function enviar() {
    setBusy(true); setError('')
    try { const n = await marcarPveEnviadas(mes); setAviso(`Se marcaron ${n} ${n === 1 ? 'PVE' : 'PVE'} como enviadas.`); cargar() } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }
  return <main className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-24 pt-6 lg:px-10">
    <p className={eyebrow}>Coordinación</p>
    <h2 className="mt-1 text-2xl font-bold tracking-tight">PVE del equipo</h2>
    <p className="mt-1.5 text-sm text-dte-gris">Cada FED sube su PVE firmada a su carpeta de Drive; acá ves quién la entregó y las descargás todas juntas para enviarlas a Nivel Central (asunto: <b>R01 - PVE - {nombreMes.toUpperCase()}</b>).</p>
    <div className="mt-4 flex items-center gap-1"><Button variant="outline" size="sm" disabled={mes <= PRIMER_MES} onClick={() => mover(-1)} aria-label="Mes anterior">‹</Button><span className="min-w-36 px-2 text-center text-sm font-bold capitalize">{nombreMes}</span><Button variant="outline" size="sm" onClick={() => mover(1)} aria-label="Mes siguiente">›</Button></div>
    {error && <div className="mt-3"><ErrorBox message={error} /></div>}
    {!lista ? <div className="mt-4 flex flex-col gap-2"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : <>
      <p className="mt-4 text-sm">Vence el <b>{lista[0] ? fechaCorta(lista[0].vence) : '—'}</b> (5.º día hábil del mes siguiente) · <b>{entregadas.length}</b> de {lista.length} entregadas{pendientes.length ? <> · faltan: {pendientes.map(f => f.nombre.split(' ')[0]).join(', ')}</> : ''}</p>
      <ul className="mt-2 divide-y divide-dte-linea rounded-2xl border border-dte-linea bg-white shadow-xs">{lista.map(f => <li key={f.fedId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
        <span className="min-w-0"><b>{f.nombre}</b>
          {pendienteCorreccion(f) ? <span className="block text-xs text-aviso"><span className="flex items-center gap-1 font-semibold"><Undo2 className="size-3" />Devuelta para corregir</span>{f.motivo}</span>
            : <span className={`flex items-center gap-1 text-xs ${f.entregada ? 'text-exito' : 'text-dte-gris'}`}>{f.enviada ? <><Send className="size-3" />Enviada</> : f.reentregada ? <><FileCheck2 className="size-3" />Reentregada corregida el {fecha(f.reentregada)}</> : f.entregada ? <><FileCheck2 className="size-3" />Entregada el {fecha(f.entregada)}</> : f.conectada ? 'Pendiente' : 'Sin carpeta de Drive conectada'}</span>}
          <Historial h={f.historial} /></span>
        <span className="flex flex-wrap gap-1.5">
          {f.archivoUrl && <a href={f.archivoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-dte-linea px-2.5 text-xs font-semibold text-dte-petroleo hover:bg-dte-tinte md:min-h-8"><ExternalLink className="size-3.5" />Ver</a>}
          {f.entregada && !pendienteCorreccion(f) && <button type="button" onClick={() => { setDevolver(f); setMotivo('') }} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-dte-linea px-2.5 text-xs font-semibold text-aviso hover:bg-aviso-fondo md:min-h-8"><Undo2 className="size-3.5" />Devolver</button>}
        </span>
      </li>)}</ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {entregadas.length > 0 && <a href={`/api/pve/zip?mes=${mes}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-dte-petroleo px-4 text-sm font-semibold text-white hover:bg-dte-petroleo-oscuro md:min-h-9"><Download className="size-4" />Descargar todas ({entregadas.length})</a>}
        {corregidas.length > 0 && <a href={`/api/pve/zip?mes=${mes}&solo=corregidas`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-dte-petroleo px-4 text-sm font-semibold text-dte-petroleo hover:bg-dte-tinte md:min-h-9"><Download className="size-4" />Descargar corregidas ({corregidas.length})</a>}
        {sinEnviar.length > 0 && <Button variant="outline" disabled={busy} onClick={() => setConfirmar(true)}>{busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Send data-icon="inline-start" />}Marcar como enviadas</Button>}
      </div>
      {aviso && <p role="status" className="mt-2 text-sm text-exito">{aviso}</p>}
    </>}
    <Confirmar abierto={confirmar} titulo="¿Marcar como enviadas?" accion="Marcar" descripcion={<>Las {sinEnviar.length} PVE entregadas de <b>{nombreMes}</b> quedan como enviadas a Nivel Central y ya no se pueden reemplazar. Las que falten o estén en corrección se pueden seguir subiendo.</>}
      onConfirmar={enviar} onCerrar={() => setConfirmar(false)} />
    <Dialog open={!!devolver} onOpenChange={o => !o && setDevolver(null)}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader><DialogTitle>Devolver la PVE de {devolver?.nombre}</DialogTitle><DialogDescription>Le llega un aviso con el motivo y puede subir la corregida. Si ya estaba enviada, vuelve a quedar abierta.</DialogDescription></DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Motivo<Textarea rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: falta la firma del 14/09; sin registrar 22 y 23/09" maxLength={500} /></label>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDevolver(null)}>Cancelar</Button><Button disabled={busy || !motivo.trim()} onClick={confirmarDevolucion} className="bg-dte-petroleo hover:bg-dte-petroleo-oscuro">{busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Undo2 data-icon="inline-start" />}Devolver</Button></div>
      </DialogContent>
    </Dialog>
  </main>
}
