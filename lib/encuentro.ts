// Reglas de los encuentros de clubes y prácticas: mínimo informativo, número de encuentro, cuándo una acción pasa a realizada y choques de horario.
import { CLUB_MIN_ENCUENTROS, esTrayecto, type Estado } from '@/lib/agenda'

// Sólo los clubes de tecnología tienen un mínimo de encuentros (8): después no importa si son más. Las prácticas se cumplen por horas, sin mínimo.
export const minEncuentros = (tipo: string | null | undefined): number | null => (tipo === 'CLUB DE TECNOLOGÍA' ? CLUB_MIN_ENCUENTROS : null)

// Texto informativo del mínimo ("mínimo 8 · faltan 3" / "mínimo 8 · cumplido"); vacío donde no hay mínimo.
export function textoMinimo(tipo: string | null | undefined, realizados: number): string {
  const min = minEncuentros(tipo)
  if (min === null) return ''
  return realizados >= min ? `mínimo ${min} · cumplido` : `mínimo ${min} · faltan ${min - realizados}`
}

type EncuentroNum = { encuentro_n: number | null, fecha: string, agenda_item_id?: string | null, item?: { estado: string } | null }

// Un encuentro sin acción asociada (planilla) ya se hizo; con acción, cuenta según su estado. Los cancelados no cuentan.
const estadoEnc = (e: EncuentroNum) => e.item?.estado ?? 'realizada'
export const esPendiente = (e: EncuentroNum) => ['planificada', 'reprogramada'].includes(estadoEnc(e))

// Número del encuentro de un club en `fecha`: sigue al último encuentro ya realizado (el mayor número cargado o la cantidad de fechas
// distintas: dos filas del mismo día son un solo encuentro) y suma las fechas planificadas anteriores (`previas`, además de las del
// propio club). Los planificados nunca alimentan la cuenta de los realizados, así no se "contagian" números entre grupos ni fechas.
export function proximoEncuentro(encuentros: EncuentroNum[], fecha?: string, excluirItem?: string, previas: string[] = []): number {
  const otros = encuentros.filter(e => !excluirItem || e.agenda_item_id !== excluirItem)
  const hechos = otros.filter(e => !esPendiente(e) && estadoEnc(e) !== 'cancelada' && (!fecha || e.fecha <= fecha))
  const base = Math.max(hechos.reduce((m, e) => Math.max(m, e.encuentro_n ?? 0), 0), new Set(hechos.map(e => e.fecha)).size)
  const hechas = new Set(hechos.map(e => e.fecha))
  const planificadas = new Set([...otros.filter(esPendiente).map(e => e.fecha), ...previas].filter(f => !!fecha && f < fecha && !hechas.has(f)))
  return base + planificadas.size + 1
}

// Una acción de club o práctica de hoy o anterior, todavía planificada, pasa a realizada cuando se cargan datos del encuentro
// (participantes reales, descripción o cierre). Las canceladas y las futuras no se tocan.
export function estadoAlCompletar(p: { accion: string | null, estado: Estado, fecha: string, hoy: string, inscriptos: string, asistentes: string, descripcion: string, esCierre: boolean }): Estado {
  if (!esTrayecto(p.accion as never) || (p.estado !== 'planificada' && p.estado !== 'reprogramada') || p.fecha > p.hoy) return p.estado
  // Los inscriptos vienen precargados del primer encuentro: no alcanzan para dar por realizado el encuentro.
  const conDatos = p.asistentes.trim() !== '' || p.descripcion.trim() !== '' || p.esCierre
  return conDatos ? 'realizada' : p.estado
}

// ¿Se pisan dos horarios (HH:MM)? Uno a continuación del otro (12:00–13:00 y 13:00–14:00) no se pisan; sin horario de inicio no se puede decir.
export function horariosSePisan(a: { ini: string, fin: string }, b: { ini: string, fin: string }): boolean {
  return !!a.ini && !!b.ini && (a.ini < (b.fin || b.ini) || a.ini === b.ini) && (b.ini < (a.fin || a.ini) || a.ini === b.ini)
}

// Propuestas más usadas en los clubes (la primera es la de siempre); "Otra" permite escribir una propia.
export const PROPUESTAS_DE_CLUB = ['Club de Tecnología', 'Ciudadanía Digital', 'Convivencia Digital', 'IA: Desafío y Oportunidades', 'Inicial (Programación y Robotita)', 'Programación - Robótica (No en inicial)',
  'Edición de Audio y Video', 'Edición Gráfica', 'Podcasts - Microrrelatos Sonoros', 'Radios Escolares', 'Contenidos Digitales Interactivos', 'Aplicaciones Educativas']

