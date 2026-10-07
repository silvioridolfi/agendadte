// Jefaturas (organismos descentralizados): campos que edita el CED y validaciones.
import { decimalValido } from '@/lib/escuelas-edicion'
import { ubicacionEnRegion } from '@/lib/mapa'

export type CampoOrganismo = { clave: string, label: string, tipo: 'texto' | 'largo' | 'telefono' | 'correo' | 'decimal', max: number }
export const CAMPOS_ORGANISMO: CampoOrganismo[] = [
  { clave: 'domicilio', label: 'Domicilio', tipo: 'texto', max: 200 },
  { clave: 'localidad', label: 'Localidad', tipo: 'texto', max: 100 },
  { clave: 'telefono', label: 'Teléfono', tipo: 'telefono', max: 30 },
  { clave: 'email', label: 'Correo', tipo: 'correo', max: 120 },
  { clave: 'contacto_nombre', label: 'Nombre del contacto', tipo: 'texto', max: 100 },
  { clave: 'contacto_apellido', label: 'Apellido del contacto', tipo: 'texto', max: 100 },
  { clave: 'contacto_cargo', label: 'Cargo del contacto', tipo: 'texto', max: 100 },
  { clave: 'latitud', label: 'Latitud', tipo: 'decimal', max: 12 },
  { clave: 'longitud', label: 'Longitud', tipo: 'decimal', max: 12 },
  { clave: 'observaciones', label: 'Observaciones', tipo: 'largo', max: 2000 },
]
export const COLS_ORGANISMO = CAMPOS_ORGANISMO.map(c => c.clave).join(', ')
export type ValoresOrganismo = Record<string, string | number | null>
export type CambioOrganismo = { clave: string, label: string, anterior: string | null, nuevo: string | null, valor: string | number | null }
const CORREO = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

// Devuelve sólo lo que cambió. Lanza un error con el motivo si algo no es válido.
export function cambiosDeOrganismo(actual: ValoresOrganismo, nuevo: Record<string, unknown>): CambioOrganismo[] {
  const final: ValoresOrganismo = { ...actual }
  for (const [clave, crudo] of Object.entries(nuevo)) {
    const campo = CAMPOS_ORGANISMO.find(c => c.clave === clave)
    if (!campo) throw new Error(`El dato "${clave}" no se puede editar`)
    if (campo.tipo === 'decimal') { final[clave] = decimalValido(crudo, campo.label); continue }
    if (crudo !== null && crudo !== undefined && typeof crudo !== 'string') throw new Error(`${campo.label} no es válido`)
    const t = ((crudo as string | null) ?? '').trim()
    const texto = campo.tipo === 'largo' ? t : t.replace(/\s+/g, ' ')
    if (texto.length > campo.max) throw new Error(`${campo.label} no puede superar los ${campo.max} caracteres`)
    if (campo.tipo === 'telefono' && texto && (!/^[0-9 +()\-./]+$/.test(texto) || texto.replace(/\D/g, '').length < 6 || texto.replace(/\D/g, '').length > 15)) throw new Error('El teléfono tiene que tener entre 6 y 15 números')
    if (campo.tipo === 'correo' && texto && !CORREO.test(texto)) throw new Error('El correo no es válido')
    final[clave] = campo.tipo === 'correo' ? texto.toLowerCase() || null : texto || null
  }
  if ('latitud' in nuevo || 'longitud' in nuevo) {
    const { latitud, longitud } = final
    if ((latitud == null) !== (longitud == null)) throw new Error('Cargá la latitud y la longitud juntas (o dejá las dos vacías)')
    if (typeof latitud === 'number' && typeof longitud === 'number' && !ubicacionEnRegion(latitud, longitud)) throw new Error('La ubicación cae fuera de la región: revisá la latitud y la longitud')
  }
  const igual = (clave: string, x: unknown, y: unknown) => (CAMPOS_ORGANISMO.find(c => c.clave === clave)?.tipo === 'decimal' ? (x == null ? null : Number(x)) === (y == null ? null : Number(y)) : (x ?? null) === (y ?? null))
  return Object.keys(nuevo).filter(c => !igual(c, actual[c], final[c])).map(c => ({
    clave: c, label: CAMPOS_ORGANISMO.find(x => x.clave === c)!.label, anterior: actual[c] == null ? null : String(actual[c]), nuevo: final[c] == null ? null : String(final[c]), valor: final[c] ?? null,
  }))
}

// Ficha de una jefatura. `puedeEditar`: CED o administración.
export type Jefatura = { id: string, codigo: string, nombre: string, subtipo: string | null, distrito: string | null, valores: ValoresOrganismo, puedeEditar: boolean }
// La jefatura distrital de una escuela, para la línea de su ficha.
export type JefaturaResumen = { id: string, nombre: string, telefono: string | null, email: string | null }
