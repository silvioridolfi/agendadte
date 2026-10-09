import { describe, expect, it } from 'vitest'
import { filasExtracto, fechasDe, htmlExtracto, periodoExtracto, tituloExtracto } from '@/lib/extracto'
import type { Cronograma } from '@/lib/cronogramas'

const c = (o: Partial<Cronograma>): Cronograma => ({ id: '1', cue: 61000001, fecha_inicio: '2026-10-12', fecha_fin: '2026-10-16', tipo: 'LAC_M', proveedor: 'Dinatech ST', nro: null, semana: '407 - Cronograma Educar 1/10/26', estado_planilla: null,
  instaladores: 'Juan Pérez DNI 30111222\nANA GÓMEZ CUIL 27-30111222-4', descripcion: null, observaciones: null, nombre_planilla: null, primera_vez_at: '', actualizado_at: '', historial: [],
  school: { id: 's', nombre: 'ESCUELA DE EDUCACIÓN SECUNDARIA N° 31', distrito: 'LA PLATA', ciudad: 'LOS HORNOS', fed_a_cargo: null, direccion: '140 E/ 62 Y 63' }, ...o })

describe('filas del extracto', () => {
  it('ordena por fecha y deja afuera lo ya realizado', () => {
    const hecho = c({ id: 'h', cue: 3, historial: [{ estado: 'realizado', nota: null, fed_id: 'f', created_at: '2026-10-10T10:00:00Z' }] })
    const filas = filasExtracto([c({ id: 'b', cue: 2, fecha_inicio: '2026-10-20', fecha_fin: '2026-10-20' }), hecho, c({ id: 'a', cue: 5 }), c({ id: 'x', cue: 4 })])
    expect(filas.map(f => f.cue)).toEqual([4, 5, 2])
  })
  it('lleva el personal con su DNI o CUIL, la tarea en lenguaje claro y el programa', () => {
    const [f] = filasExtracto([c({})])
    expect(f.personal).toEqual(['Juan Pérez (DNI 30111222)', 'Ana Gómez (CUIL 27-30111222-4)'])
    expect(f.tarea).toBe('Mantenimiento de piso')
    expect(f.programa).toBe('EDUCAR'); expect(f.empresa).toBe('Dinatech ST')
    expect(f.establecimiento).toMatch(/N° 31/); expect(f.localidad).toBe('Los Hornos'); expect(f.distrito).toBe('La Plata')
  })
  it('separa los enlaces del personal y marca las reprogramaciones', () => {
    const [f] = filasExtracto([c({ instaladores: 'https://drive.google.com/abc', semana: '407 - PBA REPROGRAMACION' })])
    expect(f.personal).toEqual([]); expect(f.enlaces).toEqual(['https://drive.google.com/abc'])
    expect(f.programa).toBe('PBA'); expect(f.observaciones).toBe('Reprogramación')
  })
  it('sin escuela cargada usa el nombre de la planilla o el CUE', () => {
    expect(filasExtracto([c({ school: null, nombre_planilla: 'ESCUELA NUEVA 5' })])[0].establecimiento).toBe('Escuela Nueva 5')
    expect(filasExtracto([c({ school: null })])[0].establecimiento).toBe('CUE 61000001')
  })
})

describe('período y título', () => {
  const filas = filasExtracto([c({ fecha_inicio: '2026-10-12', fecha_fin: '2026-10-16' }), c({ cue: 2, fecha_inicio: '2026-10-26', fecha_fin: '2026-10-30' })])
  it('usa el período elegido o el que abarcan las filas', () => {
    expect(periodoExtracto(filas, '', '')).toBe('12/10/2026 al 30/10/2026')
    expect(periodoExtracto(filas, '2026-10-01', '2026-10-31')).toBe('01/10/2026 al 31/10/2026')
    expect(periodoExtracto([], '', '')).toBe('')
    expect(fechasDe({ desde: '2026-10-12', hasta: '2026-10-12' })).toBe('12/10/2026')
  })
  it('el título nombra el distrito si se filtró uno', () => {
    expect(tituloExtracto('')).toBe('Cronogramas de conectividad')
    expect(tituloExtracto('LA PLATA')).toBe('Cronogramas de conectividad · La Plata')
  })
})

describe('documento del PDF', () => {
  it('lleva los datos, escapa el texto y no menciona nada de más', () => {
    const filas = filasExtracto([c({ school: { id: 's', nombre: 'ESCUELA <B> & CO', distrito: 'LA PLATA', ciudad: null, fed_a_cargo: null } })])
    const html = htmlExtracto({ titulo: 'Título', periodo: '12/10/2026 al 16/10/2026', filas, emitido: '09/10/2026', origen: 'https://x.test' })
    expect(html).toContain('Juan Pérez (DNI 30111222)'); expect(html).toContain('Dinatech ST'); expect(html).toContain('CUE 61000001')
    expect(html).toContain('&lt;b&gt; &amp; Co'); expect(html).not.toContain('<b> &')
    expect(html).toContain('A4 landscape')
    expect(html).toContain('src="https://x.test/brand/oficial-blanco.png"'); expect(html).toContain('alt="Dirección de Tecnología Educativa')
    expect(html).not.toMatch(/geolocaliz|ubicaci[oó]n de las fotos/i)
  })
  it('sin personal ni enlace dice "A confirmar"', () => {
    expect(htmlExtracto({ titulo: 't', periodo: 'p', filas: filasExtracto([c({ instaladores: null })]), emitido: 'e', origen: 'https://x.test' })).toContain('A confirmar')
  })
})
