// Cronogramas de conectividad (pestaña "Cronogramas" del consolidado de conectividad): lectura de la planilla, tipos y filtros de la sección (puro).
import { siglaNombre } from '@/lib/siglas'
import { titleCase } from '@/lib/format'
import { saludoDe } from '@/lib/reclamos'

// Planilla y pestaña de donde se leen (la cuenta técnica de la agenda tiene permiso de lector).
export const ID_CONSOLIDADO = '188st2Nu9AGTh9VbQzw3hPOnZQVQWED-jeOMaeJ-QOfQ'
export const PESTANA_CRONOGRAMAS = 'Cronogramas'
// Se guardan los cronogramas que terminan desde unos días antes de hoy: lo anterior no hace falta para avisar ni para el seguimiento.
export const DIAS_ATRAS = 45

// Tipos de la planilla, con el nombre que se muestra.
export const TIPOS_CRONOGRAMA: Record<string, string> = {
  LAC_M: 'Mantenimiento de piso',
  LAC: 'Instalación de piso',
  LAC_R: 'Reparación de piso',
  'Instalación Enlace/Certificación': 'Instalación de enlace y certificación',
  'Instalación SDWAN': 'Instalación SDWAN',
  Enlace: 'Enlace',
  'Certificación': 'Certificación',
  'Reubicación': 'Reubicación',
  'Asistencia técnica': 'Asistencia técnica',
}
export const etiquetaTipo = (t: string | null | undefined) => (t ? TIPOS_CRONOGRAMA[t.trim()] ?? t.trim() : 'Sin tipo')

// Cada tipo pertenece a una familia de color: así se reconocen de un vistazo en las listas.
export type FamiliaTipo = 'mantenimiento' | 'instalacion' | 'reparacion' | 'enlace' | 'otros'
export const FAMILIAS_TIPO: { id: FamiliaTipo, nombre: string, tipos: string }[] = [
  { id: 'mantenimiento', nombre: 'Mantenimiento', tipos: 'Mantenimiento de piso' },
  { id: 'instalacion', nombre: 'Instalación', tipos: 'Instalación de piso, SDWAN, enlace y certificación' },
  { id: 'reparacion', nombre: 'Reparación', tipos: 'Reparación de piso' },
  { id: 'enlace', nombre: 'Enlace y certificación', tipos: 'Enlace, Certificación' },
  { id: 'otros', nombre: 'Otros', tipos: 'Asistencia técnica, Reubicación' },
]
const FAMILIA_DE: Record<string, FamiliaTipo> = {
  LAC_M: 'mantenimiento', LAC: 'instalacion', 'Instalación SDWAN': 'instalacion', 'Instalación Enlace/Certificación': 'instalacion',
  LAC_R: 'reparacion', Enlace: 'enlace', 'Certificación': 'enlace',
}
export const familiaTipo = (t: string | null | undefined): FamiliaTipo => FAMILIA_DE[(t ?? '').trim()] ?? 'otros'

// ---------- Lectura de la planilla (CSV) ----------

// CSV según RFC 4180: comillas dobles, "" para una comilla y saltos de línea dentro de las celdas (los instaladores vienen uno por renglón).
export function parsearCsv(texto: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = [], celda = '', entreComillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (entreComillas) {
      if (c === '"') { if (texto[i + 1] === '"') { celda += '"'; i++ } else entreComillas = false }
      else celda += c
    } else if (c === '"') entreComillas = true
    else if (c === ',') { fila.push(celda); celda = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(celda); celda = ''
      if (fila.some(x => x !== '')) filas.push(fila)
      fila = []
    } else celda += c
  }
  fila.push(celda)
  if (fila.some(x => x !== '')) filas.push(fila)
  return filas
}

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const COLUMNAS = {
  estado: 'estado', predio: 'predio', inicio: 'fecha de inicio', fin: 'fecha de fin', instaladores: 'instalador responsable', proveedor: 'proveedor',
  cues: 'cues involucrados', nombre: 'nombre de las escuelas', semana: 'semana en que fue informado', tipo: 'tipo', distrito: 'distrito',
  nro: 'nro cronograma o incidencia', descripcion: 'descripcion de incidencia', observaciones: 'observaciones de territorio', establecimiento: 'tipo de establecimiento',
} as const
const OBLIGATORIAS: (keyof typeof COLUMNAS)[] = ['inicio', 'fin', 'cues', 'tipo']

