'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, CloudUpload, Eye, LayoutDashboard, Loader2, Plus, Search, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CON_ENCUENTRO, esTrayecto, type AgendaItem, type Fed, type School, type Trayecto } from '@/lib/agenda'
import { AvisosBanner, NotificacionesBell, NotificacionesProvider } from '@/components/app/notificaciones'
import { CambiarPassword, Ingreso, UsuariosView } from '@/components/app/acceso'
import { FeriadosView } from '@/components/app/feriados'
import { PveEquipoView, SeccionPve } from '@/components/app/pve'
import { SeccionFotos } from '@/components/app/fotos'
import { EventosPanel, RECARGAR } from '@/components/app/eventos'
import type { Sesion } from '@/app/actions'
import { AgendaView } from '@/components/app/agenda'
import { DetailDialog } from '@/components/app/detalle'
import { CoordinatorView } from '@/components/app/tablero'
import { ItemForm } from '@/components/app/formulario'
import { BuscadorEscuelas } from '@/components/app/escuelas'
import { ReclamoConectividad } from '@/components/app/reclamo'
import { RegistroReclamos } from '@/components/app/registroreclamos'
import { MenuPerfil, MiPerfilView } from '@/components/app/miperfil'
import { AyudaView, useNovedadesNuevas } from '@/components/app/ayuda'
import type { Destacados } from '@/lib/destacados'
import type { Rol } from '@/lib/ayuda/temas'
import { RegistroEncuentro } from '@/components/app/encuentro'
import { pendientes, sincronizarPendientes } from '@/components/app/offline'
import { limpiarCache } from '@/components/app/offline'
import { ConteoFotosProvider } from '@/components/app/fotosconteo'
import { cambiarEstadoVarias, errMsg, DestacadosCtx, type AccionAviso, iso, firstName, getFeds, miSesion, salir, Toast, PieInstitucional, ItemPreset, toWeekday, storage, VolverArriba } from '@/components/app/comun'
import { fechaHoyAR } from '@/lib/hora'

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

const SECCIONES = ['agenda', 'board', 'perfil', 'fotos', 'mispve', 'usuarios', 'feriados', 'pve', 'reclamos', 'ayuda'] as const
type Seccion = typeof SECCIONES[number]
const SECCION_KEY = 'agenda-territorial:seccion'

