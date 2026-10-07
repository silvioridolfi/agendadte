import { describe, expect, it } from 'vitest'
import { cambiosDeEscuela, historialDeContacto, limpiarAlias, nivelEdicion, validarContacto } from '@/lib/escuelas-edicion'

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
