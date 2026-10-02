// Informes del período: indicadores de la coordinación (planificación del CED 2026) y resumen de cada FED.
// Cuentan sólo acciones realizadas. Cada indicador trae las acciones que lo forman (para ver el detalle y exportarlo).
import { CATEGORIA, CATEGORIA_LABEL, CATEGORIAS, type AgendaItem, type Categoria, cuentaHecha } from '@/lib/agenda'
import { esEscuela } from '@/lib/sede'

export type Indicador = { clave: string, label: string, valor: number, detalle?: string, items: AgendaItem[] }

const hechas = (items: AgendaItem[]) => items.filter(cuentaHecha)
const escuelas = (items: AgendaItem[]) => new Set(items.filter(i => i.school_id && esEscuela(i.school)).map(i => i.school_id!)).size
// Inscriptos de cada club/práctica: el máximo registrado en sus encuentros (un grupo se cuenta una vez).
function inscriptos(items: AgendaItem[]) {
  const porClub = new Map<string, number>()
  for (const i of items) for (const e of i.encuentros ?? []) {
    const k = e.club_id ?? i.club_id ?? i.id
    porClub.set(k, Math.max(porClub.get(k) ?? 0, e.inscriptos ?? 0))
  }
  return [...porClub.values()].reduce((a, b) => a + b, 0)
}

// Indicadores de seguimiento de la planificación del CED. `ced`: ids de coordinación; `equipo`: acciones de todo el equipo.
export function indicadoresCoordinacion(equipo: AgendaItem[], ced: Set<string>): Indicador[] {
  const todas = hechas(equipo), propias = todas.filter(i => ced.has(i.fed_id))
  const de = (list: AgendaItem[], ...acciones: string[]) => list.filter(i => acciones.includes(i.accion))
  const reuniones = de(propias, 'REUNIÓN'), seguimientos = de(propias, 'SEGUIMIENTO DEL EQUIPO', 'ACOMPAÑAMIENTO A FED')
  const clubes = de(todas, 'CLUB DE TECNOLOGÍA'), peat = de(todas, 'PRÁCTICAS PROFESIONALIZANTES')
  const formacion = [...de(todas, 'TALLER/CAPACITACIÓN'), ...todas.filter(i => i.accion === 'FORMACIÓN INTERNA' && i.rol_formacion === 'La dicté')]
  const jed = de(todas, 'EVENTO DTE'), informes = de(propias, 'INFORME TÉCNICO'), articulaciones = de(propias, 'REUNIÓN CON JEFATURA', 'REUNIÓN CON INSPECCIÓN')
  const nivelCentral = de(propias, 'REUNIÓN CON NIVEL CENTRAL'), municipales = de(propias, 'ARTICULACIÓN MUNICIPAL')
  const nClubes = new Set(clubes.map(i => i.club_id ?? i.id)).size
  return [
    { clave: 'reuniones', label: 'Reuniones de coordinación', valor: reuniones.length, items: reuniones },
    { clave: 'seguimientos', label: 'Seguimientos territoriales', valor: seguimientos.length, items: seguimientos },
    { clave: 'instituciones', label: 'Instituciones acompañadas', valor: escuelas(propias), detalle: 'escuelas distintas en acciones de la coordinación', items: propias.filter(i => i.school_id && esEscuela(i.school)) },
    { clave: 'clubes', label: 'Clubes de Tecnología implementados o fortalecidos', valor: nClubes, detalle: `${clubes.length} encuentros del equipo`, items: clubes },
    { clave: 'peat', label: 'Estudiantes en Prácticas Profesionalizantes', valor: inscriptos(peat), detalle: `${peat.length} encuentros`, items: peat },
    { clave: 'formacion', label: 'Instancias de formación desarrolladas', valor: formacion.length, items: formacion },
    { clave: 'jed', label: 'Participación en Jornadas de Educación Digital y eventos DTE', valor: jed.length, detalle: 'participaciones registradas', items: jed },
    { clave: 'informes', label: 'Informes técnicos elaborados', valor: informes.length, items: informes },
    { clave: 'articulaciones', label: 'Articulaciones con Jefaturas e Inspección', valor: articulaciones.length, items: articulaciones },
    { clave: 'nivel-central', label: 'Reuniones con Nivel Central', valor: nivelCentral.length, items: nivelCentral },
    { clave: 'municipales', label: 'Articulaciones municipales', valor: municipales.length, items: municipales },
  ]
}

