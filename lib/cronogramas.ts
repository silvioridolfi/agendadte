// Cronogramas de Nivel Central (pestaña "Cronogramas" del consolidado de conectividad): lectura de la planilla, tipos y filtros de la sección (puro).

// Planilla y pestaña de donde se leen (la cuenta técnica de la agenda tiene permiso de lector).
export const ID_CONSOLIDADO = '188st2Nu9AGTh9VbQzw3hPOnZQVQWED-jeOMaeJ-QOfQ'
export const GID_CRONOGRAMAS = '1587668737'
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
  const tabla = parsearCsv(csv)
  const encabezado = (tabla[0] ?? []).map(sinTildes)
  const col = Object.fromEntries(Object.entries(COLUMNAS).map(([k, nombre]) => [k, encabezado.indexOf(nombre)])) as Record<keyof typeof COLUMNAS, number>
  const faltan = OBLIGATORIAS.filter(k => col[k] < 0).map(k => COLUMNAS[k])
  if (faltan.length) throw new Error(`La planilla cambió: no se encuentran las columnas ${faltan.join(', ')}`)
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

export type Cronograma = {
  id: string, cue: number, fecha_inicio: string, fecha_fin: string, tipo: string | null, proveedor: string | null, nro: string | null, semana: string | null,
  estado_planilla: string | null, instaladores: string | null, descripcion: string | null, observaciones: string | null, nombre_planilla: string | null,
  primera_vez_at: string, actualizado_at: string,
  school: { id: string, nombre: string | null, distrito: string | null, ciudad: string | null, fed_a_cargo: string | null } | null,
}
export type PestanaCronogramas = 'proximos' | 'pasados' | 'todos'
export type FiltrosCronogramas = { pestana: PestanaCronogramas, busqueda: string, distrito: string, fed: string, tipo: string, proveedor: string }

const norm = (s: string | null | undefined) => sinTildes(s ?? '')
export const FILTROS_VACIOS: FiltrosCronogramas = { pestana: 'proximos', busqueda: '', distrito: '', fed: '', tipo: '', proveedor: '' }

// FED a cargo de una escuela: en la base figura por nombre ("Macarena Duarte Buschiazzo"); acá se compara con el nombre del perfil ("Macarena Duarte").
export function esDelFed(fedACargo: string | null | undefined, nombreFed: string): boolean {
  const a = norm(fedACargo), b = norm(nombreFed)
  return !!a && !!b && (a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `))
}

export const SIN_FED = 'Sin FED asignado'

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
    if (f.fed && !(f.fed === SIN_FED ? !c.school?.fed_a_cargo || norm(c.school.fed_a_cargo) === norm(SIN_FED) : esDelFed(c.school?.fed_a_cargo, f.fed))) return false
    if (f.tipo && c.tipo !== f.tipo) return false
    if (f.proveedor && c.proveedor !== f.proveedor) return false
    if (q && !norm(`${c.cue} ${c.school?.nombre ?? c.nombre_planilla ?? ''} ${c.nro ?? ''} ${c.proveedor ?? ''} ${etiquetaTipo(c.tipo)}`).includes(q)) return false
    return true
  }).sort((a, b) => (f.pestana === 'pasados' ? b.fecha_inicio.localeCompare(a.fecha_inicio) : a.fecha_inicio.localeCompare(b.fecha_inicio)) || a.cue - b.cue)
}

export const resumenCronogramas = (lista: Cronograma[], hoy: string) => ({
  proximos: lista.filter(c => esProximo(c, hoy)).length,
  pasados: lista.filter(c => !esProximo(c, hoy)).length,
  sinFed: lista.filter(c => esProximo(c, hoy) && (!c.school?.fed_a_cargo || norm(c.school.fed_a_cargo) === norm(SIN_FED))).length,
  sinEscuela: lista.filter(c => esProximo(c, hoy) && !c.school).length,
})
