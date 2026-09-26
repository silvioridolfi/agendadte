'use client'

import { useEffect, useState } from 'react'
import { Check, ClipboardList, Clock, Loader2, MapPin, Pencil, School as SchoolIcon, Trash2, UserRound, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ESTADOS, type AgendaItem, type Encuentro, type Estado, type Fed } from '@/lib/agenda'
import { statusStyle, parse, fmt, cap, timeRange, schoolPlace, itemTitle, firstName, setItemStatus, deleteItem, errMsg, ActionChip, StatusBadge, ErrorBox } from '@/components/app/comun'

// =====================================================================

export function DetailDialog({ item, feds, profile, onClose, onEdit, onChanged }: { item: AgendaItem | null, feds: Fed[], profile: Fed, onClose: () => void, onEdit: (item: AgendaItem) => void, onChanged: (msg: string, updated: AgendaItem | null) => void }) {
  const [busy, setBusy] = useState<string>('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => { setError(''); setConfirmDelete(false); setBusy('') }, [item?.id])
  if (!item) return <Dialog open={false} />
  const own = item.fed_id === profile.id
  const fed = feds.find(f => f.id === item.fed_id)

  async function changeStatus(estado: Estado) {
    if (!item) return
    setBusy(estado); setError('')
    try { await setItemStatus(item.id, profile.id, estado); onChanged(`Marcada como ${statusStyle[estado].label.toLowerCase()}`, { ...item, estado }) } catch (e) { setError(errMsg(e)) } finally { setBusy('') }
  }
  async function remove() {
    if (!item) return
    setBusy('delete'); setError('')
    try { await deleteItem(item.id, profile.id); onChanged('Acción eliminada', null) } catch (e) { setError(errMsg(e)); setBusy('') }
  }

  const row = (Icon: typeof Clock, label: string, value: React.ReactNode) => value ? <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-dte-gris-claro" /><div className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-wider text-dte-gris">{label}</dt><dd className="text-sm">{value}</dd></div></div> : null

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
        {row(Users, 'Acompañado por', item.participantes?.length ? item.participantes.map(p => feds.find(f => f.id === p.fed_id)?.nombre_completo ?? '—').join(', ') : null)}
      </dl>
      {own && <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dte-gris">Cambiar estado</p>
        <div className="flex flex-wrap gap-2">{ESTADOS.map(e => <button key={e} disabled={!!busy || item.estado === e} onClick={() => changeStatus(e)} aria-pressed={item.estado === e} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${item.estado === e ? statusStyle[e].badge : 'border-dte-linea text-dte-gris hover:border-dte-gris-claro hover:text-dte-tinta'}`}>{busy === e ? <Loader2 className="size-3 animate-spin" /> : item.estado === e ? <Check className="size-3" /> : null}{statusStyle[e].label}</button>)}</div>
      </div>}
      {error && <ErrorBox message={error} />}
      <div className="flex flex-col-reverse gap-2 border-t border-dte-linea pt-4 sm:flex-row sm:items-center sm:justify-between">
        {own ? (confirmDelete
          ? <div className="flex items-center gap-2"><span className="text-sm text-[#a3164f]">¿Eliminar definitivamente?</span><Button variant="destructive" size="sm" disabled={busy === 'delete'} onClick={remove}>{busy === 'delete' && <Loader2 className="animate-spin" />}Sí, eliminar</Button><Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>No</Button></div>
          : <Button variant="ghost" className="justify-start text-[#a3164f] hover:bg-[#fff1f6] hover:text-[#a3164f]" onClick={() => setConfirmDelete(true)}><Trash2 data-icon="inline-start" />Eliminar</Button>)
          : <p className="text-xs text-dte-gris">Sólo {fed ? firstName(fed.nombre_completo) : 'el FED responsable'} puede modificar esta acción.</p>}
        <div className="flex gap-2 sm:justify-end"><Button variant="outline" className="flex-1 sm:flex-none" onClick={onClose}>Cerrar</Button>{own && <Button className="flex-1 bg-dte-petroleo hover:bg-dte-petroleo-oscuro sm:flex-none" onClick={() => onEdit(item)}><Pencil data-icon="inline-start" />Editar</Button>}</div>
      </div>
    </DialogContent>
  </Dialog>
}
