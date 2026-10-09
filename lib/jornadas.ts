// Reporte de jornadas pedagógicas: lo que Nivel Central pide en el formulario "Registro de Acciones Pedagógicas". Una fila por encuentro dictado (el formulario
// pide cargar cada uno por separado, sin agrupar), con participantes. Se arma con lo que ya está en la agenda: los encuentros de los clubes, las PEAT y los
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

export type MarcaCarga = { por: string | null, cuando: string, datos: string }
export type Jornada = {
  clave: string, encuentroId: string, tipo: TipoJornadaReporte, fedId: string, fed: string, aCargo: string[],
  distrito: string, lugar: string, propuesta: string, fecha: string, tipoJornada: string, formato: string,
  destinatarios: string[], destinatariosTexto: string, cues: string, inscriptos: number | null, participantes: number, observaciones: string,
  grupo: string | null, nro: number | null, foto: FotoJornada | null,
  cargada: { por: string, cuando: string, modificada: boolean } | null,
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


// "EES 1 - 60258569" o "Virtual".
export function lugarDe(e: { modalidad: string | null, lugar: string | null, school: EscuelaJ }): string {
  if (e.modalidad === 'Virtual') return 'Virtual'
  if (e.school?.nombre) return `${siglaNombre(titleCase(e.school.nombre))}${e.school.cue ? ` - ${e.school.cue}` : ''}`
  return (e.lugar ?? '').trim() || '—'
}
// CUE/s impactado/s: "61258258 - 60321456" (la sede y, si es otra, la escuela de origen de los estudiantes).
export const cuesDe = (...escuelas: EscuelaJ[]) => [...new Set(escuelas.map(s => s?.cue).filter((c): c is number => !!c))].join(' - ')

export type Fuentes = {
  encuentros: EncuentroJ[], clubes: ClubJ[], feds: { id: string, nombre_completo: string }[], carpetaAccion: Map<string, CarpetaFotos>, carpetaDia: Map<string, CarpetaFotos>,
  // Quiénes acompañan cada acción (por id de la acción), con su respuesta; los que avisaron que no pueden no figuran.
  acompanantes?: Map<string, { fed_id: string, respuesta?: string }[]>, marcas?: Map<string, MarcaCarga>,
}

// Una fila por encuentro dictado con participantes. "FED / CED a cargo": quien creó la acción y, después, quienes la acompañan (hayan confirmado o no todavía).
export function armarJornadas({ encuentros, clubes, feds, carpetaAccion, carpetaDia, acompanantes = new Map(), marcas = new Map() }: Fuentes): Jornada[] {
  const conParticipantes = encuentros.filter(e => (e.asistentes ?? 0) > 0)
  const fedDe = (id: string) => feds.find(f => f.id === id)?.nombre_completo ?? 'Ex integrante'
  // Número de encuentro dentro de su club o PEAT (entre los realizados), sólo para mostrar.
  const nros = new Map<string, number>()
  const porClub = new Map<string, EncuentroJ[]>()
  for (const e of encuentros) if (e.club_id) porClub.set(e.club_id, [...(porClub.get(e.club_id) ?? []), e])
  for (const es of porClub.values()) [...es].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id)).forEach((e, i) => nros.set(e.id, i + 1))
  const jornadas = conParticipantes.map<Jornada>(e => {
    const club = e.club_id ? clubes.find(c => c.id === e.club_id) ?? null : null, sede = club?.school ?? e.school
    const a = e.agenda_item_id ? carpetaAccion.get(e.agenda_item_id) : undefined, d = carpetaDia.get(`${e.fed_id}|${e.fecha}`)
    const aCargo = [fedDe(e.fed_id), ...(e.agenda_item_id ? acompanantes.get(e.agenda_item_id) ?? [] : []).filter(p => p.fed_id !== e.fed_id && p.respuesta !== 'rechaza').map(p => fedDe(p.fed_id))]
    const dest = (e.destinatarios ?? '').trim()
    const j: Jornada = {
      clave: `enc-${e.id}`, encuentroId: e.id, tipo: e.tipo, fedId: e.fed_id, fed: aCargo[0], aCargo, grupo: club?.grupo ?? null, nro: club ? nros.get(e.id) ?? null : null,
      distrito: (sede?.distrito ?? '') ? titleCase(sede!.distrito!) : '', lugar: lugarDe({ modalidad: e.modalidad, lugar: e.lugar, school: sede }),
      propuesta: (e.propuesta ?? club?.propuesta ?? '').trim() || '—', fecha: e.fecha, tipoJornada: (e.tipo_jornada ?? '').trim(), formato: (e.modalidad ?? '').trim(),
      destinatarios: destinatariosDeForm(dest), destinatariosTexto: dest, cues: cuesDe(sede, club?.escuela_origen ?? null), inscriptos: e.inscriptos, participantes: e.asistentes ?? 0,
      observaciones: (e.descripcion ?? '').trim(), foto: a ? { fecha: e.fecha, url: a.url, n: a.n, deAccion: true } : d ? { fecha: e.fecha, url: d.url, n: d.n, deAccion: false } : null, cargada: null,
    }
    const m = marcas.get(e.id)
    return m ? { ...j, cargada: { por: m.por ? fedDe(m.por) : 'Ex integrante', cuando: m.cuando, modificada: m.datos !== huellaDe(j) } } : j
  })
  return jornadas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.lugar.localeCompare(b.lugar) || a.clave.localeCompare(b.clave))
}

