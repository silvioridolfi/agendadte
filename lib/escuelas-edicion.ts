// Reglas para editar los datos de una escuela: quién puede, qué campos, cómo se validan y qué cambios quedan en el historial.
import { esDelFed } from '@/lib/cronogramas'
import { ubicacionEnRegion } from '@/lib/mapa'

export type NivelEdicion = 'todo' | 'basico'
export type QuienEdita = { esAdmin: boolean, rol: string, nombre: string }

// La administración y el CED editan todo; el FED a cargo, los datos del día a día. Las escuelas sin FED sólo las editan ellos.
export function nivelEdicion(yo: QuienEdita, fedACargo: string | null | undefined): NivelEdicion | null {
  if (yo.esAdmin || yo.rol === 'coordinacion') return 'todo'
  return esDelFed(fedACargo, yo.nombre) ? 'basico' : null
}

export type CampoEscuela = {
  clave: string, label: string, tipo: 'texto' | 'entero' | 'largo' | 'lista' | 'fecha' | 'cifras' | 'decimal', max: number,
  // Sólo la administración y el CED lo cambian.
  avanzado?: boolean,
  // Texto libre con sugerencias: las que ya figuran cargadas en otras escuelas.
  sugerencias?: boolean,
}
export const CAMPOS_ESCUELA: CampoEscuela[] = [
  { clave: 'direccion', label: 'Dirección', tipo: 'texto', max: 200 },
  { clave: 'lat', label: 'Latitud', tipo: 'decimal', max: 12 },
  { clave: 'lon', label: 'Longitud', tipo: 'decimal', max: 12 },
  { clave: 'alias', label: 'Alias', tipo: 'texto', max: 200 },
  { clave: 'nivel', label: 'Nivel', tipo: 'texto', max: 100, sugerencias: true },
  { clave: 'modalidad', label: 'Modalidad', tipo: 'texto', max: 100, sugerencias: true },
  { clave: 'turnos', label: 'Turnos', tipo: 'texto', max: 100, sugerencias: true },
  { clave: 'matricula', label: 'Matrícula', tipo: 'entero', max: 99999 },
  { clave: 'varones', label: 'Varones', tipo: 'entero', max: 99999 },
  { clave: 'mujeres', label: 'Mujeres', tipo: 'entero', max: 99999 },
  { clave: 'secciones', label: 'Secciones', tipo: 'entero', max: 9999 },
  { clave: 'observaciones', label: 'Observaciones', tipo: 'largo', max: 2000 },
  { clave: 'nombre', label: 'Nombre', tipo: 'texto', max: 200, avanzado: true },
  { clave: 'predio', label: 'Predio', tipo: 'entero', max: 99999999, avanzado: true },
  { clave: 'distrito', label: 'Distrito', tipo: 'lista', max: 100, avanzado: true },
  { clave: 'ciudad', label: 'Localidad', tipo: 'texto', max: 100, avanzado: true },
  { clave: 'fed_a_cargo', label: 'FED a cargo', tipo: 'lista', max: 100, avanzado: true },
  { clave: 'tipo_establecimiento', label: 'Tipo de establecimiento', tipo: 'lista', max: 100, avanzado: true },
  { clave: 'ambito', label: 'Ámbito', tipo: 'lista', max: 100, avanzado: true },
  // Conectividad: sólo el CED y la administración. El plan y el subplan deciden qué enlace tiene la escuela al armar un reclamo, por eso son listas cerradas.
  { clave: 'plan_enlace', label: 'Plan de enlace', tipo: 'lista', max: 100, avanzado: true },
  { clave: 'subplan_enlace', label: 'Subplan de enlace', tipo: 'lista', max: 100, avanzado: true },
  { clave: 'fecha_inicio_conectividad', label: 'Inicio de la conectividad', tipo: 'fecha', max: 10, avanzado: true },
  { clave: 'mb', label: 'Ancho de banda (Mb)', tipo: 'cifras', max: 5, avanzado: true },
  { clave: 'listado_conexion_internet', label: 'Listado de conexión', tipo: 'texto', max: 200, avanzado: true, sugerencias: true },
  { clave: 'proveedor_internet_pnce', label: 'Proveedor PNCE', tipo: 'texto', max: 100, avanzado: true, sugerencias: true },
  { clave: 'fecha_instalacion_pnce', label: 'Instalación PNCE', tipo: 'fecha', max: 10, avanzado: true },
  { clave: 'estado_instalacion_pba', label: 'Estado de instalación PBA', tipo: 'texto', max: 100, avanzado: true, sugerencias: true },
  { clave: 'proveedor_asignado_pba', label: 'Proveedor PBA', tipo: 'texto', max: 100, avanzado: true, sugerencias: true },
  { clave: 'plan_piso_tecnologico', label: 'Plan de piso tecnológico', tipo: 'lista', max: 100, avanzado: true },
  { clave: 'tipo_piso_instalado', label: 'Tipo de piso instalado', tipo: 'texto', max: 100, avanzado: true, sugerencias: true },
  { clave: 'proveedor_piso_tecnologico_cue', label: 'Proveedor del piso', tipo: 'texto', max: 100, avanzado: true, sugerencias: true },
  { clave: 'fecha_terminado_piso_tecnologico_cue', label: 'Piso terminado', tipo: 'fecha', max: 10, avanzado: true },
  { clave: 'reclamos_grupo_1_ani', label: 'ANI', tipo: 'texto', max: 50, avanzado: true },
  { clave: 'recurso_primario', label: 'Recurso primario', tipo: 'texto', max: 100, avanzado: true },
  { clave: 'access_id', label: 'Access ID', tipo: 'texto', max: 100, avanzado: true },
]
export const CLAVES_CONECTIVIDAD = ['plan_enlace', 'subplan_enlace', 'fecha_inicio_conectividad', 'mb', 'listado_conexion_internet', 'proveedor_internet_pnce', 'fecha_instalacion_pnce', 'estado_instalacion_pba', 'proveedor_asignado_pba', 'plan_piso_tecnologico', 'tipo_piso_instalado', 'proveedor_piso_tecnologico_cue', 'fecha_terminado_piso_tecnologico_cue', 'reclamos_grupo_1_ani', 'recurso_primario', 'access_id']
// Qué columnas alimentan las opciones de cada dato (los proveedores se sugieren entre sí).
const PROVEEDORES = ['proveedor_internet_pnce', 'proveedor_asignado_pba', 'proveedor_piso_tecnologico_cue']
export const ORIGEN_OPCIONES: Record<string, string[]> = {
  distrito: ['distrito'], tipo_establecimiento: ['tipo_establecimiento'], ambito: ['ambito'], nivel: ['nivel'], modalidad: ['modalidad'], turnos: ['turnos'],
  plan_enlace: ['plan_enlace'], subplan_enlace: ['subplan_enlace'], plan_piso_tecnologico: ['plan_piso_tecnologico'], listado_conexion_internet: ['listado_conexion_internet'],
  estado_instalacion_pba: ['estado_instalacion_pba'], tipo_piso_instalado: ['tipo_piso_instalado'],
  proveedor_internet_pnce: PROVEEDORES, proveedor_asignado_pba: PROVEEDORES, proveedor_piso_tecnologico_cue: PROVEEDORES,
}
export const COLS_EDITABLES = CAMPOS_ESCUELA.map(c => c.clave).join(', ')
export type ValoresEscuela = Record<string, string | number | null>
const campoDe = (clave: string) => CAMPOS_ESCUELA.find(c => c.clave === clave)

