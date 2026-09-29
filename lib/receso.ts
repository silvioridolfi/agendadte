// Enero es receso de verano: los cargos van de febrero a diciembre (regla fija, todos los años).
// Los clubes y las prácticas empiezan en marzo, cuando los estudiantes están en actividad.
import type { Feriado } from '@/lib/agenda'

export const NOMBRE_RECESO_VERANO = 'Vacaciones de verano'
export const esEnero = (fecha: string) => fecha.slice(5, 7) === '01'
export const mensajeEnero = (fecha: string) => `El ${fecha} es de enero, receso de verano: los cargos van de febrero a diciembre y no se pueden cargar acciones.`

// Inicio del período "año" (1/2) y del ciclo de clubes y prácticas (1/3).
export const inicioAnio = (y: number) => new Date(y, 1, 1, 12)
export const inicioCiclo = (y: number) => `${y}-03-01`

// Los días hábiles de enero entre dos fechas, como recesos (no están en la tabla de feriados: se arman al leerlos).
export function recesoEnero(desde: string, hasta: string): Feriado[] {
  const out: Feriado[] = []
  const fin = Date.parse(`${hasta}T12:00:00Z`)
  for (let t = Date.parse(`${desde}T12:00:00Z`); t <= fin; t += 86400000) {
    const d = new Date(t), fecha = d.toISOString().slice(0, 10), dia = d.getUTCDay()
    if (esEnero(fecha) && dia !== 0 && dia !== 6) out.push({ fecha, nombre: NOMBRE_RECESO_VERANO, tipo: 'receso', distrito: null, confirmado: true })
  }
  return out
}
