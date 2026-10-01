import { CATEGORIA, type Accion, type School } from '@/lib/agenda'
import { esEscuela } from '@/lib/sede'

type ItemTerritorio = { accion: Accion, school_id: string | null, lugar: string | null, school: Pick<School, 'cue'> | null, modalidad?: string | null }

// Institucionales que, hechas dentro de una escuela, cuentan como "en territorio": la oficina R1 (funciona en la EES 31) y las
// reuniones presenciales. La reunión con Jefatura, la sede DTE y lo virtual quedan fuera.
const EN_ESCUELA: Accion[] = ['OFICINA R1', 'REUNIÓN']

// "En territorio": acciones en una escuela o sede, fuera de las tareas institucionales, más la oficina R1 y las reuniones
// presenciales (o sin modalidad cargada, anteriores al campo) que se hacen dentro de una escuela.
export function enTerritorio(i: ItemTerritorio): boolean {
  if (!i.school_id && !i.lugar) return false
  if (CATEGORIA[i.accion] !== 'institucional') return true
  return EN_ESCUELA.includes(i.accion) && esEscuela(i.school) && i.modalidad !== 'Virtual'
}
