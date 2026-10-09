'use client'

import { claseDestacado, type Destacados } from '@/lib/destacados'
import { createContext, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowUp, Check, Loader2, ChevronLeft, ChevronRight, CircleAlert, PartyPopper, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { esVersionVieja } from '@/lib/version'
import * as api from '@/app/actions'
import { guardarCache, leerCache } from '@/components/app/offline'
import { titleCase } from '@/lib/format'
import { nombreCorto, siglaNombre } from '@/lib/siglas'
import { esPeatConGrupo } from '@/lib/encuentro'
import { esAusencia, etiquetaAccion, nombreAccion, type Accion, type AgendaItem, type Feriado, type Estado, type Fed, type School } from '@/lib/agenda'
import { anioAR, hoyAR, ZONA } from '@/lib/hora'
import { inicioAnio } from '@/lib/receso'
import { esReunion } from '@/lib/reunion'

// ---- estilos por categoría ----
// Colores de acción: distinguibles entre sí, texto con contraste AA sobre su fondo. `dot` se usa como acento.
// Paleta de categorías de acción: mapa único (texto con contraste AA sobre su fondo). No duplicar estos colores fuera de acá.
export const actionStyle: Record<Accion, { chip: string, dot: string }> = {
  'VISITA TÉCNICA': { chip: 'bg-accion-visita-tecnica text-accion-visita-tecnica-texto', dot: 'bg-accion-visita-tecnica-punto' },
  'VISITA PEDAGÓGICA': { chip: 'bg-accion-visita-pedagogica text-accion-visita-pedagogica-texto', dot: 'bg-accion-visita-pedagogica-punto' },
  'REUNIÓN': { chip: 'bg-accion-reunion text-accion-reunion-texto', dot: 'bg-accion-reunion-punto' },
  'CLUB DE TECNOLOGÍA': { chip: 'bg-accion-club-de-tecnologia text-accion-club-de-tecnologia-texto', dot: 'bg-accion-club-de-tecnologia-punto' },
  'PRÁCTICAS PROFESIONALIZANTES': { chip: 'bg-accion-practicas-profesionalizantes text-accion-practicas-profesionalizantes-texto', dot: 'bg-accion-practicas-profesionalizantes-punto' },
  'TALLER/CAPACITACIÓN': { chip: 'bg-accion-taller-capacitacion text-accion-taller-capacitacion-texto', dot: 'bg-accion-taller-capacitacion-punto' },
  'ASISTENCIA REMOTA': { chip: 'bg-accion-asistencia-remota text-accion-asistencia-remota-texto', dot: 'bg-accion-asistencia-remota-punto' },
  'CONECTIVIDAD': { chip: 'bg-accion-conectividad text-accion-conectividad-texto', dot: 'bg-accion-conectividad-punto' },
  'ADMINISTRATIVO': { chip: 'bg-accion-administrativo text-accion-administrativo-texto', dot: 'bg-accion-administrativo-punto' },
  'OFICINA R1': { chip: 'bg-accion-oficina-r1 text-accion-oficina-r1-texto', dot: 'bg-accion-oficina-r1-punto' },
  'PARO': { chip: 'bg-accion-paro text-accion-paro-texto', dot: 'bg-accion-paro-punto' },
  'ENTREGA DE EQUIPAMIENTO': { chip: 'bg-accion-entrega-de-equipamiento text-accion-entrega-de-equipamiento-texto', dot: 'bg-accion-entrega-de-equipamiento-punto' },
  'RELEVAMIENTO': { chip: 'bg-accion-relevamiento text-accion-relevamiento-texto', dot: 'bg-accion-relevamiento-punto' },
  'PLANIFICACIÓN': { chip: 'bg-accion-planificacion text-accion-planificacion-texto', dot: 'bg-accion-planificacion-punto' },
  'LICENCIA': { chip: 'bg-accion-licencia text-accion-licencia-texto', dot: 'bg-accion-licencia-punto' },
  'EVENTO DTE': { chip: 'bg-accion-evento-dte text-accion-evento-dte-texto', dot: 'bg-accion-evento-dte-punto' },
  'FORMACIÓN INTERNA': { chip: 'bg-accion-formacion-interna text-accion-formacion-interna-texto', dot: 'bg-accion-formacion-interna-punto' },
  'REUNIÓN CON JEFATURA': { chip: 'bg-accion-reunion-con-jefatura text-accion-reunion-con-jefatura-texto', dot: 'bg-accion-reunion-con-jefatura-punto' },
  'ACOMPAÑAMIENTO A FED': { chip: 'bg-accion-acompanamiento-a-fed text-accion-acompanamiento-a-fed-texto', dot: 'bg-accion-acompanamiento-a-fed-punto' },
  'GESTIÓN INSTITUCIONAL': { chip: 'bg-accion-gestion-institucional text-accion-gestion-institucional-texto', dot: 'bg-accion-gestion-institucional-punto' },
  'SEGUIMIENTO DEL EQUIPO': { chip: 'bg-accion-seguimiento-del-equipo text-accion-seguimiento-del-equipo-texto', dot: 'bg-accion-seguimiento-del-equipo-punto' },
  'INFORME TÉCNICO': { chip: 'bg-accion-informe-tecnico text-accion-informe-tecnico-texto', dot: 'bg-accion-informe-tecnico-punto' },
  'REUNIÓN CON INSPECCIÓN': { chip: 'bg-accion-reunion-con-inspeccion text-accion-reunion-con-inspeccion-texto', dot: 'bg-accion-reunion-con-inspeccion-punto' },
  'REUNIÓN CON NIVEL CENTRAL': { chip: 'bg-accion-reunion-con-nivel-central text-accion-reunion-con-nivel-central-texto', dot: 'bg-accion-reunion-con-nivel-central-punto' },
  'ARTICULACIÓN MUNICIPAL': { chip: 'bg-accion-articulacion-municipal text-accion-articulacion-municipal-texto', dot: 'bg-accion-articulacion-municipal-punto' },
}
export const statusStyle: Record<Estado, { badge: string, label: string }> = {
  planificada: { badge: 'border-pba-azul/40 bg-pba-azul/10 text-pba-azul', label: 'Planificada' },
  realizada: { badge: 'border-pba-celeste/50 bg-pba-celeste/10 text-pba-celeste-texto', label: 'Realizada' },
  reprogramada: { badge: 'border-aviso-borde bg-aviso-fondo text-aviso-fuerte', label: 'Reprogramada' },
  cancelada: { badge: 'border-pba-fucsia/40 bg-pba-fucsia/10 text-dte-magenta-oscuro', label: 'Cancelada' },
}
export const avatarColors = ['bg-avatar-1', 'bg-avatar-2', 'bg-avatar-3', 'bg-avatar-4', 'bg-avatar-5', 'bg-avatar-6']
// Orden alfabético de la A a la Z para todas las listas (con números en orden natural: N° 2 antes que N° 10).
export const az = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
export const azOtroAlFinal = (a: string, b: string) => (a === 'Otro' ? 1 : b === 'Otro' ? -1 : az(a, b))
// Select nativo: 44px y 16px en mobile (sin zoom en iOS), compacto desde md.
export const selectClass = 'h-11 w-full rounded-control border border-input bg-white px-2.5 text-base text-dte-tinta md:h-9 md:text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
export const eyebrow = 'text-xs font-bold uppercase tracking-[0.15em] text-dte-magenta'

// ---- fechas (siempre en hora local, formato YYYY-MM-DD) ----
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// Mediodía local: al formatear en hora argentina no se corre de día aunque el dispositivo esté en otra zona.
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12) }
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12)
export const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))
export const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString('es-AR', { timeZone: ZONA, ...opts })
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')
export const timeRange = (i: AgendaItem) => (i.hora_inicio ? `${hhmm(i.hora_inicio)}${i.hora_fin ? ` a ${hhmm(i.hora_fin)}` : ''}` : esAusencia(i.accion) ? 'Todo el día' : 'Sin horario')
// "21 – 27 de septiembre de 2026" o "29 de septiembre – 5 de octubre de 2026"
export function weekTitle(from: Date, to: Date) {
  const sameMonth = from.getMonth() === to.getMonth()
  return `${sameMonth ? from.getDate() : fmt(from, { day: 'numeric', month: 'long' })} – ${fmt(to, { day: 'numeric', month: 'long', year: 'numeric' })}`
}

