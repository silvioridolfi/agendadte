import type { CargoDia, DdjjDia } from '@/lib/agenda'

export type Franja = { desde: string; hasta: string }
// Otro cargo tal como lo edita el FED: un nombre con sus días y horario.
export type Cargo = { nombre: string; dias: number[]; desde: string; hasta: string }

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
export const esHora = (h: string) => HORA.test(h)
const solapan = (a: Franja, b: Franja) => a.desde < b.hasta && b.desde < a.hasta

// Franjas DTE declaradas para un día (0, 1 o 2).
export function franjasDte(d?: DdjjDia): Franja[] {
  if (!d) return []
  const out: Franja[] = []
  if (d.dte_desde && d.dte_hasta) out.push({ desde: d.dte_desde, hasta: d.dte_hasta })
  if (d.dte2_desde && d.dte2_hasta) out.push({ desde: d.dte2_desde, hasta: d.dte2_hasta })
  return out
}

export const textoFranjas = (f: Franja[]) => f.map(x => `${x.desde} a ${x.hasta}`).join(' y ')

// Agrupa los cargos por día en cargos con su lista de días (mismo nombre y horario = mismo cargo).
export function cargosDe(ddjj: DdjjDia[] | null | undefined): Cargo[] {
  const m = new Map<string, Cargo>()
  for (const d of ddjj ?? []) for (const c of d.cargos ?? []) {
    const k = `${c.nombre}|${c.desde}|${c.hasta}`
    const cargo = m.get(k) ?? { nombre: c.nombre, dias: [], desde: c.desde, hasta: c.hasta }
    if (!cargo.dias.includes(d.dia)) cargo.dias.push(d.dia)
    m.set(k, cargo)
  }
  return [...m.values()].map(c => ({ ...c, dias: c.dias.sort() }))
}

// Arma la DD.JJ. a guardar: franjas DTE por día (1..5), otros cargos y notas heredadas que se conservan.
export function armarDdjj(franjas: Record<number, Franja[]>, cargos: Cargo[], notas: Record<number, string> = {}): DdjjDia[] {
  const out: DdjjDia[] = []
  for (let dia = 1; dia <= 5; dia++) {
    const f = (franjas[dia] ?? []).filter(x => x.desde && x.hasta).slice(0, 2)
    const cd: CargoDia[] = cargos.filter(c => c.dias.includes(dia)).map(c => ({ nombre: c.nombre.trim(), desde: c.desde, hasta: c.hasta }))
    const nota = notas[dia]?.trim()
    if (!f.length && !cd.length && !nota) continue
    const d: DdjjDia = { dia, dte: textoFranjas(f) }
    if (f[0]) { d.dte_desde = f[0].desde; d.dte_hasta = f[0].hasta }
    if (f[1]) { d.dte2_desde = f[1].desde; d.dte2_hasta = f[1].hasta }
    if (cd.length) d.cargos = cd
    if (nota) d.externo = nota
    out.push(d)
  }
  return out
}

// Errores de carga (vacío = válida).
export function validarDdjj(franjas: Record<number, Franja[]>, cargos: Cargo[]): string[] {
  const err: string[] = []
  const DIA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes']
  for (let dia = 1; dia <= 5; dia++) {
    const f = (franjas[dia] ?? []).filter(x => x.desde || x.hasta)
    for (const x of f) {
      if (!esHora(x.desde) || !esHora(x.hasta)) err.push(`Completá el horario DTE del ${DIA[dia]}.`)
      else if (x.desde >= x.hasta) err.push(`El horario DTE del ${DIA[dia]} termina antes de empezar.`)
    }
    if (f.length === 2 && f.every(x => esHora(x.desde) && esHora(x.hasta)) && solapan(f[0], f[1])) err.push(`Las dos franjas DTE del ${DIA[dia]} se superponen.`)
  }
  cargos.forEach((c, i) => {
    const nombre = c.nombre.trim()
    const para = nombre ? `para ${nombre}` : `para el cargo ${i + 1}`, de = nombre ? `de ${nombre}` : `del cargo ${i + 1}`
    if (!nombre) err.push(`Indicá la institución o el cargo ${i + 1}.`)
    if (!c.dias.length) err.push(`Elegí al menos un día ${para}.`)
    if (!esHora(c.desde) || !esHora(c.hasta)) err.push(`Completá el horario ${de}.`)
    else if (c.desde >= c.hasta) err.push(`El horario ${de} termina antes de empezar.`)
  })
  return [...new Set(err)]
}

// Para el formulario: si la acción cae fuera de las franjas DTE y con qué otros cargos se superpone.
export function chequearHorario(d: DdjjDia | undefined, inicio: string, fin: string) {
  const franjas = franjasDte(d)
  const accion: Franja | null = inicio ? { desde: inicio, hasta: fin && fin > inicio ? fin : inicio } : null
  const dentro = (f: Franja) => !!accion && accion.desde >= f.desde && accion.hasta <= f.hasta
  const fuera = !!accion && franjas.length > 0 && !franjas.some(dentro)
  const choques = accion ? (d?.cargos ?? []).filter(c => accion.desde === accion.hasta ? accion.desde >= c.desde && accion.desde < c.hasta : solapan(accion, c)) : []
  return { franjas, fuera, choques }
}
