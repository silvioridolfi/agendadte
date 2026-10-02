// Nombres de las carpetas de fotos en Drive (puro, sin acceso a Drive ni a la base): una por día y una por acción.
import { esPeatConGrupo } from '@/lib/encuentro'

export const SIN_FECHA = '1900-01-01'
const SIGLAS: [RegExp, string][] = [
  [/^Escuela de Educación Secundaria Técnica/i, 'EEST'], [/^Escuela de Educación Secundaria Agraria/i, 'EESA'], [/^Escuela de Educación Secundaria/i, 'EES'],
  [/^Escuela de Educación Primaria/i, 'EP'], [/^Escuela de Educación Especial/i, 'EEE'], [/^Jardín de Infantes/i, 'JI'],
  [/^Instituto Superior de Formación Docente/i, 'ISFD'], [/^Instituto Superior de Formación Técnica/i, 'ISFT'], [/^Centro de Educación Física/i, 'CEF'],
]
const titulo = (s: string) => s.toLowerCase().replace(/(^|[\s(“"])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()).replace(/\bN°\s*/gi, 'N° ')
function sigla(nombre: string) {
  const n = titulo(nombre), s = SIGLAS.find(([re]) => re.test(n))
  const corto = s ? n.replace(s[0], s[1]) : n
  return corto.match(/^(.*?N°\s*\d+)/)?.[1] ?? corto
}
const TIPO: Record<string, string> = { 'CLUB DE TECNOLOGÍA': 'Club', 'PRÁCTICAS PROFESIONALIZANTES': 'PEAT' }

export type ItemDia = { id: string, accion: string, lugar: string | null, hora_inicio: string | null, hora_fin: string | null, school: { nombre: string | null, lat?: number | null, lon?: number | null } | null, club: { grupo: string | null } | null }
const lugarDe = (i: ItemDia) => i.school?.nombre ? sigla(i.school.nombre) : i.lugar ?? titulo(i.accion)
// Los grupos de PEAT se nombran sólo por el curso y el grupo, sin la escuela del encuentro: "12:00 · PEAT 7° Informática - Grupo 1".
export const nombreAccion = (i: ItemDia) => `${i.hora_inicio ? `${i.hora_inicio.slice(0, 5)} · ` : ''}${TIPO[i.accion] ?? titulo(i.accion)} ${esPeatConGrupo(i) ? i.club!.grupo : `${lugarDe(i)}${i.club?.grupo ? ` - ${i.club.grupo}` : ''}`}`.slice(0, 150)

export function nombreDelDia(fecha: string, items: ItemDia[]) {
  if (fecha === SIN_FECHA) return 'Sin fecha (ordenar a mano)'
  // Agrupado por escuela: "EP N° 4 (4°, 5°, 6°)".
  const porLugar = new Map<string, string[]>()
  for (const i of items) {
    if (esPeatConGrupo(i)) { if (!porLugar.has(i.club!.grupo!)) porLugar.set(i.club!.grupo!, []); continue }
    const l = porLugar.get(lugarDe(i)) ?? []; if (i.club?.grupo && !l.includes(i.club.grupo)) l.push(i.club.grupo); porLugar.set(lugarDe(i), l)
  }
  const partes = [...porLugar].map(([l, g]) => (g.length ? `${l} (${g.sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).join(', ')})` : l))
  const resumen = partes.length ? partes.slice(0, 4).join(' · ') + (partes.length > 4 ? ` y ${partes.length - 4} más` : '') : 'Sin acciones en la agenda'
  // Fecha como DD-MM-AAAA (así la leen en Drive).
  const [y, m, d] = fecha.split('-')
  return `${d}-${m}-${y} · ${resumen}`.slice(0, 180)
}