export default function Page() {
  // Sesión: undefined = verificando; null = sin sesión (pantalla de ingreso).
  const [sesion, setSesion] = useState<Sesion | null | undefined>(undefined)
  const [feds, setFeds] = useState<Fed[] | null>(null)
  const profile = sesion?.fed ?? null
  const rolAyuda: Rol = profile?.rol === 'coordinacion' ? 'ced' : 'fed'
  const [hayNovedades, marcarNovedades] = useNovedadesNuevas(rolAyuda)
  const setProfile = (f: Fed) => setSesion(s => (s ? { ...s, fed: f } : s))
  const [section, setSection] = useState<Seccion>('agenda')
  // La sección abierta se recuerda en la pestaña del navegador: al recargar se vuelve al mismo lugar.
  useEffect(() => { if (sesion) storage(() => sessionStorage.setItem(SECCION_KEY, section)) }, [section, sesion])
  const [cambiandoPass, setCambiandoPass] = useState(false)
  // Administración: ver el tablero del equipo completo o la agenda de otro integrante (solo lectura).
  const [vista, setVista] = useState<{ tipo: 'equipo' } | { tipo: 'fed', fed: Fed } | null>(null)
  // La vista del equipo completo es sólo el Tablero: al ir a otra sección se vuelve a los datos propios.
  const irA = (s: Seccion) => { setSection(s); if (s !== 'board') setVista(v => (v?.tipo === 'equipo' ? null : v)) }
  const irAlInicio = () => { setVista(null); irA(profile?.rol === 'coordinacion' ? 'board' : 'agenda'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  // `preset`: valores iniciales (ej.: reunión de equipo con todo el equipo invitado).
  const [editing, setEditing] = useState<{ item: AgendaItem | null, fecha?: string, preset?: ItemPreset } | null>(null)
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [buscador, setBuscador] = useState(false)
  // Reclamo de conectividad: `k` reinicia el formulario cada vez que se abre.
  const [reclamo, setReclamo] = useState<{ escuela: School | null, k: number } | null>(null)
  const abrirReclamo = (escuela: School | null) => setReclamo({ escuela, k: Date.now() })
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState('')
  // Lo que acaba de guardarse o marcarse como realizada se destaca un momento en las tarjetas.
  const [destacados, setDestacados] = useState<Destacados>({ guardado: null, realizadas: new Set() })
  const temporizador = useRef<number | undefined>(undefined)
  const destacar = useCallback((guardado: string | null, realizadas: string[] = []) => {
    window.clearTimeout(temporizador.current)
    setDestacados({ guardado, realizadas: new Set(realizadas) })
    temporizador.current = window.setTimeout(() => setDestacados({ guardado: null, realizadas: new Set() }), 2600)
  }, [])
  const [toastAcciones, setToastAcciones] = useState<AccionAviso[]>([])

  const cargarSesion = useCallback(() => {
    // Si el servidor de sesiones falla un momento, se reintenta antes de mandar al ingreso.
    const conReintento = (n: number): ReturnType<typeof miSesion> => miSesion().catch(e => { if (n <= 0) throw e; return new Promise(r => setTimeout(r, 3000)).then(() => conReintento(n - 1)) })
    conReintento(4).then(s => {
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
  const changed = (message: string, acciones: AccionAviso[] = []) => { setReloadKey(k => k + 1); setToast(message); setToastAcciones(acciones) }
  // Marcar como realizada con un toque (la visita completa si tiene varias acciones), con Deshacer.
  // En clubes, prácticas y talleres se avisa para completar los asistentes.
  const marcarRealizada = async (item: AgendaItem) => {
    const ids = item.visita?.map(v => v.id) ?? [item.id], antes = item.estado
    try {
      const r = await cambiarEstadoVarias(ids, 'realizada')
      if (!r.actualizadas) { setToast(r.futuras ? 'No se puede marcar como realizada una acción de una fecha que todavía no llegó' : 'No se pudo marcar como realizada'); setToastAcciones([]); return }
      destacar(null, ids)
      const deshacer = { label: 'Deshacer', onClick: () => { cambiarEstadoVarias(ids, antes).then(() => changed('Se deshizo el cambio')).catch(e => setToast(errMsg(e))) } }
      const conEncuentro = (item.visita ?? [item]).some(v => CON_ENCUENTRO.includes(v.accion))
      changed(conEncuentro ? 'Marcada como realizada. Completá los asistentes del encuentro.' : ids.length > 1 ? 'Visita marcada como realizada' : 'Marcada como realizada',
        conEncuentro ? [deshacer, { label: 'Completar', onClick: () => setEditing({ item: { ...item, estado: 'realizada' } }) }] : [deshacer])
    } catch (e) { setToast(errMsg(e)); setToastAcciones([]) }
  }
  // Registrar la participación en un evento (u otro cambio hecho desde un diálogo) recarga las vistas.
  useEffect(() => { const f = () => setReloadKey(k => k + 1); window.addEventListener(RECARGAR, f); return () => window.removeEventListener(RECARGAR, f) }, [])
  const hideToast = useCallback(() => { setToast(''); setToastAcciones([]) }, [])

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

  return <ConteoFotosProvider reloadKey={reloadKey}><NotificacionesProvider profileId={profile.id} reloadKey={reloadKey}><DestacadosCtx.Provider value={destacados}><div className="flex min-h-dvh flex-col bg-dte-fondo text-dte-tinta">
    <header className="sticky top-0 z-header pt-safe border-b border-dte-linea bg-white/95 backdrop-blur">
      <div className="bg-dte-degradado h-1" />
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 lg:px-10">
        {/* El logo y el título llevan siempre al inicio (la agenda; en coordinación, el tablero). */}
        <button type="button" onClick={irAlInicio} aria-label="Ir al inicio" className="-m-1 flex min-w-0 items-center gap-3 rounded-control p-1 text-left transition hover:bg-dte-fondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dte-petroleo">
          <img src="/brand/dte1-160.png" alt="" width={40} height={40} className="size-10 shrink-0" />
          <span className="min-w-0"><span className="hidden text-xs font-bold uppercase tracking-[0.2em] text-dte-magenta sm:block">Equipo FED · DTE</span><span className="block truncate text-base font-bold leading-tight">Agenda Territorial</span></span>
        </button>
        {/* Navegación principal en desktop; en mobile va en la barra inferior. */}
        <nav aria-label="Secciones" className="hidden rounded-full border border-dte-linea bg-dte-fondo p-1 md:flex">
          {([['agenda', 'Mi agenda', CalendarDays], ['board', 'Tablero', LayoutDashboard]] as const).map(([key, label, Icon]) =>
            <button key={key} onClick={() => irA(key)} aria-current={section === key ? 'page' : undefined} className={`flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${section === key ? 'bg-dte-petroleo text-white shadow-e1' : 'text-dte-gris hover:text-dte-tinta'}`}><Icon className="size-4" />{label}</button>)}
        </nav>
        <div className="flex shrink-0 items-center gap-1">
        {enCola > 0 && <span title="Cargadas sin conexión: se envían al volver la señal" className="flex items-center gap-1 rounded-full bg-aviso-fondo-fuerte px-2.5 py-1 text-xs font-semibold text-aviso-fuerte"><CloudUpload className="size-3.5" />{enCola} sin enviar</span>}
        <button type="button" onClick={() => setBuscador(true)} aria-label="Buscar escuela" title="Buscar escuela" className="flex size-11 items-center justify-center rounded-full text-dte-gris transition hover:bg-dte-fondo hover:text-dte-tinta"><Search className="size-5" /></button>
        <NotificacionesBell feds={feds ?? []} onOpen={setSelected} />
        <MenuPerfil profile={profile} feds={feds ?? []} esAdmin={sesion.esAdmin} hayNovedades={hayNovedades} onReclamo={() => abrirReclamo(null)} onRegistroReclamos={() => { setVista(null); irA('reclamos') }} onAyuda={() => { setVista(null); irA('ayuda') }} onPerfil={() => { setVista(null); irA('perfil') }} onFotos={() => { setVista(null); irA('fotos') }} onMisPve={() => { setVista(null); irA('mispve') }} onUsuarios={() => { setVista(null); irA('usuarios') }} onFeriados={() => { setVista(null); irA('feriados') }} onPve={() => { setVista(null); irA('pve') }} onEquipo={() => { setVista({ tipo: 'equipo' }); irA('board') }} onPassword={() => setCambiandoPass(true)} onSalir={cerrarSesion} />
        </div>
      </div>
    </header>

    <div className="sticky top-[calc(4.25rem+env(safe-area-inset-top,0px))] z-fab">
    {vista && <div role="status" className="border-b border-aviso-borde bg-aviso-fondo-fuerte px-4 py-1.5 text-sm text-aviso-fuerte">
      {/* Una sola línea: en el celular el texto se acorta y el botón queda al lado. */}
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 lg:px-6">
        <span className="flex min-w-0 items-center gap-1.5"><Eye className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 truncate sm:hidden">{vista.tipo === 'equipo' ? <b>Tablero del equipo</b> : <b>{firstName(vista.fed.nombre_completo)}</b>}<span className="max-[22.5rem]:hidden"> · solo lectura</span></span>
          <span className="hidden truncate sm:inline">{vista.tipo === 'equipo' ? <>Estás viendo el <b>tablero del equipo completo</b></> : <>Estás viendo la agenda de <b>{vista.fed.nombre_completo}</b></>} · Solo lectura</span></span>
        <button type="button" onClick={() => { setVista(null); irA('agenda') }} className="min-h-9 shrink-0 rounded-full bg-white px-3 text-xs font-semibold text-dte-petroleo shadow-e1 hover:bg-dte-tinte md:min-h-8"><span className="sm:hidden">Mi agenda</span><span className="hidden sm:inline">Volver a mi agenda</span></button></div>
    </div>}
      <AvisosBanner feds={feds ?? []} puedeSubirPve={profile.rol === 'fed'} onIrAPve={() => { setVista(null); irA('mispve') }} />
    </div>
    {/* Cada pantalla entra con un fundido corto; cambiar de sección o de vista la vuelve a animar. */}
    <div key={`${section}-${vista?.tipo ?? ''}-${vista?.tipo === 'fed' ? vista.fed.id : ''}`} className="anim-entrada">
    {section === 'reclamos' ? <RegistroReclamos profile={profile} feds={feds ?? []} esAdmin={sesion.esAdmin} />
      : section === 'pve' && (sesion.esAdmin || profile.rol === 'coordinacion') ? <PveEquipoView />
      : section === 'feriados' && sesion.esAdmin ? <main className="mx-auto w-full min-w-0 max-w-4xl px-4 pb-24 pt-6 lg:px-10"><div className="flex flex-col gap-4"><EventosPanel onSaved={changed} /><FeriadosView autorId={profile.id} onSaved={changed} /></div></main>
      : section === 'usuarios' && sesion.esAdmin ? <UsuariosView miEmail={sesion.email} onVer={id => { const f = feds?.find(x => x.id === id); if (f) { setVista({ tipo: 'fed', fed: f }); irA('agenda') } }} />
      : section === 'ayuda' ? <AyudaView rol={rolAyuda} onVista={marcarNovedades} />
      : section === 'fotos' ? <main className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-32 pt-6 lg:px-10"><SeccionFotos /></main>
      : section === 'mispve' && profile.rol === 'fed' ? <main className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-32 pt-6 lg:px-10"><SeccionPve /></main>
      : section === 'perfil'
      ? <MiPerfilView key={profile.id} fed={profile} feds={feds ?? []} onSaved={f => { setProfile(f); setFeds(l => l && l.map(x => (x.id === f.id ? f : x))); setToast('Se guardó tu perfil'); irA('agenda') }} />
      : vista?.tipo === 'fed'
      ? (section === 'agenda'
        ? <AgendaView key={vista.fed.id} fed={vista.fed} feds={feds ?? []} reloadKey={reloadKey} onSelect={setSelected} />
        : <CoordinatorView key={`ver-${vista.fed.id}`} feds={[vista.fed]} todos={feds ?? []} reloadKey={reloadKey} onSelect={setSelected} propio={vista.fed.rol === 'fed' ? vista.fed : undefined} soloLectura />)
      : vista?.tipo === 'equipo' && section === 'board'
      ? <CoordinatorView key="equipo" feds={(feds ?? []).filter(f => f.rol !== 'coordinacion')} todos={feds ?? []} reloadKey={reloadKey} onSelect={setSelected} soloLectura />
      : section === 'agenda'
      ? <AgendaView fed={profile} feds={feds ?? []} reloadKey={reloadKey} onNew={fecha => setEditing({ item: null, fecha })} onSelect={setSelected} onCambio={changed} onRealizar={marcarRealizada} />
      : <CoordinatorView key={profile.id} feds={profile.rol === 'fed' ? [profile] : (feds ?? []).filter(f => f.rol !== 'coordinacion')} todos={feds ?? []} reloadKey={reloadKey} onSelect={setSelected} onRealizar={marcarRealizada}
          propio={profile.rol === 'fed' ? profile : undefined} onNuevaAccion={preset => setEditing({ item: null, fecha: iso(toWeekday(fechaHoyAR())), preset })}
          onNuevaReunion={profile.rol !== 'coordinacion' ? undefined : () => setEditing({ item: null, fecha: iso(toWeekday(fechaHoyAR())), preset: { accion: 'REUNIÓN', sub_accion: 'Reunión de equipo (CED/FED)', participantes: (feds ?? []).filter(f => f.id !== profile.id).map(f => f.id) } })} />}
    </div>

    <DetailDialog item={selected} feds={feds ?? []} profile={profile} soloLectura={!!vista} onClose={() => setSelected(null)} onReclamo={s => { setSelected(null); abrirReclamo(s) }}
      onEdit={item => { setSelected(null); setEditing({ item }) }}
      onChanged={(msg, updated) => { changed(msg); setSelected(updated) }} />

    <BuscadorEscuelas open={buscador} onClose={() => setBuscador(false)} feds={feds ?? []} puedeAgendar={!vista} onAgendar={school => setEditing({ item: null, fecha: iso(toWeekday(fechaHoyAR())), preset: { school } })} onReclamo={abrirReclamo} onOpen={setSelected} />
    {reclamo && <ReclamoConectividad key={reclamo.k} open onClose={() => setReclamo(null)} cuenta={sesion.email} ced={(feds ?? []).find(f => f.rol === 'coordinacion') ? firstName((feds ?? []).find(f => f.rol === 'coordinacion')!.nombre_completo) : null} escuelaInicial={reclamo.escuela} />}
    <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
      <DialogContent className="bg-white sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-lg">{tituloForm(editing)}</DialogTitle><DialogDescription>{editing?.item ? 'Actualizá los datos de la acción.' : editing?.preset?.modo === 'nuevo' ? 'Con fecha, el primer encuentro se agrega a tu agenda; si todavía no la tenés, queda “por iniciar”.' : editing?.preset?.modo === 'encuentro' ? 'Se agrega a tu agenda como acción realizada (o planificada, si la fecha todavía no llegó).' : `Se agrega a la agenda de ${firstName(profile.nombre_completo)}.`}</DialogDescription></DialogHeader>
        {editing?.preset?.modo === 'encuentro' && esTrayecto(editing.preset.accion ?? null) && !editing.item
          ? <RegistroEncuentro fed={profile} tipo={editing.preset.accion as Trayecto} clubId={editing.preset.club_id} onCancel={() => setEditing(null)} onSaved={msg => { changed(msg); setEditing(null) }} />
          : editing && <ItemForm key={editing.item?.id ?? `new-${editing.fecha}`} fed={profile} feds={feds ?? []} item={editing.item} defaultFecha={editing.fecha} preset={editing.preset} onCancel={() => setEditing(null)} onSaved={({ creadas, id, mensaje, offline }) => { if (id) destacar(id); changed(mensaje ? mensaje : offline ? 'Sin conexión: la acción quedó guardada en este dispositivo y se envía al volver la señal' : editing.item ? 'Acción actualizada' : creadas > 1 ? `Se crearon ${creadas} acciones de la serie` : editing.preset?.participantes?.length ? 'Reunión creada y notificada al equipo' : 'Acción agregada a tu agenda'); setEditing(null) }} />}
      </DialogContent>
    </Dialog>

    <PieInstitucional />
    {/* Barra inferior (mobile): navegación a una mano y acceso directo a Nueva acción. */}
    <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-header border-t border-dte-linea bg-white/95 pb-safe backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3 items-center">
        <BarraBoton activo={section === 'agenda'} onClick={() => irA('agenda')} icono={CalendarDays} label="Mi agenda" />
        <div className="flex justify-center">{vista ? <span /> : <button type="button" onClick={() => setEditing({ item: null, fecha: iso(toWeekday(fechaHoyAR())) })} aria-label="Nueva acción" className="-mt-5 flex size-14 items-center justify-center rounded-full bg-dte-magenta text-white shadow-e2 ring-4 ring-white transition active:scale-95 hover:bg-dte-magenta-oscuro"><Plus className="size-6" /></button>}</div>
        <BarraBoton activo={section === 'board'} onClick={() => irA('board')} icono={LayoutDashboard} label="Tablero" />
      </div>
    </nav>

    <Dialog open={cambiandoPass} onOpenChange={setCambiandoPass}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader><DialogTitle className="text-lg">Cambiar contraseña</DialogTitle><DialogDescription>Elegí una contraseña nueva para ingresar a la agenda.</DialogDescription></DialogHeader>
        {cambiandoPass && <CambiarPassword obligatorio={false} onCancelar={() => setCambiandoPass(false)} onListo={() => { setCambiandoPass(false); setToast('Se cambió tu contraseña') }} />}
      </DialogContent>
    </Dialog>
    <VolverArriba alto={section === 'perfil'} />
    {toast && <Toast message={toast} onDone={hideToast} acciones={toastAcciones} />}
  </div></DestacadosCtx.Provider></NotificacionesProvider></ConteoFotosProvider>
}
