export const ACCIONES = [
  'VISITA TÉCNICA', 'VISITA PEDAGÓGICA', 'REUNIÓN', 'CLUB DE TECNOLOGÍA', 'PRÁCTICAS PROFESIONALIZANTES', 'TALLER/CAPACITACIÓN',
  'ASISTENCIA REMOTA', 'CONECTIVIDAD', 'ENTREGA DE EQUIPAMIENTO', 'ADMINISTRATIVO', 'PLANIFICACIÓN', 'OFICINA R1',
  'LICENCIA', 'PARO', 'EVENTO DTE', 'FORMACIÓN INTERNA',
  'REUNIÓN CON JEFATURA', 'ACOMPAÑAMIENTO A FED', 'GESTIÓN INSTITUCIONAL', 'SEGUIMIENTO DEL EQUIPO',
  'INFORME TÉCNICO', 'REUNIÓN CON INSPECCIÓN',
] as const
export const ESTADOS = ['planificada', 'realizada', 'reprogramada', 'cancelada'] as const

export type Accion = (typeof ACCIONES)[number]
// Texto corto de las etiquetas (el valor guardado no cambia).
const ETIQUETA_ACCION: Partial<Record<Accion, { corto: string, largo: string }>> = {
  'PRÁCTICAS PROFESIONALIZANTES': { corto: 'PEAT', largo: 'PEAT (Prácticas Educativas en Ambientes de Trabajo)' },
}
export const etiquetaAccion = (a: Accion) => ETIQUETA_ACCION[a]?.corto ?? a
export const nombreAccion = (a: Accion) => ETIQUETA_ACCION[a]?.largo ?? a
export type Estado = (typeof ESTADOS)[number]