export const schoolName = (s: School | null) => (s?.nombre ? titleCase(s.nombre) : 'Sin escuela asignada')
// Siglas y nombre mínimo para calendarios y tarjetas angostas (la lógica está en lib/siglas.ts).
export const shortSchoolName = (s: School | null) => nombreCorto(schoolName(s))
// Escuelas que comparten edificio: nombre corto con su CUE, y la línea para los resultados de búsqueda.
export const nombreHermana = (h: { id: string, cue: number | null, nombre: string | null }) => `${shortSchoolName({ id: h.id, cue: h.cue, nombre: h.nombre, distrito: null, ciudad: null })} (CUE ${h.cue ?? '—'})`
export const lineaPredio = (s: Pick<School, 'predio' | 'comparte'>) => (s.predio && s.comparte?.length ? `Predio ${s.predio} · comparte con ${s.comparte.map(nombreHermana).join(', ')}` : '')
export const siglaEscuela = (s: School | null) => siglaNombre(schoolName(s))
// Segunda línea de las tarjetas: CUE y localidad.
export const cueLugar = (s: School | null) => (s ? [s.cue ? `CUE ${s.cue}` : null, schoolPlace(s)].filter(Boolean).join(' · ') : '')
export const schoolPlace = (s: School | null) => (s ? [s.ciudad && s.ciudad !== s.distrito ? titleCase(s.ciudad) : null, s.distrito ? titleCase(s.distrito) : null].filter(Boolean).join(', ') : '')

