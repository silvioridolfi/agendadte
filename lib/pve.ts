import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import { DriveError, carpetaVigente, crearCarpeta, darLectura, esCarpeta, listarHijos, renombrar } from '@/lib/drive'

// Planillas de Visita a Escuelas (PVE): cada FED sube un PDF por mes a "PVE MM-AAAA", dentro de la subcarpeta "PVE"
// de su carpeta de Drive (la misma que usa para las fotos). La agenda lo detecta, lo renombra con el formato del
// instructivo ("R01 - PVE (OCTUBRE 2026) - NOMBRE") y le da permiso de lectura a la coordinación.
export const REGION = 'R01'
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

// Mes como AAAA-MM-01; `desplazamiento` en meses respecto de la fecha dada.
export function inicioMes(fecha: string, desplazamiento = 0) {
  const [y, m] = fecha.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + desplazamiento, 1))
  return d.toISOString().slice(0, 10)
}
export const nombreMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`
export const carpetaMes = (mes: string) => `PVE ${mes.slice(5, 7)}-${mes.slice(0, 4)}`
export const nombrePve = (mes: string, fed: string) => `${REGION} - PVE (${nombreMes(mes)}) - ${fed.toUpperCase()}.pdf`
export const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

// Meses con carpeta abierta: el actual y el anterior (la del mes anterior se entrega los primeros días del siguiente).
export const mesesAbiertos = (hoy = hoyAR()) => [inicioMes(hoy, -1), inicioMes(hoy)]

export type ResultadoPve = { entregadas: number, nuevas: number }

export async function revisarPve(fedId: string): Promise<ResultadoPve> {
  const db = supabaseServer()
  const res: ResultadoPve = { entregadas: 0, nuevas: 0 }
  const { data: fed } = await db.from('feds').select('nombre_completo, carpeta_fotos_id, carpeta_pve_id, rol').eq('id', fedId).maybeSingle()
  if (!fed?.carpeta_fotos_id || fed.rol !== 'fed') return res

  // Carpeta "PVE" dentro de la carpeta del FED (se vuelve a crear si la borraron).
  let pveId = fed.carpeta_pve_id as string | null
  if (!pveId || !(await carpetaVigente(pveId))) {
    const existente = (await listarHijos(fed.carpeta_fotos_id)).find(f => esCarpeta(f) && f.name === 'PVE')
    pveId = existente?.id ?? (await crearCarpeta('PVE', fed.carpeta_fotos_id)).id
    await db.from('feds').update({ carpeta_pve_id: pveId }).eq('id', fedId)
  }

  // Carpetas de los meses abiertos (la de cada mes se crea sola; las ya existentes con ese nombre se reutilizan).
  const { data: filas } = await db.from('pve').select('mes, folder_id, file_id, enviada_at').eq('fed_id', fedId).gte('mes', inicioMes(hoyAR(), -3))
  const porMes = new Map((filas ?? []).map(f => [f.mes as string, f]))
  const hijos = await listarHijos(pveId)
  for (const mes of mesesAbiertos()) {
    const actual = porMes.get(mes)
    if (actual && (await carpetaVigente(actual.folder_id as string))) continue
    const folder = hijos.find(f => esCarpeta(f) && f.name === carpetaMes(mes))?.id ?? (await crearCarpeta(carpetaMes(mes), pveId)).id
    await db.from('pve').upsert({ fed_id: fedId, mes, folder_id: folder, updated_at: new Date().toISOString() })
    porMes.set(mes, { mes, folder_id: folder, file_id: null, enviada_at: null })
  }

  // Coordinación: recibe permiso de lectura y el aviso de cada entrega nueva.
  const { data: coord } = await db.from('feds').select('id, email').eq('rol', 'coordinacion')
  for (const [mes, fila] of porMes) {
    if (fila.enviada_at) { if (fila.file_id) res.entregadas++; continue } // ya enviada a Nivel Central: queda fija
    let pdfs
    try { pdfs = (await listarHijos(fila.folder_id as string)).filter(f => f.mimeType === 'application/pdf') }
    catch (e) { if (e instanceof DriveError && (e.status === 404 || e.status === 403)) continue; throw e }
    // Si hay más de uno, vale el último subido.
    const pdf = pdfs.sort((a, b) => (b.createdTime ?? '').localeCompare(a.createdTime ?? ''))[0]
    if (!pdf) {
      if (fila.file_id) await db.from('pve').update({ file_id: null, nombre: null, entregada_at: null, updated_at: new Date().toISOString() }).eq('fed_id', fedId).eq('mes', mes)
      continue
    }
    res.entregadas++
    const nombre = nombrePve(mes, fed.nombre_completo as string)
    if (pdf.name !== nombre) await renombrar(pdf.id, nombre)
    if (pdf.id === fila.file_id) continue
    for (const c of coord ?? []) if (c.email) try { await darLectura(pdf.id, c.email as string) } catch { /* sin permiso para compartir: lo ve igual desde la agenda */ }
    await db.from('pve').update({ file_id: pdf.id, nombre, entregada_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('fed_id', fedId).eq('mes', mes)
    if (coord?.length) await db.from('notificaciones').insert(coord.map(c => ({ fed_id: c.id, autor_id: fedId, tipo: 'pve', detalle: `Entregó su PVE de ${nombreMes(mes).toLowerCase()}` })))
    res.nuevas++
  }
  return res
}

// Último día hábil (lunes a viernes) del mes de la fecha dada.
export function ultimoHabil(fecha: string) {
  const d = new Date(`${inicioMes(fecha, 1)}T12:00:00Z`)
  do d.setUTCDate(d.getUTCDate() - 1); while (d.getUTCDay() === 0 || d.getUTCDay() === 6)
  return d.toISOString().slice(0, 10)
}
