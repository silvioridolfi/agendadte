import 'server-only'
import { createSign } from 'node:crypto'

// Cliente mínimo de Google Drive con la cuenta técnica de la agenda (cuenta de servicio).
// Sólo accede a las carpetas que cada FED le comparte. Credenciales en GOOGLE_SA_EMAIL / GOOGLE_SA_KEY.
export const cuentaTecnica = () => process.env.GOOGLE_SA_EMAIL ?? ''
export const driveConfigurado = () => !!process.env.GOOGLE_SA_EMAIL && !!process.env.GOOGLE_SA_KEY

let cache: { token: string, vence: number } | null = null
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url')

async function token(): Promise<string> {
  if (cache && cache.vence > Date.now() + 60_000) return cache.token
  const email = process.env.GOOGLE_SA_EMAIL, key = process.env.GOOGLE_SA_KEY?.replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Falta configurar la cuenta técnica de Google Drive')
  const ahora = Math.floor(Date.now() / 1000)
  const cuerpo = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify({ iss: email, scope: 'https://www.googleapis.com/auth/drive', aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 }))}`
  const firma = createSign('RSA-SHA256').update(cuerpo).sign(key)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${cuerpo}.${b64(firma)}` }),
  })
  const data = await res.json() as { access_token?: string, expires_in?: number, error_description?: string }
  if (!res.ok || !data.access_token) throw new Error(`No se pudo conectar con Google Drive: ${data.error_description ?? res.status}`)
  cache = { token: data.access_token, vence: Date.now() + (data.expires_in ?? 3600) * 1000 }
  return cache.token
}

export class DriveError extends Error { constructor(msg: string, public status: number) { super(msg) } }

