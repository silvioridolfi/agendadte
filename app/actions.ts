'use server'

import { type AgendaItemInput, type Fed, type Feriado } from '@/lib/agenda'
import { requerirUsuario, type Usuario } from '@/lib/sesion'
import { veTodoElEquipo } from '@/lib/permisos'
import type { EntradaComunicado } from '@/lib/comunicados'
import * as comunicados from '@/lib/servidor/comunicados'
import * as sesion from '@/lib/servidor/sesion'
import * as eventos from '@/lib/servidor/eventos'
export type { ExtrasEscuela } from '@/lib/servidor/escuelas'
export type { Ocupacion, ClubPorIniciarInput, Organismo, Ubicacion } from '@/lib/servidor/agenda'
import type { ClubPorIniciarInput } from '@/lib/servidor/agenda'
import type { EventoInput } from '@/lib/servidor/eventos'
import * as rc from '@/lib/servidor/reclamos-cronogramas'
import * as esc from '@/lib/servidor/escuelas'
import * as ag from '@/lib/servidor/agenda'
import * as usuarios from '@/lib/servidor/usuarios'
import * as jornadas from '@/lib/servidor/jornadas'
import * as parahacer from '@/lib/servidor/parahacer'
import * as fotos from '@/lib/servidor/fotos-pve'
import { errMsgServer, quienEs } from '@/lib/servidor/comun'
import { type EstadoReclamo } from '@/lib/reclamos-registro'
import { type AvisoCronograma, type EstadoSeguimiento } from '@/lib/cronogramas'
import { type ContactoInput } from '@/lib/escuelas-edicion'

// En producción Next oculta el mensaje de los errores lanzados en server actions (React #441),
// así que se devuelven como valor y el cliente los vuelve a lanzar con el mensaje real.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }
async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() } } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }
}