export const ddjjFor = (fed: Fed, fecha: string) => { const d = parse(fecha).getDay(); return d >= 1 && d <= 5 ? fed.ddjj?.find(x => x.dia === d) : undefined }
// Título de la acción; en clubes y prácticas se agrega el grado/grupo (ej.: "EP N° 5 · 4° A").
export const conGrupo = (i: AgendaItem, t: string) => (i.club?.grupo ? `${t} · ${i.club.grupo}` : t)
// Los grupos de PEAT llevan como título sólo el curso y el grupo (ej.: "7° Informática - Grupo 1"), y la escuela donde es el encuentro va en la segunda línea.
// Segunda línea de las tarjetas: CUE y localidad (en los grupos de PEAT, la escuela del encuentro y su localidad).
export const lugarDeTarjeta = (i: AgendaItem) => (esPeatConGrupo(i) ? (i.school ? [shortSchoolName(i.school), schoolPlace(i.school)].filter(Boolean).join(' · ') : '') : cueLugar(i.school))
export const itemTitle = (i: AgendaItem) => esPeatConGrupo(i) ? i.club!.grupo! : conGrupo(i, i.school ? schoolName(i.school) : i.lugar || i.sub_accion || (i.modalidad === 'Virtual' ? `${cap(i.accion.toLowerCase())} virtual` : cap(i.accion.toLowerCase())))
// Reunión virtual o híbrida: se marca en las tarjetas ("Virtual" / "Híbrido").
export const marcaModalidad = (i: AgendaItem) => (esReunion(i.accion) && i.modalidad && i.modalidad !== 'Presencial' ? i.modalidad : null)
export const itemCorto = (i: AgendaItem) => (i.school && !esPeatConGrupo(i) ? conGrupo(i, siglaEscuela(i.school)) : itemTitle(i))
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
export const firstName = (name: string) => name.split(/\s+/)[0]
export const fedColor = (feds: Fed[], id: string) => avatarColors[Math.max(0, feds.findIndex(f => f.id === id)) % avatarColors.length]

