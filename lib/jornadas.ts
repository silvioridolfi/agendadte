// Reporte de jornadas pedagógicas: lo que Nivel Central pide en el formulario "Registro de Acciones Pedagógicas" (jornadas de formación, sensibilización,
// talleres, presentaciones… dictadas y finalizadas, con participantes). Se arma con lo que ya está en la agenda: los encuentros de los clubes, las PEAT y los
// talleres y capacitaciones. Las visitas a escuelas sin participantes (charlas con EMATP o directivos) no cuentan. Todo es determinístico.
import { siglaNombre } from '@/lib/siglas'
import { titleCase } from '@/lib/format'
import { ordenCampos } from '@/lib/jornadas-campos'

export type TipoJornadaReporte = 'CLUB DE TECNOLOGÍA' | 'PRÁCTICAS PROFESIONALIZANTES' | 'TALLER/CAPACITACIÓN'
export type EscuelaJ = { cue: number | null, nombre: string | null, distrito: string | null } | null
// Un encuentro realizado, tal como lo trae el servidor.
export type EncuentroJ = {
  id: string, agenda_item_id: string | null, fed_id: string, fecha: string, tipo: TipoJornadaReporte, lugar: string | null, propuesta: string | null, modalidad: string | null,
  tipo_jornada: string | null, club_id: string | null, destinatarios: string | null, inscriptos: number | null, asistentes: number | null, descripcion: string | null, school: EscuelaJ,
}
export type ClubJ = { id: string, grupo: string | null, propuesta: string | null, fecha_cierre: string | null, school: EscuelaJ, escuela_origen: EscuelaJ }
export type CarpetaFotos = { url: string, n: number }
export type FotoJornada = { fecha: string, url: string, n: number, deAccion: boolean }

export type Jornada = {
  clave: string, tipo: TipoJornadaReporte, fedId: string, fed: string,
  distrito: string, lugar: string, propuesta: string, fechaFin: string, encuentros: number, tipoJornada: string, formato: string,
  destinatarios: string[], destinatariosTexto: string, cues: string, inscriptos: number | null, participantes: number, observaciones: string,
  finalizada: boolean, grupo: string | null, fotos: FotoJornada[],
}

// Destinatarios del formulario (casillas): JR, JD, IE, Equipo de Conducción, Docentes, Familias, Estudiantes, Otros.
export const DESTINATARIOS_FORM = ['JR', 'JD', 'IE', 'Equipo de Conducción', 'Docentes', 'Familias', 'Estudiantes', 'Otros (aclarar en observaciones)'] as const
const sinTilde = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
// Pasa el texto libre de la agenda ("Estudiantes de 6° A", "Docentes y directivos") a las casillas del formulario.
export function destinatariosDeForm(texto: string | null | undefined): string[] {
  const t = sinTilde(texto ?? ''), out: string[] = []
  const hay = (re: RegExp) => re.test(t)
  if (hay(/\bjefe? regional|\bjr\b/)) out.push('JR')
  if (hay(/\bjefe? distrital|\bjd\b/)) out.push('JD')
  if (hay(/\binspector|\bie\b/)) out.push('IE')
  if (hay(/directiv|equipo de conduccion|conduccion|\bdirector|vicedirector|\bed\b/)) out.push('Equipo de Conducción')
  if (hay(/docente|maestr|profesor/)) out.push('Docentes')
  if (hay(/familia|padres|madres/)) out.push('Familias')
  if (hay(/estudiante|alumn|chicos|jovenes|ninos|ninas/)) out.push('Estudiantes')
  return out.length ? out : ['Otros (aclarar en observaciones)']
}

const maximo = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? Math.max(...v) : null }
const ultimo = <T>(xs: T[], f: (x: T) => string | null | undefined) => [...xs].reverse().map(f).find(v => (v ?? '').trim()) ?? ''

// "EES 1 - 60258569" o "Virtual".
export function lugarDe(e: { modalidad: string | null, lugar: string | null, school: EscuelaJ }): string {
  if (e.modalidad === 'Virtual') return 'Virtual'
  if (e.school?.nombre) return `${siglaNombre(titleCase(e.school.nombre))}${e.school.cue ? ` - ${e.school.cue}` : ''}`
  return (e.lugar ?? '').trim() || '—'
}
// CUE/s impactado/s: "61258258 - 60321456" (la sede y, si es otra, la escuela de origen de los estudiantes).
export const cuesDe = (...escuelas: EscuelaJ[]) => [...new Set(escuelas.map(s => s?.cue).filter((c): c is number => !!c))].join(' - ')

export type Fuentes = { encuentros: EncuentroJ[], clubes: ClubJ[], feds: { id: string, nombre_completo: string }[], carpetaAccion: Map<string, CarpetaFotos>, carpetaDia: Map<string, CarpetaFotos> }

