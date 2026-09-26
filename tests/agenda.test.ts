import { describe, expect, it } from 'vitest'
import { clubEncuentrosRealizados, clubEstado, diasHabilesEntre, esTrayecto, nivelDeEscuela, serieFechas, ultimaActividad, type Club } from '@/lib/agenda'
import { nombreArchivo } from '@/lib/exportar'

const club = (over: Partial<Club> = {}): Club => ({
  id: 'c', fed_id: 'f', school_id: null, lugar: null, grupo: '5° A', tipo: 'CLUB DE TECNOLOGÍA', escuela_origen: null, propuesta: 'Club de Tecnología',
  fecha_inicio: '2026-03-02', fecha_cierre: null, encuentros_previstos: 8, school: null, encuentros: [], ...over,
})
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
