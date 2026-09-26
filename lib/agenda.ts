export const ACCIONES = [
  'VISITA TÉCNICA', 'VISITA PEDAGÓGICA', 'REUNIÓN', 'CLUB DE TECNOLOGÍA', 'PRÁCTICAS PROFESIONALIZANTES', 'TALLER/CAPACITACIÓN',
  'ASISTENCIA REMOTA', 'CONECTIVIDAD', 'ENTREGA DE TABLETS', 'CHECKLIST', 'ADMINISTRATIVO', 'PLANIFICACIÓN', 'OFICINA R1',
  'LICENCIA', 'PARO',
] as const
export const ESTADOS = ['planificada', 'realizada', 'reprogramada', 'cancelada'] as const

export type Accion = (typeof ACCIONES)[number]
export type Estado = (typeof ESTADOS)[number]

// Clasificación acordada con coordinación (ver "Pautas para la confección de las Planillas de Visita a Escuelas 2026").
// Las institucionales no suman ni a técnicas ni a pedagógicas.
export const CATEGORIAS = ['tecnica', 'pedagogica', 'institucional'] as const
export type Categoria = (typeof CATEGORIAS)[number]
export const CATEGORIA_LABEL: Record<Categoria, string> = { tecnica: 'Técnicas', pedagogica: 'Pedagógicas', institucional: 'Institucionales' }
export const CATEGORIA: Record<Accion, Categoria> = {
  'VISITA TÉCNICA': 'tecnica', 'ASISTENCIA REMOTA': 'tecnica', 'CONECTIVIDAD': 'tecnica', 'CHECKLIST': 'tecnica', 'ENTREGA DE TABLETS': 'tecnica',
  'VISITA PEDAGÓGICA': 'pedagogica', 'CLUB DE TECNOLOGÍA': 'pedagogica', 'PRÁCTICAS PROFESIONALIZANTES': 'pedagogica', 'TALLER/CAPACITACIÓN': 'pedagogica',
  'REUNIÓN': 'institucional', 'ADMINISTRATIVO': 'institucional', 'OFICINA R1': 'institucional', 'PLANIFICACIÓN': 'institucional', 'PARO': 'institucional', 'LICENCIA': 'institucional',
}
// Acciones que registran encuentros con participantes (N° de encuentro, destinatarios, inscriptos, asistentes).
export const CON_ENCUENTRO: Accion[] = ['CLUB DE TECNOLOGÍA', 'TALLER/CAPACITACIÓN', 'PRÁCTICAS PROFESIONALIZANTES']
// Sugerencias de sub-acción tomadas del instructivo de la DTE y del master regional (se puede escribir otra).
export const SUB_ACCIONES: Partial<Record<Accion, string[]>> = {
  'VISITA TÉCNICA': ['Desbloqueos', 'Actualización de S.O.', 'Cambio de pilas', 'Chequeo de enlaces', 'Pisos tecnológicos', 'Demanda escolar', 'Soporte técnico en territorio', 'Mantenimiento de equipamiento', 'Gestión de accesos y blanqueos'],
  'ASISTENCIA REMOTA': ['Desbloqueos', 'Gestión de accesos y blanqueos', 'Soporte técnico', 'Instalación de imágenes'],
  'CONECTIVIDAD': ['Relevamiento de conectividad', 'Gestión y seguimiento de incidencias', 'Ampliación u obra nueva', 'Gestión de reclamos institucionales'],
  'VISITA PEDAGÓGICA': ['Presentación', 'Relevamiento de autoridades', 'Propuestas de intervención', 'Planificación de actividades institucionales', 'Gestión administrativa de clubes', 'Acompañamiento a experiencias (JED)', 'Elaboración de materiales pedagógicos'],
  'TALLER/CAPACITACIÓN': ['Ciudadanía digital', 'Introducción a la programación', 'Plataforma ABC'],
  'ADMINISTRATIVO': ['Atención de consultas', 'Planificación de agenda', 'Elaboración de informes', 'Carga de bases de datos'],
  'REUNIÓN': ['Reunión institucional', 'Reunión técnica', 'Trabajo interregional'],
}