// Una fila por propuesta dictada: cada club o PEAT es una (con todos sus encuentros) y cada taller o capacitación, una por encuentro. Sólo cuentan los encuentros con
// participantes. Los clubes y PEAT que todavía no se cerraron figuran como "en curso" (`finalizada: false`) con la fecha de su último encuentro.
export function armarJornadas({ encuentros, clubes, feds, carpetaAccion, carpetaDia }: Fuentes): Jornada[] {
  const conParticipantes = encuentros.filter(e => (e.asistentes ?? 0) > 0).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const porClub = new Map<string, EncuentroJ[]>(), sueltos: EncuentroJ[] = []
  for (const e of conParticipantes) { if (e.club_id) porClub.set(e.club_id, [...(porClub.get(e.club_id) ?? []), e]); else sueltos.push(e) }
  const fedDe = (id: string) => feds.find(f => f.id === id)?.nombre_completo ?? 'Ex integrante'
  const fotosDe = (es: EncuentroJ[]): FotoJornada[] => es.flatMap<FotoJornada>(e => {
    const a = e.agenda_item_id ? carpetaAccion.get(e.agenda_item_id) : undefined
    if (a) return [{ fecha: e.fecha, url: a.url, n: a.n, deAccion: true }]
    const d = carpetaDia.get(`${e.fed_id}|${e.fecha}`)
    return d ? [{ fecha: e.fecha, url: d.url, n: d.n, deAccion: false }] : []
  })
  const armar = (clave: string, es: EncuentroJ[], club: ClubJ | null): Jornada => {
    const ult = es[es.length - 1], sede = club?.school ?? ult.school
    const dest = ultimo(es, e => e.destinatarios)
    return {
      clave, tipo: ult.tipo, fedId: ult.fed_id, fed: fedDe(ult.fed_id), grupo: club?.grupo ?? null,
      distrito: (sede?.distrito ?? '') ? titleCase(sede!.distrito!) : '', lugar: lugarDe({ modalidad: ult.modalidad, lugar: ult.lugar, school: sede }),
      propuesta: (club?.propuesta ?? ult.propuesta ?? '').trim() || '—', fechaFin: club?.fecha_cierre ?? ult.fecha, encuentros: es.length,
      tipoJornada: ultimo(es, e => e.tipo_jornada), formato: ultimo(es, e => e.modalidad), destinatarios: destinatariosDeForm(dest), destinatariosTexto: dest,
      cues: cuesDe(sede, club?.escuela_origen ?? null), inscriptos: maximo(es.map(e => e.inscriptos)), participantes: maximo(es.map(e => e.asistentes)) ?? 0,
      observaciones: ultimo(es, e => e.descripcion), finalizada: club ? !!club.fecha_cierre : true, fotos: fotosDe(es),
    }
  }
  const filas = [...porClub.entries()].map(([id, es]) => armar(`club-${id}`, es, clubes.find(c => c.id === id) ?? null)), unitarias = sueltos.map(e => armar(`enc-${e.id}`, [e], null))
  return [...filas, ...unitarias].sort((a, b) => b.fechaFin.localeCompare(a.fechaFin) || a.lugar.localeCompare(b.lugar))
}

export type FiltrosJornadas = { desde: string, hasta: string, fedId: string, distrito: string, tipo: '' | TipoJornadaReporte, enCurso: boolean }
export const FILTROS_JORNADAS: FiltrosJornadas = { desde: '', hasta: '', fedId: '', distrito: '', tipo: '', enCurso: false }
// Por fecha de finalización (la del cierre del club o la del encuentro). Por defecto, sólo las finalizadas.
export function filtrarJornadas(lista: Jornada[], f: FiltrosJornadas): Jornada[] {
  return lista.filter(j => (f.enCurso || j.finalizada) && (!f.desde || j.fechaFin >= f.desde) && (!f.hasta || j.fechaFin <= f.hasta) && (!f.fedId || j.fedId === f.fedId)
    && (!f.distrito || j.distrito === f.distrito) && (!f.tipo || j.tipo === f.tipo))
}

const completa = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
export const fechaJornada = completa
// Los datos, uno por renglón y en el orden del formulario, para copiar de a uno o todos juntos.
export function camposDeJornada(j: Jornada): { clave: string, etiqueta: string, valor: string }[] {
  return ordenCampos.map(([clave, etiqueta]) => ({ clave, etiqueta, valor: ({
    region: '1', distrito: j.distrito, lugar: j.lugar, propuesta: j.propuesta, fechaFin: completa(j.fechaFin), encuentros: String(j.encuentros), tipoJornada: j.tipoJornada, formato: j.formato,
    destinatarios: j.destinatarios.join(', '), cues: j.cues, inscriptos: j.inscriptos == null ? '' : String(j.inscriptos), participantes: String(j.participantes), fed: j.fed,
    observaciones: [j.observaciones, j.destinatarios.includes('Otros (aclarar en observaciones)') && j.destinatariosTexto ? `Destinatarios: ${j.destinatariosTexto}` : ''].filter(Boolean).join('. '),
  } as Record<string, string>)[clave] ?? '' }))
}
export const textoDeJornada = (j: Jornada) => camposDeJornada(j).map(c => `${c.etiqueta}: ${c.valor || '—'}`).join('\n')
