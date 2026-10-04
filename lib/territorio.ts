import { CATEGORIA, type Accion, type School } from '@/lib/agenda'
import { esEscuela } from '@/lib/sede'

type ItemTerritorio = { accion: Accion, school_id: string | null, lugar: string | null, school: Pick<School, 'cue'> | null, modalidad?: string | null, visita?: ItemTerritorio[] }

// La oficina R1 funciona en la EES 31: es siempre territorio, aunque la acción se cargue con la DTE como sede (para que figure sin
// escuela fija). La asistencia remota es siempre virtual: la DTE figura ahí como sede sólo para registrar trabajo sin escuela fija o
// que se hace en casa, y nunca es territorio. Las reuniones presenciales cuentan si se hacen dentro de una escuela; la reunión con
// Jefatura, la sede DTE y lo virtual quedan fuera.
const SIEMPRE_TERRITORIO: Accion[] = ['OFICINA R1']
const NUNCA_TERRITORIO: Accion[] = ['ASISTENCIA REMOTA']
const EN_ESCUELA: Accion[] = ['REUNIÓN']

function accionEnTerritorio(i: ItemTerritorio): boolean {
  if (NUNCA_TERRITORIO.includes(i.accion)) return false
  if (SIEMPRE_TERRITORIO.includes(i.accion)) return i.modalidad !== 'Virtual'
  if (!i.school_id && !i.lugar) return false
  if (CATEGORIA[i.accion] !== 'institucional') return true
  return EN_ESCUELA.includes(i.accion) && esEscuela(i.school) && i.modalidad !== 'Virtual'
}

// "En territorio": acciones en una escuela o sede, fuera de las tareas institucionales, más la oficina R1 y las reuniones
// presenciales (o sin modalidad cargada, anteriores al campo) que se hacen dentro de una escuela. Una visita con varias acciones
// cuenta si alguna de sus etiquetas cuenta.
export function enTerritorio(i: ItemTerritorio): boolean {
  return (i.visita?.length ? i.visita : [i]).some(accionEnTerritorio)
}
