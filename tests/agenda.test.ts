import { describe, expect, it } from 'vitest'
import { clubEncuentrosRealizados, clubEstado, diasHabilesEntre, esTrayecto, nivelDeEscuela, serieFechas, ultimaActividad, iniciado, ordenGrupo, type Club, type ClubIniciado } from '@/lib/agenda'
import { nombreArchivo } from '@/lib/exportar'

const club = (over: Partial<Club> = {}): ClubIniciado => ({
  id: 'c', fed_id: 'f', school_id: null, lugar: null, grupo: '5° A', tipo: 'CLUB DE TECNOLOGÍA', escuela_origen: null, propuesta: 'Club de Tecnología',
  fecha_inicio: '2026-03-02', fecha_cierre: null, encuentros_previstos: 8, school: null, encuentros: [], ...over,
} as ClubIniciado)
const enc = (fecha: string) => ({ id: fecha, fecha, propuesta: null, school_id: null, lugar: null, school: null, encuentro_n: null, inscriptos: null, asistentes: null, tipo_jornada: null, modalidad: null, destinatarios: null, es_cierre: false })

describe('serieFechas', () => {
  it('genera los días elegidos después de la fecha inicial, hasta el límite', () => {
    // 2026-09-02 es miércoles
    expect(serieFechas('2026-09-02', [3], '2026-09-30')).toEqual(['2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30'])
  })
  it('saltea los no laborables', () => {
    expect(serieFechas('2026-09-02', [3], '2026-09-23', new Set(['2026-09-16']))).toEqual(['2026-09-09', '2026-09-23'])
  })
  it('admite varios días por semana', () => {
    expect(serieFechas('2026-09-07', [1, 4], '2026-09-17')).toEqual(['2026-09-10', '2026-09-14', '2026-09-17'])
  })
  it('no pasa de 60 fechas', () => {
    expect(serieFechas('2026-01-01', [1, 2, 3, 4, 5], '2027-12-31')).toHaveLength(60)
  })
})

describe('diasHabilesEntre', () => {
  it('cuenta sólo lunes a viernes', () => {
    expect(diasHabilesEntre('2026-09-04', '2026-09-11')).toBe(5) // vie → vie
  })
  it('no cuenta el receso invernal 2026 ni los no hábiles indicados', () => {
    expect(diasHabilesEntre('2026-07-17', '2026-08-03')).toBe(1) // sólo el lunes 3/8
    expect(diasHabilesEntre('2026-09-04', '2026-09-11', new Set(['2026-09-08']))).toBe(4)
  })
})

describe('clubEstado', () => {
  it('finalizado si tiene cierre', () => {
    expect(clubEstado(club({ fecha_cierre: '2026-07-01' }), '2026-09-26')).toBe('finalizado')
  })
  it('activo con actividad reciente y sin actividad después de 30 días hábiles', () => {
    expect(clubEstado(club({ encuentros: [enc('2026-09-16')] }), '2026-09-26')).toBe('activo')
    expect(clubEstado(club({ encuentros: [enc('2026-06-10')] }), '2026-09-26')).toBe('sin_actividad')
  })
  it('última actividad y encuentros realizados (días distintos)', () => {
    const c = club({ encuentros: [enc('2026-04-01'), enc('2026-04-01'), enc('2026-05-06')] })
    expect(ultimaActividad(c)).toBe('2026-05-06')
    expect(clubEncuentrosRealizados(c)).toBe(2)
  })
})

describe('nivelDeEscuela', () => {
  it.each([
    ['ESCUELA DE EDUCACIÓN PRIMARIA N° 22', 'primaria'],
    ['ESCUELA DE EDUCACIÓN SECUNDARIA N° 31', 'secundaria'],
    ['ESCUELA DE EDUCACIÓN SECUNDARIA TÉCNICA N° 3', 'tecnica'],
    ['CENTRO EDUCATIVO PARA LA PRODUCCIÓN TOTAL N° 18', 'tecnica'],
    ['CENTRO EDUCATIVO DE NIVEL SECUNDARIO N° 451', 'cens'],
    ['JARDÍN DE INFANTES N° 905', 'inicial'],
    ['ESCUELA ESPECIAL N° 502', 'especial'],
    ['INSTITUTO SUPERIOR DE FORMACIÓN DOCENTE N° 9', 'superior'],
  ])('%s → %s', (nombre, nivel) => expect(nivelDeEscuela(nombre)).toBe(nivel))
})