export const getActividadEquipo = async () => conUsuario(yo => ag.getActividadEquipo(yo))
// Todas las acciones exigen sesión. El perfil que actúa sale de la sesión, nunca de los parámetros del navegador.
const conUsuario = <T,>(fn: (yo: Usuario) => Promise<T>) => run(async () => fn(await requerirUsuario()))
export const getFeds = async () => conUsuario(yo => ag.getFeds(yo))
export const searchSchools = async (query: string) => conUsuario(() => esc.searchSchoolsImpl(query))
export const getFichaEscuela = async (id: string) => conUsuario(yo => esc.getFichaEscuelaImpl(yo, id))
export const getConectividadEscuela = async (id: string) => conUsuario(() => esc.getConectividadEscuelaImpl(id))
export const registrarReclamo = async (input: { school_id: string, tipo: string, asunto: string }) => conUsuario(yo => rc.registrarReclamoImpl(yo, input))
export const getReclamos = async () => conUsuario(() => rc.getReclamosImpl())
export const getAccesos = async () => conUsuario(yo => esc.getAccesosImpl(yo))
export const getMisEscuelas = async () => conUsuario(yo => esc.getMisEscuelasImpl(yo))
export const getExtrasEscuela = async (id: string) => conUsuario(yo => esc.getExtrasEscuelaImpl(yo, id))
export const getCruceReclamos = async () => conUsuario(yo => rc.getCruceReclamosImpl(yo))
export const getPuntosMapa = async () => conUsuario(() => esc.getPuntosMapaImpl())
export const getJefatura = async (id: string) => conUsuario(yo => esc.getJefaturaImpl(yo, id))
export const guardarJefatura = async (id: string, cambios: Record<string, unknown>) => conUsuario(yo => esc.guardarJefaturaImpl(yo, id, cambios))
export const getEdicionEscuela = async (id: string) => conUsuario(yo => esc.getEdicionEscuelaImpl(yo, id))
export const guardarEscuela = async (id: string, cambios: Record<string, unknown>) => conUsuario(yo => esc.guardarEscuelaImpl(yo, id, cambios))
export const guardarContacto = async (id: string, contactoId: string | null, contacto: ContactoInput) => conUsuario(yo => esc.guardarContactoImpl(yo, id, contactoId, contacto))
export const borrarContacto = async (id: string, contactoId: string) => conUsuario(yo => esc.borrarContactoImpl(yo, id, contactoId))
export const contactoPrincipal = async (id: string, contactoId: string) => conUsuario(yo => esc.principalContactoImpl(yo, id, contactoId))
export const getCronogramas = async () => conUsuario(yo => rc.getCronogramasImpl(yo))
export const avisarCronograma = async (id: string, aviso: AvisoCronograma) => conUsuario(yo => rc.avisarCronogramaImpl(yo, id, aviso))
export const getContactosCronograma = async (id: string) => conUsuario(yo => rc.getContactosCronogramaImpl(yo, id))
export const marcarCronograma = async (id: string, estado: EstadoSeguimiento, nota: string) => conUsuario(yo => rc.marcarCronogramaImpl(yo, id, estado, nota))
export const sincronizarCronogramasAhora = async () => conUsuario(yo => rc.sincronizarCronogramasAhoraImpl(yo))
export const reclamosAbiertosDe = async (schoolId: string) => conUsuario(() => rc.reclamosAbiertosDeImpl(schoolId))
export const resolverReclamo = async (id: string, nota: string | null) => conUsuario(yo => rc.resolverReclamoImpl(yo, id, nota))
export const actualizarReclamo = async (id: string, cambios: { estado?: EstadoReclamo, nro_incidencia?: string | null, notas?: string | null }) => conUsuario(yo => rc.actualizarReclamoImpl(yo, id, cambios))
export type { Borrador } from '@/lib/servidor/reclamos-cronogramas'
export const guardarBorradorReclamo = async (input: { school_id: string, tipo: string, asunto: string, para: string | null, cuerpo: string, adjuntos: { texto: string, enlace?: string }[], reemplaza_id?: string }) => conUsuario(yo => rc.guardarBorradorImpl(yo, input))
export const getBorradoresReclamo = async () => conUsuario(yo => rc.getBorradoresImpl(yo))
export const eliminarBorradorReclamo = async (id: string) => conUsuario(yo => rc.eliminarBorradorImpl(yo, id))
export const enviarBorradorReclamo = async (id: string, fecha: string | null) => conUsuario(yo => rc.enviarBorradorImpl(yo, id, fecha))

