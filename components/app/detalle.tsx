'use client'

import { useEffect, useState } from 'react'
import { Camera, Check, ClipboardList, Clock, History, Loader2, GraduationCap, MapPin, Navigation, ClipboardCheck, Pencil, Repeat, School as SchoolIcon, Trash2, UserRound, Users, Video, Wifi, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ESTADOS, esTrayecto, type AgendaItem, type Estado, type Fed, type School } from '@/lib/agenda'
import type { Ubicacion } from '@/app/actions'
import { titleCase } from '@/lib/format'
import { ubicacionDe, statusStyle, parse, fmt, cap, timeRange, schoolPlace, itemTitle, firstName, setItemStatus, deleteItem, responder, getHistorial, fotosDelDia, errMsg, ActionChip, StatusBadge, ErrorBox } from '@/components/app/comun'
import { ZONA, hoyAR } from '@/lib/hora'

// =====================================================================

// El estado del detalle (errores, confirmaciones, historial, fotos, dirección) se reinicia al cambiar de acción: se remonta con key.
export function DetailDialog(props: Parameters<typeof DetalleAccion>[0]) { return <DetalleAccion key={props.item?.id ?? ''} {...props} /> }

function DetalleAccion({ item, feds, profile, soloLectura, onClose, onEdit, onChanged, onReclamo }: { onReclamo?: (s: School) => void, item: AgendaItem | null, feds: Fed[], profile: Fed, soloLectura?: boolean, onClose: () => void, onEdit: (item: AgendaItem) => void, onChanged: (msg: string, updated: AgendaItem | null) => void }) {
  const [busy, setBusy] = useState<string>('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [historial, setHistorial] = useState<Awaited<ReturnType<typeof getHistorial>> | null>(null)
  const [verHistorial, setVerHistorial] = useState(false)
  useEffect(() => { if (verHistorial && item && !historial) getHistorial(item.id).then(setHistorial).catch(() => setHistorial([])) }, [verHistorial, item, historial])
  // Fotos del día en Drive (del responsable y de quienes participaron), si ya se ordenaron.
  const [fotos, setFotos] = useState<{ fedId: string, url: string, deAccion: boolean, n: number }[]>([])
  useEffect(() => {
    if (!item) return
    let vivo = true
    fotosDelDia([item.fed_id, ...(item.participantes ?? []).map(p => p.fed_id)], item.fecha, item.id).then(r => vivo && setFotos(r)).catch(() => {})
    return () => { vivo = false }
  }, [item])
  // Dirección de la escuela o jefatura, con enlace a Google Maps (enlace común, sin API ni límites de uso).
  // La fila se reserva desde el principio (con un renglón en blanco) para que la tarjeta no cambie de alto al llegar la dirección.
  const [ubic, setUbic] = useState<Ubicacion | null>(null)
  const [ubicLista, setUbicLista] = useState(false)
  useEffect(() => {
    if (!item || (!item.school_id && !item.lugar)) return
    let vivo = true
    ubicacionDe(item.school_id, item.lugar).then(u => vivo && setUbic(u)).catch(() => {}).finally(() => vivo && setUbicLista(true))
    return () => { vivo = false }
  }, [item])
  if (!item) return <Dialog open={false} />
  const textoDir = ubic ? [ubic.direccion, ubic.localidad ? titleCase(ubic.localidad) : null].filter(Boolean).join(', ') : ''
  const mapa = ubic && (ubic.lat != null && ubic.lon != null ? `${ubic.lat},${ubic.lon}` : textoDir ? `${textoDir}, Buenos Aires, Argentina` : null)
  // En las vistas de solo lectura (administración) el detalle es sólo de consulta, aunque la acción sea propia.
  const own = item.fed_id === profile.id && !soloLectura
  const fed = feds.find(f => f.id === item.fed_id)
  const nombre = (id: string | null) => feds.find(f => f.id === id)?.nombre_completo ?? '—'
  const mio = item.participantes?.find(p => p.fed_id === profile.id)
  async function responderInv(respuesta: 'acepta' | 'rechaza') {
    if (!item) return
    setBusy(respuesta); setError('')
    try {
      await responder(item.id, profile.id, respuesta)
      onChanged(respuesta === 'acepta' ? 'Confirmaste tu participación' : 'Avisaste que no podés participar', { ...item, participantes: item.participantes.map(p => (p.fed_id === profile.id ? { ...p, respuesta } : p)) })
    } catch (e) { setError(errMsg(e)) } finally { setBusy('') }
  }

  // Visita con varias acciones: se ve como una sola (etiquetas juntas, un estado, un bloque por tipo).
  const visita = item?.visita
  // Club o práctica de hoy o anterior todavía sin completar: atajo para cargar inscriptos, participantes y descripción.
  const completar = own && !visita && esTrayecto(item.accion) && item.fecha <= hoyAR() && (item.estado === 'planificada' || item.estado === 'reprogramada')
  async function changeStatus(estado: Estado) {
    if (!item) return
    setBusy(estado); setError('')
    try { await setItemStatus(item.id, profile.id, estado); onChanged(visita ? `Visita marcada como ${statusStyle[estado].label.toLowerCase()}` : `Marcada como ${statusStyle[estado].label.toLowerCase()}`, { ...item, estado, visita: visita?.map(v => ({ ...v, estado })) }) } catch (e) { setError(errMsg(e)) } finally { setBusy('') }
  }
  async function remove(serie = false) {
    if (!item) return
    setBusy(serie ? 'delete-serie' : 'delete'); setError('')
    try { const n = await deleteItem(item.id, profile.id, serie); onChanged(visita ? `Visita eliminada (${n} acciones)` : n > 1 ? `Se eliminaron ${n} acciones de la serie` : 'Acción eliminada', null) } catch (e) { setError(errMsg(e)); setBusy('') }
  }

  const row = (Icon: typeof Clock, label: string, value: React.ReactNode) => value ? <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-dte-gris-claro" /><div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wider text-dte-gris">{label}</dt><dd className="text-sm">{value}</dd></div></div> : null

  return <Dialog open onOpenChange={o => !o && onClose()}>
    <DialogContent className="bg-white sm:max-w-lg">
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2">{(visita ?? [item]).map(v => <ActionChip key={v.id} label={v.accion} />)}<StatusBadge status={item.estado} /></div>
        <DialogTitle className="pt-1 text-lg leading-snug">{itemTitle(item)}</DialogTitle>
        <DialogDescription>{cap(fmt(parse(item.fecha), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · {timeRange(item)}</DialogDescription>
      </DialogHeader>
      <dl className="flex flex-col gap-3 rounded-tile bg-dte-fondo p-4">
        {row(MapPin, 'Lugar', !item.school && item.lugar)}
        {row(Video, 'Reunión virtual', item.enlace && <a href={item.enlace} target="_blank" rel="noopener noreferrer" title={item.enlace} className="inline-flex min-h-11 items-center font-semibold text-dte-petroleo underline underline-offset-2 md:min-h-0">Unirse a la reunión</a>)}
        {row(GraduationCap, item.accion === 'FORMACIÓN INTERNA' ? 'Formación' : 'Modalidad', (item.modalidad || item.rol_formacion || item.dictada_por) && [item.rol_formacion, item.modalidad, item.dictada_por ? `dictada por ${item.dictada_por}` : null].filter(Boolean).join(' · '))}
        {row(SchoolIcon, 'Escuela', item.school && <>CUE {item.school.cue ?? '—'}{schoolPlace(item.school) ? ` · ${schoolPlace(item.school)}` : ''}</>)}
        {row(Navigation, 'Dirección', !ubicLista && (item.school_id || item.lugar) ? <span aria-hidden className="block h-5 w-56 max-w-full anim-brillo rounded bg-dte-linea/70" /> : (textoDir || mapa) && <>{textoDir}{mapa && <> {textoDir ? '· ' : ''}<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapa)}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-dte-petroleo underline underline-offset-2">Cómo llegar</a></>}</>)}
        {!visita && <>
        {row(ClipboardList, 'Sub-acción', item.sub_accion && <>{item.sub_accion}{item.cantidad ? <span className="text-dte-gris"> · {item.cantidad} equipos</span> : null}</>)}
        {row(UserRound, item.encuentros?.length > 1 ? `Encuentros (${item.encuentros.length})` : 'Encuentro', item.encuentros?.length ? <ul className="flex flex-col gap-1.5">{item.encuentros.map(e => <li key={e.id}>{[e.propuesta, e.encuentro_n ? `Encuentro N° ${e.encuentro_n}` : null, e.modalidad].filter(Boolean).join(' · ')}<span className="block text-xs text-dte-gris">{[e.destinatarios, e.inscriptos != null ? `${e.inscriptos} inscriptos` : null, e.asistentes != null ? `${e.asistentes} asistentes` : null].filter(Boolean).join(' · ')}{e.fotos_url && <> · <a href={e.fotos_url} target="_blank" rel="noreferrer" className="text-dte-petroleo underline">fotos</a></>}</span>{e.descripcion && <span className="mt-1 block whitespace-pre-wrap rounded-control bg-white p-2 text-sm"><span className="block text-xs font-semibold uppercase tracking-wider text-dte-gris">Breve descripción</span>{e.descripcion}</span>}</li>)}</ul> : null)}
        {row(Pencil, 'Detalle', item.detalle && <span className="whitespace-pre-wrap">{item.detalle}</span>)}
        </>}
        {row(UserRound, 'Creada por', fed?.nombre_completo ?? '—')}
        {row(Users, 'Acompañado por', item.participantes?.length ? <ul className="flex flex-col gap-0.5">{item.participantes.map(p => <li key={p.fed_id} className="flex items-center gap-1.5">{nombre(p.fed_id)}<span className={`rounded-full px-1.5 text-xs font-semibold ${p.respuesta === 'acepta' ? 'bg-exito-fondo text-exito' : p.respuesta === 'rechaza' ? 'bg-peligro-suave text-peligro' : 'bg-dte-tinte text-dte-gris'}`}>{p.respuesta === 'acepta' ? 'Confirmó' : p.respuesta === 'rechaza' ? 'No puede' : 'Sin respuesta'}</span></li>)}</ul> : null)}
        {row(Repeat, 'Serie', item.serie_id ? 'Forma parte de una serie semanal' : null)}
      </dl>
      {visita && <section aria-label="Acciones de la visita" className="flex flex-col gap-2">{visita.map(v => <div key={v.id} className="rounded-tile border border-dte-linea p-3 text-sm">
        <ActionChip label={v.accion} />
        {(v.sub_accion || !!v.cantidad) && <p className="mt-1.5">{v.sub_accion}{v.cantidad ? <span className="text-dte-gris">{v.sub_accion ? ' · ' : ''}{v.cantidad} equipos</span> : null}</p>}
        {v.encuentros?.map(e => <p key={e.id} className="mt-1 text-dte-gris">{[e.propuesta, e.destinatarios, e.inscriptos != null ? `${e.inscriptos} inscriptos` : null, e.asistentes != null ? `${e.asistentes} asistentes` : null].filter(Boolean).join(' · ')}{e.descripcion && <span className="mt-1 block whitespace-pre-wrap">{e.descripcion}</span>}</p>)}
        {v.detalle && <p className="mt-1 whitespace-pre-wrap text-dte-gris">{v.detalle}</p>}
        {!v.sub_accion && !v.cantidad && !v.detalle && !v.encuentros?.length && <p className="mt-1 text-xs text-dte-gris">Sin datos adicionales.</p>}
      </div>)}</section>}
      {mio && !soloLectura && <div className="flex flex-wrap items-center justify-between gap-2 rounded-tile border border-dte-linea p-3">
        <p className="text-sm"><b>{fed ? firstName(fed.nombre_completo) : 'Un compañero'}</b> te sumó a esta acción. {mio.respuesta === 'acepta' ? 'Confirmaste.' : mio.respuesta === 'rechaza' ? 'Avisaste que no podés.' : '¿Participás?'}</p>
        <div className="flex gap-2"><Button size="sm" variant={mio.respuesta === 'acepta' ? 'default' : 'outline'} disabled={!!busy} onClick={() => responderInv('acepta')} className={mio.respuesta === 'acepta' ? 'bg-dte-petroleo' : ''}>{busy === 'acepta' ? <Loader2 className="animate-spin" /> : <Check data-icon="inline-start" />}Participo</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={() => responderInv('rechaza')} className={mio.respuesta === 'rechaza' ? 'border-peligro text-peligro' : ''}>{busy === 'rechaza' ? <Loader2 className="animate-spin" /> : <X data-icon="inline-start" />}No puedo</Button></div>
      </div>}
      <div>
        {fotos.length > 0 && <div className="mb-2 flex flex-wrap items-center gap-2">{fotos.map(f => <a key={f.fedId} href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-dte-linea px-3 text-xs font-semibold text-dte-petroleo hover:bg-dte-tinte md:min-h-8"><Camera className="size-3.5" />{f.deAccion ? 'Fotos de esta acción' : 'Fotos de ese día'}{fotos.length > 1 || f.fedId !== item.fed_id ? ` · ${firstName(feds.find(x => x.id === f.fedId)?.nombre_completo ?? '')}` : ''}</a>)}</div>}
        <button type="button" onClick={() => setVerHistorial(v => !v)} className="flex items-center gap-1.5 text-xs font-semibold text-dte-gris hover:text-dte-tinta"><History className="size-3.5" />{verHistorial ? 'Ocultar historial' : 'Ver historial de cambios'}</button>
        {verHistorial && <ul className="mt-2 flex flex-col gap-1 text-xs text-dte-gris">{!historial ? <li>Cargando…</li> : !historial.length ? <li>Sin cambios registrados (las acciones importadas de las planillas no tienen historial).</li> : historial.map((h, i) => <li key={i}><b className="text-dte-tinta">{nombre(h.autor_id)}</b> · {{ alta: 'la creó', modificacion: 'la modificó', baja: 'la eliminó', estado: `cambió el estado a ${String(h.datos?.estado ?? '')}` }[h.operacion] ?? h.operacion} · {new Date(h.created_at).toLocaleString('es-AR', { timeZone: ZONA, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</li>)}</ul>}
      </div>
      {own && <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dte-gris">Cambiar estado</p>
        <div className="flex flex-wrap gap-2">{ESTADOS.map(e => <button key={e} disabled={!!busy || item.estado === e} onClick={() => changeStatus(e)} aria-pressed={item.estado === e} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition disabled:cursor-default md:min-h-8 md:text-xs ${item.estado === e ? statusStyle[e].badge : 'border-dte-linea text-dte-gris hover:border-dte-gris-claro hover:text-dte-tinta'}`}>{busy === e ? <Loader2 className="size-3 animate-spin" /> : item.estado === e ? <Check className="size-3" /> : null}{statusStyle[e].label}</button>)}</div>
      </div>}
      {error && <ErrorBox message={error} />}
      {own && confirmDelete ? <div role="alertdialog" aria-label="Confirmar eliminación" ref={el => { const c = el?.closest('[data-slot=dialog-content]'); if (c) requestAnimationFrame(() => c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' })) }} className="flex flex-col gap-3 rounded-tile border border-peligro-borde bg-peligro-fondo p-3">
        <p className="text-sm font-semibold text-peligro">¿Eliminar definitivamente?{visita && <span className="block font-normal">Se elimina la visita completa ({visita.length} acciones). Si sólo una no se hizo, editá la visita y desmarcala.</span>}{item.serie_id && <span className="block font-normal">Es parte de una serie: elegí si borrás sólo esta fecha o también las planificadas que siguen.</span>}</p>
        <div className={`grid gap-2 ${item.serie_id ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <Button variant="outline" disabled={!!busy} onClick={() => setConfirmDelete(false)} className="bg-white">No, volver</Button>
          <Button disabled={!!busy} onClick={() => remove()} className="bg-peligro text-white hover:bg-peligro/90">{busy === 'delete' && <Loader2 className="animate-spin" data-icon="inline-start" />}{item.serie_id ? 'Sólo esta' : 'Sí, eliminar'}</Button>
          {item.serie_id && <Button disabled={!!busy} onClick={() => remove(true)} className="bg-peligro text-white hover:bg-peligro/90">{busy === 'delete-serie' && <Loader2 className="animate-spin" data-icon="inline-start" />}Esta y las siguientes</Button>}
        </div>
      </div>
      : <div className="flex flex-col-reverse gap-2 border-t border-dte-linea pt-4 sm:flex-row sm:items-center sm:justify-between">
        {own ? <Button variant="outline" className="mt-2 self-start border-peligro/60 bg-white text-peligro hover:bg-peligro-fondo hover:text-peligro sm:mt-0 sm:self-auto" onClick={() => setConfirmDelete(true)}><Trash2 data-icon="inline-start" />Eliminar</Button>
          : <p className="text-xs text-dte-gris">{soloLectura ? 'Vista de solo lectura.' : `Sólo ${fed ? firstName(fed.nombre_completo) : 'el FED responsable'} puede modificar esta acción.`}</p>}
        <div className="flex flex-wrap gap-2 sm:justify-end"><Button variant="outline" className="flex-1 sm:flex-none" onClick={onClose}>Cerrar</Button>
          {onReclamo && item.accion === 'CONECTIVIDAD' && item.school && <Button variant="outline" className="order-first basis-full sm:order-none sm:basis-auto sm:flex-none" onClick={() => onReclamo(item.school!)}><Wifi data-icon="inline-start" />Reclamo de conectividad</Button>}
          {own && completar && <Button className="order-first basis-full bg-dte-petroleo hover:bg-dte-petroleo-oscuro sm:order-none sm:basis-auto sm:flex-none" onClick={() => onEdit(item)}><ClipboardCheck data-icon="inline-start" />Completar encuentro</Button>}
          {own && <Button variant={completar ? 'outline' : 'default'} className={`flex-1 sm:flex-none ${completar ? '' : 'bg-dte-petroleo hover:bg-dte-petroleo-oscuro'}`} onClick={() => onEdit(item)}><Pencil data-icon="inline-start" />Editar</Button>}</div>
      </div>}
    </DialogContent>
  </Dialog>
}