// Lo que se carga en el formulario, como un solo texto: sirve para saber si el encuentro cambió después de marcarlo como cargado.
export const huellaDe = (j: Jornada) => camposDeJornada(j).map(c => c.valor).join('\u001f')

export type EstadoCarga = 'pendientes' | 'cargadas' | 'todas'
export type FiltrosJornadas = { desde: string, hasta: string, fedId: string, distrito: string, tipo: '' | TipoJornadaReporte, estado: EstadoCarga }
export const FILTROS_JORNADAS: FiltrosJornadas = { desde: '', hasta: '', fedId: '', distrito: '', tipo: '', estado: 'pendientes' }
// Las modificadas después de cargarlas cuentan como pendientes: hay que revisarlas en el formulario.
export const estaPendiente = (j: Jornada) => !j.cargada || j.cargada.modificada
export function filtrarJornadas(lista: Jornada[], f: FiltrosJornadas): Jornada[] {
  return lista.filter(j => (f.estado === 'todas' || (f.estado === 'pendientes') === estaPendiente(j)) && (!f.desde || j.fecha >= f.desde) && (!f.hasta || j.fecha <= f.hasta)
    && (!f.fedId || j.fedId === f.fedId) && (!f.distrito || j.distrito === f.distrito) && (!f.tipo || j.tipo === f.tipo))
}

const completa = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
export const fechaJornada = completa
// Los datos, uno por renglón y en el orden del formulario, para copiar de a uno o todos juntos. Cada fila es un encuentro: la cantidad de encuentros es siempre 1.
export function camposDeJornada(j: Jornada): { clave: string, etiqueta: string, valor: string }[] {
  return ordenCampos.map(([clave, etiqueta]) => ({ clave, etiqueta, valor: ({
    region: '1', distrito: j.distrito, lugar: j.lugar, propuesta: j.propuesta, fechaFin: completa(j.fecha), encuentros: '1', tipoJornada: j.tipoJornada, formato: j.formato,
    destinatarios: j.destinatarios.join(', '), cues: j.cues, inscriptos: j.inscriptos == null ? '' : String(j.inscriptos), participantes: String(j.participantes), fed: j.aCargo.join(', '),
    observaciones: [j.observaciones, j.destinatarios.includes('Otros (aclarar en observaciones)') && j.destinatariosTexto ? `Destinatarios: ${j.destinatariosTexto}` : ''].filter(Boolean).join('. '),
  } as Record<string, string>)[clave] ?? '' }))
}
export const textoDeJornada = (j: Jornada) => camposDeJornada(j).map(c => `${c.etiqueta}: ${c.valor || '—'}`).join('\n')