// Desenvuelve el Result de las server actions: lanza con el mensaje real del servidor.
// Sesión vencida o cerrada en el servidor: se avisa a la página para volver a la pantalla de ingreso.
// Cuando se publica una versión nueva, una pestaña que quedó abierta con la anterior pide acciones del servidor que ya no existen
// ("Server Action … was not found"): se avisa a la página para ofrecer actualizarla y se muestra un mensaje claro.
export const call = <A extends unknown[], T>(fn: (...a: A) => Promise<api.Result<T>>) => async (...a: A): Promise<T> => {
  let r: api.Result<T>
  try { r = await fn(...a) } catch (e) {
    if (esVersionVieja(e instanceof Error ? e.message : String(e))) { if (typeof window !== 'undefined') window.dispatchEvent(new Event('agenda-version-nueva')); throw new Error('La agenda se actualizó. Actualizá la página para seguir.') }
    throw e
  }
  if (!r.ok) {
    if (r.error === 'SESION_VENCIDA') { if (typeof window !== 'undefined') window.dispatchEvent(new Event('agenda-sesion-vencida')); throw new Error('Tu sesión venció. Ingresá de nuevo.') }
    throw new Error(r.error)
  }
  return r.data
}
export const miSesion = call(api.miSesion)
export const ingresar = call(api.ingresar)
export const salir = call(api.salir)
export const cambiarPassword = call(api.cambiarPassword)
export const listarUsuarios = call(api.listarUsuarios)
export const generarPasswordTemporal = call(api.generarPasswordTemporal)
export const getComunicadosPendientes = call(api.getComunicadosPendientes)
export const marcarComunicadoLeido = call(api.marcarComunicadoLeido)
export const getComunicadosGestion = call(api.getComunicadosGestion)
export const crearComunicado = call(api.crearComunicado)
export const editarComunicado = call(api.editarComunicado)
export const retirarComunicado = call(api.retirarComunicado)
export const eliminarComunicado = call(api.eliminarComunicado)
export const getFeds = call(api.getFeds)
export const getJornadas = call(api.getJornadas)
export const searchSchools = call(api.searchSchools)
export const getFichaEscuela = call(api.getFichaEscuela)
export const getConectividadEscuela = call(api.getConectividadEscuela)
export const registrarReclamo = call(api.registrarReclamo)
export const guardarBorradorReclamo = call(api.guardarBorradorReclamo)
export const getBorradoresReclamo = call(api.getBorradoresReclamo)
export const eliminarBorradorReclamo = call(api.eliminarBorradorReclamo)
export const enviarBorradorReclamo = call(api.enviarBorradorReclamo)
export const getReclamos = call(api.getReclamos)
export const resolverReclamo = call(api.resolverReclamo)
export const getAccesos = call(api.getAccesos)
export const getMisEscuelas = call(api.getMisEscuelas)
export const getExtrasEscuela = call(api.getExtrasEscuela)
export const getPuntosMapa = call(api.getPuntosMapa)
export const getCruceReclamos = call(api.getCruceReclamos)
export const getJefatura = call(api.getJefatura)
export const guardarJefatura = call(api.guardarJefatura)
export const getEdicionEscuela = call(api.getEdicionEscuela)
export const guardarEscuela = call(api.guardarEscuela)
export const guardarContacto = call(api.guardarContacto)
export const borrarContacto = call(api.borrarContacto)
export const contactoPrincipal = call(api.contactoPrincipal)
export const getCronogramas = call(api.getCronogramas)
export const marcarCronograma = call(api.marcarCronograma)
export const avisarCronograma = call(api.avisarCronograma)
export const getContactosCronograma = call(api.getContactosCronograma)
export const sincronizarCronogramasAhora = call(api.sincronizarCronogramasAhora)
export const reclamosAbiertosDe = call(api.reclamosAbiertosDe)
export const actualizarReclamo = call(api.actualizarReclamo)
export const getFedItems = call(api.getFedItems)
export const buscarOrganismos = call(api.buscarOrganismos)
export const ubicacionDe = call(api.ubicacionDe)
export const getAllItems = call(api.getAllItems)
export const disponibilidad = call(api.disponibilidad)
export const getEncuentros = call(api.getEncuentros)
export const getFeriados = call(api.getFeriados)
export const misTiposFrecuentes = call(api.misTiposFrecuentes)
export const guardarVisita = call(api.guardarVisita)
export const editarVisita = call(api.editarVisita)
export const getEventos = call(api.getEventos)
export const listarEventos = call(api.listarEventos)
export const guardarEvento = call(api.guardarEvento)
export const eliminarEvento = call(api.eliminarEvento)
export const miParticipacion = call(api.miParticipacion)
export const registrarParticipacion = call(api.registrarParticipacion)
export const getClubes = call(api.getClubes)
export const getNotificaciones = call(api.getNotificaciones)
export const getActividadEquipo = call(api.getActividadEquipo)
export const marcarLeidas = call(api.marcarLeidas)
export const setClubCierre = call(api.setClubCierre)
export const saveItem = call(api.saveItem)
export const responder = call(api.responder)
export const getHistorial = call(api.getHistorial)
export const cambiarEstadoVarias = call(api.cambiarEstadoVarias)
export const eliminarVarias = call(api.eliminarVarias)
export const moverFinDeSemana = call(api.moverFinDeSemana)
export const updateMiPerfil = call(api.updateMiPerfil)
export const estadoFotos = call(api.estadoFotos)
export const guardarCarpetaFotos = call(api.guardarCarpetaFotos)
export const ordenarMisFotos = call(api.ordenarMisFotos)
export const misPve = call(api.misPve)
export const abrirCarpetaPve = call(api.abrirCarpetaPve)
export const pveEquipo = call(api.pveEquipo)
export const marcarPveEnviadas = call(api.marcarPveEnviadas)
export const devolverPve = call(api.devolverPve)
export const fotosDelDia = call(api.fotosDelDia)
export const conteoFotos = call(api.conteoFotos)
export const crearClubPorIniciar = call(api.crearClubPorIniciar)
export const addFeriado = call(api.addFeriado)
export const deleteFeriado = call(api.deleteFeriado)
export const confirmarFeriado = call(api.confirmarFeriado)
export const setItemStatus = call(api.setItemStatus)
export const deleteItem = call(api.deleteItem)
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Error inesperado')

