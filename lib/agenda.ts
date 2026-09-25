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
  modalidad: 'Presencial' | 'Virtual' | null
  destinatarios: string | null
  inscriptos: number | null
  asistentes: number | null
  descripcion: string | null
  fotos_url: string | null
  origen: 'app' | 'planilla'
  school: School | null
}
// `id`: encuentro existente que se está editando (si no viene, se crea uno nuevo).
export type EncuentroInput = Pick<Encuentro, 'propuesta' | 'encuentro_n' | 'modalidad' | 'destinatarios' | 'inscriptos' | 'asistentes'> & { id?: string }
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
