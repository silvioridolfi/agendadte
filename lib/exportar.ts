// Exportación a Excel (planilla mensual por FED y consolidado regional). Se genera en el navegador.
import { CATEGORIA, CATEGORIA_LABEL, CATEGORIAS, clubEstado, ultimaActividad, type AgendaItem, type Club, type Encuentro, type Fed } from '@/lib/agenda'
import { titleCase } from '@/lib/format'

type Datos = { titulo: string, desde: string, hasta: string, items: AgendaItem[], encuentros?: Encuentro[], feds: Fed[], clubes?: Club[], porFed?: boolean }

const PETROLEO = 'FF05476E', TINTE = 'FFEAF2F7'
const fecha = (s: string | null | undefined) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }
const hora = (i: AgendaItem) => (i.hora_inicio ? `${i.hora_inicio.slice(0, 5)}${i.hora_fin ? ` a ${i.hora_fin.slice(0, 5)}` : ''}` : '')
const escuela = (s: { nombre: string | null } | null, lugar?: string | null) => (s?.nombre ? titleCase(s.nombre) : lugar ?? '')
const ESTADO_LABEL: Record<string, string> = { planificada: 'Planificada', realizada: 'Realizada', reprogramada: 'Reprogramada', cancelada: 'Cancelada' }

// Nombre de archivo y de hoja seguros (Excel no admite algunos caracteres y limita las hojas a 31).
const hoja = (s: string) => s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)
export const nombreArchivo = (s: string) => `${s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_')}.xlsx`