// Clasificación acordada con coordinación (ver "Pautas para la confección de las Planillas de Visita a Escuelas 2026").
// Las institucionales no suman ni a técnicas ni a pedagógicas.
export const CATEGORIAS = ['tecnica', 'pedagogica', 'institucional'] as const
export type Categoria = (typeof CATEGORIAS)[number]
export const CATEGORIA_LABEL: Record<Categoria, string> = { tecnica: 'Técnicas', pedagogica: 'Pedagógicas', institucional: 'Institucionales' }
export const CATEGORIA: Record<Accion, Categoria> = {
  'VISITA TÉCNICA': 'tecnica', 'ASISTENCIA REMOTA': 'tecnica', 'CONECTIVIDAD': 'tecnica', 'ENTREGA DE EQUIPAMIENTO': 'tecnica',
  'VISITA PEDAGÓGICA': 'pedagogica', 'CLUB DE TECNOLOGÍA': 'pedagogica', 'PRÁCTICAS PROFESIONALIZANTES': 'pedagogica', 'TALLER/CAPACITACIÓN': 'pedagogica',
  'REUNIÓN': 'institucional', 'ADMINISTRATIVO': 'institucional', 'OFICINA R1': 'institucional', 'PLANIFICACIÓN': 'institucional', 'PARO': 'institucional', 'LICENCIA': 'institucional', 'EVENTO DTE': 'institucional', 'FORMACIÓN INTERNA': 'institucional',
  'REUNIÓN CON JEFATURA': 'institucional', 'ACOMPAÑAMIENTO A FED': 'institucional', 'GESTIÓN INSTITUCIONAL': 'institucional', 'SEGUIMIENTO DEL EQUIPO': 'institucional',
  'INFORME TÉCNICO': 'institucional', 'REUNIÓN CON INSPECCIÓN': 'institucional',
}
// Tareas propias de la coordinación (CED): el formulario las muestra primero al CED y no se ofrecen a los FED.
export const ACCIONES_CED: Accion[] = ['REUNIÓN', 'REUNIÓN CON JEFATURA', 'REUNIÓN CON INSPECCIÓN', 'ACOMPAÑAMIENTO A FED', 'SEGUIMIENTO DEL EQUIPO', 'GESTIÓN INSTITUCIONAL', 'INFORME TÉCNICO']
export const SOLO_CED: Accion[] = ['REUNIÓN CON JEFATURA', 'REUNIÓN CON INSPECCIÓN', 'ACOMPAÑAMIENTO A FED', 'SEGUIMIENTO DEL EQUIPO', 'GESTIÓN INSTITUCIONAL', 'INFORME TÉCNICO']
// Acciones que registran encuentros con participantes (N° de encuentro, destinatarios, inscriptos, asistentes).
export const CON_ENCUENTRO: Accion[] = ['CLUB DE TECNOLOGÍA', 'TALLER/CAPACITACIÓN', 'PRÁCTICAS PROFESIONALIZANTES']
// Sugerencias de sub-acción tomadas del instructivo de la DTE y del master regional (se puede escribir otra).
export const SUB_ACCIONES: Partial<Record<Accion, string[]>> = {
  'VISITA TÉCNICA': ['Desbloqueos', 'Actualización de S.O.', 'Cambio de pilas', 'Chequeo de enlaces', 'Pisos tecnológicos', 'Demanda escolar', 'Soporte técnico en territorio', 'Mantenimiento de equipamiento', 'Gestión de accesos y blanqueos'],
  'ASISTENCIA REMOTA': ['Desbloqueos', 'Gestión de accesos y blanqueos', 'Soporte técnico', 'Instalación de imágenes'],
  'CONECTIVIDAD': ['Checklist', 'Relevamiento de conectividad', 'Gestión y seguimiento de incidencias', 'Ampliación u obra nueva', 'Gestión de reclamos institucionales'],
  'VISITA PEDAGÓGICA': ['Presentación', 'Relevamiento de autoridades', 'Propuestas de intervención', 'Planificación de actividades institucionales', 'Gestión administrativa de clubes', 'Acompañamiento a experiencias (JED)', 'Elaboración de materiales pedagógicos'],
  'TALLER/CAPACITACIÓN': ['Ciudadanía digital', 'Introducción a la programación', 'Plataforma ABC'],
  'ADMINISTRATIVO': ['Atención de consultas', 'Planificación de agenda', 'Elaboración de informes', 'Carga de bases de datos'],
  'ENTREGA DE EQUIPAMIENTO': ['Tablets', 'Netbooks', 'Kits de robótica', 'Pisos tecnológicos', 'Otro equipamiento'],
  // Coordinación (según la planificación del CED 2026).
  'REUNIÓN CON JEFATURA': ['Jefatura Regional', 'Jefatura Distrital La Plata', 'Jefatura Distrital Berisso', 'Jefatura Distrital Ensenada', 'Jefatura Distrital Magdalena', 'Jefatura Distrital Brandsen', 'Jefatura Distrital Punta Indio'],
  'REUNIÓN CON INSPECCIÓN': ['Inicial', 'Primaria', 'Secundaria', 'Técnico Profesional', 'Especial', 'Adultos', 'Superior'],
  'SEGUIMIENTO DEL EQUIPO': ['Reunión quincenal', 'Seguimiento semanal'],
  'ACOMPAÑAMIENTO A FED': ['Acompañamiento en escuela', 'Apoyo a club', 'Apoyo a PEAT'],
  'GESTIÓN INSTITUCIONAL': ['Conectividad', 'Continuemos Estudiando', 'JED', 'Organización de capacitación'],
  'INFORME TÉCNICO': ['Informe mensual', 'Evaluación semestral', 'Sistematización de experiencias'],
  'REUNIÓN': ['Reunión de equipo (CED/FED)', 'Reunión entre FEDs', 'Reunión institucional', 'Reunión técnica', 'Trabajo interregional'],
}

