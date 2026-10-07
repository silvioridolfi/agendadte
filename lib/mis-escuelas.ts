// Mis escuelas: listado de las escuelas a cargo de cada FED, con un resumen por escuela (puro).
import { SIN_FED, esDelFed, sinFed } from '@/lib/cronogramas'
import { nombreCorto } from '@/lib/siglas'
import { titleCase } from '@/lib/format'
import { hermanasDe, predioValido, type Hermana } from '@/lib/predio'

export type ContactoEscuela = { nombre: string | null, apellido: string | null, cargo: string | null, telefono: string | null, correo: string | null, correo_laboral: string | null, es_principal: boolean }
export type ResumenEscuela = {
  id: string, cue: number | null, nombre: string | null, distrito: string | null, ciudad: string | null, nivel: string | null, modalidad: string | null, fed_a_cargo: string | null,
  direccion: string | null,
  // Número de predio y las otras escuelas que lo comparten.
  predio: number | null, comparte: Hermana[],
  // Contacto principal (o el primero que haya) y cuántos más hay.
  contacto: ContactoEscuela | null, contactosExtra: number,
  // Cronogramas de Nivel Central que no terminaron y el que empieza primero.
  cronogramas: number, proximoCronograma: { fecha_inicio: string, fecha_fin: string, tipo: string | null } | null,
  // Todos los que no terminaron, del que empieza primero al último (para el Excel).
  proximosCronogramas: { fecha_inicio: string, fecha_fin: string, tipo: string | null }[],
  reclamosAbiertos: number, ultimaVisita: string | null, proximaAccion: string | null,
}
export type FiltrosEscuelas = { busqueda: string, distrito: string, nivel: string, fed: string, conCronograma: boolean, conReclamo: boolean }
export const FILTROS_ESCUELAS_VACIOS: FiltrosEscuelas = { busqueda: '', distrito: '', nivel: '', fed: '', conCronograma: false, conReclamo: false }

const norm = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// Se busca por CUE, nombre completo, sigla ("EP 4", "ees 31"), distrito o localidad; todas las palabras tienen que estar.
export function filtrarEscuelas(lista: ResumenEscuela[], f: FiltrosEscuelas): ResumenEscuela[] {
  const palabras = norm(f.busqueda).split(' ').filter(Boolean)
  return lista.filter(e => {
    if (f.distrito && norm(e.distrito) !== norm(f.distrito)) return false
    if (f.nivel && e.nivel !== f.nivel) return false
    if (f.fed && !(f.fed === SIN_FED ? sinFed(e.fed_a_cargo) : esDelFed(e.fed_a_cargo, f.fed))) return false
    if (f.conCronograma && !e.cronogramas) return false
    if (f.conReclamo && !e.reclamosAbiertos) return false
    if (!palabras.length) return true
    const nombre = e.nombre ? titleCase(e.nombre) : ''
    const texto = norm(`${e.cue ?? ''} ${nombre} ${nombre ? nombreCorto(nombre) : ''} ${e.distrito ?? ''} ${e.ciudad ?? ''} ${e.direccion ?? ''} ${nombreContacto(e.contacto)} ${e.contacto?.correo ?? ''} ${e.contacto?.correo_laboral ?? ''}`)
    return palabras.every(p => texto.includes(p))
  }).sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es', { numeric: true, sensitivity: 'base' }) || (a.cue ?? 0) - (b.cue ?? 0))
}

// "Nombre Apellido" del contacto (vacío si no hay).
export const nombreContacto = (c: Pick<ContactoEscuela, 'nombre' | 'apellido'> | null | undefined) => [c?.nombre, c?.apellido].map(x => (x ?? '').trim()).filter(Boolean).join(' ')

// De los contactos de una escuela, el principal (o el primero con algún dato) y cuántos más hay.
export function elegirContacto(lista: ContactoEscuela[]): { contacto: ContactoEscuela | null, extra: number } {
  const con = lista.filter(c => [c.nombre, c.apellido, c.telefono, c.correo, c.correo_laboral].some(x => (x ?? '').trim()))
  const principal = con.find(c => c.es_principal) ?? con[0] ?? null
  return { contacto: principal, extra: Math.max(0, con.length - 1) }
}