// DD.JJ. de horarios: un registro por día hábil (1 = lunes ... 5 = viernes).
export type DdjjDia = { dia: number; dte: string; dte_desde?: string; dte_hasta?: string; externo?: string }
export type Fed = { id: string; nombre_completo: string; distritos_a_cargo: string[]; carga_horaria: string | null; ddjj: DdjjDia[] }
// Participación en clubes, talleres y prácticas (hoja CAPACITACIONES del master). 0..N por acción.
export type Encuentro = {
  id: string
  agenda_item_id: string | null
  fed_id: string
  school_id: string | null
  lugar: string | null
  fecha: string
  tipo: Accion
  propuesta: string | null
  encuentro_n: number | null
  modalidad: Modalidad | null
  tipo_jornada: TipoJornada | null
  club_id: string | null
  es_cierre: boolean
  destinatarios: string | null
  inscriptos: number | null
  asistentes: number | null
  descripcion: string | null
  fotos_url: string | null
  origen: 'app' | 'planilla'
  school: School | null
}
// `id`: encuentro existente que se está editando (si no viene, se crea uno nuevo).
// Club: `club_id` de uno existente, o `nuevo_club` para iniciarlo con esta fecha. `es_cierre` finaliza el club.
export type EncuentroInput = Pick<Encuentro, 'propuesta' | 'encuentro_n' | 'modalidad' | 'destinatarios' | 'inscriptos' | 'asistentes'> & Partial<Pick<Encuentro, 'tipo_jornada' | 'descripcion' | 'club_id' | 'es_cierre'>> & { id?: string, nuevo_club?: boolean, encuentros_previstos?: number | null }
// Fila de public.establecimientos (misma fuente que el buscador DTE).
export type School = { id: string; cue: number | null; nombre: string | null; distrito: string | null; ciudad: string | null }
export type AgendaItem = {
  id: string
  fed_id: string
  school_id: string | null
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  accion: Accion
  sub_accion: string | null
  detalle: string | null
  estado: Estado
  cantidad: number | null
  lugar: string | null
  origen: 'app' | 'planilla'
  created_at: string
  updated_at: string
  school: School | null
  encuentros: Encuentro[]
}
export type AgendaItemInput = {
  fed_id: string
  school_id: string | null
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  accion: Accion
  sub_accion: string | null
  detalle: string | null
  estado: Estado
  cantidad: number | null
  lugar: string | null
  // Datos del encuentro (sólo clubes, talleres y prácticas); se guardan en agenda_encuentros.
  encuentro: EncuentroInput | null
}

// Feriados nacionales, días con fines turísticos y aniversarios distritales (tabla public.feriados).
// distrito null = aplica a todos; si no, sólo a quienes tienen ese distrito a cargo.
export type Feriado = { fecha: string; nombre: string; tipo: 'nacional' | 'turistico' | 'distrital'; distrito: string | null; confirmado: boolean }

export const MODALIDADES = ['Presencial', 'Virtual', 'Híbrido'] as const
export type Modalidad = (typeof MODALIDADES)[number]
export const TIPOS_JORNADA = ['Sensibilización', 'Formación', 'Presentación', 'Taller', 'Acompañamiento', 'Otro'] as const
export type TipoJornada = (typeof TIPOS_JORNADA)[number]

// Clubes de Tecnología (tabla public.clubes). Documento marco 2026: mínimo 8 encuentros, hasta 20 participantes.
export const CLUB_MIN_ENCUENTROS = 8
export const CLUB_MAX_PARTICIPANTES = 20
export const CLUB_DIAS_SIN_ACTIVIDAD = 30
export type ClubEncuentro = Pick<Encuentro, 'id' | 'fecha' | 'encuentro_n' | 'inscriptos' | 'asistentes' | 'tipo_jornada' | 'modalidad' | 'destinatarios' | 'es_cierre'>
export type Club = {
  id: string
  fed_id: string
  school_id: string | null
  lugar: string | null
  propuesta: string
  fecha_inicio: string
  fecha_cierre: string | null
  encuentros_previstos: number | null
  school: School | null
  encuentros: ClubEncuentro[]
}
export type ClubEstado = 'activo' | 'sin_actividad' | 'finalizado'

// Receso invernal 2026 (PBA): no cuenta para "sin actividad".
const RECESO = [['2026-07-20', '2026-07-31']]
export function diasHabilesEntre(desde: string, hasta: string) {
  const d = new Date(`${desde}T12:00:00`), end = new Date(`${hasta}T12:00:00`)
  let n = 0
  while (d < end) {
    d.setDate(d.getDate() + 1)
    const s = d.toISOString().slice(0, 10), w = d.getDay()
    if (w !== 0 && w !== 6 && !RECESO.some(([a, b]) => s >= a && s <= b)) n++
  }
  return n
}
export function ultimaActividad(c: Club) { return c.encuentros.reduce((m, e) => (e.fecha > m ? e.fecha : m), c.fecha_inicio) }
export function clubEstado(c: Club, hoy: string): ClubEstado {
  if (c.fecha_cierre) return 'finalizado'
  return diasHabilesEntre(ultimaActividad(c), hoy) > CLUB_DIAS_SIN_ACTIVIDAD ? 'sin_actividad' : 'activo'
}
// Encuentros distintos del club (varios registros el mismo día con distintos grupos cuentan como uno).
export function clubEncuentrosRealizados(c: Club) { return new Set(c.encuentros.map(e => e.fecha)).size }