// DD.JJ. de horarios: un registro por día hábil (1 = lunes ... 5 = viernes).
// DD.JJ. de horarios por día hábil (1 = lunes). `dte` es el texto legible del horario DTE (se arma a partir de las franjas);
// `dte2_*` es una segunda franja opcional; `cargos`, los otros cargos de ese día; `externo`, nota de texto heredada de la planilla.
export type CargoDia = { nombre: string; desde: string; hasta: string }
export type DdjjDia = { dia: number; dte: string; dte_desde?: string; dte_hasta?: string; dte2_desde?: string; dte2_hasta?: string; cargos?: CargoDia[]; externo?: string }
// rol 'coordinacion': perfil de coordinación (crea reuniones de equipo, no suma a las métricas por FED).
export type Fed = { id: string; nombre_completo: string; distritos_a_cargo: string[]; carga_horaria: string | null; ddjj: DdjjDia[]; rol: 'fed' | 'coordinacion'; carpeta_fotos_url?: string | null }
// Participación en clubes, talleres y prácticas (hoja CAPACITACIONES del master). 0..N por acción.
export type Encuentro = {
  id: string
  agenda_item_id: string | null
  fed_id: string
  school_id: string | null
  lugar: string | null
  fecha: string
  tipo: Accion
  // Escuela de origen de los estudiantes, si difiere de la sede (ej.: prácticas en otra escuela).
  escuela_origen: School | null
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
export type EncuentroInput = Pick<Encuentro, 'propuesta' | 'encuentro_n' | 'modalidad' | 'destinatarios' | 'inscriptos' | 'asistentes'> & Partial<Pick<Encuentro, 'tipo_jornada' | 'descripcion' | 'club_id' | 'es_cierre'>> & { id?: string, nuevo_club?: boolean, grupo?: string | null, escuela_origen_id?: string | null, encuentros_previstos?: number | null }
// Fila de public.establecimientos (misma fuente que el buscador DTE).
export type School = { id: string; cue: number | null; nombre: string | null; distrito: string | null; ciudad: string | null }
export type AgendaItem = {
  // Visita con varias acciones: todas comparten visita_id. `visita` (sólo en pantalla): las acciones de la visita, incluida ésta.
  visita_id?: string | null
  visita?: AgendaItem[]
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
  // Compañeros etiquetados ("acompañado por"): la acción también aparece en su calendario.
  participantes: { fed_id: string, respuesta?: 'pendiente' | 'acepta' | 'rechaza' }[]
  // Serie de acciones repetidas y club/práctica asociado (para completar cada encuentro).
  serie_id?: string | null
  club_id?: string | null
  // Grado o grupo del club/práctica (para distinguir varios grupos de una misma escuela).
  club?: { grupo: string | null } | null
  // Evento DTE al que corresponde la acción (participación registrada desde el calendario).
  evento_id?: string | null
  // Formación interna: modalidad, si asistió o la dictó, y quién la dictó.
  modalidad?: ModalidadEvento | null
  rol_formacion?: RolFormacion | null
  dictada_por?: string | null
}
export const MODALIDADES_EVENTO = ['Presencial', 'Virtual', 'Híbrido'] as const
export type ModalidadEvento = (typeof MODALIDADES_EVENTO)[number]
export const ROLES_FORMACION = ['Asistí', 'La dicté'] as const
export type RolFormacion = (typeof ROLES_FORMACION)[number]
// Eventos propios de la DTE (JED, jornadas): los carga administración y aparecen en el calendario de todos.
export type EventoDte = { id: string; nombre: string; fechas: string[]; hora_inicio: string | null; hora_fin: string | null; modalidad: ModalidadEvento; lugar: string | null; enlace: string | null; descripcion: string | null }
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
  modalidad?: ModalidadEvento | null
  rol_formacion?: RolFormacion | null
  dictada_por?: string | null
  // Datos del encuentro (sólo clubes, talleres y prácticas); se guardan en agenda_encuentros.
  encuentro: EncuentroInput | null
  // FEDs etiquetados (sin incluir a quien la crea).
  participantes?: string[]
  // Sólo al crear: repetir la acción los días de semana indicados (1 = lunes … 5 = viernes) hasta `hasta`.
  repeticion?: { dias: number[], hasta: string } | null
  // Visita con varias acciones (lo asigna el servidor).
  visita_id?: string | null
}

export type Notificacion = { id: string; tipo: 'etiqueta' | 'modificacion' | 'cancelacion' | 'respuesta' | 'evento' | 'pve'; detalle: string | null; leida: boolean; created_at: string; autor_id: string | null; item: AgendaItem | null }

// Feriados nacionales, días con fines turísticos y aniversarios distritales (tabla public.feriados).
// distrito null = aplica a todos; si no, sólo a quienes tienen ese distrito a cargo.
export type Feriado = { id?: string; fecha: string; nombre: string; tipo: 'nacional' | 'turistico' | 'distrital' | 'receso'; distrito: string | null; confirmado: boolean }

export const MODALIDADES = ['Presencial', 'Virtual', 'Híbrido'] as const
export type Modalidad = (typeof MODALIDADES)[number]
export const TIPOS_JORNADA = ['Sensibilización', 'Formación', 'Presentación', 'Taller', 'Acompañamiento'] as const
export type TipoJornada = (typeof TIPOS_JORNADA)[number]