export async function exportarPlanilla({ titulo, desde, hasta, items, encuentros = [], feds, clubes, porFed = true }: Datos) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Agenda Territorial DTE'
  wb.created = new Date()
  const fedName = (id: string) => feds.find(f => f.id === id)?.nombre_completo ?? ''
  const periodo = `Período: ${fecha(desde)} al ${fecha(hasta)}`

  type Col = { header: string, key: string, width: number }
  function tabla(nombre: string, cols: Col[], filas: Record<string, unknown>[], subtitulo?: string) {
    const ws = wb.addWorksheet(hoja(nombre), { views: [{ state: 'frozen', ySplit: 3 }] })
    ws.getCell('A1').value = `${titulo} · ${nombre}`
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: PETROLEO } }
    ws.getCell('A2').value = subtitulo ?? periodo
    ws.getCell('A2').font = { italic: true, color: { argb: 'FF5B6472' } }
    const head = ws.getRow(3)
    cols.forEach((c, i) => { head.getCell(i + 1).value = c.header; ws.getColumn(i + 1).width = c.width })
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PETROLEO } }
    head.alignment = { vertical: 'middle', wrapText: true }
    filas.forEach((f, n) => {
      const row = ws.addRow(cols.map(c => f[c.key] ?? ''))
      row.alignment = { vertical: 'top', wrapText: true }
      if (n % 2) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTE } }
    })
    if (filas.length) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + filas.length, column: cols.length } }
    return ws
  }

  const ordenados = [...items].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
  const colsAcciones: Col[] = [
    { header: 'Fecha', key: 'fecha', width: 11 }, { header: 'Horario', key: 'horario', width: 13 }, { header: 'FED', key: 'fed', width: 24 },
    { header: 'Distrito', key: 'distrito', width: 14 }, { header: 'CUE', key: 'cue', width: 11 }, { header: 'Escuela / lugar', key: 'escuela', width: 40 },
    { header: 'Acción', key: 'accion', width: 24 }, { header: 'Categoría', key: 'categoria', width: 14 }, { header: 'Sub-acción', key: 'sub', width: 30 },
    { header: 'Cantidad (equipos)', key: 'cantidad', width: 10 }, { header: 'Estado', key: 'estado', width: 13 }, { header: 'Acompañado por', key: 'con', width: 28 },
    { header: 'Detalle', key: 'detalle', width: 60 },
  ]
  const filaAccion = (i: AgendaItem) => ({
    fecha: fecha(i.fecha), horario: hora(i), fed: fedName(i.fed_id), distrito: i.school?.distrito ? titleCase(i.school.distrito) : '', cue: i.school?.cue ?? '',
    escuela: escuela(i.school, i.lugar), accion: titleCase(i.accion), categoria: CATEGORIA_LABEL[CATEGORIA[i.accion]], sub: i.sub_accion ?? '',
    cantidad: i.cantidad ?? '', estado: ESTADO_LABEL[i.estado] ?? i.estado, con: (i.participantes ?? []).map(p => fedName(p.fed_id)).join(', '), detalle: i.detalle ?? '',
  })

  // Resumen por FED (sólo acciones realizadas, como las métricas del tablero).
  const equipo = feds.filter(f => f.rol !== 'coordinacion' && items.some(i => i.fed_id === f.id))
  const resumen = equipo.map(f => {
    const suyas = items.filter(i => i.fed_id === f.id), hechas = suyas.filter(i => i.estado === 'realizada')
    const cuenta = Object.fromEntries(CATEGORIAS.map(c => [c, hechas.filter(i => CATEGORIA[i.accion] === c).length]))
    return { fed: f.nombre_completo, distritos: f.distritos_a_cargo.map(titleCase).join(', '), ...cuenta, total: hechas.length,
      planificadas: suyas.filter(i => i.estado === 'planificada').length, escuelas: new Set(hechas.map(i => i.school_id).filter(Boolean)).size,
      equipos: hechas.reduce((a, i) => a + (i.cantidad ?? 0), 0), encuentros: encuentros.filter(e => e.fed_id === f.id).length }
  })
  if (resumen.length > 1) {
    const tot: Record<string, unknown> = { fed: 'TOTAL', distritos: '' }
    for (const k of [...CATEGORIAS, 'total', 'planificadas', 'equipos', 'encuentros'] as const) tot[k] = resumen.reduce((a, r) => a + Number(r[k as keyof typeof r] ?? 0), 0)
    tot.escuelas = new Set(items.filter(i => i.estado === 'realizada').map(i => i.school_id).filter(Boolean)).size
    resumen.push(tot as typeof resumen[number])
  }
  const wsRes = tabla('Resumen', [
    { header: 'FED', key: 'fed', width: 28 }, { header: 'Distritos', key: 'distritos', width: 26 },
    ...CATEGORIAS.map(c => ({ header: CATEGORIA_LABEL[c], key: c, width: 13 })),
    { header: 'Total realizadas', key: 'total', width: 12 }, { header: 'Planificadas', key: 'planificadas', width: 12 },
    { header: 'Escuelas alcanzadas', key: 'escuelas', width: 12 }, { header: 'Equipos intervenidos', key: 'equipos', width: 12 }, { header: 'Encuentros (clubes, talleres, prácticas)', key: 'encuentros', width: 16 },
  ], resumen, `${periodo} · cuenta acciones realizadas`)
  if (resumen.length > 1) wsRes.getRow(3 + resumen.length).font = { bold: true }

  tabla('Acciones', colsAcciones, ordenados.map(filaAccion))

  if (encuentros.length) tabla('Capacitaciones', [
    { header: 'Fecha', key: 'fecha', width: 11 }, { header: 'FED', key: 'fed', width: 24 }, { header: 'Distrito', key: 'distrito', width: 14 }, { header: 'CUE', key: 'cue', width: 11 },
    { header: 'Escuela / lugar', key: 'escuela', width: 40 }, { header: 'Tipo', key: 'tipo', width: 22 }, { header: 'Propuesta', key: 'propuesta', width: 36 },
    { header: 'Encuentro N°', key: 'n', width: 10 }, { header: 'Tipo de jornada', key: 'jornada', width: 16 }, { header: 'Formato', key: 'modalidad', width: 12 },
    { header: 'Destinatarios', key: 'dest', width: 28 }, { header: 'Inscriptos', key: 'ins', width: 10 }, { header: 'Participantes reales', key: 'asi', width: 11 }, { header: 'Descripción', key: 'desc', width: 60 },
  ], [...encuentros].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(e => ({
    fecha: fecha(e.fecha), fed: fedName(e.fed_id), distrito: e.school?.distrito ? titleCase(e.school.distrito) : '', cue: e.school?.cue ?? '', escuela: escuela(e.school, e.lugar),
    tipo: titleCase(e.tipo), propuesta: e.propuesta ?? '', n: e.encuentro_n ?? '', jornada: e.tipo_jornada ?? '', modalidad: e.modalidad ?? '', dest: e.destinatarios ?? '',
    ins: e.inscriptos ?? '', asi: e.asistentes ?? '', desc: e.descripcion ?? '',
  })))

  if (clubes?.length) {
    const hoy = new Date().toISOString().slice(0, 10)
    for (const [tipo, nombre] of [['CLUB DE TECNOLOGÍA', 'Clubes'], ['PRÁCTICAS PROFESIONALIZANTES', 'Prácticas']] as const) {
      const l = clubes.filter(c => c.tipo === tipo)
      if (!l.length) continue
      tabla(nombre, [
        { header: 'FED', key: 'fed', width: 24 }, { header: 'Escuela / sede', key: 'escuela', width: 40 }, { header: 'Grupo', key: 'grupo', width: 22 },
        { header: 'Estudiantes de', key: 'origen', width: 30 }, { header: 'Distrito', key: 'distrito', width: 14 }, { header: 'Inicio', key: 'inicio', width: 11 },
        { header: 'Cierre', key: 'cierre', width: 11 }, { header: 'Último encuentro', key: 'ultimo', width: 11 }, { header: 'Estado', key: 'estado', width: 13 },
        { header: 'Encuentros realizados', key: 'realizados', width: 11 }, { header: 'Encuentros previstos', key: 'previstos', width: 11 },
      ], l.map(c => {
        const est = clubEstado(c, hoy)
        return { fed: fedName(c.fed_id), escuela: escuela(c.school, c.lugar), grupo: c.grupo ?? '', origen: c.escuela_origen ? escuela(c.escuela_origen) : '',
          distrito: c.school?.distrito ? titleCase(c.school.distrito) : '', inicio: fecha(c.fecha_inicio), cierre: fecha(c.fecha_cierre), ultimo: fecha(ultimaActividad(c)),
          estado: est === 'activo' ? 'Activo' : est === 'finalizado' ? 'Finalizado' : 'Sin actividad', realizados: new Set(c.encuentros.map(e => e.fecha)).size, previstos: c.encuentros_previstos ?? '' }
      }), 'Ciclo lectivo completo · un grupo por fila')
    }
  }

  // Una hoja por FED con sus acciones (la planilla mensual de cada uno).
  if (porFed) for (const f of equipo) tabla(f.nombre_completo, colsAcciones.filter(c => c.key !== 'fed'), ordenados.filter(i => i.fed_id === f.id).map(filaAccion))

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url; a.download = nombreArchivo(`${titulo} ${desde} a ${hasta}`)
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