describe('otros', () => {
  it('esTrayecto', () => {
    expect(esTrayecto('CLUB DE TECNOLOGÍA')).toBe(true)
    expect(esTrayecto('PRÁCTICAS PROFESIONALIZANTES')).toBe(true)
    expect(esTrayecto('VISITA TÉCNICA')).toBe(false)
  })
  it('nombre de archivo sin acentos ni símbolos', () => {
    expect(nombreArchivo('Planilla Andrés Guzmán 2026-09-01 a 2026-09-30')).toBe('Planilla_Andres_Guzman_2026-09-01_a_2026-09-30.xlsx')
  })
})

import { armarDdjj, cargosDe, chequearHorario, franjasDte, validarDdjj } from '@/lib/ddjj'

describe('DD.JJ. de horarios', () => {
  const cargos = [{ nombre: 'EP 5', dias: [1, 3], desde: '13:00', hasta: '17:00' }]
  const ddjj = armarDdjj({ 1: [{ desde: '08:00', hasta: '12:00' }], 2: [{ desde: '08:00', hasta: '10:00' }, { desde: '14:00', hasta: '16:00' }] }, cargos, { 4: 'nota vieja' })
  it('arma los días con franjas, cargos y notas', () => {
    expect(ddjj.map(d => d.dia)).toEqual([1, 2, 3, 4])
    expect(ddjj[1].dte).toBe('08:00 a 10:00 y 14:00 a 16:00')
    expect(franjasDte(ddjj[1])).toHaveLength(2)
    expect(ddjj[3]).toEqual({ dia: 4, dte: '', externo: 'nota vieja' })
  })
  it('reagrupa los cargos por día', () => {
    expect(cargosDe(ddjj)).toEqual(cargos)
  })
  it('valida horarios y superposiciones', () => {
    expect(validarDdjj({ 1: [{ desde: '12:00', hasta: '08:00' }] }, [])).toEqual(['El horario DTE del lunes termina antes de empezar.'])
    expect(validarDdjj({ 2: [{ desde: '08:00', hasta: '12:00' }, { desde: '11:00', hasta: '13:00' }] }, [])).toEqual(['Las dos franjas DTE del martes se superponen.'])
    expect(validarDdjj({}, [{ nombre: '', dias: [], desde: '', hasta: '' }])).toHaveLength(3)
    expect(validarDdjj({ 1: [{ desde: '08:00', hasta: '12:00' }] }, cargos)).toEqual([])
  })
  it('detecta acciones fuera de horario o superpuestas con otro cargo', () => {
    expect(chequearHorario(ddjj[0], '09:00', '11:00')).toMatchObject({ fuera: false, choques: [] })
    expect(chequearHorario(ddjj[0], '11:00', '14:00').fuera).toBe(true)
    expect(chequearHorario(ddjj[0], '11:00', '14:00').choques).toHaveLength(1)
    expect(chequearHorario(ddjj[1], '14:30', '').fuera).toBe(false)
  })
})

describe('clubes por iniciar', () => {
  it('distingue clubes sin fecha de inicio', () => {
    expect(iniciado(club())).toBe(true)
    expect(iniciado({ ...club(), fecha_inicio: null })).toBe(false)
  })
})

describe('orden de grados', () => {
  it('ordena de menor a mayor comparando números', () => {
    expect(['10° A', '5°', '4° B', '4° A', '6°'].sort(ordenGrupo)).toEqual(['4° A', '4° B', '5°', '6°', '10° A'])
    expect(['7° Informática - Grupo 2', '7° Informática - Grupo 1'].sort(ordenGrupo)).toEqual(['7° Informática - Grupo 1', '7° Informática - Grupo 2'])
  })
})