export const buscarOrganismos = async (query: string) => conUsuario(yo => ag.buscarOrganismos(yo, query))
export const ubicacionDe = async (schoolId: string | null, lugar: string | null) => conUsuario(yo => ag.ubicacionDe(yo, schoolId, lugar))
export const getFedItems = async (fedId: string, from: string, to: string) => conUsuario(yo => ag.getFedItems(yo, fedId, from, to))
// El equipo completo es de la coordinación y la administración; un FED recibe solo lo suyo (sus acciones y las que comparte).
export const getAllItems = async (from: string, to: string) => conUsuario(yo => (veTodoElEquipo(quienEs(yo)) ? ag.getAllItemsImpl(from, to) : ag.getFedItemsImpl(yo.fed.id, from, to)))
export const disponibilidad = async (fecha: string, ids: string[], excluir?: string) => conUsuario(yo => ag.disponibilidadImpl(yo, fecha, ids, excluir))
export const getEncuentros = async (from: string, to: string) => conUsuario(yo => ag.getEncuentros(yo, from, to))
export const saveItem = async (input: AgendaItemInput, id?: string, alcance: 'uno' | 'siguientes' = 'uno') => conUsuario(yo => ag.saveItemImpl({ ...input, fed_id: yo.fed.id }, id, alcance))
export const guardarVisita = async (inputs: AgendaItemInput[]) => conUsuario(yo => ag.guardarVisita(yo, inputs))
export const editarVisita = async (itemId: string, inputs: AgendaItemInput[], alcance: 'uno' | 'siguientes' = 'uno') => conUsuario(yo => ag.editarVisita(yo, itemId, inputs, alcance))
export const setItemStatus = async (id: string, _fedId: string, estado: AgendaItemInput['estado']) => conUsuario(yo => ag.setItemStatusImpl(id, yo.fed.id, estado))
export const deleteItem = async (id: string, _fedId: string, serie = false) => conUsuario(yo => ag.deleteItemImpl(id, yo.fed.id, serie))
export const cambiarEstadoVarias = async (ids: string[], estado: AgendaItemInput['estado']) => conUsuario(yo => ag.cambiarEstadoVariasImpl(ids, yo.fed.id, estado))
export const eliminarVarias = async (ids: string[]) => conUsuario(yo => ag.eliminarVariasImpl(ids, yo.fed.id))
export const moverFinDeSemana = async (ids: string[], destino: 'viernes' | 'lunes') => conUsuario(yo => ag.moverFinDeSemanaImpl(ids, yo.fed.id, destino))
export const getFeriados = async (from: string, to: string) => conUsuario(() => ag.getFeriadosImpl(from, to))
export const misTiposFrecuentes = async () => conUsuario(yo => ag.misTiposFrecuentes(yo))
export type { EventoInput } from '@/lib/servidor/eventos'
// Eventos DTE: los carga administración; cada FED registra su participación (acción "EVENTO DTE" vinculada).
export const getEventos = async (from: string, to: string) => conUsuario(yo => eventos.getEventos(yo, from, to))
export const listarEventos = async (anio: number) => conUsuario(yo => eventos.listarEventos(yo, anio))
export const guardarEvento = async (ev: EventoInput, id?: string) => conUsuario(yo => eventos.guardarEvento(yo, ev, id))
export const eliminarEvento = async (id: string) => conUsuario(yo => eventos.eliminarEvento(yo, id))
export const miParticipacion = async (eventoId: string) => conUsuario(yo => eventos.miParticipacion(yo, eventoId))
export const registrarParticipacion = async (eventoId: string, fechas: string[]) => conUsuario(yo => eventos.registrarParticipacion(yo, eventoId, fechas))

export const getClubes = async (fedId?: string) => conUsuario(yo => ag.getClubesImpl(veTodoElEquipo(quienEs(yo)) ? fedId : yo.fed.id))
export const setClubCierre = async (id: string, fecha: string | null) => conUsuario(yo => ag.setClubCierre(yo, id, fecha))
export const getNotificaciones = async (_fedId: string) => conUsuario(async yo => { await ag.avisarInactividad(yo).catch(e => console.error('avisarInactividad:', errMsgServer(e))); return ag.getNotificacionesImpl(yo.fed.id) })
export const marcarLeidas = async (_fedId: string, ids?: string[]) => conUsuario(yo => ag.marcarLeidasImpl(yo.fed.id, ids))
export const responder = async (itemId: string, _fedId: string, respuesta: 'acepta' | 'rechaza') => conUsuario(yo => ag.responderImpl(itemId, yo.fed.id, respuesta))
export const getHistorial = async (itemId: string) => conUsuario(yo => ag.getHistorial(yo, itemId))
export const crearClubPorIniciar = async (c: ClubPorIniciarInput) => conUsuario(yo => ag.crearClubPorIniciarImpl({ ...c, fed_id: yo.fed.id }))
export const updateMiPerfil = async (_fedId: string, datos: Pick<Fed, 'distritos_a_cargo' | 'carga_horaria' | 'ddjj'>) => conUsuario(yo => ag.updateMiPerfilImpl(yo.fed.id, datos))
export const addFeriado = async (_autorId: string, f: Omit<Feriado, 'id'>) => conUsuario(yo => ag.addFeriadoImpl(yo.fed.id, f))
export const deleteFeriado = async (_autorId: string, id: string) => conUsuario(yo => ag.deleteFeriadoImpl(yo.fed.id, id))
export const confirmarFeriado = async (id: string, confirmado: boolean) => conUsuario(yo => ag.confirmarFeriadoImpl(yo.fed.id, id, confirmado))