// Fecha "d/m/aaaa" (con o sin ceros) a "aaaa-mm-dd"; null si no es una fecha válida.
export function fechaDe(s: string | null | undefined): string | null {
  const m = (s ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const d = Number(m[1]), mes = Number(m[2]), a = Number(m[3])
  if (mes < 1 || mes > 12 || d < 1 || a < 2000 || a > 2100) return null
  if (d > new Date(a, mes, 0).getDate()) return null
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// CUE de 8 dígitos de una celda ("61457700 - 61520100" trae dos).
export const cuesDe = (s: string | null | undefined): number[] => [...new Set((s ?? '').match(/\d{8}/g) ?? [])].map(Number)

export type FilaCronograma = {
  clave: string, cue: number, fecha_inicio: string, fecha_fin: string, tipo: string | null, proveedor: string | null, nro: string | null,
  semana: string | null, estado_planilla: string | null, instaladores: string | null, descripcion: string | null, observaciones: string | null,
  predio: string | null, distrito: string | null, nombre_planilla: string | null, tipo_establecimiento: string | null,
}
export type LecturaCronogramas = { filas: FilaCronograma[], descartadas: number, duplicadas: number }

const limpio = (s: string | undefined) => { const t = (s ?? '').replace(/[ \t]+/g, ' ').trim(); return t || null }
const claveDe = (nro: string | null, cue: number, inicio: string, tipo: string | null) => `${(nro ?? '').toLowerCase().replace(/\s+/g, '')}|${cue}|${inicio}|${(tipo ?? '').toLowerCase().replace(/\s+/g, '')}`

// Filas de la pestaña: una por cronograma y CUE. Si cambiaron los encabezados, falla con un mensaje claro en lugar de cargar datos mal.
export function leerCronogramas(csv: string): LecturaCronogramas {
  const todas = parsearCsv(csv)
  // El encabezado puede no estar en el primer renglón: se lo busca entre los primeros.
  const idx = Math.max(0, todas.slice(0, 10).findIndex(f => f.map(sinTildes).includes(COLUMNAS.inicio)))
  const tabla = todas.slice(idx)
  const encabezado = (tabla[0] ?? []).map(sinTildes)
  const col = Object.fromEntries(Object.entries(COLUMNAS).map(([k, nombre]) => [k, encabezado.indexOf(nombre)])) as Record<keyof typeof COLUMNAS, number>
  const faltan = OBLIGATORIAS.filter(k => col[k] < 0).map(k => COLUMNAS[k])
  if (faltan.length) throw new Error(`La planilla cambió: no se encuentran las columnas ${faltan.join(', ')}. Primer renglón leído: ${(todas[0] ?? []).slice(0, 8).map(x => x.slice(0, 30)).join(' | ') || '(vacío)'} (${todas.length} renglones)`)
  const v = (f: string[], k: keyof typeof COLUMNAS) => (col[k] >= 0 ? f[col[k]] : undefined)
  const porClave = new Map<string, FilaCronograma>()
  let descartadas = 0, duplicadas = 0
  for (const f of tabla.slice(1)) {
    const inicio = fechaDe(v(f, 'inicio')), cues = cuesDe(v(f, 'cues'))
    if (!inicio || !cues.length) { descartadas++; continue }
    const fin = fechaDe(v(f, 'fin')) ?? inicio
    const tipo = limpio(v(f, 'tipo')), nro = limpio(v(f, 'nro'))
    for (const cue of cues) {
      const clave = claveDe(nro, cue, inicio, tipo)
      if (porClave.has(clave)) duplicadas++
      porClave.set(clave, {
        clave, cue, fecha_inicio: inicio, fecha_fin: fin < inicio ? inicio : fin, tipo, proveedor: limpio(v(f, 'proveedor')), nro, semana: limpio(v(f, 'semana')),
        estado_planilla: limpio(v(f, 'estado')), instaladores: (v(f, 'instaladores') ?? '').split(/\r?\n/).map(x => x.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n') || null,
        descripcion: limpio(v(f, 'descripcion')), observaciones: limpio(v(f, 'observaciones')), predio: limpio(v(f, 'predio')),
        distrito: limpio(v(f, 'distrito')), nombre_planilla: limpio(v(f, 'nombre')), tipo_establecimiento: limpio(v(f, 'establecimiento')),
      })
    }
  }
  return { filas: [...porClave.values()], descartadas, duplicadas }
}

// Fecha ISO de hace `dias` días (para quedarse sólo con lo reciente).
export function haceDias(hoy: string, dias: number): string {
  const [a, m, d] = hoy.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d - dias)).toISOString().slice(0, 10)
}

// ---------- Sección Cronogramas ----------

// Estado que el equipo anota en la agenda (la planilla queda como referencia). El último que se anota es el vigente.
export const ESTADOS_SEGUIMIENTO = ['realizado', 'no_realizado', 'reprogramado'] as const
export type EstadoSeguimiento = typeof ESTADOS_SEGUIMIENTO[number]
export const ESTADO_SEGUIMIENTO_LABEL: Record<EstadoSeguimiento, string> = { realizado: 'Realizado', no_realizado: 'No se realizó', reprogramado: 'Reprogramado' }
// Para estos dos estados hay que anotar el motivo.
export const PIDE_MOTIVO: EstadoSeguimiento[] = ['no_realizado', 'reprogramado']
export const MAX_NOTA = 500
// Avisos que se anotan en el mismo historial: la jefatura distrital (la avisa el CED) y la escuela (la avisa el FED a cargo).
export const AVISOS_CRONOGRAMA = ['jefatura_avisada', 'escuela_avisada'] as const
export type AvisoCronograma = typeof AVISOS_CRONOGRAMA[number]
export type TipoSeguimiento = EstadoSeguimiento | AvisoCronograma
export const TIPO_SEGUIMIENTO_LABEL: Record<TipoSeguimiento, string> = { ...ESTADO_SEGUIMIENTO_LABEL, jefatura_avisada: 'Jefatura avisada', escuela_avisada: 'Escuela avisada' }
export type Seguimiento = { estado: TipoSeguimiento, nota: string | null, fed_id: string | null, created_at: string }

export type Cronograma = {
  id: string, cue: number, fecha_inicio: string, fecha_fin: string, tipo: string | null, proveedor: string | null, nro: string | null, semana: string | null,
  estado_planilla: string | null, instaladores: string | null, descripcion: string | null, observaciones: string | null, nombre_planilla: string | null,
  primera_vez_at: string, actualizado_at: string,
  // Del más nuevo al más viejo; el primero es el estado vigente.
  historial: Seguimiento[],
  school: { id: string, nombre: string | null, distrito: string | null, ciudad: string | null, fed_a_cargo: string | null, turnos?: string | null, direccion?: string | null, lat?: number | null, lon?: number | null, predio?: string | null } | null,
  // Otras escuelas del mismo predio (el rack puede estar en una de ellas: hay que avisar a ambas).
  comparte?: { cue: number | null, nombre: string | null }[],
  // Reclamos de conectividad abiertos de la escuela (sólo para mostrar el cruce).
  reclamos?: { id: string, tipo_label: string, estado: string, nro_incidencia: string | null, enviado_at: string }[],
}
export type PestanaCronogramas = 'proximos' | 'pasados' | 'todos'
export type FiltrosCronogramas = { pestana: PestanaCronogramas, busqueda: string, distrito: string, fed: string, tipo: string, proveedor: string, estado: '' | 'sin_marcar' | EstadoSeguimiento, aviso: '' | 'sin_escuela' | 'sin_jefatura', conReclamo: boolean }

const norm = (s: string | null | undefined) => sinTildes(s ?? '')
export const FILTROS_VACIOS: FiltrosCronogramas = { pestana: 'proximos', busqueda: '', distrito: '', fed: '', tipo: '', proveedor: '', estado: '', aviso: '', conReclamo: false }

// FED a cargo de una escuela: en la base figura por nombre ("Macarena Duarte Buschiazzo"); acá se compara con el nombre del perfil ("Macarena Duarte").
export function esDelFed(fedACargo: string | null | undefined, nombreFed: string): boolean {
  const a = norm(fedACargo), b = norm(nombreFed)
  return !!a && !!b && (a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `))
}

export const SIN_FED = 'Sin FED asignado'
export const sinFed = (fedACargo: string | null | undefined) => !fedACargo || norm(fedACargo) === norm(SIN_FED)

// Cómo salió (el último anotado); los avisos a la jefatura y a la escuela no cuentan como resultado.
export const estadoDe = (c: Pick<Cronograma, 'historial'>): EstadoSeguimiento | null => (c.historial.find(h => (ESTADOS_SEGUIMIENTO as readonly string[]).includes(h.estado))?.estado as EstadoSeguimiento | undefined) ?? null
export const avisoDe = (c: Pick<Cronograma, 'historial'>, aviso: AvisoCronograma): Seguimiento | null => c.historial.find(h => h.estado === aviso) ?? null
// Aviso a la jefatura: el CED y la administración; a la escuela: quien puede anotar el estado.
export const puedeAvisarJefatura = (quien: { esAdmin: boolean, rol: string }) => quien.esAdmin || quien.rol === 'coordinacion'

// Quién puede anotar el estado: la coordinación, la administración y el FED a cargo de la escuela.
export const puedeMarcar = (quien: { esAdmin: boolean, rol: string, nombre: string }, c: Pick<Cronograma, 'school'>) =>
  quien.esAdmin || quien.rol === 'coordinacion' || esDelFed(c.school?.fed_a_cargo, quien.nombre)

// Ventana del cronograma, por ejemplo "06/10 al 20/10" (o un solo día).
export const ventanaDe = (c: Pick<Cronograma, 'fecha_inicio' | 'fecha_fin'>) => {
  const corta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`
  return c.fecha_fin === c.fecha_inicio ? corta(c.fecha_inicio) : `${corta(c.fecha_inicio)} al ${corta(c.fecha_fin)}`
}

export const esProximo = (c: Pick<Cronograma, 'fecha_fin'>, hoy: string) => c.fecha_fin >= hoy

export function filtrarCronogramas(lista: Cronograma[], f: FiltrosCronogramas, hoy: string): Cronograma[] {
  const q = norm(f.busqueda)
  return lista.filter(c => {
    if (f.pestana === 'proximos' && !esProximo(c, hoy)) return false
    if (f.pestana === 'pasados' && esProximo(c, hoy)) return false
    if (f.distrito && norm(c.school?.distrito) !== norm(f.distrito)) return false
    if (f.fed && !(f.fed === SIN_FED ? sinFed(c.school?.fed_a_cargo) : esDelFed(c.school?.fed_a_cargo, f.fed))) return false
    if (f.aviso === 'sin_escuela' && avisoDe(c, 'escuela_avisada')) return false
    if (f.aviso === 'sin_jefatura' && avisoDe(c, 'jefatura_avisada')) return false
    if (f.estado && (f.estado === 'sin_marcar' ? estadoDe(c) !== null : estadoDe(c) !== f.estado)) return false
    if (f.conReclamo && !c.reclamos?.length) return false
    if (f.tipo && c.tipo !== f.tipo) return false
    if (f.proveedor && c.proveedor !== f.proveedor) return false
    if (q && !norm(`${c.cue} ${c.school?.nombre ?? c.nombre_planilla ?? ''} ${c.nro ?? ''} ${c.proveedor ?? ''} ${etiquetaTipo(c.tipo)} ${(c.comparte ?? []).map(o => `${o.cue ?? ''} ${o.nombre ?? ''}`).join(' ')}`).includes(q)) return false
    return true
  }).sort((a, b) => (f.pestana === 'pasados' ? b.fecha_inicio.localeCompare(a.fecha_inicio) : a.fecha_inicio.localeCompare(b.fecha_inicio)) || a.cue - b.cue)
}

export const resumenCronogramas = (lista: Cronograma[], hoy: string) => ({
  proximos: lista.filter(c => esProximo(c, hoy)).length,
  pasados: lista.filter(c => !esProximo(c, hoy)).length,
  sinFed: lista.filter(c => esProximo(c, hoy) && sinFed(c.school?.fed_a_cargo)).length,
  // Próximos a los que todavía no se les avisó a la escuela.
  sinAvisarEscuela: lista.filter(c => esProximo(c, hoy) && !avisoDe(c, 'escuela_avisada')).length,
  // Ya terminaron y nadie anotó cómo salió.
  sinCerrar: lista.filter(c => !esProximo(c, hoy) && estadoDe(c) === null).length,
  sinEscuela: lista.filter(c => esProximo(c, hoy) && !c.school).length,
})

// ---------- Referencia de la guía (programa, vigencia y puntos a tener en cuenta) ----------

// Programa del cronograma, según cómo lo informa la planilla en "Semana en que fue informado" ("407 - Cronograma Educar 1/10/26", "… PBA … REPROGRAMACION").
export const programaDe = (semana: string | null | undefined): 'Educar' | 'PBA' | null => (/\bpba\b/i.test(semana ?? '') ? 'PBA' : /\beducar\b/i.test(semana ?? '') ? 'Educar' : null)
export const esReprogramacion = (semana: string | null | undefined) => /reprogram/i.test(semana ?? '')
// La guía toma como rango de validez de un cronograma de 7 a 10 días desde las fechas indicadas.
export const VALIDEZ_DIAS: [number, number] = [7, 10]
export const validoHasta = (c: Pick<Cronograma, 'fecha_fin'>) => haceDias(c.fecha_fin, -VALIDEZ_DIAS[1])
// En PBA los datos de contacto de los directivos se informan al menos 48 hs antes de la fecha del cronograma.
export const HORAS_CONTACTO_PBA = 48
export const limiteContactosPba = (c: Pick<Cronograma, 'fecha_inicio'>) => haceDias(c.fecha_inicio, HORAS_CONTACTO_PBA / 24)
export const esVespertino = (turnos: string | null | undefined) => /vesp/i.test((turnos ?? '').normalize('NFD').replace(/[̀-ͯ]/g, ''))
export const fechaCortaAR = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`

// ---------- Avisos ----------

// Reparte los cronogramas entre los FED según la escuela a cargo; los que no tienen FED asignado van aparte (resumen del CED).
export function repartirPorFed<T extends { school: { fed_a_cargo: string | null } | null }>(filas: T[], feds: { id: string, nombre_completo: string }[]): { porFed: Map<string, T[]>, sinFed: T[] } {
  const porFed = new Map<string, T[]>(), sin: T[] = []
  for (const f of filas) {
    const fed = feds.find(x => esDelFed(f.school?.fed_a_cargo, x.nombre_completo))
    if (!fed) { sin.push(f); continue }
    porFed.set(fed.id, [...(porFed.get(fed.id) ?? []), f])
  }
  return { porFed, sinFed: sin }
}

const corta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`
type ParaAviso = Pick<Cronograma, 'fecha_inicio' | 'fecha_fin' | 'tipo' | 'cue'> & { school: { nombre: string | null } | null }
const quien = (c: ParaAviso) => `${c.school?.nombre ? siglaNombre(titleCase(c.school.nombre)) : `CUE ${c.cue}`} (${etiquetaTipo(c.tipo)}, ${ventanaDe(c)})`
// Hasta tres cronogramas en el texto; el resto se cuenta.
const lista = (cs: ParaAviso[]) => cs.slice(0, 3).map(quien).join(' · ') + (cs.length > 3 ? ` · y ${cs.length - 3} más` : '')
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

export const avisoNuevosFed = (cs: ParaAviso[]) => `${plural(cs.length, 'cronograma nuevo', 'cronogramas nuevos')} en tus escuelas: ${lista(cs)}`
export const avisoRecordatorioFed = (cs: ParaAviso[], cuando: string) => `Recordatorio: ${cs.length === 1 ? 'empieza' : 'empiezan'} ${cuando} ${plural(cs.length, 'cronograma', 'cronogramas')} en tus escuelas: ${lista(cs)}`
const sinFedTxt = (n: number) => (n ? ` (${n} sin FED asignado)` : '')
export const avisoNuevosCed = (total: number, sin: number) => `Cronogramas nuevos en la planilla: ${total}${sinFedTxt(sin)}`
export const avisoRecordatorioCed = (total: number, sin: number, cuando: string) => `Recordatorio: ${cuando} ${total === 1 ? 'empieza' : 'empiezan'} ${plural(total, 'cronograma', 'cronogramas')}${sinFedTxt(sin)}`
export const avisoEstadoCed = (estado: EstadoSeguimiento, c: ParaAviso, nota: string | null) => `${ESTADO_SEGUIMIENTO_LABEL[estado]}: ${quien(c)}${nota ? `. ${nota}` : ''}`

// Próximo día hábil después de `hoy` (sin fines de semana ni no laborables).
export function proximoHabil(hoy: string, noLab: Set<string> = new Set()): string {
  const d = new Date(`${hoy}T12:00:00Z`)
  do d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || noLab.has(d.toISOString().slice(0, 10)))
  return d.toISOString().slice(0, 10)
}
export const esHabil = (f: string, noLab: Set<string> = new Set()) => { const d = new Date(`${f}T12:00:00Z`).getUTCDay(); return d !== 0 && d !== 6 && !noLab.has(f) }
// "mañana" si el próximo día hábil es el día siguiente; si no, "el lunes 12/10".
export function cuandoEmpieza(hoy: string, habil: string): string {
  const manana = new Date(`${hoy}T12:00:00Z`); manana.setUTCDate(manana.getUTCDate() + 1)
  if (manana.toISOString().slice(0, 10) === habil) return 'mañana'
  const dia = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][new Date(`${habil}T12:00:00Z`).getUTCDay()]
  return `el ${dia} ${corta(habil)}`
}