// Clubes de Tecnología (tabla public.clubes). Documento marco 2026: mínimo 8 encuentros, hasta 20 participantes.
export const CLUB_MIN_ENCUENTROS = 8
export const CLUB_MAX_PARTICIPANTES = 20
export const CLUB_DIAS_SIN_ACTIVIDAD = 30
export type ClubEncuentro = Pick<Encuentro, 'id' | 'fecha' | 'propuesta' | 'school_id' | 'lugar' | 'school' | 'encuentro_n' | 'inscriptos' | 'asistentes' | 'tipo_jornada' | 'modalidad' | 'destinatarios' | 'es_cierre'>
export type Club = {
  id: string
  fed_id: string
  school_id: string | null
  lugar: string | null
  // Grado o grado + sección (ej.: "5° A"): cada grado es un club en sí mismo.
  grupo: string | null
  // Club de Tecnología o Prácticas Educativas en Ambientes de Trabajo (mismo registro por grupo).
  tipo: Accion
  // Escuela de origen de los estudiantes, si difiere de la sede (ej.: prácticas en otra escuela).
  escuela_origen: School | null
  propuesta: string
  // null = "por iniciar": planificado sin fecha; se completa al programar el primer encuentro.
  fecha_inicio: string | null
  fecha_cierre: string | null
  encuentros_previstos: number | null
  created_at?: string
  school: School | null
  encuentros: ClubEncuentro[]
}
export type ClubEstado = 'activo' | 'sin_actividad' | 'finalizado'

// Receso invernal 2026 (PBA), por si todavía no se cargaron los recesos de la tabla de feriados.
// AAAA-MM-DD con los campos locales de la fecha (mismo criterio que getDay, sin pasar por UTC).
const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const RECESO = [['2026-07-20', '2026-07-31']]
// Días hábiles entre dos fechas (sin contar `desde`). `noHabiles`: feriados y recesos cargados en la tabla.
export function diasHabilesEntre(desde: string, hasta: string, noHabiles?: Set<string>) {
  const d = new Date(`${desde}T12:00:00`), end = new Date(`${hasta}T12:00:00`)
  let n = 0
  while (d < end) {
    d.setDate(d.getDate() + 1)
    const s = ymdLocal(d), w = d.getDay()
    if (w !== 0 && w !== 6 && !noHabiles?.has(s) && !RECESO.some(([a, b]) => s >= a && s <= b)) n++
  }
  return n
}

// Fechas de una serie semanal: los días elegidos (1 = lunes … 5 = viernes) después de `desde` y hasta `hasta`,
// salteando no laborables. Máximo 60 fechas.
export function serieFechas(desde: string, dias: number[], hasta: string, noLaborables: Set<string> = new Set()) {
  const out: string[] = []
  const d = new Date(`${desde}T12:00:00`), end = new Date(`${hasta}T12:00:00`)
  while (out.length < 60) {
    d.setDate(d.getDate() + 1)
    if (d > end) break
    const s = ymdLocal(d)
    if (dias.includes(d.getDay()) && !noLaborables.has(s)) out.push(s)
  }
  return out
}
// Club con fecha de inicio (ya empezó o tiene su primer encuentro programado).
export type ClubIniciado = Club & { fecha_inicio: string }
export const iniciado = (c: Club): c is ClubIniciado => !!c.fecha_inicio
export function ultimaActividad(c: ClubIniciado) { return c.encuentros.reduce((m, e) => (e.fecha > m ? e.fecha : m), c.fecha_inicio) }
export function clubEstado(c: ClubIniciado, hoy: string, noHabiles?: Set<string>): ClubEstado {
  if (c.fecha_cierre) return 'finalizado'
  return diasHabilesEntre(ultimaActividad(c), hoy, noHabiles) > CLUB_DIAS_SIN_ACTIVIDAD ? 'sin_actividad' : 'activo'
}
// Encuentros distintos del club (varios registros el mismo día con distintos grupos cuentan como uno).
export function clubEncuentrosRealizados(c: Club) { return new Set(c.encuentros.map(e => e.fecha)).size }

