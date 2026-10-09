// Exportación a Excel (planilla mensual por FED y consolidado regional). Se genera en el navegador.
import type { FilaExtracto } from '@/lib/extracto'
import { camposDeJornada, type Jornada } from '@/lib/jornadas'
import { escuelaDelClub } from '@/lib/encuentro'
import { ESTADO_RECLAMO_LABEL, type Reclamo } from '@/lib/reclamos-registro'
import { nombreContacto, type ResumenEscuela } from '@/lib/mis-escuelas'
import { etiquetaTipo, ventanaDe } from '@/lib/cronogramas'
import { CATEGORIA, CATEGORIA_LABEL, CATEGORIAS, clubEstado, cuentaHecha, esAusencia, iniciado, ordenGrupo, ultimaActividad, type AgendaItem, type Club, type Encuentro, type Fed } from '@/lib/agenda'
import { titleCase } from '@/lib/format'
import { graficosInforme, type Grafico } from '@/lib/graficos'
import type { Workbook } from 'exceljs'
import { hoyAR, anioAR, ZONA } from '@/lib/hora'

type Datos = { titulo: string, desde: string, hasta: string, items: AgendaItem[], encuentros?: Encuentro[], feds: Fed[], clubes?: Club[], porFed?: boolean }

const PETROLEO = 'FF05476E', TINTE = 'FFEAF2F7'  // colores de la identidad DTE
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
  // Logo DTE Región 1 en el encabezado de cada hoja (si no se puede cargar, la planilla sale igual).
  let logo: number | null = null
  try {
    const buf = await (await fetch('/brand/dte1-160.png')).arrayBuffer()
    logo = wb.addImage({ buffer: buf, extension: 'png' })
  } catch { logo = null }
  // Firma institucional oficial al pie de la hoja Resumen.
  let oficial: number | null = null
  try { oficial = wb.addImage({ buffer: await (await fetch('/brand/oficial-color.png')).arrayBuffer(), extension: 'png' }) } catch { oficial = null }
  const periodo = `Período: ${fecha(desde)} al ${fecha(hasta)}`

  type Col = { header: string, key: string, width: number }
  function tabla(nombre: string, cols: Col[], filas: Record<string, unknown>[], subtitulo?: string) {
    const ws = wb.addWorksheet(hoja(nombre), { views: [{ state: 'frozen', ySplit: 3 }] })
    ws.getRow(1).height = 30; ws.getRow(2).height = 18
    if (logo !== null) ws.addImage(logo, { tl: { col: cols.length, row: 0.1 }, ext: { width: 44, height: 44 } })
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
    escuela: escuela(i.school, i.lugar || (i.modalidad === 'Virtual' ? 'Virtual' : null)), accion: titleCase(i.accion), categoria: CATEGORIA_LABEL[CATEGORIA[i.accion]], sub: i.sub_accion ?? '',
    cantidad: i.cantidad ?? '', estado: ESTADO_LABEL[i.estado] ?? i.estado, con: (i.participantes ?? []).map(p => fedName(p.fed_id)).join(', '), detalle: i.detalle ?? '',
  })

  // Resumen por FED (sólo acciones realizadas, como las métricas del tablero).
  const equipo = feds.filter(f => f.rol !== 'coordinacion' && items.some(i => i.fed_id === f.id))
  const resumen = equipo.map(f => {
    const suyas = items.filter(i => i.fed_id === f.id), hechas = suyas.filter(cuentaHecha)
    const cuenta = Object.fromEntries(CATEGORIAS.map(c => [c, hechas.filter(i => CATEGORIA[i.accion] === c).length]))
    return { fed: f.nombre_completo, distritos: f.distritos_a_cargo.map(titleCase).join(', '), ...cuenta, total: hechas.length,
      planificadas: suyas.filter(i => i.estado === 'planificada' && !esAusencia(i.accion)).length, escuelas: new Set(hechas.map(i => i.school_id).filter(Boolean)).size,
      equipos: hechas.reduce((a, i) => a + (i.cantidad ?? 0), 0), encuentros: encuentros.filter(e => e.fed_id === f.id).length }
  })
  if (resumen.length > 1) {
    const tot: Record<string, unknown> = { fed: 'TOTAL', distritos: '' }
    for (const k of [...CATEGORIAS, 'total', 'planificadas', 'equipos', 'encuentros'] as const) tot[k] = resumen.reduce((a, r) => a + Number(r[k as keyof typeof r] ?? 0), 0)
    tot.escuelas = new Set(items.filter(cuentaHecha).map(i => i.school_id).filter(Boolean)).size
    resumen.push(tot as typeof resumen[number])
  }
  const wsRes = tabla('Resumen', [
    { header: 'FED', key: 'fed', width: 28 }, { header: 'Distritos', key: 'distritos', width: 26 },
    ...CATEGORIAS.map(c => ({ header: CATEGORIA_LABEL[c], key: c, width: 13 })),
    { header: 'Total realizadas', key: 'total', width: 12 }, { header: 'Planificadas', key: 'planificadas', width: 12 },
    { header: 'Escuelas alcanzadas', key: 'escuelas', width: 12 }, { header: 'Equipos intervenidos', key: 'equipos', width: 12 }, { header: 'Encuentros (clubes, talleres, prácticas)', key: 'encuentros', width: 16 },
  ], resumen, `${periodo} · cuenta acciones realizadas`)
  if (resumen.length > 1) wsRes.getRow(3 + resumen.length).font = { bold: true }
  if (oficial !== null) wsRes.addImage(oficial, { tl: { col: 0, row: 4 + resumen.length }, ext: { width: 520, height: 72 } })
  wsRes.getCell(`A${9 + resumen.length}`).value = `© ${anioAR()} Dirección de Tecnología Educativa (DTE), Región 1 · Agenda Territorial`
  wsRes.getCell(`A${9 + resumen.length}`).font = { size: 9, color: { argb: 'FF5B6472' } }

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
    const hoy = hoyAR()
    for (const [tipo, nombre] of [['CLUB DE TECNOLOGÍA', 'Clubes'], ['PRÁCTICAS PROFESIONALIZANTES', 'Prácticas']] as const) {
      const l = clubes.filter(c => c.tipo === tipo).sort((a, b) => escuela(a.school, a.lugar).localeCompare(escuela(b.school, b.lugar), 'es', { numeric: true }) || ordenGrupo(a.grupo, b.grupo))
      if (!l.length) continue
      tabla(nombre, [
        { header: 'FED', key: 'fed', width: 24 }, { header: 'Escuela / sede', key: 'escuela', width: 40 }, { header: 'Grupo', key: 'grupo', width: 22 },
        { header: 'Estudiantes de', key: 'origen', width: 30 }, { header: 'Distrito', key: 'distrito', width: 14 }, { header: 'Inicio', key: 'inicio', width: 11 },
        { header: 'Cierre', key: 'cierre', width: 11 }, { header: 'Último encuentro', key: 'ultimo', width: 11 }, { header: 'Estado', key: 'estado', width: 13 },
        { header: 'Encuentros realizados', key: 'realizados', width: 11 }, { header: 'Encuentros previstos', key: 'previstos', width: 11 },
      ], l.map(c => {
        const est = iniciado(c) ? clubEstado(c, hoy) : null
        return { fed: fedName(c.fed_id), escuela: escuela(escuelaDelClub(c), c.lugar), grupo: c.grupo ?? '', origen: c.escuela_origen && escuelaDelClub(c) !== c.escuela_origen ? escuela(c.escuela_origen) : '',
          distrito: escuelaDelClub(c)?.distrito ? titleCase(escuelaDelClub(c)!.distrito!) : '', inicio: fecha(c.fecha_inicio), cierre: fecha(c.fecha_cierre), ultimo: iniciado(c) ? fecha(ultimaActividad(c)) : '',
          estado: !est ? 'Por iniciar' : est === 'activo' ? 'Activo' : est === 'finalizado' ? 'Finalizado' : 'Sin actividad', realizados: new Set(c.encuentros.map(e => e.fecha)).size, previstos: c.tipo === 'CLUB DE TECNOLOGÍA' ? c.encuentros_previstos ?? '' : '' }
      }), 'Ciclo lectivo completo · un grupo por fila')
    }
  }

  // Una hoja por FED con sus acciones (la planilla mensual de cada uno). Con un solo FED sería igual a "Acciones", así que se omite.
  if (porFed && equipo.length > 1) for (const f of equipo) tabla(f.nombre_completo, colsAcciones.filter(c => c.key !== 'fed'), ordenados.filter(i => i.fed_id === f.id).map(filaAccion))

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url; a.download = nombreArchivo(`${titulo} ${desde} a ${hasta}`)
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// SVG de un gráfico a PNG (sólo en el navegador, con un canvas; el doble de resolución para que se vea nítido). Si no se puede, devuelve null.
export async function svgAPng(g: Pick<Grafico, 'svg' | 'ancho' | 'alto'>, escala = 2): Promise<ArrayBuffer | null> {
  let url = ''
  try {
    url = URL.createObjectURL(new Blob([g.svg], { type: 'image/svg+xml;charset=utf-8' }))
    const img = new Image()
    await new Promise<void>((ok, mal) => { img.onload = () => ok(); img.onerror = () => mal(new Error('svg')); img.src = url })
    const c = document.createElement('canvas')
    c.width = g.ancho * escala; c.height = g.alto * escala
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/png'))
    return blob ? await blob.arrayBuffer() : null
  } catch { return null } finally { if (url) URL.revokeObjectURL(url) }
}