// Acciones de otros integrantes en las que el FED fue etiquetado y que se realizaron (las que rechazó no cuentan).
// Se informan aparte: no se suman al total ni a las categorías, porque cada acción ya cuenta para quien la hizo.
export const accionesAcompanadas = (items: AgendaItem[], fedId: string) =>
  hechas(items).filter(i => i.fed_id !== fedId && (i.participantes ?? []).some(p => p.fed_id === fedId && p.respuesta !== 'rechaza'))

// Resumen del período de un FED: `items` son sus acciones; `acompanadas`, las de otros en las que lo etiquetaron.
export function informeFed(items: AgendaItem[], acompanadas: AgendaItem[] = []): Indicador[] {
  const h = hechas(items)
  const de = (...acciones: string[]) => h.filter(i => acciones.includes(i.accion))
  const porCat = (c: Categoria) => h.filter(i => CATEGORIA[i.accion] === c)
  const encuentros = de('CLUB DE TECNOLOGÍA', 'PRÁCTICAS PROFESIONALIZANTES')
  const asistentes = encuentros.reduce((a, i) => a + (i.encuentros ?? []).reduce((b, e) => b + (e.asistentes ?? 0), 0), 0)
  const formInterna = de('FORMACIÓN INTERNA')
  return [
    { clave: 'total', label: 'Acciones realizadas', valor: h.length, items: h },
    ...CATEGORIAS.map(c => ({ clave: c, label: `Acciones ${CATEGORIA_LABEL[c].toLowerCase()}`, valor: porCat(c).length, items: porCat(c) })),
    { clave: 'escuelas', label: 'Escuelas visitadas', valor: escuelas(h), detalle: 'escuelas distintas', items: h.filter(i => i.school_id && esEscuela(i.school)) },
    { clave: 'encuentros', label: 'Encuentros de clubes y prácticas', valor: encuentros.length, detalle: `${asistentes} asistentes en total`, items: encuentros },
    { clave: 'talleres', label: 'Talleres y capacitaciones dictados', valor: de('TALLER/CAPACITACIÓN').length, items: de('TALLER/CAPACITACIÓN') },
    { clave: 'formacion', label: 'Formaciones internas', valor: formInterna.length, detalle: `${formInterna.filter(i => i.rol_formacion === 'La dicté').length} dictadas`, items: formInterna },
    { clave: 'eventos', label: 'Eventos DTE', valor: de('EVENTO DTE').length, items: de('EVENTO DTE') },
    { clave: 'acompanadas', label: 'Acciones acompañadas', valor: acompanadas.length, detalle: 'de otros integrantes; no suman al total', items: acompanadas },
  ]
}

// Acciones por tipo (para el detalle del informe).
export function porTipo(items: AgendaItem[]) {
  return [...hechas(items).reduce((m, i) => m.set(i.accion, (m.get(i.accion) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])
}

// Línea de resumen del informe plegado: lo principal de un vistazo. Con los indicadores del FED usa realizadas, escuelas y encuentros; si no, los tres primeros con valor.
const CORTOS: Record<string, [string, string]> = { total: ['acción realizada', 'acciones realizadas'], escuelas: ['escuela visitada', 'escuelas visitadas'], encuentros: ['encuentro de clubes y prácticas', 'encuentros de clubes y prácticas'] }
export function resumenDe(indicadores: Indicador[]): string {
  const elegidos = Object.keys(CORTOS).map(k => indicadores.find(x => x.clave === k)).filter((x): x is Indicador => !!x)
  const lista = elegidos.length === Object.keys(CORTOS).length ? elegidos : indicadores.filter(x => x.valor > 0).slice(0, 3)
  return lista.map(x => `${x.valor} ${CORTOS[x.clave]?.[x.valor === 1 ? 0 : 1] ?? x.label.toLowerCase()}`).join(' · ')
}