// Destinatarios: opciones fijas (el grado del club se suma como "Estudiantes de 5°"). Se guardan como texto separado por comas.
export const DESTINATARIOS_BASE = ['Docentes', 'Familias', 'Equipo de Conducción', 'JR', 'JD', 'IE']
export const destinatarioEstudiantes = (grupo: string | null | undefined) => (grupo?.trim() ? `Estudiantes de ${grupo.trim()}` : 'Estudiantes')
export const opcionesDestinatarios = (grupo: string | null | undefined) => [destinatarioEstudiantes(grupo), ...DESTINATARIOS_BASE]
export const partirDestinatarios = (texto: string): string[] => texto.split(',').map(x => x.trim()).filter(Boolean)
export const unirDestinatarios = (l: string[]): string => l.join(', ')

// Inscriptos del club: los del primer encuentro que los tenga (se definen al iniciar y se mantienen hasta el cierre).
export function inscriptosDelClub(encuentros: { fecha: string, inscriptos: number | null }[]): number | null {
  return [...encuentros].filter(e => e.inscriptos != null).sort((a, b) => a.fecha.localeCompare(b.fecha))[0]?.inscriptos ?? null
}

// ¿El cambio toca la fecha, el horario, el lugar, el tipo o el club? Sólo entonces tiene sentido preguntar si aplica a toda la serie.
export function cambiaLaSerie(antes: { fecha: string, hora_inicio: string | null, hora_fin: string | null, school_id: string | null, lugar: string | null, accion: string | null },
  ahora: { fecha: string, hora_inicio: string, hora_fin: string, school_id: string | null, lugar: string, accion: string | null }): boolean {
  const hh = (h: string | null) => (h ?? '').slice(0, 5)
  return antes.fecha !== ahora.fecha || hh(antes.hora_inicio) !== hh(ahora.hora_inicio) || hh(antes.hora_fin) !== hh(ahora.hora_fin)
    || (antes.school_id ?? null) !== (ahora.school_id ?? null) || (antes.lugar ?? '') !== (ahora.lugar ?? '') || antes.accion !== ahora.accion
}

// Clubes (o prácticas) que el FED ya tiene ese día: se sugieren al cargar una acción nueva. Sin repetir y sin canceladas.
export function clubesDelDia<T extends { club_id?: string | null, accion: string | null, estado: string, fed_id: string }>(items: T[], accion: string | null, fedId: string): string[] {
  return [...new Set(items.filter(i => i.fed_id === fedId && i.accion === accion && i.club_id && i.estado !== 'cancelada').map(i => i.club_id!))]
}

// Cursos divididos en grupos: las prácticas se cuentan por curso (escuela + cohorte), no por grupo. Sin cohorte, cada grupo es una unidad.
export const unidadDe = (c: { id: string, school_id: string | null, lugar: string | null, cohorte?: string | null, escuela_origen?: { id: string } | null }): string =>
  c.cohorte?.trim() ? `${c.escuela_origen?.id ?? c.school_id ?? `lugar:${c.lugar ?? ''}`}|${c.cohorte.trim().toLowerCase()}` : c.id

// Escuela con la que se identifica un club o grupo: en los clubes, donde funcionan; en las prácticas (que se hacen en varios lugares), la escuela de origen de los estudiantes.
export const escuelaDelClub = <S,>(c: { tipo: string, school: S | null, escuela_origen: S | null }): S | null =>
  c.tipo === 'PRÁCTICAS PROFESIONALIZANTES' ? c.escuela_origen ?? c.school : c.school

const PESO_ESTADO: Record<string, number> = { activo: 0, sin_actividad: 1, finalizado: 2 }
// Cantidad de unidades por estado: un curso con grupos en estados distintos cuenta una vez, en el más activo de sus grupos.
export function contarUnidades(lista: { c: { id: string, school_id: string | null, lugar: string | null, cohorte?: string | null, escuela_origen?: { id: string } | null }, estado: string }[]): { total: number, porEstado: Record<string, number> } {
  const mejor = new Map<string, string>()
  for (const { c, estado } of lista) {
    const k = unidadDe(c), previo = mejor.get(k)
    if (previo === undefined || (PESO_ESTADO[estado] ?? 9) < (PESO_ESTADO[previo] ?? 9)) mejor.set(k, estado)
  }
  const porEstado: Record<string, number> = {}
  for (const e of mejor.values()) porEstado[e] = (porEstado[e] ?? 0) + 1
  return { total: mejor.size, porEstado }
}