// ---------- Mensaje a la escuela ----------

const esEnlace = (t: string) => /^https?:\/\//i.test(t.trim())

// Una línea de la columna de instaladores, lista para leer: sin el código inicial ("DT01 Cañete.Zenteno"), con los puntos entre apellidos como espacio,
// en formato nombre si venía todo en mayúsculas, y el DNI o CUIL entre paréntesis y sin puntos ("Sadoski Victor (DNI 35610950)"). Lo que no es un nombre
// ("DINA BA15") se deja como viene.
export function personaDe(linea: string): string {
  let t = linea.replace(/[ \t]+/g, ' ').trim()
  const doc = t.match(/[,;\-–]?\s*\b(DNI|CUIL|CUIT)\b[:.]?\s*([\d][\d.\-]*\d)/i)
  if (doc) t = t.replace(doc[0], ' ')
  t = t.replace(/^[A-Za-z]{1,3}\d{1,3}\s+(?=\S)/, '').replace(/(?<=\p{L})\.(?=\p{L})/gu, ' ').replace(/[\s,;\-–]+$/, '').replace(/\s+/g, ' ').trim()
  if (t === t.toUpperCase() && /\s/.test(t) && !/\d/.test(t)) t = titleCase(t)
  if (!doc) return t
  const tipo = doc[1].toUpperCase(), numero = tipo === 'DNI' ? doc[2].replace(/\D/g, '') : doc[2]
  return `${t ? `${t} ` : ''}(${tipo} ${numero})`
}