const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

// Un alias por variante: si quedaron "La Legión, La Legion" se conserva la primera.
export function limpiarAlias(texto: string): string {
  const vistos = new Set<string>()
  return texto.split(',').map(p => p.trim().replace(/\s+/g, ' ')).filter(p => {
    const k = sinTildes(p)
    if (!k || vistos.has(k)) return false
    vistos.add(k); return true
  }).join(', ')
}

export type Opciones = Record<string, string[]>

// Fechas: la base las guarda como texto "d/mm/aaaa" (día sin cero a la izquierda). El selector del navegador usa aaaa-mm-dd.
export function fechaValida(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const d = Number(m[1]), mes = Number(m[2]), a = Number(m[3])
  const f = new Date(Date.UTC(a, mes - 1, d))
  if (a < 2000 || a > 2100 || f.getUTCFullYear() !== a || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null
  return `${d}/${String(mes).padStart(2, '0')}/${a}`
}
export const fechaAIso = (texto: string | null | undefined) => { const m = (texto ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '' }
export const fechaDeIso = (iso: string) => { const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${Number(m[3])}/${m[2]}/${m[1]}` : '' }

// Número con punto o coma decimal, redondeado a 8 decimales (alcanza para ubicar un edificio). Vacío: null.
export function decimalValido(crudo: unknown, label: string): number | null {
  const t = typeof crudo === 'number' ? String(crudo) : typeof crudo === 'string' ? crudo.trim().replace(',', '.') : ''
  if (crudo !== null && crudo !== undefined && typeof crudo !== 'string' && typeof crudo !== 'number') throw new Error(`${label} no es válido`)
  if (!t) return null
  if (!/^-?\d{1,3}(\.\d+)?$/.test(t)) throw new Error(`${label} tiene que ser un número con decimales (por ejemplo -34.92145)`)
  return Math.round(Number(t) * 1e8) / 1e8
}

// Valida lo que llegó contra la escuela actual y devuelve sólo lo que cambió (con el valor anterior, para el historial).
// `nuevo` trae únicamente los campos que se quieren tocar. Lanza un error con el motivo si algo no es válido.
export type Cambio = { clave: string, label: string, anterior: string | null, nuevo: string | null, valor: string | number | null }
export function cambiosDeEscuela(actual: ValoresEscuela, nuevo: Record<string, unknown>, nivel: NivelEdicion, opciones: Opciones = {}): Cambio[] {
  const final: ValoresEscuela = { ...actual }
  const tocados: string[] = []
  for (const [clave, crudo] of Object.entries(nuevo)) {
    const campo = campoDe(clave)
    if (!campo) throw new Error(`El dato "${clave}" no se puede editar`)
    if (campo.avanzado && nivel !== 'todo') throw new Error(`"${campo.label}" lo cambia solo el CED o la administración`)
    let valor: string | number | null
    if (campo.tipo === 'entero') {
      if (crudo === null || crudo === undefined || String(crudo).trim() === '') valor = null
      else {
        const n = Number(String(crudo).trim())
        if (!Number.isInteger(n) || n < 0) throw new Error(`${campo.label} tiene que ser un número entero, sin negativos`)
        if (n > campo.max) throw new Error(`${campo.label} no puede superar ${campo.max}`)
        valor = n
      }
    } else if (campo.tipo === 'decimal') {
      valor = decimalValido(crudo, campo.label)
    } else if (campo.tipo === 'fecha') {
      const t = typeof crudo === 'string' ? crudo.trim() : ''
      if (crudo !== null && crudo !== undefined && typeof crudo !== 'string') throw new Error(`${campo.label} no es válido`)
      valor = t ? fechaValida(t) : null
      if (t && !valor) throw new Error(`${campo.label}: la fecha no es válida (día/mes/año)`)
    } else if (campo.tipo === 'cifras') {
      const t = typeof crudo === 'string' || typeof crudo === 'number' ? String(crudo).trim() : ''
      if (t && !/^\d{1,5}$/.test(t)) throw new Error(`${campo.label} tiene que ser un número de hasta 5 cifras`)
      valor = t ? String(Number(t)) : null
    } else {
      if (crudo !== null && crudo !== undefined && typeof crudo !== 'string') throw new Error(`${campo.label} no es válido`)
      const t = ((crudo as string | null) ?? '').trim()
      const texto = campo.tipo === 'largo' ? t : t.replace(/\s+/g, ' ')
      if (texto.length > campo.max) throw new Error(`${campo.label} no puede superar los ${campo.max} caracteres`)
      valor = campo.clave === 'alias' ? limpiarAlias(texto) || null : texto || null
      if (campo.clave === 'nombre' && !valor) throw new Error('El nombre no puede quedar vacío')
      if (campo.clave.startsWith('proveedor') && valor && /^[\d\s\-+()]+$/.test(valor as string)) throw new Error(`${campo.label} tiene que ser el nombre de la empresa, no un número`)
      if (campo.tipo === 'lista' && valor) {
        const permitidas = opciones[campo.clave as keyof Opciones]
        if (permitidas && !permitidas.includes(valor as string)) throw new Error(`${campo.label}: elegí una opción de la lista`)
      }
    }
    final[clave] = valor
    tocados.push(clave)
  }
  if ('lat' in nuevo || 'lon' in nuevo) {
    const { lat, lon } = final
    if ((lat == null) !== (lon == null)) throw new Error('Cargá la latitud y la longitud juntas (o dejá las dos vacías)')
    if (typeof lat === 'number' && typeof lon === 'number' && !ubicacionEnRegion(lat, lon)) throw new Error('La ubicación cae fuera de la región: revisá la latitud y la longitud (en Buenos Aires son negativas, por ejemplo -34.92 y -57.95)')
  }
  const { matricula, varones, mujeres } = final
  if (typeof matricula === 'number' && typeof varones === 'number' && typeof mujeres === 'number' && varones + mujeres > matricula) throw new Error('Varones más mujeres no pueden superar la matrícula')
  return tocados.filter(c => (actual[c] ?? null) !== (final[c] ?? null)).map(c => ({
    clave: c, label: campoDe(c)!.label, anterior: actual[c] == null ? null : String(actual[c]), nuevo: final[c] == null ? null : String(final[c]), valor: final[c] ?? null,
  }))
}

// ── Contactos ──
export const DOMINIO_LABORAL = '@abc.gob.ar'
export type ContactoInput = { nombre?: string | null, apellido?: string | null, cargo?: string | null, telefono?: string | null, correo?: string | null, correo_laboral?: string | null }
export type ContactoValido = { nombre: string | null, apellido: string | null, cargo: string | null, telefono: string | null, correo: string | null, correo_laboral: string | null }
const CORREO = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

export function validarContacto(c: ContactoInput): ContactoValido {
  const texto = (v: string | null | undefined, label: string, max: number) => {
    const t = (v ?? '').trim().replace(/\s+/g, ' ')
    if (t.length > max) throw new Error(`${label} no puede superar los ${max} caracteres`)
    return t || null
  }
  const nombre = texto(c.nombre, 'El nombre', 100), apellido = texto(c.apellido, 'El apellido', 100), cargo = texto(c.cargo, 'El cargo', 100)
  const tel = (c.telefono ?? '').trim()
  if (tel && (!/^[0-9 +()\-./]+$/.test(tel) || tel.replace(/\D/g, '').length < 6 || tel.replace(/\D/g, '').length > 15)) throw new Error('El teléfono tiene que tener entre 6 y 15 números')
  const correo = (c.correo ?? '').trim().toLowerCase(), laboral = (c.correo_laboral ?? '').trim().toLowerCase()
  if (correo && (!CORREO.test(correo) || correo.length > 120)) throw new Error('El correo no es válido')
  if (laboral && (!CORREO.test(laboral) || !laboral.endsWith(DOMINIO_LABORAL))) throw new Error(`El correo laboral tiene que terminar en ${DOMINIO_LABORAL}`)
  const r = { nombre, apellido, cargo, telefono: tel || null, correo: correo || null, correo_laboral: laboral || null }
  if (!r.nombre && !r.apellido && !r.telefono && !r.correo && !r.correo_laboral) throw new Error('Cargá al menos un nombre, un teléfono o un correo')
  return r
}

export const CAMPOS_CONTACTO: [keyof ContactoValido, string][] = [['nombre', 'Nombre'], ['apellido', 'Apellido'], ['cargo', 'Cargo'], ['telefono', 'Teléfono'], ['correo', 'Correo'], ['correo_laboral', 'Correo laboral']]
export const resumenContacto = (c: Partial<ContactoValido>) => [[c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre', c.cargo, c.telefono, c.correo_laboral || c.correo].filter(Boolean).join(' · ')

// Qué se anota en el historial al cambiar un contacto: una fila por dato modificado.
export type FilaHistorial = { seccion: string, campo: string, valor_anterior: string | null, valor_nuevo: string | null }
export function historialDeContacto(antes: Partial<ContactoValido>, despues: ContactoValido): FilaHistorial[] {
  const quien = [antes.nombre, antes.apellido].filter(Boolean).join(' ') || 'sin nombre'
  return CAMPOS_CONTACTO.filter(([k]) => (antes[k] ?? null) !== (despues[k] ?? null)).map(([k, label]) => ({ seccion: 'Contacto', campo: `${label} (${quien})`, valor_anterior: antes[k] ?? null, valor_nuevo: despues[k] ?? null }))
}

// Lo que trae la pantalla de edición de una escuela.
export type ContactoEditable = ContactoValido & { id: string, es_principal: boolean }
export type CambioEscuela = { id: string, seccion: string, campo: string, valor_anterior: string | null, valor_nuevo: string | null, created_at: string, autor: string | null }
export type OpcionesEscuela = Opciones
export type EdicionEscuela = { id: string, cue: number | null, nombre: string | null, nivel: NivelEdicion, valores: ValoresEscuela, contactos: ContactoEditable[], historial: CambioEscuela[], opciones: OpcionesEscuela }

// Sección del historial a la que pertenece cada dato (las mismas que usaba el buscador).
const ACADEMICO = ['nivel', 'modalidad', 'turnos', 'matricula', 'varones', 'mujeres', 'secciones']
export const seccionDe = (clave: string) => (clave === 'observaciones' ? 'Observaciones' : ACADEMICO.includes(clave) ? 'Académico' : CLAVES_CONECTIVIDAD.includes(clave) ? 'Conectividad' : 'General')