async function api<T>(path: string, init: RequestInit = {}, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`)
  for (const [k, v] of Object.entries({ supportsAllDrives: 'true', ...params })) url.searchParams.set(k, v)
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', ...init.headers } })
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new DriveError(e.error?.message ?? `Error de Google Drive (${res.status})`, res.status)
  }
  return res.status === 204 ? (undefined as T) : res.json() as Promise<T>
}

export type ArchivoDrive = { id: string, name: string, mimeType: string, createdTime?: string, imageMediaMetadata?: { time?: string, location?: { latitude?: number, longitude?: number } }, shortcutDetails?: { targetId?: string } }
const CARPETA = 'application/vnd.google-apps.folder'

// Id de carpeta a partir del enlace que pega el FED (…/folders/<id> o ?id=<id>).
export function idDeCarpeta(url: string): string | null {
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]{10,})/) ?? url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)
  return m ? m[1] : null
}

export async function verificarCarpeta(id: string) {
  const f = await api<{ id: string, name: string, mimeType: string, capabilities?: { canAddChildren?: boolean, canEdit?: boolean } }>(`files/${id}`, {}, { fields: 'id,name,mimeType,capabilities(canAddChildren,canEdit)' })
  if (f.mimeType !== CARPETA) throw new Error('El enlace no es de una carpeta')
  return { nombre: f.name, puedeEditar: !!f.capabilities?.canAddChildren }
}

export async function listar(padre: string, soloCarpetas = false): Promise<ArchivoDrive[]> {
  const out: ArchivoDrive[] = []
  let pageToken = ''
  do {
    const q = `'${padre}' in parents and trashed = false${soloCarpetas ? ` and mimeType = '${CARPETA}'` : ` and mimeType != '${CARPETA}'`}`
    const r = await api<{ files: ArchivoDrive[], nextPageToken?: string }>('files', {}, { q, pageSize: '200', fields: 'nextPageToken,files(id,name,mimeType,createdTime,imageMediaMetadata(time,location))', includeItemsFromAllDrives: 'true', ...(pageToken ? { pageToken } : {}) })
    out.push(...r.files); pageToken = r.nextPageToken ?? ''
  } while (pageToken && out.length < 1000)
  return out
}

// Carpeta usable: existe y no está en la papelera (si el FED la borró, hay que crear otra).
// Con `padre`, además tiene que seguir dentro de esa carpeta: si el FED la quitó de su Drive (queda sin ubicación
// porque es de la cuenta de la agenda), cuenta como borrada.
export async function carpetaVigente(id: string, padre?: string): Promise<boolean> {
  try { const f = await api<{ trashed?: boolean, parents?: string[] }>(`files/${id}`, {}, { fields: 'trashed,parents' }); return !f.trashed && (!padre || (f.parents ?? []).includes(padre)) }
  catch (e) { if (e instanceof DriveError && (e.status === 404 || e.status === 403)) return false; throw e }
}
// Contenido de una carpeta aunque esté en la papelera (para rescatar fotos de carpetas eliminadas).
export async function listarTodo(padre: string): Promise<ArchivoDrive[]> {
  const r = await api<{ files: ArchivoDrive[] }>('files', {}, { q: `'${padre}' in parents`, pageSize: '500', fields: 'files(id,name,mimeType)', includeItemsFromAllDrives: 'true' })
  return r.files
}
// Todo lo que hay dentro de una carpeta (no en la papelera), incluidos accesos directos y su destino.
export async function listarHijos(padre: string): Promise<ArchivoDrive[]> {
  const out: ArchivoDrive[] = []
  let pageToken = ''
  do {
    const r = await api<{ files: ArchivoDrive[], nextPageToken?: string }>('files', {}, { q: `'${padre}' in parents and trashed = false`, pageSize: '500', fields: 'nextPageToken,files(id,name,mimeType,createdTime,imageMediaMetadata(time,location),shortcutDetails(targetId))', includeItemsFromAllDrives: 'true', ...(pageToken ? { pageToken } : {}) })
    out.push(...r.files); pageToken = r.nextPageToken ?? ''
  } while (pageToken && out.length < 2000)
  return out
}
export const esAtajo = (f: ArchivoDrive) => f.mimeType === 'application/vnd.google-apps.shortcut'
export const borrar = (id: string) => api(`files/${id}`, { method: 'DELETE' })
// Permiso de lectura para una persona (sin mail de aviso de Google).
export const darLectura = (id: string, email: string) => api(`files/${id}/permissions`, { method: 'POST', body: JSON.stringify({ role: 'reader', type: 'user', emailAddress: email }) }, { sendNotificationEmail: 'false', fields: 'id' })
// Contenido de un archivo (para armar el ZIP de PVE).
export async function descargar(id: string): Promise<ArrayBuffer> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${await token()}` } })
  if (!res.ok) throw new DriveError(`No se pudo descargar el archivo (${res.status})`, res.status)
  return res.arrayBuffer()
}
// Una pestaña de una planilla de Google, por su nombre, como CSV con los valores ya calculados (las fórmulas se leen por su resultado).
export async function exportarHojaCsv(archivoId: string, pestana: string): Promise<string> {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${archivoId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(pestana)}`, { headers: { Authorization: `Bearer ${await token()}` } })
  if (!res.ok) throw new DriveError(res.status === 403 || res.status === 404 ? 'La cuenta técnica no tiene acceso a la planilla de conectividad' : `No se pudo leer la planilla (${res.status})`, res.status)
  return res.text()
}
export const esCarpeta = (f: ArchivoDrive) => f.mimeType === CARPETA
export const crearCarpeta = (nombre: string, padre: string) => api<{ id: string }>('files', { method: 'POST', body: JSON.stringify({ name: nombre, mimeType: CARPETA, parents: [padre] }) }, { fields: 'id' })
export const renombrar = (id: string, nombre: string) => api(`files/${id}`, { method: 'PATCH', body: JSON.stringify({ name: nombre }) }, { fields: 'id' })
export const mover = (id: string, desde: string, hacia: string) => api(`files/${id}`, { method: 'PATCH', body: '{}' }, { addParents: hacia, removeParents: desde, fields: 'id' })
export const atajo = (id: string, nombre: string, padre: string) => api('files', { method: 'POST', body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.shortcut', parents: [padre], shortcutDetails: { targetId: id } }) }, { fields: 'id' })
export const urlCarpeta = (id: string) => `https://drive.google.com/drive/folders/${id}`

// Fecha de captura de la foto ("2026:09:30 10:11:12" en los metadatos EXIF) como AAAA-MM-DD.
export function fechaDeCaptura(f: ArchivoDrive): string | null {
  const t = f.imageMediaMetadata?.time
  const m = t?.match(/^(\d{4})[:-](\d{2})[:-](\d{2})/)
  return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` : null
}

// Lugar de captura (GPS de la cámara), si la foto lo tiene.
export function ubicacionDeCaptura(f: ArchivoDrive): { lat: number, lon: number } | null {
  const l = f.imageMediaMetadata?.location
  return l && typeof l.latitude === 'number' && typeof l.longitude === 'number' && (l.latitude || l.longitude) ? { lat: l.latitude, lon: l.longitude } : null
}

// Hora de captura en minutos desde la medianoche (hora local de la cámara), o null.
export function minutosDeCaptura(f: ArchivoDrive): number | null {
  const m = f.imageMediaMetadata?.time?.match(/^\d{4}[:-]\d{2}[:-]\d{2}[ T](\d{2}):(\d{2})/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
