import type { Feriado } from '@/lib/agenda'
import { titleCase } from '@/lib/format'

// Lógica del selector de fechas (calendario propio): todo con cadenas AAAA-MM-DD para no depender de la zona horaria del dispositivo.

export const DIAS_CORTOS = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'] as const
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const dos = (n: number) => String(n).padStart(2, '0')
export const aIso = (y: number, m0: number, d: number) => { const f = new Date(Date.UTC(y, m0, d)); return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}` }
export const esIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && aIso(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) === s

export const sumarDias = (f: string, n: number) => aIso(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)) + n)
// Suma meses y deja el día dentro del mes de destino (31/01 + 1 mes = 28/02).
export function sumarMeses(f: string, n: number): string {
  const y = Number(f.slice(0, 4)), m0 = Number(f.slice(5, 7)) - 1 + n, d = Number(f.slice(8, 10))
  const ultimo = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()
  return aIso(y, m0, Math.min(d, ultimo))
}
export const tituloMes = (f: string) => `${MESES[Number(f.slice(5, 7)) - 1]} de ${f.slice(0, 4)}`
// Día de la semana con el lunes primero (0 = lunes … 6 = domingo).
const diaLunes = (f: string) => (new Date(Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)))).getUTCDay() + 6) % 7

export type Dia = { iso: string, delMes: boolean }
// Las semanas (de lunes a domingo) que cubren el mes de `f`: siempre 6, para que el calendario no cambie de alto.
export function semanasDelMes(f: string): Dia[][] {
  const primero = `${f.slice(0, 7)}-01`
  const inicio = sumarDias(primero, -diaLunes(primero))
  return Array.from({ length: 6 }, (_, s) => Array.from({ length: 7 }, (_, d) => { const iso = sumarDias(inicio, s * 7 + d); return { iso, delMes: iso.slice(0, 7) === f.slice(0, 7) } }))
}

// Fuera del rango permitido (min y max inclusive, ambos opcionales).
export const fueraDeRango = (f: string, min?: string, max?: string) => (!!min && f < min) || (!!max && f > max)
// Lleva una fecha al rango permitido.
export const dentroDeRango = (f: string, min?: string, max?: string) => (min && f < min ? min : max && f > max ? max : f)

export const textoFecha = (f: string) => (esIso(f) ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : '')
// Valores del selector con hora: AAAA-MM-DDTHH:mm.
export const partesFechaHora = (v: string): { fecha: string, hora: string, minuto: string } => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(v)
  return m && esIso(m[1]) ? { fecha: m[1], hora: m[2], minuto: m[3] } : { fecha: '', hora: '', minuto: '' }
}
export const textoFechaHora = (v: string) => { const p = partesFechaHora(v); return p.fecha ? `${textoFecha(p.fecha)} ${p.hora}:${p.minuto}` : '' }

// Texto de las marcas del calendario (día → descripción), a nivel global: todos los feriados y recesos cargados, sean nacionales, provinciales,
// turísticos, no laborables o distritales (de estos se aclara el distrito). Si un día tiene más de uno, se unen.
export function marcasFeriados(feriados: Pick<Feriado, 'fecha' | 'nombre' | 'tipo' | 'distrito' | 'confirmado'>[]): Record<string, string> {
  const out: Record<string, string[]> = {}
  for (const f of feriados) {
    const texto = `${f.nombre}${f.tipo === 'distrital' && f.distrito ? ` (distrito ${titleCase(f.distrito)})` : ''}${f.confirmado ? '' : ' · a confirmar'}`
    out[f.fecha] = [...(out[f.fecha] ?? []), texto]
  }
  return Object.fromEntries(Object.entries(out).map(([f, t]) => [f, t.join(' · ')]))
}
// Sábado o domingo, según la columna de la grilla (0 = lunes … 6 = domingo).
export const esFinDeSemana = (columna: number) => columna >= 5