export type ColumnaEscuelas = 'nombre' | 'cue' | 'direccion' | 'ciudad' | 'distrito'
// Ordena por la columna elegida (el CUE como número, el resto sin distinguir mayúsculas ni tildes; lo que no tiene dato va al final).
export function ordenarEscuelas(lista: ResumenEscuela[], col: ColumnaEscuelas, asc = true): ResumenEscuela[] {
  const clave = (e: ResumenEscuela) => (col === 'cue' ? e.cue : norm(e[col] ?? '')) as string | number | null
  const comparar = (a: ResumenEscuela, b: ResumenEscuela) => {
    const x = clave(a), y = clave(b)
    if ((x === null || x === '') !== (y === null || y === '')) return x === null || x === '' ? 1 : -1
    const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'es', { numeric: true })
    return (asc ? r : -r) || (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es', { numeric: true })
  }
  return [...lista].sort(comparar)
}

export const resumenEscuelas = (lista: ResumenEscuela[]) => ({
  total: lista.length, conCronograma: lista.filter(e => e.cronogramas > 0).length, conReclamo: lista.filter(e => e.reclamosAbiertos > 0).length,
})

// Arma el resumen de cada escuela con lo que ya se trajo de la base (cronogramas, reclamos abiertos y acciones), mirando desde `hoy`.
export function armarResumen(
  escuelas: (Pick<ResumenEscuela, 'id' | 'cue' | 'nombre' | 'distrito' | 'ciudad' | 'nivel' | 'modalidad' | 'fed_a_cargo' | 'direccion'> & { predio?: number | null })[],
  datos: { grupos?: Map<number, Hermana[]>, contactos?: (ContactoEscuela & { cue: number | null })[], cronogramas: { school_id: string | null, fecha_inicio: string, fecha_fin: string, tipo: string | null }[], reclamos: { school_id: string | null }[], acciones: { school_id: string | null, fecha: string, estado: string }[] },
  hoy: string,
): ResumenEscuela[] {
  const por = <T extends { school_id: string | null }>(l: T[]) => { const m = new Map<string, T[]>(); for (const x of l) if (x.school_id) m.set(x.school_id, [...(m.get(x.school_id) ?? []), x]); return m }
  const porCue = new Map<number, ContactoEscuela[]>()
  for (const c of datos.contactos ?? []) if (c.cue != null) porCue.set(c.cue, [...(porCue.get(c.cue) ?? []), c])
  const cr = por(datos.cronogramas.filter(c => c.fecha_fin >= hoy)), re = por(datos.reclamos), ac = por(datos.acciones)
  return escuelas.map(e => {
    const cs = [...(cr.get(e.id) ?? [])].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
    const as = ac.get(e.id) ?? []
    const { contacto, extra } = elegirContacto(e.cue == null ? [] : (porCue.get(e.cue) ?? []))
    return {
      ...e, predio: predioValido(e.predio), comparte: hermanasDe(datos.grupos ?? new Map(), e.id, e.predio), contacto, contactosExtra: extra, proximosCronogramas: cs.map(c => ({ fecha_inicio: c.fecha_inicio, fecha_fin: c.fecha_fin, tipo: c.tipo })), cronogramas: cs.length, proximoCronograma: cs[0] ? { fecha_inicio: cs[0].fecha_inicio, fecha_fin: cs[0].fecha_fin, tipo: cs[0].tipo } : null,
      reclamosAbiertos: (re.get(e.id) ?? []).length,
      ultimaVisita: as.filter(a => a.estado === 'realizada' && a.fecha <= hoy).reduce<string | null>((m, a) => (!m || a.fecha > m ? a.fecha : m), null),
      proximaAccion: as.filter(a => a.estado === 'planificada' && a.fecha >= hoy).reduce<string | null>((m, a) => (!m || a.fecha < m ? a.fecha : m), null),
    }
  })
}

// Números de los accesos rápidos del Tablero. `escuelaIds`: las escuelas a cargo (o todas, para el CED). Los reclamos abiertos cuentan los de esas escuelas
// y los que registró el propio FED; los cronogramas, los que todavía no terminaron en esas escuelas.
export type Accesos = { escuelas: number, conReclamo: number, reclamosAbiertos: number, cronogramasProximos: number }
export function contarAccesos(d: { escuelaIds: Set<string>, todas: boolean, miId: string, reclamosAbiertos: { school_id: string | null, fed_id: string | null }[], cronogramasProximos: { school_id: string | null }[] }): Accesos {
  const mia = (id: string | null) => d.todas || (!!id && d.escuelaIds.has(id))
  const reclamos = d.reclamosAbiertos.filter(r => mia(r.school_id) || r.fed_id === d.miId)
  return {
    escuelas: d.escuelaIds.size,
    conReclamo: new Set(reclamos.map(r => r.school_id).filter((x): x is string => !!x && mia(x))).size,
    reclamosAbiertos: reclamos.length,
    cronogramasProximos: d.cronogramasProximos.filter(c => mia(c.school_id)).length,
  }
}
