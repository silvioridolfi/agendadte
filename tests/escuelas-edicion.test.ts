import { describe, expect, it } from 'vitest'
import { cambiosDeEscuela, fechaAIso, fechaDeIso, fechaValida, historialDeContacto, limpiarAlias, nivelEdicion, seccionDe, validarContacto } from '@/lib/escuelas-edicion'

const fed = { esAdmin: false, rol: 'fed', nombre: 'Macarena Duarte Buschiazzo' }
const actual = { direccion: 'Calle 1', alias: null, nivel: 'Primario', matricula: 100, varones: 40, mujeres: 60, secciones: 5, nombre: 'EP N° 1', distrito: 'LA PLATA', observaciones: null }

describe('nivelEdicion', () => {
  it('el FED a cargo edita lo básico; otro FED no edita', () => {
    expect(nivelEdicion(fed, 'Macarena Duarte Buschiazzo')).toBe('basico')
    expect(nivelEdicion(fed, 'Jorge Pérez')).toBeNull()
  })
  it('las escuelas sin FED sólo las editan el CED y la administración', () => {
    expect(nivelEdicion(fed, null)).toBeNull()
    expect(nivelEdicion({ esAdmin: false, rol: 'coordinacion', nombre: 'Julio' }, null)).toBe('todo')
    expect(nivelEdicion({ esAdmin: true, rol: 'fed', nombre: 'Silvio' }, 'Jorge Pérez')).toBe('todo')
  })
})

describe('cambiosDeEscuela', () => {
  it('devuelve sólo lo que cambió, con el valor anterior', () => {
    const c = cambiosDeEscuela(actual, { direccion: ' Calle   2 ', secciones: '5', alias: 'La Legión' }, 'basico')
    expect(c.map(x => [x.clave, x.anterior, x.nuevo])).toEqual([['direccion', 'Calle 1', 'Calle 2'], ['alias', null, 'La Legión']])
  })
  it('un FED no toca los datos avanzados', () => {
    expect(() => cambiosDeEscuela(actual, { nombre: 'Otro' }, 'basico')).toThrow(/CED o la administración/)
    expect(cambiosDeEscuela(actual, { nombre: 'Otro' }, 'todo')).toHaveLength(1)
  })
  it('rechaza datos que no existen o inválidos', () => {
    expect(() => cambiosDeEscuela(actual, { cue: 5 }, 'todo')).toThrow(/no se puede editar/)
    expect(() => cambiosDeEscuela(actual, { matricula: -1 }, 'basico')).toThrow(/entero/)
    expect(() => cambiosDeEscuela(actual, { matricula: '12,5' }, 'basico')).toThrow(/entero/)
    expect(() => cambiosDeEscuela(actual, { direccion: 'x'.repeat(201) }, 'basico')).toThrow(/200/)
    expect(() => cambiosDeEscuela(actual, { nombre: '  ' }, 'todo')).toThrow(/vacío/)
  })
  it('varones más mujeres no superan la matrícula', () => {
    expect(() => cambiosDeEscuela(actual, { matricula: 90 }, 'basico')).toThrow(/matrícula/)
    expect(cambiosDeEscuela(actual, { matricula: 90, varones: 40, mujeres: 50 }, 'basico')).toHaveLength(2)
  })
  it('vacío borra el dato', () => {
    expect(cambiosDeEscuela(actual, { matricula: '' }, 'basico')[0]).toMatchObject({ clave: 'matricula', anterior: '100', nuevo: null })
  })
  it('las listas aceptan sólo las opciones existentes', () => {
    expect(() => cambiosDeEscuela(actual, { distrito: 'ATLANTIS' }, 'todo', { distrito: ['LA PLATA', 'BERISSO'] })).toThrow(/lista/)
    expect(cambiosDeEscuela(actual, { distrito: 'BERISSO' }, 'todo', { distrito: ['LA PLATA', 'BERISSO'] })).toHaveLength(1)
  })
})

describe('limpiarAlias', () => {
  it('no duplica la variante sin tilde', () => {
    expect(limpiarAlias('LA LEGIÓN, LA LEGION')).toBe('LA LEGIÓN')
    expect(limpiarAlias(' a ,, b , A')).toBe('a, b')
  })
})

describe('validarContacto', () => {
  it('limpia y acepta un contacto válido', () => {
    expect(validarContacto({ nombre: '  Ana  ', cargo: 'Directora', telefono: '221 555-1234', correo: 'ANA@Mail.com', correo_laboral: 'ana@abc.gob.ar' })).toEqual({ nombre: 'Ana', apellido: null, cargo: 'Directora', telefono: '221 555-1234', correo: 'ana@mail.com', correo_laboral: 'ana@abc.gob.ar' })
  })
  it('pide algún dato y valida teléfono y correos', () => {
    expect(() => validarContacto({ cargo: 'Director' })).toThrow(/al menos/)
    expect(() => validarContacto({ nombre: 'Ana', telefono: '12ab' })).toThrow(/teléfono/)
    expect(() => validarContacto({ nombre: 'Ana', correo: 'ana@' })).toThrow(/correo/)
    expect(() => validarContacto({ nombre: 'Ana', correo_laboral: 'ana@gmail.com' })).toThrow(/@abc\.gob\.ar/)
  })
})

