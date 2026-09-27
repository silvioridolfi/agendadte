'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, CloudUpload, Eye, LayoutDashboard, Loader2, Plus, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { esTrayecto, type AgendaItem, type Fed, type Trayecto } from '@/lib/agenda'
import { NotificacionesBell } from '@/components/app/notificaciones'
import { CambiarPassword, Ingreso, UsuariosView } from '@/components/app/acceso'
import type { Sesion } from '@/app/actions'
import { AgendaView } from '@/components/app/agenda'
import { DetailDialog } from '@/components/app/detalle'
import { CoordinatorView } from '@/components/app/tablero'
import { ItemForm } from '@/components/app/formulario'
import { MenuPerfil, MiPerfilView } from '@/components/app/miperfil'
import { RegistroEncuentro } from '@/components/app/encuentro'
import { pendientes, sincronizarPendientes } from '@/components/app/offline'
import { limpiarCache } from '@/components/app/offline'
import { ConteoFotosProvider } from '@/components/app/fotosconteo'
import { iso, firstName, getFeds, miSesion, salir, Toast, PieInstitucional, ItemPreset, toWeekday, storage } from '@/components/app/comun'

// Botón de la barra inferior mobile (área táctil de 56px de alto).
function BarraBoton({ activo, onClick, icono: Icono, label }: { activo: boolean, onClick: () => void, icono: LucideIcon, label: string }) {
  return <button type="button" onClick={onClick} aria-current={activo ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition ${activo ? 'text-dte-petroleo' : 'text-dte-gris hover:text-dte-tinta'}`}>
    <span className={`flex h-7 w-12 items-center justify-center rounded-full transition ${activo ? 'bg-dte-petroleo/10' : ''}`}><Icono className="size-5" /></span>{label}
  </button>
}

// Título del formulario según desde dónde se abre (agenda general o sección de clubes/prácticas).
function tituloForm(e: { item: AgendaItem | null, preset?: ItemPreset } | null) {
  const club = e?.preset?.accion === 'PRÁCTICAS PROFESIONALIZANTES' || e?.item?.accion === 'PRÁCTICAS PROFESIONALIZANTES' ? 'práctica' : 'club'
  if (e?.item) return esTrayecto(e.item.accion) ? `Editar encuentro de ${club === 'club' ? 'club' : 'práctica'}` : 'Editar acción'
  if (e?.preset?.modo === 'nuevo') return club === 'club' ? 'Nuevo club' : 'Nueva práctica'
  if (e?.preset?.modo === 'encuentro') return `Registrar encuentro de ${club === 'club' ? 'club' : 'práctica'}`
  return 'Nueva acción'
}

const SECCIONES = ['agenda', 'board', 'perfil', 'usuarios'] as const
type Seccion = typeof SECCIONES[number]
const SECCION_KEY = 'agenda-territorial:seccion'

export default function Page() {
  // Sesión: undefined = verificando; null = sin sesión (pantalla de ingreso).
  const [sesion, setSesion] = useState<Sesion | null | undefined>(undefined)
  const [feds, setFeds] = useState<Fed[] | null>(null)
  const profile = sesion?.fed ?? null
  const setProfile = (f: Fed) => setSesion(s => (s ? { ...s, fed: f } : s))
  const [section, setSection] = useState<Seccion>('agenda')
  // La sección abierta se recuerda en la pestaña del navegador: al recargar se vuelve al mismo lugar.
  useEffect(() => { if (sesion) storage(() => sessionStorage.setItem(SECCION_KEY, section)) }, [section, sesion])
  const [cambiandoPass, setCambiandoPass] = useState(false)
  // Administración: ver el tablero del equipo completo o la agenda de otro integrante (solo lectura).
  const [vista, setVista] = useState<{ tipo: 'equipo' } | { tipo: 'fed', fed: Fed } | null>(null)
  // La vista del equipo completo es sólo el Tablero: al ir a otra sección se vuelve a los datos propios.
  useEffect(() => { if (vista?.tipo === 'equipo' && section !== 'board') setVista(null) }, [vista, section])
  // `preset`: valores iniciales (ej.: reunión de equipo con todo el equipo invitado).
  const [editing, setEditing] = useState<{ item: AgendaItem | null, fecha?: string, preset?: ItemPreset } | null>(null)
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState('')

  const cargarSesion = useCallback(() => {
    miSesion().then(s => {
      setSesion(s)
      // Coordinación entra al Tablero (vistazo general del equipo); cada FED, a su agenda.
      if (s) { const previa = storage(() => sessionStorage.getItem(SECCION_KEY)) as Seccion | null; setSection(previa && SECCIONES.includes(previa) ? previa : s.fed.rol === 'coordinacion' ? 'board' : 'agenda'); if (!s.debeCambiar) getFeds().then(setFeds).catch(() => setFeds([])) }
    }).catch(() => setSesion(null))
  }, [])
  useEffect(() => {
    cargarSesion()
    const vencida = () => setSesion(null)
    window.addEventListener('agenda-sesion-vencida', vencida)
    return () => window.removeEventListener('agenda-sesion-vencida', vencida)
  }, [cargarSesion])
  const cerrarSesion = async () => { try { await salir() } finally { storage(() => sessionStorage.removeItem(SECCION_KEY)); limpiarCache(); setSesion(null); setVista(null); setFeds(null); setEditing(null); setSelected(null) } }
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

  if (sesion === undefined) return <div className="flex min-h-dvh items-center justify-center bg-dte-fondo" aria-busy="true"><Loader2 className="size-8 animate-spin text-dte-petroleo" aria-label="Cargando" /></div>
  if (!sesion || !profile) return <Ingreso onIngreso={cargarSesion} />
  if (sesion.debeCambiar) return <CambiarPassword obligatorio onListo={() => { setToast('Listo: ya tenés tu contraseña propia'); cargarSesion() }} />

  return <ConteoFotosProvider reloadKey={reloadKey}><div className="flex min-h-dvh flex-col bg-dte-fondo text-dte-tinta">
    <header className="sticky top-0 z-header pt-safe border-b border-dte-linea bg-white/95 backdrop-blur">
      <div className="bg-dte-degradado h-1" />
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/brand/dte1-160.png" alt="DTE Región 1" width={40} height={40} className="size-10 shrink-0" />
          <div className="min-w-0"><p className="hidden text-xs font-bold uppercase tracking-[0.2em] text-dte-magenta sm:block">Equipo FED · DTE</p><h1 className="truncate text-base font-bold leading-tight">Agenda Territorial</h1></div>
        </div>
        {/* Navegación principal en desktop; en mobile va en la barra inferior. */}
        <nav aria-label="Secciones" className="hidden rounded-full border border-dte-linea bg-dte-fondo p-1 md:flex">
          {([['agenda', 'Mi agenda', CalendarDays], ['board', 'Tablero', LayoutDashboard]] as const).map(([key, label, Icon]) =>
            <button key={key} onClick={() => setSection(key)} aria-current={section === key ? 'page' : undefined} className={`flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${section === key ? 'bg-dte-petroleo text-white shadow-sm' : 'text-dte-gris hover:text-dte-tinta'}`}><Icon className="size-4" />{label}</button>)}
        </nav>
        <div className="flex shrink-0 items-center gap-1">
        {enCola > 0 && <span title="Cargadas sin conexión: se envían al volver la señal" className="flex items-center gap-1 rounded-full bg-aviso-fondo-fuerte px-2.5 py-1 text-xs font-semibold text-aviso-fuerte"><CloudUpload className="size-3.5" />{enCola} sin enviar</span>}
        <NotificacionesBell profile={profile} feds={feds ?? []} reloadKey={reloadKey} onOpen={setSelected} />
        <MenuPerfil profile={profile} feds={feds ?? []} esAdmin={sesion.esAdmin} onPerfil={() => { setVista(null); setSection('perfil') }} onUsuarios={() => { setVista(null); setSection('usuarios') }} onEquipo={() => { setVista({ tipo: 'equipo' }); setSection('board') }} onPassword={() => setCambiandoPass(true)} onSalir={cerrarSesion} />
        </div>
      </div>
    </header>

    {vista && <div role="status" className="sticky top-[calc(4.25rem+env(safe-area-inset-top,0px))] z-fab border-b border-aviso-borde bg-aviso-fondo-fuerte px-4 py-2 text-sm text-aviso-fuerte">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 lg:px-6"><span className="flex items-center gap-1.5"><Eye className="size-4 shrink-0" aria-hidden /><span>{vista.tipo === 'equipo' ? <>Estás viendo el <b>tablero del equipo completo</b></> : <>Estás viendo la agenda de <b>{vista.fed.nombre_completo}</b></>} · Solo lectura</span></span>
        <button type="button" onClick={() => { setVista(null); setSection('agenda') }} className="min-h-10 rounded-full bg-white px-3 text-xs font-semibold text-dte-petroleo shadow-xs hover:bg-dte-tinte md:min-h-8">Volver a mi agenda</button></div>
    </div>}
    {section === 'usuarios' && sesion.esAdmin ? <UsuariosView miEmail={sesion.email} onVer={id => { const f = feds?.find(x => x.id === id); if (f) { setVista({ tipo: 'fed', fed: f }); setSection('agenda') } }} />
      : section === 'perfil' && profile.rol === 'fed'
      ? <MiPerfilView key={profile.id} fed={profile} feds={feds ?? []} onSaved={f => { setProfile(f); setFeds(l => l && l.map(x => (x.id === f.id ? f : x))); setToast('Se guardó tu perfil'); setSection('agenda') }} />
      : vista?.tipo === 'fed'
      ? (section === 'agenda'
        ? <AgendaView key={vista.fed.id} fed={vista.fed} feds={feds ?? []} reloadKey={reloadKey} onSelect={setSelected} />
        : <CoordinatorView key={`ver-${vista.fed.id}`} feds={[vista.fed]} todos={feds ?? []} reloadKey={reloadKey} onSelect={setSelected} propio={vista.fed.rol === 'fed' ? vista.fed : undefined} soloLectura />)
      : vista?.tipo === 'equipo' && section === 'board'
      ? <CoordinatorView key="equipo" feds={(feds ?? []).filter(f => f.rol !== 'coordinacion')} todos={feds ?? []} reloadKey={reloadKey} onSelect={setSelected} soloLectura />
      : section === 'agenda'
      ? <AgendaView fed={profile} feds={feds ?? []} reloadKey={reloadKey} onNew={fecha => setEditing({ item: null, fecha })} onSelect={setSelected} onCambio={changed} />
      : <CoordinatorView key={profile.id} feds={profile.rol === 'fed' ? [profile] : (feds ?? []).filter(f => f.rol !== 'coordinacion')} todos={feds ?? []} reloadKey={reloadKey} onSelect={setSelected}
          propio={profile.rol === 'fed' ? profile : undefined} onNuevaAccion={preset => setEditing({ item: null, fecha: iso(toWeekday(new Date())), preset })}
          onNuevaReunion={profile.rol !== 'coordinacion' ? undefined : () => setEditing({ item: null, fecha: iso(toWeekday(new Date())), preset: { accion: 'REUNIÓN', sub_accion: 'Reunión de equipo (CED/FED)', participantes: (feds ?? []).filter(f => f.id !== profile.id).map(f => f.id) } })} />}

    <DetailDialog item={selected} feds={feds ?? []} profile={profile} soloLectura={!!vista} onClose={() => setSelected(null)}
      onEdit={item => { setSelected(null); setEditing({ item }) }}
      onChanged={(msg, updated) => { changed(msg); setSelected(updated) }} />

    <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
      <DialogContent className="bg-white sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-lg">{tituloForm(editing)}</DialogTitle><DialogDescription>{editing?.item ? 'Actualizá los datos de la acción.' : editing?.preset?.modo === 'nuevo' ? 'Con fecha, el primer encuentro se agrega a tu agenda; si todavía no la tenés, queda “por iniciar”.' : editing?.preset?.modo === 'encuentro' ? 'Se agrega a tu agenda como acción realizada (o planificada, si la fecha todavía no llegó).' : `Se agrega a la agenda de ${firstName(profile.nombre_completo)}.`}</DialogDescription></DialogHeader>
        {editing?.preset?.modo === 'encuentro' && esTrayecto(editing.preset.accion ?? null) && !editing.item
          ? <RegistroEncuentro fed={profile} tipo={editing.preset.accion as Trayecto} clubId={editing.preset.club_id} onCancel={() => setEditing(null)} onSaved={msg => { changed(msg); setEditing(null) }} />
          : editing && <ItemForm key={editing.item?.id ?? `new-${editing.fecha}`} fed={profile} feds={feds ?? []} item={editing.item} defaultFecha={editing.fecha} preset={editing.preset} onCancel={() => setEditing(null)} onSaved={({ creadas, mensaje, offline }) => { changed(mensaje ? mensaje : offline ? 'Sin conexión: la acción quedó guardada en este dispositivo y se envía al volver la señal' : editing.item ? 'Acción actualizada' : creadas > 1 ? `Se crearon ${creadas} acciones de la serie` : editing.preset?.participantes?.length ? 'Reunión creada y notificada al equipo' : 'Acción agregada a tu agenda'); setEditing(null) }} />}
      </DialogContent>
    </Dialog>

    <PieInstitucional />
    {/* Barra inferior (mobile): navegación a una mano y acceso directo a Nueva acción. */}
    <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-header border-t border-dte-linea bg-white/95 pb-safe backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3 items-center">
        <BarraBoton activo={section === 'agenda'} onClick={() => setSection('agenda')} icono={CalendarDays} label="Mi agenda" />
        <div className="flex justify-center">{vista ? <span /> : <button type="button" onClick={() => setEditing({ item: null, fecha: iso(toWeekday(new Date())) })} aria-label="Nueva acción" className="-mt-5 flex size-14 items-center justify-center rounded-full bg-dte-magenta text-white shadow-lg ring-4 ring-white transition active:scale-95 hover:bg-dte-magenta-oscuro"><Plus className="size-6" /></button>}</div>
        <BarraBoton activo={section === 'board'} onClick={() => setSection('board')} icono={LayoutDashboard} label="Tablero" />
      </div>
    </nav>

    <Dialog open={cambiandoPass} onOpenChange={setCambiandoPass}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader><DialogTitle className="text-lg">Cambiar contraseña</DialogTitle><DialogDescription>Elegí una contraseña nueva para ingresar a la agenda.</DialogDescription></DialogHeader>
        {cambiandoPass && <CambiarPassword obligatorio={false} onCancelar={() => setCambiandoPass(false)} onListo={() => { setCambiandoPass(false); setToast('Se cambió tu contraseña') }} />}
      </DialogContent>
    </Dialog>
    {toast && <Toast message={toast} onDone={hideToast} />}
  </div></ConteoFotosProvider>
}
