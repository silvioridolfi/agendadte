import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const estado = vi.hoisted(() => ({ llamadas: 0 }))
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => {
    estado.llamadas++
    const cadena: unknown = new Proxy({}, { get: (_, m: string) => m === 'then' ? (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok) : () => cadena })
    return { from: () => cadena }
  },
}))

import { armarJornadas, camposDeJornada, cuesDe, destinatariosDeForm, filtrarJornadas, FILTROS_JORNADAS, lugarDe, textoDeJornada, type EncuentroJ, type ClubJ } from '@/lib/jornadas'
import { jornadasImpl } from '@/lib/servidor/jornadas'
import type { Usuario } from '@/lib/sesion'

const esc = (cue: number, nombre: string, distrito = 'LA PLATA') => ({ cue, nombre, distrito })
const enc = (o: Partial<EncuentroJ>): EncuentroJ => ({ id: 'e1', agenda_item_id: null, fed_id: 'f1', fecha: '2026-09-10', tipo: 'TALLER/CAPACITACIÓN', lugar: null, propuesta: 'Robótica', modalidad: 'Presencial',
  tipo_jornada: 'Taller', club_id: null, destinatarios: 'Docentes', inscriptos: 20, asistentes: 15, descripcion: '', school: esc(111, 'ESCUELA DE EDUCACIÓN SECUNDARIA 1'), ...o })
const feds = [{ id: 'f1', nombre_completo: 'Ana Pérez' }]
const vacio = { carpetaAccion: new Map(), carpetaDia: new Map() }

describe('destinatariosDeForm', () => {
  it('mapea el texto libre a las casillas', () => {
    expect(destinatariosDeForm('Estudiantes de 6° A')).toEqual(['Estudiantes'])
    expect(destinatariosDeForm('Docentes y directivos')).toEqual(['Equipo de Conducción', 'Docentes'])
    expect(destinatariosDeForm('Inspectora e Jefe Distrital')).toEqual(['JD', 'IE'])
  })
  it('lo que no reconoce va a Otros', () => {
    expect(destinatariosDeForm('Comunidad')).toEqual(['Otros (aclarar en observaciones)'])
    expect(destinatariosDeForm(null)).toEqual(['Otros (aclarar en observaciones)'])
  })
})

describe('lugar y CUE', () => {
  it('virtual, escuela o texto libre', () => {
    expect(lugarDe({ modalidad: 'Virtual', lugar: null, school: null })).toBe('Virtual')
    expect(lugarDe({ modalidad: 'Presencial', lugar: null, school: esc(111, 'ESCUELA DE EDUCACIÓN SECUNDARIA 1') })).toMatch(/- 111$/)
    expect(lugarDe({ modalidad: 'Presencial', lugar: ' Biblioteca ', school: null })).toBe('Biblioteca')
    expect(lugarDe({ modalidad: null, lugar: null, school: null })).toBe('—')
  })
  it('CUE sin repetir', () => {
    expect(cuesDe(esc(1, 'a'), esc(2, 'b'), esc(1, 'a'), null)).toBe('1 - 2')
  })
})

