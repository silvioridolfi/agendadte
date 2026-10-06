// Mis escuelas: listado de las escuelas a cargo de cada FED, con un resumen por escuela (puro).
import { SIN_FED, esDelFed, sinFed } from '@/lib/cronogramas'
import { nombreCorto } from '@/lib/siglas'
import { titleCase } from '@/lib/format'

export type ResumenEscuela = {
  id: string, cue: number | null, nombre: string | null, distrito: string | null, ciudad: string | null, nivel: string | null, modalidad: string | null, fed_a_cargo: string | null,
  // Cronogramas de Nivel Central que no terminaron y el que empieza primero.
  cronogramas: number, proximoCronograma: { fecha_inicio: string, fecha_fin: string, tipo: string | null } | null,
  reclamosAbiertos: number, ultimaVisita: string | null, proximaAccion: string | null,
}
export type ContactoEscuela = { nombre: string | null, apellido: string | null, cargo: string | null, telefono: string | null, correo: string | null, correo_laboral: string | null, es_principal: boolean }

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
    const texto = norm(`${e.cue ?? ''} ${nombre} ${nombre ? nombreCorto(nombre) : ''} ${e.distrito ?? ''} ${e.ciudad ?? ''}`)
    return palabras.every(p => texto.includes(p))
  }).sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es', { numeric: true, sensitivity: 'base' }) || (a.cue ?? 0) - (b.cue ?? 0))
}

export const resumenEscuelas = (lista: ResumenEscuela[]) => ({
  total: lista.length, conCronograma: lista.filter(e => e.cronogramas > 0).length, conReclamo: lista.filter(e => e.reclamosAbiertos > 0).length,
})

// Arma el resumen de cada escuela con lo que ya se trajo de la base (cronogramas, reclamos abiertos y acciones), mirando desde `hoy`.
export function armarResumen(
  escuelas: Pick<ResumenEscuela, 'id' | 'cue' | 'nombre' | 'distrito' | 'ciudad' | 'nivel' | 'modalidad' | 'fed_a_cargo'>[],
  datos: { cronogramas: { school_id: string | null, fecha_inicio: string, fecha_fin: string, tipo: string | null }[], reclamos: { school_id: string | null }[], acciones: { school_id: string | null, fecha: string, estado: string }[] },
  hoy: string,
): ResumenEscuela[] {
  const por = <T extends { school_id: string | null }>(l: T[]) => { const m = new Map<string, T[]>(); for (const x of l) if (x.school_id) m.set(x.school_id, [...(m.get(x.school_id) ?? []), x]); return m }
  const cr = por(datos.cronogramas.filter(c => c.fecha_fin >= hoy)), re = por(datos.reclamos), ac = por(datos.acciones)
  return escuelas.map(e => {
    const cs = [...(cr.get(e.id) ?? [])].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
    const as = ac.get(e.id) ?? []
    return {
      ...e, cronogramas: cs.length, proximoCronograma: cs[0] ? { fecha_inicio: cs[0].fecha_inicio, fecha_fin: cs[0].fecha_fin, tipo: cs[0].tipo } : null,
      reclamosAbiertos: (re.get(e.id) ?? []).length,
      ultimaVisita: as.filter(a => a.estado === 'realizada' && a.fecha <= hoy).reduce<string | null>((m, a) => (!m || a.fecha > m ? a.fecha : m), null),
      proximaAccion: as.filter(a => a.estado === 'planificada' && a.fecha >= hoy).reduce<string | null>((m, a) => (!m || a.fecha < m ? a.fecha : m), null),
    }
  })
}
