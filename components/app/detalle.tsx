'use client'

import { useEffect, useState } from 'react'
import { Check, ClipboardList, Clock, History, Loader2, MapPin, Pencil, Repeat, School as SchoolIcon, Trash2, UserRound, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ESTADOS, type AgendaItem, type Encuentro, type Estado, type Fed } from '@/lib/agenda'
import { statusStyle, parse, fmt, cap, timeRange, schoolPlace, itemTitle, firstName, setItemStatus, deleteItem, responder, getHistorial, errMsg, ActionChip, StatusBadge, ErrorBox } from '@/components/app/comun'

// =====================================================================

export function DetailDialog({ item, feds, profile, onClose, onEdit, onChanged }: { item: AgendaItem | null, feds: Fed[], profile: Fed, onClose: () => void, onEdit: (item: AgendaItem) => void, onChanged: (msg: string, updated: AgendaItem | null) => void }) {
  const [busy, setBusy] = useState<string>('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [historial, setHistorial] = useState<Awaited<ReturnType<typeof getHistorial>> | null>(null)
  const [verHistorial, setVerHistorial] = useState(false)
  useEffect(() => { setError(''); setConfirmDelete(false); setBusy(''); setHistorial(null); setVerHistorial(false) }, [item?.id])
  useEffect(() => { if (verHistorial && item && !historial) getHistorial(item.id).then(setHistorial).catch(() => setHistorial([])) }, [verHistorial, item, historial])
  if (!item) return <Dialog open={false} />
  const own = item.fed_id === profile.id
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

  async function changeStatus(estado: Estado) {
    if (!item) return
    setBusy(estado); setError('')
    try { await setItemStatus(item.id, profile.id, estado); onChanged(`Marcada como ${statusStyle[estado].label.toLowerCase()}`, { ...item, estado }) } catch (e) { setError(errMsg(e)) } finally { setBusy('') }
  }
  async function remove(serie = false) {
    if (!item) return
    setBusy(serie ? 'delete-serie' : 'delete'); setError('')
    try { const n = await deleteItem(item.id, profile.id, serie); onChanged(n > 1 ? `Se eliminaron ${n} acciones de la serie` : 'Acción eliminada', null) } catch (e) { setError(errMsg(e)); setBusy('') }
  }

  const row = (Icon: typeof Clock, label: string, value: React.ReactNode) => value ? <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-dte-gris-claro" /><div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wider text-dte-gris">{label}</dt><dd className="text-sm">{value}</dd></div></div> : null

  return <Dialog open onOpenChange={o => !o && onClose()}>
    <DialogContent className="bg-white sm:max-w-lg">
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2"><ActionChip label={item.accion} /><StatusBadge status={item.estado} /></div>
        <DialogTitle className="pt-1 text-lg leading-snug">{itemTitle(item)}</DialogTitle>
        <DialogDescription>{cap(fmt(parse(item.fecha), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · {timeRange(item)}</DialogDescription>
      </DialogHeader>
      <dl className="flex flex-col gap-3 rounded-xl bg-dte-fondo p-4">
        {row(MapPin, 'Lugar', !item.school && item.lugar)}
        {row(SchoolIcon, 'Escuela', item.school && <>CUE {item.school.cue ?? '—'}{schoolPlace(item.school) ? ` · ${schoolPlace(item.school)}` : ''}</>)}
        {row(ClipboardList, 'Sub-acción', item.sub_accion && <>{item.sub_accion}{item.cantidad ? <span className="text-dte-gris"> · {item.cantidad} equipos</span> : null}</>)}
        {row(UserRound, item.encuentros?.length > 1 ? `Encuentros (${item.encuentros.length})` : 'Encuentro', item.encuentros?.length ? <ul className="flex flex-col gap-1.5">{item.encuentros.map(e => <li key={e.id}>{[e.propuesta, e.encuentro_n ? `Encuentro N° ${e.encuentro_n}` : null, e.modalidad].filter(Boolean).join(' · ')}<span className="block text-xs text-dte-gris">{[e.destinatarios, e.inscriptos != null ? `${e.inscriptos} inscriptos` : null, e.asistentes != null ? `${e.asistentes} asistentes` : null].filter(Boolean).join(' · ')}{e.fotos_url && <> · <a href={e.fotos_url} target="_blank" rel="noreferrer" className="text-dte-petroleo underline">fotos</a></>}</span></li>)}</ul> : null)}
        {row(Pencil, 'Detalle', item.detalle && <span className="whitespace-pre-wrap">{item.detalle}</span>)}
        {row(UserRound, 'Creada por', fed?.nombre_completo ?? '—')}
        {row(Users, 'Acompañado por', item.participantes?.length ? <ul className="flex flex-col gap-0.5">{item.participantes.map(p => <li key={p.fed_id} className="flex items-center gap-1.5">{nombre(p.fed_id)}<span className={`rounded-full px-1.5 text-xs font-semibold ${p.respuesta === 'acepta' ? 'bg-exito-fondo text-exito' : p.respuesta === 'rechaza' ? 'bg-peligro-suave text-peligro' : 'bg-dte-tinte text-dte-gris'}`}>{p.respuesta === 'acepta' ? 'Confirmó' : p.respuesta === 'rechaza' ? 'No puede' : 'Sin respuesta'}</span></li>)}</ul> : null)}
        {row(Repeat, 'Serie', item.serie_id ? 'Forma parte de una serie semanal' : null)}
      </dl>
      {mio && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dte-linea p-3">
        <p className="text-sm"><b>{fed ? firstName(fed.nombre_completo) : 'Un compañero'}</b> te sumó a esta acción. {mio.respuesta === 'acepta' ? 'Confirmaste.' : mio.respuesta === 'rechaza' ? 'Avisaste que no podés.' : '¿Participás?'}</p>
        <div className="flex gap-2"><Button size="sm" variant={mio.respuesta === 'acepta' ? 'default' : 'outline'} disabled={!!busy} onClick={() => responderInv('acepta')} className={mio.respuesta === 'acepta' ? 'bg-dte-petroleo' : ''}>{busy === 'acepta' ? <Loader2 className="animate-spin" /> : <Check data-icon="inline-start" />}Participo</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={() => responderInv('rechaza')} className={mio.respuesta === 'rechaza' ? 'border-peligro text-peligro' : ''}>{busy === 'rechaza' ? <Loader2 className="animate-spin" /> : <X data-icon="inline-start" />}No puedo</Button></div>
      </div>}
      <div>
        <button type="button" onClick={() => setVerHistorial(v => !v)} className="flex items-center gap-1.5 text-xs font-semibold text-dte-gris hover:text-dte-tinta"><History className="size-3.5" />{verHistorial ? 'Ocultar historial' : 'Ver historial de cambios'}</button>
        {verHistorial && <ul className="mt-2 flex flex-col gap-1 text-xs text-dte-gris">{!historial ? <li>Cargando…</li> : !historial.length ? <li>Sin cambios registrados (las acciones importadas de las planillas no tienen historial).</li> : historial.map((h, i) => <li key={i}><b className="text-dte-tinta">{nombre(h.autor_id)}</b> · {{ alta: 'la creó', modificacion: 'la modificó', baja: 'la eliminó', estado: `cambió el estado a ${String(h.datos?.estado ?? '')}` }[h.operacion] ?? h.operacion} · {new Date(h.created_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</li>)}</ul>}
      </div>
      {own && <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dte-gris">Cambiar estado</p>
        <div className="flex flex-wrap gap-2">{ESTADOS.map(e => <button key={e} disabled={!!busy || item.estado === e} onClick={() => changeStatus(e)} aria-pressed={item.estado === e} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${item.estado === e ? statusStyle[e].badge : 'border-dte-linea text-dte-gris hover:border-dte-gris-claro hover:text-dte-tinta'}`}>{busy === e ? <Loader2 className="size-3 animate-spin" /> : item.estado === e ? <Check className="size-3" /> : null}{statusStyle[e].label}</button>)}</div>
      </div>}
      {error && <ErrorBox message={error} />}
      <div className="flex flex-col-reverse gap-2 border-t border-dte-linea pt-4 sm:flex-row sm:items-center sm:justify-between">
        {own ? (confirmDelete
          ? <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-peligro">¿Eliminar definitivamente?</span><Button variant="destructive" size="sm" disabled={!!busy} onClick={() => remove()}>{busy === 'delete' && <Loader2 className="animate-spin" />}{item.serie_id ? 'Sólo esta' : 'Sí, eliminar'}</Button>{item.serie_id && <Button variant="destructive" size="sm" disabled={!!busy} onClick={() => remove(true)}>{busy === 'delete-serie' && <Loader2 className="animate-spin" />}Esta y las siguientes</Button>}<Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>No</Button></div>
          : <Button variant="ghost" className="justify-start text-peligro hover:bg-peligro-fondo hover:text-peligro" onClick={() => setConfirmDelete(true)}><Trash2 data-icon="inline-start" />Eliminar</Button>)
          : <p className="text-xs text-dte-gris">Sólo {fed ? firstName(fed.nombre_completo) : 'el FED responsable'} puede modificar esta acción.</p>}
        <div className="flex gap-2 sm:justify-end"><Button variant="outline" className="flex-1 sm:flex-none" onClick={onClose}>Cerrar</Button>{own && <Button className="flex-1 bg-dte-petroleo hover:bg-dte-petroleo-oscuro sm:flex-none" onClick={() => onEdit(item)}><Pencil data-icon="inline-start" />Editar</Button>}</div>
      </div>
    </DialogContent>
  </Dialog>
}
