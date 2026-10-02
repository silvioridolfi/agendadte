import { describe, expect, it } from 'vitest'
import { nombreAccion, nombreDelDia, type ItemDia } from '@/lib/fotos-nombres'

const ees31 = { nombre: 'ESCUELA DE EDUCACIÓN SECUNDARIA N° 31 GRAL. JOSÉ DE SAN MARTÍN' }, ep4 = { nombre: 'ESCUELA DE EDUCACIÓN PRIMARIA N° 4 "NUESTRA SEÑORA DE LAS MERCEDES"' }
const item = (p: Partial<ItemDia>): ItemDia => ({ id: 'i', accion: 'CLUB DE TECNOLOGÍA', lugar: null, hora_inicio: '12:00:00', hora_fin: '13:00:00', school: ep4, club: { grupo: '4°' }, ...p })
const peat = (grupo: string, p: Partial<ItemDia> = {}) => item({ accion: 'PRÁCTICAS PROFESIONALIZANTES', school: ees31, club: { grupo }, ...p })

describe('nombres de las carpetas de fotos', () => {
  it('un club lleva la escuela y el grado', () => {
    expect(nombreAccion(item({}))).toBe('12:00 · Club EP N° 4 - 4°')
  })
  it('un grupo de PEAT lleva sólo el curso y el grupo, sin la escuela del encuentro', () => {
    expect(nombreAccion(peat('7° Informática - Grupo 1', { hora_inicio: '08:00:00' }))).toBe('08:00 · PEAT 7° Informática - Grupo 1')
  })
  it('una práctica sin grupo conserva la escuela', () => {
    expect(nombreAccion(peat('x', { club: null }))).toBe('12:00 · PEAT EES N° 31')
  })
  it('el nombre del día muestra los grupos de PEAT sin la escuela', () => {
    const dia = nombreDelDia('2026-10-14', [peat('7° Informática - Grupo 1'), peat('7° Informática - Grupo 2'), item({}), item({ id: 'j', club: { grupo: '5°' } })])
    expect(dia).toBe('14-10-2026 · 7° Informática - Grupo 1 · 7° Informática - Grupo 2 · EP N° 4 (4°, 5°)')
    expect(dia).not.toMatch(/EES/)
  })
})