// Hoja "Gráficos": a la izquierda la imagen de cada gráfico y a su derecha la tabla con los números (para editarlos o rehacer el gráfico en Excel).
// `pngs`: una imagen por gráfico; si alguna es null la hoja queda con las tablas y un aviso.
export function agregarHojaGraficos(wb: Workbook, graficos: Grafico[], pngs: (ArrayBuffer | null)[]) {
  const ws = wb.addWorksheet('Gráficos')
  ws.properties.defaultRowHeight = 15 // 20 px por fila: sirve para calcular cuánto ocupa cada imagen
  const COL_TABLA = 9, ESCALA = 1.15, FILA_PX = 20
  ws.getColumn(COL_TABLA).width = 30
  for (let c = COL_TABLA + 1; c <= COL_TABLA + 4; c++) ws.getColumn(c).width = 16
  ws.getCell('A1').value = 'Gráficos del período'
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: PETROLEO } }
  const faltan = graficos.some((_, i) => !pngs[i])
  if (faltan) { ws.getCell('A2').value = 'Las imágenes de los gráficos no se pudieron generar en este navegador: los datos de cada gráfico están en las tablas.'; ws.getCell('A2').font = { italic: true, color: { argb: 'FF5B6472' } } }
  let fila = 4
  graficos.forEach((g, i) => {
    const alto = Math.round(g.alto * ESCALA), ancho = Math.round(g.ancho * ESCALA)
    const png = pngs[i]
    if (png) ws.addImage(wb.addImage({ buffer: png, extension: 'png' }), { tl: { col: 0, row: fila - 1 }, ext: { width: ancho, height: alto } })
    // Tabla de datos, a la derecha de la imagen.
    const t = ws.getRow(fila)
    t.getCell(COL_TABLA).value = g.titulo; t.getCell(COL_TABLA).font = { bold: true, color: { argb: PETROLEO } }
    const cab = ws.getRow(fila + 1)
    g.tabla.cabeza.forEach((h, k) => { const c = cab.getCell(COL_TABLA + k); c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PETROLEO } }; c.alignment = { wrapText: true, vertical: 'middle', horizontal: k ? 'right' : 'left' } })
    g.tabla.filas.forEach((f, n) => {
      const r = ws.getRow(fila + 2 + n)
      f.forEach((v, k) => { const c = r.getCell(COL_TABLA + k); c.value = v; c.alignment = { horizontal: k ? 'right' : 'left' }; if (n % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTE } } })
    })
    fila += Math.max(Math.ceil(alto / FILA_PX), g.tabla.filas.length + 3) + 2
  })
  return ws
}

