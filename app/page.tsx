'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, CloudUpload, LayoutDashboard } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { type AgendaItem, type Fed } from '@/lib/agenda'
import { NotificacionesBell } from '@/components/app/notificaciones'
import { ProfileSelect } from '@/components/app/perfil'
import { AgendaView } from '@/components/app/agenda'
import { DetailDialog } from '@/components/app/detalle'
import { CoordinatorView } from '@/components/app/tablero'
import { ItemForm } from '@/components/app/formulario'
import { pendientes, sincronizarPendientes } from '@/components/app/offline'
import { PROFILE_KEY, iso, initials, firstName, fedColor, getFeds, errMsg, storage, Toast, PieInstitucional, ItemPreset, toWeekday } from '@/components/app/comun'

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

  // Acciones cargadas sin conexión: se envían al volver la señal (y al abrir la app).
  const [enCola, setEnCola] = useState(0)
  useEffect(() => {
    const contar = () => setEnCola(pendientes())
    const enviar = () => sincronizarPendientes().then(({ enviadas, fallidas }) => {
      contar()
      if (enviadas) { setReloadKey(k => k + 1); setToast(`Se enviaron ${enviadas} ${enviadas === 1 ? 'acción cargada' : 'acciones cargadas'} sin conexión`) }
      if (fallidas.length) setToast(`No se pudo enviar: ${fallidas[0]}`)
    })
    contar(); enviar()
    window.addEventListener('online', enviar); window.addEventListener('agenda-pendientes', contar)
    return () => { window.removeEventListener('online', enviar); window.removeEventListener('agenda-pendientes', contar) }
  }, [])

  if (!profile) return <ProfileSelect feds={feds} error={fedsError} onRetry={loadFeds} onSelect={choose} />

  return <div className="flex min-h-screen flex-col bg-dte-fondo text-dte-tinta">
    <header className="sticky top-0 z-40 border-b border-dte-linea bg-white/95 backdrop-blur">
      <div className="bg-dte-degradado h-1" />
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/brand/dte1-160.png" alt="DTE Región 1" width={40} height={40} className="size-10 shrink-0" />
          <div className="hidden min-w-0 sm:block"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-dte-magenta">Equipo FED · DTE</p><h1 className="truncate text-base font-bold leading-tight">Agenda Territorial</h1></div>
        </div>
        <nav aria-label="Secciones" className="flex rounded-full border border-dte-linea bg-dte-fondo p-1">
          {([['agenda', 'Mi agenda', CalendarDays], ['board', 'Tablero', LayoutDashboard]] as const).map(([key, label, Icon]) =>
            <button key={key} onClick={() => setSection(key)} aria-current={section === key ? 'page' : undefined} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${section === key ? 'bg-dte-petroleo text-white shadow-sm' : 'text-dte-gris hover:text-dte-tinta'}`}><Icon className="size-4" />{label}</button>)}
        </nav>
        <div className="flex items-center gap-1">
        {enCola > 0 && <span title="Cargadas sin conexión: se envían al volver la señal" className="flex items-center gap-1 rounded-full bg-aviso-fondo-fuerte px-2.5 py-1 text-xs font-semibold text-aviso-fuerte"><CloudUpload className="size-3.5" />{enCola} sin enviar</span>}
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
      ? <AgendaView fed={profile} feds={feds ?? []} reloadKey={reloadKey} onNew={fecha => setEditing({ item: null, fecha })} onSelect={setSelected} />
      : <CoordinatorView feds={(feds ?? []).filter(f => f.rol !== 'coordinacion')} todos={feds ?? []} reloadKey={reloadKey} onSelect={setSelected}
          autorId={profile.rol === 'coordinacion' ? profile.id : undefined} onChanged={msg => { setToast(msg); loadFeds() }}
          onNuevaReunion={profile.rol !== 'coordinacion' ? undefined : () => setEditing({ item: null, fecha: iso(toWeekday(new Date())), preset: { accion: 'REUNIÓN', sub_accion: 'Reunión de equipo (CED/FED)', participantes: (feds ?? []).filter(f => f.id !== profile.id).map(f => f.id) } })} />}

    <DetailDialog item={selected} feds={feds ?? []} profile={profile} onClose={() => setSelected(null)}
      onEdit={item => { setSelected(null); setEditing({ item }) }}
      onChanged={(msg, updated) => { changed(msg); setSelected(updated) }} />

    <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-lg">{editing?.item ? 'Editar acción' : 'Nueva acción'}</DialogTitle><DialogDescription>{editing?.item ? 'Actualizá los datos de la acción.' : `Se agrega a la agenda de ${firstName(profile.nombre_completo)}.`}</DialogDescription></DialogHeader>
        {editing && <ItemForm key={editing.item?.id ?? `new-${editing.fecha}`} fed={profile} feds={feds ?? []} item={editing.item} defaultFecha={editing.fecha} preset={editing.preset} onCancel={() => setEditing(null)} onSaved={({ creadas, offline }) => { changed(offline ? 'Sin conexión: la acción quedó guardada en este dispositivo y se envía al volver la señal' : editing.item ? 'Acción actualizada' : creadas > 1 ? `Se crearon ${creadas} acciones de la serie` : editing.preset?.participantes?.length ? 'Reunión creada y notificada al equipo' : 'Acción agregada a tu agenda'); setEditing(null) }} />}
      </DialogContent>
    </Dialog>

    <PieInstitucional />
    {toast && <Toast message={toast} onDone={hideToast} />}
  </div>
}
