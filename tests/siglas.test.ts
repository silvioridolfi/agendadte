import { describe, expect, it } from 'vitest'
import { titleCase } from '@/lib/format'
import { nombreCorto, siglaNombre } from '@/lib/siglas'

const sigla = (n: string) => siglaNombre(titleCase(n))

describe('siglas de establecimientos', () => {
  it.each([
    ['ESCUELA DE EDUCACIÓN PRIMARIA N° 102 DR. DARDO ROCHA', 'EP N° 102'],
    ['ESCUELA PRIMARIA N° 21', 'EP N° 21'],
    ['ESCUELA DE EDUCACIÓN SECUNDARIA N° 10', 'EES N° 10'],
    ['ESCUELA SECUNDARIA N° 13', 'ES N° 13'],
    ['ESCUELA DE EDUCACIÓN SECUNDARIA TÉCNICA N° 1 ALMIRANTE GUILLERMO BROWN', 'EEST N° 1'],
    ['ESCUELA DE EDUCACIÓN SECUNDARIA AGRARIA N° 1', 'EESA N° 1'],
    ['ESCUELA ESPECIAL N° 501 (A.R.S. Y R.M.) DR. RENÉ FAVALORO', 'EEE N° 501'],
    ['ESCUELA DE EDUCACIÓN ESTÉTICA N°1', 'EEE N°1'],
    ['ESCUELA DE ADULTOS N° 701', 'EEPA N° 701'],
    ['JARDÍN DE INFANTES N° 901 ALBERT SABIN', 'JI N° 901'],
    ['JARDÍN MATERNAL N° 1 MARIQUITA S. DE THOMPSON', 'JM N° 1'],
    ['INSTITUTO SUPERIOR DE FORMACIÓN DOCENTE N° 49', 'ISFD N° 49'],
    ['INSTITUTO SUPERIOR DE FORMACIÓN DOCENTE Y TÉCNICA N° 210', 'ISFDyT N° 210'],
    ['INSTITUTO SUPERIOR DE FORMACIÓN TÉCNICA N° 221', 'ISFT N° 221'],
    ['CENTRO EDUCATIVO PARA LA PRODUCCIÓN TOTAL N° 18', 'CEPT N° 18'],
    ['CENTRO EDUCATIVO DE NIVEL SECUNDARIO N° 451', 'CENS N° 451'],
    ['CENTRO EDUCATIVO NIVEL SECUNDARIO N° 456', 'CENS N° 456'],
    ['CENTRO DE FORMACIÓN PROFESIONAL N° 403', 'CFP N° 403'],
    ['CENTRO EDUCATIVO COMPLEMENTARIO N° 1', 'CEC N° 1'],
    ['C. E. C. N° 2 UN RINCÓN PARA LOS NIÑOS', 'CEC N° 2'],
    ['CENTRO DE EDUCACIÓN AGRÍCOLA N° 16', 'CEA N° 16'],
    ['DIRECCIÓN DE TECNOLOGÍA EDUCATIVA', 'DTE'],
  ])('%s → %s', (n, esperado) => expect(sigla(n)).toBe(esperado))

  it('los centros de investigación conservan su nombre entre comillas', () => {
    expect(sigla('CENTRO DE INVESTIGACIÓN EDUCATIVA "IRMA SOLEDAD PINTOS"')).toBe('CIE "Irma Soledad Pintos"')
    expect(sigla('CENTRO INVESTIGACIÓN EDUCATIVA')).toBe('CIE')
  })

  it('extensiones y anexos llevan la escuela de la que dependen', () => {
    expect(sigla('EXTENSIÓN N° 1 DE ESCUELA DE EDUCACIÓN SECUNDARIA N° 28')).toBe('Ext. N° 1 de EES N° 28')
    expect(sigla('ANEXO I DE ESCUELA DE EDUCACIÓN SECUNDARIA N° 77')).toBe('Anexo I de EES N° 77')
    expect(sigla('ANEXO I DE ESCUELA SECUNDARIA N° 9')).toBe('Anexo I de ES N° 9')
    expect(sigla('EXTENSIÓN DEL C.E.C. N° 1')).toBe('Ext. del CEC N° 1')
    expect(sigla('EXTENSIÓN A PP N° 130')).toBe('Ext. a Pp N° 130')
  })

  it('nombres puntuales sin número', () => {
    expect(sigla('LICEO VÍCTOR MERCANTE - UNLP')).toBe('Liceo')
    expect(sigla('COLEGIO NACIONAL RAFAEL HERNÁNDEZ')).toBe('Nacional')
    expect(sigla('BACHILLERATO DE BELLAS ARTES FRANCISCO A.DE SANTO')).toBe('Bellas Artes')
    expect(sigla('ESCUELA DE ARTE DE BERISSO')).toBe('Escuela de Arte')
  })

  it('el resto de los nombres sin número queda como está', () => {
    expect(sigla('ESCUELA MUNICIPAL LAS ALGARROBAS')).toBe('Escuela Municipal las Algarrobas')
    expect(sigla('ESCUELA DE DANZAS TRADICIONALES ARGENTINAS JOSÉ HERNÁNDEZ')).toBe('Escuela de Danzas Tradicionales Argentinas José Hernández')
  })

  it('nombreCorto no recorta lo que sigue al número', () => {
    expect(nombreCorto(titleCase('ESCUELA PRIMARIA N° 116 DR. ALBERT BRUCE SABIN'))).toBe('EP N° 116 Dr. Albert Bruce Sabin')
  })
})