describe('historialDeContacto', () => {
  it('anota una fila por dato cambiado, con el nombre de la persona', () => {
    const antes = { nombre: 'Ana', apellido: 'Paz', telefono: '1', correo: null }
    const f = historialDeContacto(antes, { nombre: 'Ana', apellido: 'Paz', cargo: null, telefono: '2', correo: 'a@b.com', correo_laboral: null })
    expect(f.map(x => [x.campo, x.valor_anterior, x.valor_nuevo])).toEqual([['Teléfono (Ana Paz)', '1', '2'], ['Correo (Ana Paz)', null, 'a@b.com']])
  })
})

describe('conectividad', () => {
  const con = { plan_enlace: 'PNCE', subplan_enlace: 'PNCE', mb: '10', fecha_inicio_conectividad: '1/01/2021', proveedor_asignado_pba: 'Orbith S.A', estado_instalacion_pba: 'FINALIZADO' }
  const listas = { plan_enlace: ['PNCE', 'PBA', 'Sin enlace'] }
  it('el FED a cargo no la toca', () => {
    expect(() => cambiosDeEscuela(con, { mb: '20' }, 'basico')).toThrow(/CED o la administración/)
  })
  it('el CED cambia el dato y queda en la sección Conectividad', () => {
    const c = cambiosDeEscuela(con, { mb: '20', estado_instalacion_pba: 'PENDIENTE PBA' }, 'todo')
    expect(c.map(x => [x.clave, x.anterior, x.nuevo])).toEqual([['mb', '10', '20'], ['estado_instalacion_pba', 'FINALIZADO', 'PENDIENTE PBA']])
    expect(seccionDe('mb')).toBe('Conectividad')
    expect(seccionDe('matricula')).toBe('Académico')
  })
  it('el plan es una lista cerrada', () => {
    expect(() => cambiosDeEscuela(con, { plan_enlace: 'XYZ' }, 'todo', listas)).toThrow(/lista/)
    expect(cambiosDeEscuela(con, { plan_enlace: 'PBA' }, 'todo', listas)).toHaveLength(1)
  })
  it('valida el ancho de banda, las fechas y los proveedores', () => {
    expect(() => cambiosDeEscuela(con, { mb: '10 Mb' }, 'todo')).toThrow(/número/)
    expect(() => cambiosDeEscuela(con, { mb: '123456' }, 'todo')).toThrow(/5 cifras/)
    expect(() => cambiosDeEscuela(con, { fecha_inicio_conectividad: '31/02/2024' }, 'todo')).toThrow(/fecha/)
    expect(() => cambiosDeEscuela(con, { proveedor_asignado_pba: '221-156053435' }, 'todo')).toThrow(/empresa/)
    expect(cambiosDeEscuela(con, { fecha_inicio_conectividad: '5/3/2024' }, 'todo')[0].nuevo).toBe('5/03/2024')
    expect(cambiosDeEscuela(con, { fecha_inicio_conectividad: '' }, 'todo')[0].nuevo).toBeNull()
  })
  it('convierte las fechas entre el formato de la base y el del selector', () => {
    expect(fechaValida('12/12/2019')).toBe('12/12/2019')
    expect(fechaValida('1/1/1999')).toBeNull()
    expect(fechaAIso('1/01/2021')).toBe('2021-01-01')
    expect(fechaAIso('basura')).toBe('')
    expect(fechaDeIso('2021-03-05')).toBe('5/03/2021')
  })
})

describe('ubicación en el mapa', () => {
  const base = { lat: -34.9, lon: -57.9 }
  it('el FED a cargo la corrige', () => {
    const c = cambiosDeEscuela(base, { lat: '-34,92145', lon: '-57.95' }, 'basico')
    expect(c.map(x => [x.clave, x.nuevo])).toEqual([['lat', '-34.92145'], ['lon', '-57.95']])
  })
  it('rechaza lo que cae fuera de la región o está a medias', () => {
    expect(() => cambiosDeEscuela(base, { lat: '34.9' }, 'basico')).toThrow(/fuera de la región/)
    expect(() => cambiosDeEscuela(base, { lat: 'abc' }, 'basico')).toThrow(/número/)
    expect(() => cambiosDeEscuela(base, { lat: '' }, 'basico')).toThrow(/juntas/)
    expect(cambiosDeEscuela(base, { lat: '', lon: '' }, 'basico').map(x => x.nuevo)).toEqual([null, null])
  })
})