export type { EstadoFotos, PveEvento, PveMes, PveFed, ConteoFotos } from '@/lib/servidor/fotos-pve'
// Fotos en Google Drive: carpeta propia de cada FED, ordenada por día por la cuenta técnica.
export const estadoFotos = async () => conUsuario(yo => fotos.estadoFotos(yo))
export const guardarCarpetaFotos = async (url: string) => conUsuario(yo => fotos.guardarCarpetaFotos(yo, url))
export const ordenarMisFotos = async () => conUsuario(yo => fotos.ordenarMisFotos(yo))

// PVE (Planillas de Visita a Escuelas): el FED sube un PDF por mes a su carpeta; la coordinación las descarga juntas.
export const misPve = async (revisar = false) => conUsuario(yo => fotos.misPve(yo, revisar))
export const abrirCarpetaPve = async (mes: string) => conUsuario(yo => fotos.abrirCarpetaPve(yo, mes))
export const pveEquipo = async (mes: string) => run(() => fotos.pveEquipo(mes))
export const marcarPveEnviadas = async (mes: string) => run(() => fotos.marcarPveEnviadas(mes))
export const devolverPve = async (fedId: string, mes: string, motivo: string) => run(() => fotos.devolverPve(fedId, mes, motivo))
export const fotosDelDia = async (fedIds: string[], fecha: string, itemId?: string) => conUsuario(yo => fotos.fotosDelDia(yo, fedIds, fecha, itemId))
export const conteoFotos = async () => conUsuario(yo => fotos.conteoFotos(yo))

export type { Sesion } from '@/lib/servidor/sesion'
// Sesión: ingreso, salida y cambio de contraseña.
export const miSesion = async () => run(() => sesion.miSesion())
export const ingresar = async (email: string, password: string) => run(() => sesion.ingresar(email, password))
export const salir = async () => run(() => sesion.salir())
export const cambiarPassword = async (nueva: string, actual = '') => run(() => sesion.cambiarPassword(nueva, actual))

export type { UsuarioEquipo } from '@/lib/servidor/usuarios'
// Usuarios (sólo administración): alta de cuentas y reseteo de contraseñas.
export const listarUsuarios = async () => run(() => usuarios.listarUsuarios())
export const generarPasswordTemporal = async (fedId: string) => run(() => usuarios.generarPasswordTemporal(fedId))

// ---------- Comunicados del CED a los FED (la lógica está en lib/servidor/comunicados.ts) ----------
export type { ComunicadoPendiente, ComunicadoGestion } from '@/lib/servidor/comunicados'
export const getComunicadosPendientes = async () => conUsuario(yo => comunicados.comunicadosPendientes(yo))
export const marcarComunicadoLeido = async (id: string) => conUsuario(yo => comunicados.marcarLeido(yo, id))
export const getComunicadosGestion = async () => conUsuario(yo => comunicados.comunicadosGestion(yo))
export const crearComunicado = async (e: EntradaComunicado) => conUsuario(yo => comunicados.crear(yo, e))
export const editarComunicado = async (id: string, e: EntradaComunicado) => conUsuario(yo => comunicados.editar(yo, id, e))
export const eliminarComunicado = async (id: string) => conUsuario(yo => comunicados.eliminar(yo, id))
export const retirarComunicado = async (id: string) => conUsuario(yo => comunicados.retirar(yo, id))

// ---------- Reporte de jornadas pedagógicas (formulario de Nivel Central): sólo CED y administración ----------
export const getJornadas = async () => conUsuario(yo => jornadas.jornadasImpl(yo))
export const getParaHacer = async () => conUsuario(yo => parahacer.paraHacerImpl(yo))
export const marcarJornada = async (encuentroId: string, cargada: boolean) => conUsuario(yo => jornadas.marcarJornadaImpl(yo, encuentroId, cargada))
