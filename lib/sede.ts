import type { School } from '@/lib/agenda'

// La DTE figura como "sede" en acciones institucionales y en formaciones virtuales hechas desde casa
// (se usa porque tiene CUE propio). Para las métricas no es una escuela ni pertenece a un distrito.
export const CUE_DTE = 60000000
export const GRUPO_VIRTUAL = 'Virtual'
export const GRUPO_DTE = 'DTE / institucional'
export const SIN_ESCUELA = 'Sin escuela'
const ESPECIALES = [GRUPO_VIRTUAL, GRUPO_DTE, SIN_ESCUELA]

export const esSedeDte = (s: Pick<School, 'cue'> | null | undefined) => Number(s?.cue) === CUE_DTE
// Cuenta como escuela alcanzada: tiene establecimiento y no es la DTE.
export const esEscuela = (s: Pick<School, 'cue'> | null | undefined) => !!s && !esSedeDte(s)

// Grupo "distrito" de una acción o encuentro: los encuentros virtuales van a "Virtual";
// lo hecho con sede DTE, a "DTE / institucional"; el resto, al distrito de la escuela.
export function grupoDistrito(x: { school?: Pick<School, 'cue' | 'distrito'> | null, modalidad?: string | null }): string {
  if (x.modalidad === 'Virtual') return GRUPO_VIRTUAL
  if (esSedeDte(x.school)) return GRUPO_DTE
  return x.school?.distrito ?? SIN_ESCUELA
}

export const esGrupoEspecial = (k: string) => ESPECIALES.includes(k)
// Distritos alfabéticamente y los grupos especiales al final (Virtual, DTE, Sin escuela).
export const ordenGrupos = (a: string, b: string) => {
  const ia = ESPECIALES.indexOf(a), ib = ESPECIALES.indexOf(b)
  return ia === -1 && ib === -1 ? a.localeCompare(b, 'es') : ia === -1 ? -1 : ib === -1 ? 1 : ia - ib
}
