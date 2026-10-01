import type { Estado } from '@/lib/agenda'

// Estado con el que se guarda una acción nueva: una planificada con fecha pasada se registra como realizada (carga retroactiva) y un paro
// queda siempre como realizado (es una adhesión: no hay nada pendiente), sea cual sea la fecha. Cualquier otro estado elegido se respeta.
export function estadoAlCrear(p: { accion: string | null, fecha: string, hoy: string, estado: Estado }): Estado {
  if (p.estado !== 'planificada') return p.estado
  return p.fecha < p.hoy || p.accion === 'PARO' ? 'realizada' : p.estado
}
