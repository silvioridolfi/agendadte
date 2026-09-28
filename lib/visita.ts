// Visita con varias acciones: cada tipo marcado se guarda como una acción propia, con la misma escuela,
// fecha, horario y acompañantes. Acá se arma el pedido de cada tipo a partir de los datos comunes.
import { CATEGORIA, CON_ENCUENTRO, type Accion, type AgendaItemInput, type Modalidad } from '@/lib/agenda'

// Datos propios de cada tipo dentro de la visita.
export type DatosTipo = {
  sub_accion: string, cantidad: string, detalle: string,
  propuesta: string, encuentro_n: string, destinatarios: string, modalidad: Modalidad, inscriptos: string, asistentes: string,
}
export const datosVacios = (): DatosTipo => ({ sub_accion: '', cantidad: '', detalle: '', propuesta: '', encuentro_n: '', destinatarios: '', modalidad: 'Presencial', inscriptos: '', asistentes: '' })

// Tipos que no se combinan: clubes y prácticas (flujo propio), paro, licencia, eventos DTE y formación interna (datos propios).
const NO_SUMABLES: Accion[] = ['CLUB DE TECNOLOGÍA', 'PRÁCTICAS PROFESIONALIZANTES', 'PARO', 'LICENCIA', 'EVENTO DTE', 'FORMACIÓN INTERNA']
export const esSumable = (a: Accion | null): a is Accion => !!a && !NO_SUMABLES.includes(a)

// Elegir un tipo: si ambos se pueden sumar, se agrega o se quita de la visita; si no, reemplaza la selección.
export function alternarTipo(elegidos: Accion[], tipo: Accion): Accion[] {
  if (elegidos.includes(tipo)) return elegidos.filter(t => t !== tipo)
  if (esSumable(tipo) && elegidos.every(esSumable)) return [...elegidos, tipo].slice(0, 8)
  return [tipo]
}

const num = (v: string) => (v.trim() === '' ? null : Number(v))

// Pedido de un tipo adicional de la visita: los datos comunes de `base` y los propios del tipo.
export function inputDeTipo(base: AgendaItemInput, accion: Accion, d: DatosTipo): AgendaItemInput {
  return {
    ...base, accion,
    sub_accion: d.sub_accion.trim() || null, detalle: d.detalle,
    cantidad: CATEGORIA[accion] === 'tecnica' ? num(d.cantidad) : null,
    modalidad: null, rol_formacion: null, dictada_por: null,
    encuentro: CON_ENCUENTRO.includes(accion)
      ? { propuesta: d.propuesta, encuentro_n: num(d.encuentro_n), modalidad: d.modalidad, destinatarios: d.destinatarios, inscriptos: num(d.inscriptos), asistentes: num(d.asistentes) }
      : null,
  }
}