// Informe del período (coordinación o un FED): datos de la persona, indicadores y detalle de acciones.
export type Persona = { nombre: string, rol: string, distritos: string[], carga: string | null }
export async function exportarInforme({ titulo, persona, desde, hasta, indicadores, items, acompanadas = [], feds }: { titulo: string, persona: Persona, desde: string, hasta: string, indicadores: { label: string, valor: number, detalle?: string }[], items: AgendaItem[], acompanadas?: AgendaItem[], feds: Fed[] }) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Agenda Territorial DTE'; wb.created = new Date()
  const fedName = (id: string) => feds.find(f => f.id === id)?.nombre_completo ?? ''
  let oficial: number | null = null
  try { oficial = wb.addImage({ buffer: await (await fetch('/brand/oficial-color.png')).arrayBuffer(), extension: 'png' }) } catch { oficial = null }

  const ws = wb.addWorksheet('Informe')
  ws.getColumn(1).width = 52; ws.getColumn(2).width = 14; ws.getColumn(3).width = 44
  if (oficial !== null) { ws.getRow(1).height = 56; ws.addImage(oficial, { tl: { col: 0, row: 0.1 }, ext: { width: 400, height: 56 } }) }
  const datos: [string, string][] = [
    [titulo, ''], ['Nombre', persona.nombre], ['Rol', persona.rol], ['Región', 'Región Educativa 1'],
    ['Distritos a cargo', persona.distritos.map(titleCase).join(', ') || '—'], ['Carga horaria', persona.carga ?? '—'],
    ['Período', `${fecha(desde)} al ${fecha(hasta)}`], ['Emitido', new Date().toLocaleDateString('es-AR', { timeZone: ZONA })],
  ]
  datos.forEach(([k, v], n) => {
    const row = ws.getRow(n + 3)
    row.getCell(1).value = k; row.getCell(2).value = v
    if (n === 0) row.getCell(1).font = { bold: true, size: 14, color: { argb: PETROLEO } }
    else { row.getCell(1).font = { bold: true, color: { argb: 'FF5B6472' } }; ws.mergeCells(n + 3, 2, n + 3, 3) }
  })
  const ini = datos.length + 4
  const head = ws.getRow(ini)
  ;['Indicador', 'Cantidad', 'Aclaración'].forEach((h, i) => { head.getCell(i + 1).value = h })
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PETROLEO } }
  indicadores.forEach((x, n) => {
    const row = ws.getRow(ini + 1 + n)
    row.getCell(1).value = x.label; row.getCell(2).value = x.valor; row.getCell(3).value = x.detalle ?? ''
    row.getCell(2).font = { bold: true }
    if (n % 2) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTE } }
  })

  const graf = graficosInforme({ items, desde, hasta })
  if (graf.length) agregarHojaGraficos(wb, graf, await Promise.all(graf.map(g => svgAPng(g))))

  const wd = wb.addWorksheet('Acciones', { views: [{ state: 'frozen', ySplit: 1 }] })
  const cols = [['Fecha', 11], ['Horario', 13], ['Responsable', 24], ['Acción', 26], ['Sub-acción / tema', 30], ['Escuela / lugar', 40], ['CUE', 11], ['Distrito', 14], ['Detalle', 50]] as const
  cols.forEach(([h, w], i) => { wd.getRow(1).getCell(i + 1).value = h; wd.getColumn(i + 1).width = w })
  wd.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  wd.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PETROLEO } }
  const ordenados = [...items].filter(cuentaHecha).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
  ordenados.forEach((i, n) => {
    const row = wd.addRow([fecha(i.fecha), hora(i), fedName(i.fed_id), titleCase(i.accion), i.sub_accion ?? '', escuela(i.school, i.lugar), i.school?.cue ?? '', i.school?.distrito ? titleCase(i.school.distrito) : '', i.detalle ?? ''])
    row.alignment = { vertical: 'top', wrapText: true }
    if (n % 2) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTE } }
  })

  // Acciones de otros integrantes en las que participó: hoja aparte, no se suman a los indicadores.
  if (acompanadas.length) {
    const wa = wb.addWorksheet('Acompañadas', { views: [{ state: 'frozen', ySplit: 1 }] })
    cols.forEach(([h, w], i) => { wa.getRow(1).getCell(i + 1).value = h; wa.getColumn(i + 1).width = w })
    wa.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    wa.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PETROLEO } }
    ;[...acompanadas].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? '')).forEach((i, n) => {
      const row = wa.addRow([fecha(i.fecha), hora(i), fedName(i.fed_id), titleCase(i.accion), i.sub_accion ?? '', escuela(i.school, i.lugar), i.school?.cue ?? '', i.school?.distrito ? titleCase(i.school.distrito) : '', i.detalle ?? ''])
      row.alignment = { vertical: 'top', wrapText: true }
      if (n % 2) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTE } }
    })
  }

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = nombreArchivo(`${titulo} ${persona.nombre} ${desde}`); a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// Registro de reclamos de conectividad (lo que se ve en el panel, con sus filtros): mismas columnas que la planilla del CED, más la escuela y las notas.
export async function exportarReclamos(reclamos: Reclamo[], nombreFed: (id: string | null) => string) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Agenda Territorial DTE'; wb.created = new Date()
  const ws = wb.addWorksheet('Reclamos', { views: [{ state: 'frozen', ySplit: 1 }] })
  const cols = [['FED', 18], ['Tipo de conexión', 26], ['Asunto de mail', 62], ['Escuela', 44], ['CUE', 11], ['Distrito', 16], ['Estado', 18], ['Fecha de envío', 14], ['N° de ticket o incidencia', 28], ['¿Se resolvió?', 14], ['Notas', 44]] as const
  cols.forEach(([h, w], i) => { ws.getRow(1).getCell(i + 1).value = h; ws.getColumn(i + 1).width = w })
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PETROLEO } }
  const dia = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' })
  reclamos.forEach((r, n) => {
    const row = ws.addRow([nombreFed(r.fed_id), r.conexion ?? '', r.asunto, r.school?.nombre ? titleCase(r.school.nombre) : '', r.cue ?? '', r.school?.distrito ? titleCase(r.school.distrito) : '', ESTADO_RECLAMO_LABEL[r.estado], dia(r.enviado_at), r.nro_incidencia ?? '', r.estado === 'resuelto' ? 'Sí' : r.estado === 'anulado' ? 'Anulado' : 'En proceso', r.notas ?? ''])
    row.alignment = { vertical: 'top', wrapText: true }
    if (n % 2) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTE } }
  })
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } }
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = nombreArchivo(`Reclamos de conectividad ${new Date().toLocaleDateString('en-CA', { timeZone: ZONA })}`); a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// Extracto de cronogramas de conectividad (lista de intervenciones por fecha) para adjuntar en los mails a jefaturas y escuelas.
export async function exportarExtracto(filas: FilaExtracto[], titulo: string, periodo: string) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Agenda Territorial DTE'; wb.created = new Date()
  const ws = wb.addWorksheet('Cronograma', { views: [{ state: 'frozen', ySplit: 3 }] })
  const cols = [['Desde', 12], ['Hasta', 12], ['Establecimiento', 44], ['CUE', 11], ['Dirección', 30], ['Localidad', 18], ['Distrito', 16], ['Tarea', 30], ['Empresa', 18], ['Programa', 11], ['Personal a cargo', 44], ['Datos del personal (enlace)', 40], ['Observaciones', 16]] as const
  cols.forEach(([, w], i) => { ws.getColumn(i + 1).width = w })
  ws.getCell('A1').value = titulo; ws.getCell('A1').font = { bold: true, size: 14, color: { argb: PETROLEO } }
  ws.getCell('A2').value = `Período: ${periodo} · Emitido el ${new Date().toLocaleDateString('es-AR', { timeZone: ZONA })}`; ws.getCell('A2').font = { color: { argb: 'FF5B6474' } }
  const head = ws.getRow(3)
  cols.forEach(([h], i) => { head.getCell(i + 1).value = h })
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PETROLEO } }
  const dia = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
  filas.forEach((f, n) => {
    const row = ws.addRow([dia(f.desde), dia(f.hasta), f.establecimiento, f.cue, f.direccion, f.localidad, f.distrito, f.tarea, f.empresa, f.programa, f.personal.join('\n') || 'A confirmar', f.enlaces.join('\n'), f.observaciones])
    row.alignment = { vertical: 'top', wrapText: true }
    if (n % 2) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTE } }
  })
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: cols.length } }
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = nombreArchivo(`Cronograma de conectividad ${new Date().toLocaleDateString('en-CA', { timeZone: ZONA })}`); a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// Jornadas pedagógicas con las columnas en el orden del formulario de Nivel Central (más el tipo, los encuentros y los enlaces a las fotos).
export async function exportarJornadas(jornadas: Jornada[]) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Agenda Territorial DTE'; wb.created = new Date()
  const ws = wb.addWorksheet('Jornadas', { views: [{ state: 'frozen', ySplit: 1 }] })
  const campos = jornadas[0] ? camposDeJornada(jornadas[0]) : []
  const cols = [...campos.map(c => [c.etiqueta, c.clave === 'observaciones' ? 40 : c.clave === 'lugar' || c.clave === 'propuesta' ? 34 : 22] as const), ['Tipo de acción', 24] as const, ['Estado de carga', 28] as const, ['Fotos (carpeta de Drive)', 60] as const]
  cols.forEach(([h, w], i) => { ws.getRow(1).getCell(i + 1).value = h; ws.getColumn(i + 1).width = w })
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PETROLEO } }
  jornadas.forEach((j, n) => {
    const row = ws.addRow([...camposDeJornada(j).map(c => c.valor), j.tipo, j.cargada ? (j.cargada.modificada ? 'Cargada, modificada después' : `Cargada por ${j.cargada.por}`) : 'Pendiente', j.foto?.url ?? ''])
    row.alignment = { vertical: 'top', wrapText: true }
    if (n % 2) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTE } }
  })
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } }
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = nombreArchivo(`Jornadas pedagogicas ${new Date().toLocaleDateString('en-CA', { timeZone: ZONA })}`); a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// Lista de escuelas tal como se ve en pantalla: escuela, CUE, dirección, localidad, distrito y contacto (para comparar con un registro propio).
export async function exportarEscuelas(escuelas: ResumenEscuela[]) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Agenda Territorial DTE'; wb.created = new Date()
  const ws = wb.addWorksheet('Escuelas', { views: [{ state: 'frozen', ySplit: 1 }] })
  const cols = [['Escuela', 46], ['CUE', 11], ['Dirección', 32], ['Localidad', 20], ['Distrito', 16], ['Contacto', 28], ['Cargo', 18], ['Teléfono', 16], ['Correo', 32], ['Otros contactos', 15], ['Próximos cronogramas', 40], ['Predio', 10], ['Comparte predio con', 44]] as const
  cols.forEach(([h, w], i) => { ws.getRow(1).getCell(i + 1).value = h; ws.getColumn(i + 1).width = w })
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PETROLEO } }
  escuelas.forEach((e, n) => {
    const c = e.contacto
    const row = ws.addRow([e.nombre ? titleCase(e.nombre) : '', e.cue ?? '', e.direccion ? titleCase(e.direccion) : '', e.ciudad ? titleCase(e.ciudad) : '', e.distrito ? titleCase(e.distrito) : '',
      nombreContacto(c), c?.cargo ?? '', c?.telefono ?? '', c?.correo_laboral || c?.correo || '', e.contactosExtra || '',
      e.proximosCronogramas.map(p => `${ventanaDe(p)} · ${etiquetaTipo(p.tipo)}`).join('\n'),
      e.predio ?? '', e.comparte.map(h => `${h.nombre ? titleCase(h.nombre) : 'Sin nombre'} (CUE ${h.cue ?? '—'})`).join('\n')])
    row.alignment = { vertical: 'top', wrapText: true }
    if (n % 2) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTE } }
  })
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } }
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = nombreArchivo(`Escuelas ${new Date().toLocaleDateString('en-CA', { timeZone: ZONA })}`); a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