export function storage<T>(fn: () => T): T | null { try { return fn() } catch { return null } }

// ---- piezas chicas ----
// Marcar como realizada con un toque: sólo acciones propias, planificadas o reprogramadas, de hoy o días anteriores.
export const puedeRealizar = (item: AgendaItem, viewer?: string) => !!viewer && item.fed_id === viewer && !esAusencia(item.accion) && (item.estado === 'planificada' || item.estado === 'reprogramada') && item.fecha <= hoyAR()
export function BotonRealizar({ item, onRealizar, className = '' }: { item: AgendaItem, onRealizar: (item: AgendaItem) => void, className?: string }) {
  const [enviando, setEnviando] = useState(false)
  return <button type="button" disabled={enviando} onClick={async e => { e.stopPropagation(); setEnviando(true); try { await onRealizar(item) } finally { setEnviando(false) } }}
    aria-label={`Marcar ${item.visita ? 'la visita' : 'la acción'} como realizada`} title="Marcar como realizada"
    className={`flex size-11 shrink-0 items-center justify-center rounded-full text-dte-gris transition hover:text-exito focus-visible:opacity-100 md:size-8 ${className}`}>
    <span className="flex size-7 items-center justify-center rounded-full border-2 border-current bg-white md:size-6">{enviando ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" strokeWidth={3} />}</span>
  </button>
}
// Lo que acaba de pasar y conviene destacar un momento (ver lib/destacados).
export { claseDestacado }
export const DestacadosCtx = createContext<Destacados>({ guardado: null, realizadas: new Set() })
// Tilde que se dibuja al marcar una acción como realizada (se desvanece solo).
export const SelloRealizada = () => <span aria-hidden className="anim-sello pointer-events-none absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-exito text-white shadow-e2"><Check className="anim-tilde size-3.5" strokeWidth={3} /></span>
// Contenido que se despliega y se pliega con suavidad (sin saltos de alto). Cerrado, no se puede enfocar.
export function Despliegue({ abierto, id, children }: { abierto: boolean, id?: string, children: React.ReactNode }) {
  return <div id={id} inert={!abierto} className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${abierto ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}><div className="min-h-0 overflow-hidden">{children}</div></div>
}
// Etiquetas de una acción o, si es una visita con varias, de todas sus acciones.
export function EtiquetasAccion({ item }: { item: AgendaItem }) {
  return <>{(item.visita ?? [item]).map(v => <ActionChip key={v.id} label={v.accion} />)}</>
}
// En desktop las etiquetas son más discretas (en minúscula, sin relleno grande); en mobile, como siempre.
const SIGLAS = new Set(['PEAT', 'R1', 'DTE', 'CED', 'FED', 'JED'])
const enFrase = (t: string) => t.toLowerCase().split(' ').map((w, i) => (SIGLAS.has(w.toUpperCase()) ? w.toUpperCase() : i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ')
export function ActionChip({ label, className = '' }: { label: Accion, className?: string }) {
  const texto = etiquetaAccion(label)
  return <span title={nombreAccion(label)} className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold uppercase leading-tight tracking-[0.04em] md:gap-1 md:px-1.5 md:py-0.5 md:font-semibold md:normal-case md:tracking-normal ${actionStyle[label]?.chip ?? 'bg-muted text-muted-foreground'} ${className}`}><span className={`size-1.5 shrink-0 rounded-full ${actionStyle[label]?.dot ?? 'bg-current'}`} /><span className="md:hidden">{texto}</span><span className="hidden truncate md:inline">{enFrase(texto)}</span></span>
}
export function StatusBadge({ status }: { status: Estado }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold md:px-1.5 md:py-0 md:font-medium ${statusStyle[status]?.badge ?? ''}`}>{statusStyle[status]?.label ?? status}</span>
}
// Botón para volver a la pantalla de la que se vino (en el celular no hay otra forma de salir de una sección sin pasar por el Tablero o la agenda).
export function BotonVolver({ onClick, destino }: { onClick: () => void, destino: string }) {
  return <button type="button" onClick={onClick} className="-ml-2 mb-2 flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm font-semibold text-dte-petroleo transition hover:bg-dte-tinte md:hidden"><ArrowLeft className="size-4" aria-hidden />Volver a {destino}</button>
}

export function ErrorBox({ message, onRetry }: { message: string, onRetry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-tile border border-peligro-borde bg-peligro-fondo p-4 text-sm text-peligro"><p className="flex min-w-0 items-start gap-2"><CircleAlert className="mt-px size-4 shrink-0" aria-hidden /><span className="min-w-0 [overflow-wrap:anywhere]"><span className="font-semibold">No se pudo completar la operación.</span> {message}</span></p>{onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>}</div>
}
// Estado vacío común: ícono, mensaje y, si corresponde, una acción para salir de él.
export function Vacio({ icono: Icono, titulo, texto, children }: { icono: React.ComponentType<{ className?: string }>, titulo: string, texto?: string, children?: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-dte-linea bg-white/60 px-6 py-10 text-center">
    <span className="flex size-12 items-center justify-center rounded-full bg-dte-fondo text-dte-gris"><Icono className="size-6" /></span>
    <p className="font-semibold text-dte-tinta">{titulo}</p>{texto && <p className="max-w-sm text-sm text-dte-gris">{texto}</p>}
    {children && <div className="mt-2">{children}</div>}
  </div>
}
export function Skeleton({ className = '' }: { className?: string }) { return <div className={`anim-brillo rounded-tile bg-dte-linea/70 ${className}`} /> }

// `acciones`: botones del aviso (p. ej., Deshacer); al tocarlos, el aviso se cierra.
export type AccionAviso = { label: string, onClick: () => void }
export function Toast({ message, onDone, acciones = [] }: { message: string, onDone: () => void, acciones?: AccionAviso[] }) {
  // Tiempo suficiente para leerlo; se pausa mientras el puntero o el foco están encima.
  const [pausa, setPausa] = useState(false)
  useEffect(() => { if (pausa) return; const t = setTimeout(onDone, acciones.length ? 8000 : 5000); return () => clearTimeout(t) }, [message, onDone, pausa, acciones.length])
  return <div role="status" aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-x-0 bottom-safe-24 z-toast flex justify-center px-4 sm:bottom-8">
    <div onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)} onFocus={() => setPausa(true)} onBlur={() => setPausa(false)} className="pointer-events-auto flex max-w-full items-center gap-2 rounded-card bg-dte-tinta py-1 pl-4 pr-1 text-sm font-medium text-white shadow-e2">
      <Check className="size-4 shrink-0 text-dte-celeste" aria-hidden /><span className="min-w-0">{message}</span>
      {acciones.map(a => <button key={a.label} type="button" onClick={() => { onDone(); a.onClick() }} className="min-h-11 shrink-0 rounded-control px-2 text-sm font-bold text-dte-celeste underline-offset-2 hover:underline md:min-h-8">{a.label}</button>)}
      <button onClick={onDone} aria-label="Cerrar aviso" className="flex size-11 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white md:size-8"><X className="size-4" /></button>
    </div>
  </div>
}

// `cacheKey`: guarda lo cargado en el dispositivo. Al abrir se muestra al instante la última copia y se actualiza
// en segundo plano; si no hay conexión, queda la copia con el aviso de "sin conexión" (`desdeCache`).
export function useItems(load: () => Promise<AgendaItem[]>, deps: unknown[], cacheKey?: string) {
  const [retry, setRetry] = useState(0)
  // Cada resultado queda asociado a la consulta que lo pidió: al cambiar de período se descarta el anterior sin resetear el estado en el efecto.
  const clave = JSON.stringify([...deps, retry])
  const [res, setRes] = useState<{ clave: string, cacheKey?: string, items: AgendaItem[] | null, error: string, desdeCache: number | null } | null>(null)
  useEffect(() => {
    let alive = true
    load().then(r => { if (!alive) return; setRes({ clave, cacheKey, items: r, error: '', desdeCache: null }); if (cacheKey) guardarCache(cacheKey, r) }).catch(e => {
      if (!alive) return
      const c = cacheKey ? leerCache(cacheKey) : null
      setRes(c ? { clave, cacheKey, items: c.items, error: '', desdeCache: c.ts } : { clave, cacheKey, items: null, error: errMsg(e), desdeCache: null })
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])
  // Mientras llega la respuesta se muestra la última copia guardada en el dispositivo (si hay).
  const enCache = useMemo(() => (cacheKey ? leerCache(cacheKey)?.items ?? null : null), [cacheKey])
  const actual = res?.clave === clave ? res : null
  // Al recargar el mismo período (tras marcar, deshacer o editar) se sigue mostrando lo último en pantalla, no la copia vieja.
  const previo = !actual && cacheKey && res?.cacheKey === cacheKey ? res.items : null
  return { items: actual ? actual.items : previo ?? enCache, error: actual?.error ?? '', retry: () => setRetry(n => n + 1), desdeCache: actual?.desdeCache ?? null }
}

// =====================================================================

// `modo`: formulario exclusivo de clubes/prácticas ('nuevo' = alta; 'encuentro' = cargar un encuentro de uno activo).
export type ItemPreset = { school?: School, accion?: Accion, sub_accion?: string, participantes?: string[], club_id?: string, modo?: 'nuevo' | 'encuentro' }

// =====================================================================

// `llena`: en el celular ocupa todo el ancho, con los tres botones parejos (anterior, Hoy, siguiente); desde sm vuelve a su tamaño natural.
export function WeekNav({ onPrev, onToday, onNext, prevLabel, nextLabel, llena = false }: { onPrev: () => void, onToday: () => void, onNext: () => void, prevLabel: string, nextLabel: string, llena?: boolean }) {
  const lado = llena ? 'max-sm:w-full!' : ''
  return <div className={`items-center rounded-control border border-dte-linea bg-white shadow-e1 ${llena ? 'grid w-full grid-cols-[1fr_2fr_1fr] sm:flex sm:w-auto' : 'flex'}`}>
    <Button variant="ghost" size="icon-lg" className={lado} aria-label={prevLabel} onClick={onPrev}><ChevronLeft /></Button>
    <Button variant="ghost" size="lg" className="rounded-none border-x border-dte-linea px-4 font-semibold" onClick={onToday}>Hoy</Button>
    <Button variant="ghost" size="icon-lg" className={lado} aria-label={nextLabel} onClick={onNext}><ChevronRight /></Button>
  </div>
}

// ---- calendario: sólo días hábiles (lunes a viernes) ----
export type CalView = 'day' | 'week' | 'month' | 'semester' | 'list'
export const CAL_VIEWS: [CalView, string][] = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['semester', '6 meses'], ['list', 'Lista']]
export const CAL_KEY = 'agenda-territorial:vista'
export const DIAS_HABILES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
export const isWeekday = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5
export const toWeekday = (d: Date, dir = 1) => { let x = d; while (!isWeekday(x)) x = addDays(x, dir); return x }
export const monthStart = (d: Date, plus = 0) => new Date(d.getFullYear(), d.getMonth() + plus, 1, 12)
export const monthEnd = (d: Date, plus = 0) => new Date(d.getFullYear(), d.getMonth() + plus + 1, 0, 12)
export function calBounds(anchor: Date, view: CalView): [Date, Date] {
  if (view === 'day') return [anchor, anchor]
  if (view === 'week') { const s = startOfWeek(anchor); return [s, addDays(s, 4)] }
  if (view === 'month') return [monthStart(anchor), monthEnd(anchor)]
  if (view === 'list') return [inicioAnio(anchor.getFullYear()), new Date(anchor.getFullYear(), 11, 31, 12)]
  return [monthStart(anchor), monthEnd(anchor, 5)]
}
export function calShift(anchor: Date, view: CalView, dir: number) {
  if (view === 'day') return toWeekday(addDays(anchor, dir), dir)
  if (view === 'week') return addDays(anchor, 7 * dir)
  if (view === 'list') return inicioAnio(anchor.getFullYear() + dir)
  return monthStart(anchor, view === 'month' ? dir : 6 * dir)
}
// Semanas (lunes a viernes) que cubren un mes; los días de otros meses quedan en null.
export function monthWeeks(month: Date): (Date | null)[][] {
  const weeks: (Date | null)[][] = []
  for (let w = startOfWeek(monthStart(month)); w <= monthEnd(month); w = addDays(w, 7)) {
    const row = Array.from({ length: 5 }, (_, i) => { const d = addDays(w, i); return d.getMonth() === month.getMonth() ? d : null })
    if (row.some(Boolean)) weeks.push(row)
  }
  return weeks
}

export function useFeriados(from: string, to: string, distritos: string[] | null) {
  const [list, setList] = useState<Feriado[]>([])
  useEffect(() => {
    let alive = true
    getFeriados(from, to).then(r => alive && setList(r)).catch(() => alive && setList([]))
    return () => { alive = false }
  }, [from, to])
  // Nacionales para todos; distritales sólo para quien tiene ese distrito a cargo (null = todos los distritos).
  return useMemo(() => {
    const m = new Map<string, Feriado[]>()
    for (const f of list) if (!f.distrito || !distritos || distritos.includes(f.distrito)) m.set(f.fecha, [...(m.get(f.fecha) ?? []), f])
    return m
  }, [list, distritos])
}

export function FeriadoTag({ f, compact = false }: { f: Feriado, compact?: boolean }) {
  const distrital = f.tipo === 'distrital'
  return <span title={`${f.nombre}${f.confirmado ? '' : ' (fecha a confirmar)'}`} className={`inline-flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-xs font-semibold ${distrital ? 'bg-aniversario-marca text-aniversario-texto' : 'bg-feriado-marca text-peligro'}`}>
    <PartyPopper className="size-3 shrink-0" />{compact ? (distrital ? 'Aniv. distrital' : 'Feriado') : f.nombre}{!f.confirmado && ' *'}
  </span>
}

// Pie institucional (mismo texto que el resto de los proyectos DTE). `oscuro`: sobre fondo degradado.
export function PieInstitucional({ oscuro = false }: { oscuro?: boolean }) {
  return <footer className={`px-4 pt-8 text-center text-xs ${oscuro ? 'pb-[calc(2rem+env(safe-area-inset-bottom,0px))] text-white/85' : 'mt-auto border-t border-dte-linea bg-white pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] text-dte-gris md:pb-8'}`}>
    <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-3">
      <img src={oscuro ? '/brand/oficial-blanco.png' : '/brand/oficial-color.png'} alt="Dirección de Tecnología Educativa · Dirección General de Cultura y Educación · Gobierno de la Provincia de Buenos Aires" width={1200} height={166} className="h-12 w-auto max-w-full object-contain sm:h-16 lg:h-[72px]" />
      <p>© {anioAR()} Dirección de Tecnología Educativa (DTE), Región 1 · Desarrollado por Silvio Ridolfi, Facilitador de Educación Digital</p>
    </div>
  </footer>
}

// Botón "Volver arriba": aparece al bajar bastante en páginas largas. `alto`: deja lugar a una barra fija inferior.
export function VolverArriba({ alto = false }: { alto?: boolean }) {
  const [ver, setVer] = useState(false)
  useEffect(() => {
    const f = () => setVer(window.scrollY > 900)
    f(); window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])
  if (!ver) return null
  return <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Volver arriba" title="Volver arriba"
    className={`fixed right-4 z-fab flex size-11 items-center justify-center rounded-full border border-dte-linea bg-white/95 text-dte-petroleo shadow-e2 backdrop-blur transition hover:bg-dte-tinte md:right-6 ${alto ? 'bottom-[calc(10rem+env(safe-area-inset-bottom,0px))] md:bottom-24' : 'bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6'}`}>
    <ArrowUp className="size-5" aria-hidden />
  </button>
}
