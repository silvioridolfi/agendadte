// Reglas para editar los datos de una escuela: quién puede, qué campos, cómo se validan y qué cambios quedan en el historial.
import { esDelFed } from '@/lib/cronogramas'

export type NivelEdicion = 'todo' | 'basico'
export type QuienEdita = { esAdmin: boolean, rol: string, nombre: string }

// La administración y el CED editan todo; el FED a cargo, los datos del día a día. Las escuelas sin FED sólo las editan ellos.
export function nivelEdicion(yo: QuienEdita, fedACargo: string | null | undefined): NivelEdicion | null {
  if (yo.esAdmin || yo.rol === 'coordinacion') return 'todo'
  return esDelFed(fedACargo, yo.nombre) ? 'basico' : null
}

export type CampoEscuela = {
  clave: string, label: string, tipo: 'texto' | 'entero' | 'largo' | 'lista', max: number,
  // Sólo la administración y el CED lo cambian.
  avanzado?: boolean,
}
export const CAMPOS_ESCUELA: CampoEscuela[] = [
  { clave: 'direccion', label: 'Dirección', tipo: 'texto', max: 200 },
  { clave: 'alias', label: 'Alias', tipo: 'texto', max: 200 },
  { clave: 'nivel', label: 'Nivel', tipo: 'texto', max: 100 },
  { clave: 'modalidad', label: 'Modalidad', tipo: 'texto', max: 100 },
  { clave: 'turnos', label: 'Turnos', tipo: 'texto', max: 100 },
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
]
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

export type Opciones = Partial<Record<'distrito' | 'fed_a_cargo' | 'tipo_establecimiento' | 'ambito', string[]>>

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
    } else {
      if (crudo !== null && crudo !== undefined && typeof crudo !== 'string') throw new Error(`${campo.label} no es válido`)
      const t = ((crudo as string | null) ?? '').trim()
      const texto = campo.tipo === 'largo' ? t : t.replace(/\s+/g, ' ')
      if (texto.length > campo.max) throw new Error(`${campo.label} no puede superar los ${campo.max} caracteres`)
      valor = campo.clave === 'alias' ? limpiarAlias(texto) || null : texto || null
      if (campo.clave === 'nombre' && !valor) throw new Error('El nombre no puede quedar vacío')
      if (campo.tipo === 'lista' && valor) {
        const permitidas = opciones[campo.clave as keyof Opciones]
        if (permitidas && !permitidas.includes(valor as string)) throw new Error(`${campo.label}: elegí una opción de la lista`)
      }
    }
    final[clave] = valor
    tocados.push(clave)
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
export type OpcionesEscuela = Record<'distrito' | 'fed_a_cargo' | 'tipo_establecimiento' | 'ambito' | 'nivel' | 'modalidad' | 'turnos', string[]>
export type EdicionEscuela = { id: string, cue: number | null, nombre: string | null, nivel: NivelEdicion, valores: ValoresEscuela, contactos: ContactoEditable[], historial: CambioEscuela[], opciones: OpcionesEscuela }

// Sección del historial a la que pertenece cada dato (las mismas que usaba el buscador).
const ACADEMICO = ['nivel', 'modalidad', 'turnos', 'matricula', 'varones', 'mujeres', 'secciones']
export const seccionDe = (clave: string) => (clave === 'observaciones' ? 'Observaciones' : ACADEMICO.includes(clave) ? 'Académico' : 'General')