// Mensaje informativo para el directivo, redactado como el que se manda por WhatsApp: qué tarea del cronograma de conectividad se hace en la escuela, cuándo, quién (empresa y personal) y qué se necesita de la escuela
// (los cronogramas los establece otro organismo: no se piden ni se cambian fechas). El personal sale de la planilla con nombre y DNI o CUIL, o con el enlace que figura en la planilla.
const completa = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
const cuandoTxt = (c: Pick<Cronograma, 'fecha_inicio' | 'fecha_fin'>) => (c.fecha_fin === c.fecha_inicio ? `el día ${completa(c.fecha_inicio)}` : `entre los días ${completa(c.fecha_inicio)} y ${completa(c.fecha_fin)}`)
const TAREAS: Record<string, string> = {
  LAC_M: 'tareas de mantenimiento del piso tecnológico', LAC: 'la instalación del piso tecnológico', LAC_R: 'tareas de reparación del piso tecnológico',
  'Instalación Enlace/Certificación': 'la instalación del enlace de internet y su certificación', 'Instalación SDWAN': 'la instalación del equipo SD-WAN',
  Enlace: 'la instalación del enlace de internet', 'Certificación': 'la certificación del enlace de internet', 'Reubicación': 'la reubicación del equipamiento de conectividad', 'Asistencia técnica': 'una asistencia técnica',
}
const tareaDe = (t: string | null) => TAREAS[(t ?? '').trim()] ?? `tareas de ${etiquetaTipo(t).toLowerCase()}`
// Las instalaciones de enlace o de equipo SD-WAN se hacen en el rack de la escuela.
const pideRack = (t: string | null) => ['Instalación Enlace/Certificación', 'Instalación SDWAN', 'Enlace'].includes((t ?? '').trim())
// Los tipos que llevan las recomendaciones de Conectividad para la escuela (nuevos enlaces y equipos SD-WAN).
export const llevaRecomendaciones = (t: string | null | undefined) => ['Instalación Enlace/Certificación', 'Instalación SDWAN', 'Enlace', 'Certificación'].includes((t ?? '').trim())
export const RECOMENDACIONES_ENLACE = `Algunas aclaraciones de Conectividad para tener en cuenta:

- Si la escuela tiene piso tecnológico, el nuevo enlace se instala dentro del piso, en el WAN 2 del UTM: el filtrado de red se realiza a través de él.
- Si la escuela no tiene piso tecnológico, el módem del proveedor es el que realiza el filtrado.
- Los equipos SD-WAN también filtran contenido web: en escuelas con piso tecnológico, el equipo se coloca entre el módem del proveedor y el piso tecnológico.
- Ya no existen enlaces exclusivamente administrativos: todos los servicios son administrativos/pedagógicos.
- El responsable institucional es quien firma la conformidad del servicio. Una vez firmada es difícil revertir la instalación, por eso conviene consultar cualquier duda antes de firmar.
- Ante cualquier inconveniente con el servicio, se envía un correo detallando el problema, con una foto del módem y del equipo SD-WAN, y el nombre y contacto del responsable institucional.`