describe('armarJornadas', () => {
  it('deja afuera los encuentros sin participantes', () => {
    expect(armarJornadas({ encuentros: [enc({ asistentes: 0 }), enc({ id: 'e2', asistentes: null })], clubes: [], feds, ...vacio })).toEqual([])
  })
  it('un taller es una fila por encuentro, finalizada', () => {
    const r = armarJornadas({ encuentros: [enc({}), enc({ id: 'e2', fecha: '2026-09-12' })], clubes: [], feds, ...vacio })
    expect(r).toHaveLength(2)
    expect(r.every(j => j.finalizada && j.encuentros === 1 && j.fed === 'Ana Pérez')).toBe(true)
  })
  it('un club agrupa sus encuentros: máximos, fecha de cierre y estado', () => {
    const club: ClubJ = { id: 'c1', grupo: 'A', propuesta: 'Club de robótica', fecha_cierre: '2026-09-30', school: esc(222, 'EES 2', 'BERISSO'), escuela_origen: esc(333, 'EP 3') }
    const es = [enc({ id: 'a', club_id: 'c1', tipo: 'CLUB DE TECNOLOGÍA', inscriptos: 10, asistentes: 8 }), enc({ id: 'b', club_id: 'c1', tipo: 'CLUB DE TECNOLOGÍA', fecha: '2026-09-17', inscriptos: 12, asistentes: 6 })]
    const [j] = armarJornadas({ encuentros: es, clubes: [club], feds, ...vacio })
    expect(j).toMatchObject({ encuentros: 2, inscriptos: 12, participantes: 8, fechaFin: '2026-09-30', finalizada: true, distrito: 'Berisso', cues: '222 - 333', propuesta: 'Club de robótica' })
    const [abierto] = armarJornadas({ encuentros: es, clubes: [{ ...club, fecha_cierre: null }], feds, ...vacio })
    expect(abierto).toMatchObject({ finalizada: false, fechaFin: '2026-09-17' })
  })
  it('fotos: la de la acción o, si no, la del día', () => {
    const r = armarJornadas({ encuentros: [enc({ agenda_item_id: 'i1' }), enc({ id: 'e2', fecha: '2026-09-11' })], clubes: [], feds,
      carpetaAccion: new Map([['i1', { url: 'u-accion', n: 3 }]]), carpetaDia: new Map([['f1|2026-09-11', { url: 'u-dia', n: 5 }]]) })
    const fotos = r.flatMap(j => j.fotos)
    expect(fotos).toEqual(expect.arrayContaining([{ fecha: '2026-09-10', url: 'u-accion', n: 3, deAccion: true }, { fecha: '2026-09-11', url: 'u-dia', n: 5, deAccion: false }]))
  })
})

describe('filtros y campos', () => {
  const club: ClubJ = { id: 'c1', grupo: null, propuesta: 'X', fecha_cierre: null, school: esc(222, 'EES 2', 'BERISSO'), escuela_origen: null }
  const lista = armarJornadas({ encuentros: [enc({}), enc({ id: 'b', club_id: 'c1', tipo: 'CLUB DE TECNOLOGÍA', fecha: '2026-10-01' })], clubes: [club], feds, ...vacio })
  it('por defecto solo las finalizadas; con "en curso" también las abiertas', () => {
    expect(filtrarJornadas(lista, FILTROS_JORNADAS)).toHaveLength(1)
    expect(filtrarJornadas(lista, { ...FILTROS_JORNADAS, enCurso: true })).toHaveLength(2)
  })
  it('por período, distrito y tipo', () => {
    const f = { ...FILTROS_JORNADAS, enCurso: true }
    expect(filtrarJornadas(lista, { ...f, desde: '2026-09-20' })).toHaveLength(1)
    expect(filtrarJornadas(lista, { ...f, distrito: 'Berisso' })).toHaveLength(1)
    expect(filtrarJornadas(lista, { ...f, tipo: 'TALLER/CAPACITACIÓN' })).toHaveLength(1)
  })
  it('los campos siguen el orden del formulario y el texto los junta', () => {
    const c = camposDeJornada(lista.find(j => j.finalizada)!)
    expect(c[0]).toMatchObject({ clave: 'region', valor: '1' })
    expect(c.find(x => x.clave === 'fechaFin')?.valor).toBe('10/09/2026')
    expect(textoDeJornada(lista[0]).split('\n')).toHaveLength(c.length)
  })
})

describe('permisos del reporte', () => {
  const usuario = (rol: 'fed' | 'coordinacion', esAdmin = false) => ({ fed: { id: 'u', nombre_completo: 'u', rol }, esAdmin }) as unknown as Usuario
  beforeEach(() => { estado.llamadas = 0 })
  it('un FED común no lo ve y ni toca la base', async () => {
    await expect(jornadasImpl(usuario('fed'))).rejects.toThrow(/coordinación y la administración/)
    expect(estado.llamadas).toBe(0)
  })
  it('CED y administración sí', async () => {
    await expect(jornadasImpl(usuario('coordinacion'))).resolves.toEqual([])
    await expect(jornadasImpl(usuario('fed', true))).resolves.toEqual([])
  })
})
