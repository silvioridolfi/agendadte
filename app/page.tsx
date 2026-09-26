'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, ClipboardList, LayoutDashboard } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { type AgendaItem, type Fed } from '@/lib/agenda'
import { NotificacionesBell } from '@/components/app/notificaciones'
import { ProfileSelect } from '@/components/app/perfil'
import { AgendaView } from '@/components/app/agenda'
import { DetailDialog } from '@/components/app/detalle'
import { CoordinatorView } from '@/components/app/tablero'
import { ItemForm } from '@/components/app/formulario'
import { PROFILE_KEY, iso, initials, firstName, fedColor, getFeds, errMsg, storage, Toast, ItemPreset, toWeekday } from '@/components/app/comun'

export default function Page() {
  const [feds, setFeds] = useState<Fed[] | null>(null)
  const [fedsError, setFedsError] = useState('')
  const [profile, setProfile] = useState<Fed | null>(null)
  const [section, setSection] = useState<'agenda' | 'board'>('agenda')
  // `preset`: valores iniciales (ej.: reunión de equipo con todo el equipo invitado).
  const [editing, setEditing] = useState<{ item: AgendaItem | null, fecha?: string, preset?: ItemPreset } | null>(null)
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState('')

  const loadFeds = useCallback(() => {
    setFedsError(''); setFeds(null)
    getFeds().then(list => {
      setFeds(list)
      // Recordar el último perfil usado en este navegador.
      const saved = storage(() => localStorage.getItem(PROFILE_KEY))
      const fed = saved ? list.find(f => f.id === saved) : undefined
      if (fed) setProfile(fed)
    }).catch(e => setFedsError(errMsg(e)))
  }, [])
  useEffect(loadFeds, [loadFeds])

  const choose = (fed: Fed | null) => {
    setProfile(fed); setSection('agenda')
    storage(() => (fed ? localStorage.setItem(PROFILE_KEY, fed.id) : localStorage.removeItem(PROFILE_KEY)))
  }
  const changed = (message: string) => { setReloadKey(k => k + 1); setToast(message) }
  const hideToast = useCallback(() => setToast(''), [])

  if (!profile) return <ProfileSelect feds={feds} error={fedsError} onRetry={loadFeds} onSelect={choose} />

  return <div className="min-h-screen bg-dte-fondo text-dte-tinta">
    <header className="sticky top-0 z-40 border-b border-dte-linea bg-white/95 backdrop-blur">
      <div className="bg-dte-degradado h-1" />
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-dte-degradado text-white"><ClipboardList className="size-5" /></div>
          <div className="hidden min-w-0 sm:block"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-dte-magenta">Equipo FED · DTE</p><h1 className="truncate text-base font-bold leading-tight">Agenda Territorial</h1></div>
        </div>
        <nav aria-label="Secciones" className="flex rounded-full border border-dte-linea bg-dte-fondo p-1">
          {([['agenda', 'Mi agenda', CalendarDays], ['board', 'Tablero', LayoutDashboard]] as const).map(([key, label, Icon]) =>
            <button key={key} onClick={() => setSection(key)} aria-current={section === key ? 'page' : undefined} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${section === key ? 'bg-dte-petroleo text-white shadow-sm' : 'text-dte-gris hover:text-dte-tinta'}`}><Icon className="size-4" />{label}</button>)}
        </nav>
        <div className="flex items-center gap-1">
        <NotificacionesBell profile={profile} feds={feds ?? []} reloadKey={reloadKey} onOpen={setSelected} />
        <button onClick={() => choose(null)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-left transition hover:bg-dte-fondo" aria-label={`Perfil: ${profile.nombre_completo}. Cambiar de perfil`}>
          <Avatar className="size-9"><AvatarFallback className={`${fedColor(feds ?? [], profile.id)} text-xs font-bold text-dte-petroleo-oscuro`}>{initials(profile.nombre_completo)}</AvatarFallback></Avatar>
          <span className="hidden md:block"><span className="block text-sm font-semibold leading-tight">{profile.nombre_completo}</span><span className="block text-[11px] text-dte-gris">{profile.rol === 'coordinacion' ? 'Coordinación · cambiar' : 'Cambiar de perfil'}</span></span>
          <ChevronDown className="hidden size-4 text-dte-gris md:block" />
        </button>
        </div>
      </div>
    </header>

    {section === 'agenda'
      ? <AgendaView fed={profile} reloadKey={reloadKey} onNew={fecha => setEditing({ item: null, fecha })} onSelect={setSelected} />
      : <CoordinatorView feds={(feds ?? []).filter(f => f.rol !== 'coordinacion')} todos={feds ?? []} reloadKey={reloadKey} onSelect={setSelected}
          onNuevaReunion={profile.rol !== 'coordinacion' ? undefined : () => setEditing({ item: null, fecha: iso(toWeekday(new Date())), preset: { accion: 'REUNIÓN', sub_accion: 'Reunión de equipo (CED/FED)', participantes: (feds ?? []).filter(f => f.id !== profile.id).map(f => f.id) } })} />}

    <DetailDialog item={selected} feds={feds ?? []} profile={profile} onClose={() => setSelected(null)}
      onEdit={item => { setSelected(null); setEditing({ item }) }}
      onChanged={(msg, updated) => { changed(msg); setSelected(updated) }} />

    <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-lg">{editing?.item ? 'Editar acción' : 'Nueva acción'}</DialogTitle><DialogDescription>{editing?.item ? 'Actualizá los datos de la acción.' : `Se agrega a la agenda de ${firstName(profile.nombre_completo)}.`}</DialogDescription></DialogHeader>
        {editing && <ItemForm key={editing.item?.id ?? `new-${editing.fecha}`} fed={profile} feds={feds ?? []} item={editing.item} defaultFecha={editing.fecha} preset={editing.preset} onCancel={() => setEditing(null)} onSaved={() => { changed(editing.item ? 'Acción actualizada' : editing.preset?.participantes?.length ? 'Reunión creada y notificada al equipo' : 'Acción agregada a tu agenda'); setEditing(null) }} />}
      </DialogContent>
    </Dialog>

    {toast && <Toast message={toast} onDone={hideToast} />}
  </div>
}