// `contacto` es el nombre de pila de la persona a la que se le escribe, si se sabe.
export function mensajeEscuela(c: Pick<Cronograma, 'cue' | 'fecha_inicio' | 'fecha_fin' | 'tipo' | 'proveedor' | 'instaladores' | 'semana'> & { school: { nombre: string | null } | null, nombre_planilla?: string | null }, ahora: Date, contacto?: string | null): { asunto: string, cuerpo: string } {
  const escuela = c.school?.nombre ? siglaNombre(titleCase(c.school.nombre)) : c.nombre_planilla ? titleCase(c.nombre_planilla) : `CUE ${c.cue}`
  const lugar = escuela.startsWith('CUE ') ? `la escuela ${escuela}` : `${escuela} (CUE ${c.cue})`
  const personal = (c.instaladores ?? '').split('\n').map(x => x.trim()).filter(Boolean)
  const enlaces = personal.filter(esEnlace), responsables = personal.filter(x => !esEnlace(x)).map(personaDe).filter(Boolean)
  const programa = programaDe(c.semana)
  const saludo = saludoDe(ahora), nombre = (contacto ?? '').trim().split(/\s+/)[0]
  const apertura = nombre ? `Hola ${titleCase(nombre)}, ${saludo}.` : `${saludo[0].toUpperCase()}${saludo.slice(1)}.`
  const quien = c.proveedor ? `personal de la empresa ${c.proveedor}` : 'personal técnico'
  const cuerpo = [
    `${apertura} Desde la Dirección de Tecnología Educativa informamos que, según el cronograma ${programa ? `de ${programa === 'Educar' ? 'EDUCAR' : programa}` : 'establecido'}, ${cuandoTxt(c)}, ${quien} realizará ${tareaDe(c.tipo)} en ${lugar}.`,
    responsables.length === 1 ? `El personal técnico asignado es: ${responsables[0]}.` : responsables.length > 1 ? `El personal técnico asignado será:\n${responsables.map(r => `- ${r}`).join('\n')}` : null,
    enlaces.length ? `Datos del personal técnico: ${enlaces.join(' ')}` : null,
    `Se informa para que la institución esté al tanto y pueda facilitar el acceso al personal técnico.${pideRack(c.tipo) ? ' Se solicita tener disponible y accesible el rack para poder llevar adelante la instalación.' : ''}`,
    'Saludos!',
  ].filter((x): x is string => !!x).join('\n\n')
  return { asunto: `Cronograma de conectividad: ${escuela}, ${ventanaDe(c)}`, cuerpo }
}

// Aviso al FED a cargo cuando el CED avisó a la jefatura.
export const avisoJefaturaFed = (c: ParaAviso) => `Se avisó a la jefatura: ${quien(c)}. Falta avisar a la escuela`