// Niveles y modalidades para elegir el grado/curso de un club. Se sugiere según el nombre del establecimiento.
export type Nivel = { id: string, label: string, cursos: string[], cursoLabel: string }
export const NIVELES: Nivel[] = [
  { id: 'primaria', label: 'Primaria', cursoLabel: 'Grado', cursos: ['1°', '2°', '3°', '4°', '5°', '6°'] },
  { id: 'secundaria', label: 'Secundaria', cursoLabel: 'Año', cursos: ['1°', '2°', '3°', '4°', '5°', '6°'] },
  { id: 'tecnica', label: 'Secundaria técnica / agraria', cursoLabel: 'Año', cursos: ['1°', '2°', '3°', '4°', '5°', '6°', '7°'] },
  { id: 'cens', label: 'Secundaria de adultos (CENS)', cursoLabel: 'Año', cursos: ['1°', '2°', '3°'] },
  { id: 'adultos', label: 'Primaria de adultos', cursoLabel: 'Ciclo', cursos: ['1° ciclo', '2° ciclo', '3° ciclo'] },
  { id: 'especial', label: 'Especial', cursoLabel: 'Nivel', cursos: ['Inicial', 'Primario', 'Formación integral', 'Formación laboral'] },
  { id: 'inicial', label: 'Inicial', cursoLabel: 'Sala', cursos: ['Sala de 3', 'Sala de 4', 'Sala de 5'] },
  { id: 'superior', label: 'Superior', cursoLabel: 'Año', cursos: ['1°', '2°', '3°', '4°'] },
  { id: 'fp', label: 'Formación profesional / otros', cursoLabel: 'Grupo', cursos: ['Grupo único', 'Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4'] },
]
export const SECCIONES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
export function nivelDeEscuela(nombre: string | null | undefined): string {
  const n = (nombre ?? '').toUpperCase()
  if (/T[ÉE]CNICA|AGRARIA|C\.?E\.?P\.?T|PRODUCCI[ÓO]N TOTAL/.test(n) && /SECUNDARIA|PRODUCCI[ÓO]N|C\.?E\.?P\.?T/.test(n)) return 'tecnica'
  if (/NIVEL SECUNDARIO|C\.?E\.?N\.?S/.test(n)) return 'cens'
  if (/ADULTOS|ALFABETIZACI[ÓO]N|C\.?E\.?B\.?A\.?S/.test(n)) return 'adultos'
  if (/ESPECIAL|LABORAL/.test(n)) return 'especial'
  if (/JARD[ÍI]N/.test(n)) return 'inicial'
  if (/SUPERIOR|INSTITUTO/.test(n)) return 'superior'
  if (/SECUNDARIA|MEDIA|POLIMODAL/.test(n)) return 'secundaria'
  if (/PRIMARIA/.test(n)) return 'primaria'
  return 'fp'
}

// Trayectos por grupo con inicio y cierre: clubes y prácticas comparten registro, cada uno con su identidad visual.
export const TRAYECTOS = ['CLUB DE TECNOLOGÍA', 'PRÁCTICAS PROFESIONALIZANTES'] as const satisfies readonly Accion[]
export type Trayecto = (typeof TRAYECTOS)[number]
export const esTrayecto = (a: Accion | null | undefined): a is Trayecto => !!a && (TRAYECTOS as readonly string[]).includes(a)
export const TRAYECTO_MARCA: Record<Trayecto, { nombre: string, corto: string, plural: string, logo: string, degradado: string, acento: string, propuesta: string, nota: string }> = {
  'CLUB DE TECNOLOGÍA': { nombre: 'Club de Tecnología', corto: 'club', plural: 'clubes', logo: '/clubes/club-logo.png', degradado: 'bg-club-degradado-h', acento: '#5a2583', propuesta: 'Club de Tecnología', nota: 'Línea prioritaria DTE 2025–2027 · mínimo 8 encuentros, hasta 20 participantes' },
  'PRÁCTICAS PROFESIONALIZANTES': { nombre: 'Prácticas Educativas en Ambientes de Trabajo', corto: 'práctica', plural: 'prácticas', logo: '/practicas/peat-logo.png', degradado: 'bg-peat-degradado-h', acento: '#d81b72', propuesta: 'Prácticas Educativas en Ambientes de Trabajo', nota: 'PEAT · cada grupo de estudiantes es un trayecto con inicio y cierre' },
}
// Recordatorio del Instructivo Planillas Visita a Escuelas (apartado Ausencias).
export const RECORDATORIO_LICENCIA = 'En el caso de ausencias, especificá el motivo. El aviso se realiza en el momento en que se produce y dentro de las 48 hs posteriores se debe enviar la constancia de justificación.'
// Establecimiento DTE (lugar de trabajo): los paros se registran ahí.
export const CUE_DTE = 60000000

// Distritos de la Región 1 (para elegir los distritos a cargo en Mi perfil).
export const DISTRITOS_REGION = ['BERISSO', 'BRANDSEN', 'ENSENADA', 'LA PLATA', 'MAGDALENA', 'PUNTA INDIO']

// Orden de grados/grupos de menor a mayor ("4° A" < "5°" < "10°"), comparando los números como números.
export const ordenGrupo = (a: string | null | undefined, b: string | null | undefined) => (a ?? '').localeCompare(b ?? '', 'es', { numeric: true, sensitivity: 'base' })
