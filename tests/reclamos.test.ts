import { describe, expect, it } from 'vitest'
import { DATOS_VACIOS, directivoDe, esJardin, llevaChecklist, pisoPnce, puedeSerAmbos, gmailUrl, gmailAppUrl, plataformaDe, RECLAMOS_PARA, RECLAMOS_PARA_CLARO, armarReclamo, asuntoDe, codigoFecha, enlacesDe, faltantes, tipoDe, type DatosReclamo, type EscuelaConectividad } from '@/lib/reclamos'

const esc = (p: Partial<EscuelaConectividad> = {}): EscuelaConectividad => ({ id: 'e', cue: 60897700, nombre: 'ESCUELA DE EDUCACIÓN SECUNDARIA N° 31', distrito: 'LA PLATA', ciudad: 'LA PLATA', direccion: 'BRASIL esq. EVA PERÓN', matricula: 784,
  plan_enlace: 'PBA', subplan_enlace: 'PBA GRUPO 2 A', plan_piso_tecnologico: 'PBA', tipo_piso_instalado: 'Red Local Pequeña - Instalada', tipo: 'PISO TECNOLÓGICO + ENLACE', proveedor_pnce: null, proveedor_pba: 'Orbith S.A', ani: null, recurso_primario: null, access_id: null, nivel: 'Nivel Secundario', contactos: [], ...p })
const datos = (p: Partial<DatosReclamo> = {}): DatosReclamo => ({ ...DATOS_VACIOS, enlace: 'PBA2', detalle: 'No hay internet desde el lunes', contactoNombre: 'María López', contactoCargo: 'Directora', contactoTelefono: '221 555 0000', contactoHorario: '8 a 16', ...p })
const fed = 'Julio'
// 10/08/2023 10:10 hora argentina = 13:10 UTC (la guía usa ese ejemplo).
const ahora = new Date('2023-08-10T13:10:00Z')
const tipo = (id: string) => tipoDe(id)!

describe('enlaces según el plan cargado', () => {
  it.each([
    ['PNCE', 'PNCE', ['PNCE']], ['PBA', 'PBA GRUPO 2 A', ['PBA2']], ['PBA', 'PBA GRUPO 1', ['PBA1']], ['PBA', 'PBA 2019', ['PBA2019']],
    ['PNCE - PBA', 'PNCE - PBA GRUPO 1', ['PNCE', 'PBA1']], ['PBA', 'PBA 2019 - PBA GRUPO 2 A', ['PBA2', 'PBA2019']], ['PBA', 'PBA Grupo 2 A', ['PBA2']],
    ['PBA', 'PBA GRUPO 1 - PBA GRUPO 2 A', ['PBA1', 'PBA2']], ['Sin enlace', 'Sin enlace', []], ['ESCUELA CERRADA', 'ESCUELA CERRADA', []], [null, null, []],
  ])('%s / %s', (plan, sub, esperado) => { expect(enlacesDe(plan, sub).sort()).toEqual([...esperado].sort()) })
})

describe('asunto', () => {
  it('sigue el formato de la guía: provincia-programa-fecha y hora, CUE de 8 dígitos y asunto', () => {
    expect(codigoFecha(ahora)).toBe('100820231010')
    expect(asuntoDe(60000000, tipo('sin_conectividad'), ahora)).toBe('06-01-100820231010 - CUE 60000000 - Sin Conectividad')
  })
  it('usa la hora argentina aunque sea otro día en UTC', () => {
    expect(codigoFecha(new Date('2026-10-02T01:30:00Z'))).toBe('011020262230')
  })
  it('los 15 tipos usan los asuntos de la guía', () => {
    expect(['Sin Conectividad', 'Problemas con UTM o Switch', 'Problemas con Piso Tecnológico', 'Mudanza', 'Unificación/Desunificación de predio', 'Cambio TAC a USAP', 'Extensión/ampliación Piso', 'Ampliación de Ancho de Banda', 'Daños/Robo al Predio', 'Error en dirección', 'Instalación incorrecta', 'Solicitud de Piso', 'Solicitud de Conectividad', 'Problemas con instaladores', 'Incumplimiento en cronograma'].every(a => ['sin_conectividad', 'utm_switch', 'piso', 'mudanza', 'unificacion', 'tac_usap', 'extension', 'ancho_banda', 'danos_robo', 'error_direccion', 'instalacion', 'solicitud_piso', 'solicitud_conectividad', 'instaladores', 'cronograma'].some(id => tipo(id).asunto === a))).toBe(true)
  })
})

describe('sin conectividad según enlace y piso', () => {
  it('PBA Grupo 2 o 2019 sin piso: contacto y foto del módem', () => {
    const r = armarReclamo(esc({ plan_piso_tecnologico: null, tipo_piso_instalado: null }), tipo('sin_conectividad'), datos(), ahora, fed)
    expect(r.adjuntos.map(a => a.texto)).toEqual(['Fotos del módem (o de la antena, si el problema es ahí)'])
    expect(r.para).toBe(RECLAMOS_PARA)
    expect(r.cuerpo).toContain('Contacto del establecimiento:\nNombre: María López\nCargo: Directora\nTeléfono: 221 555 0000\nHorario: 8 a 16')
  })
  it('PBA Grupo 2 o 2019 con piso de PBA: suma el checklist USAP', () => {
    expect(armarReclamo(esc(), tipo('sin_conectividad'), datos(), ahora, fed).adjuntos.map(a => a.texto)).toEqual(['Fotos del módem (o de la antena, si el problema es ahí)', 'Checklist USAP completo'])
  })
  it('PBA con piso de PNCE: alcanza con las fotos (no hace falta el checklist)', () => {
    expect(armarReclamo(esc({ plan_piso_tecnologico: 'PNCE' }), tipo('sin_conectividad'), datos(), ahora, fed).adjuntos.map(a => a.texto)).toEqual(['Fotos del módem (o de la antena, si el problema es ahí)'])
  })
  it('PBA Grupo 1 con Claro: mail a conectividaddte con fotos y contacto', () => {
    const r = armarReclamo(esc({ subplan_enlace: 'PBA GRUPO 1' }), tipo('sin_conectividad'), datos({ enlace: 'PBA1', proveedorG1: 'Claro' }), ahora, fed)
    expect(r.para).toBe(RECLAMOS_PARA_CLARO)
    expect(r.adjuntos.map(a => a.texto)).toEqual(['Fotos del módem (o de la antena, si el problema es ahí)'])
  })
  it('PBA Grupo 1 con Movistar: no es un mail, la escuela llama al 0800 con los ID', () => {
    const r = armarReclamo(esc({ subplan_enlace: 'PBA GRUPO 1', ani: '221-1111', recurso_primario: 'RP-9' }), tipo('sin_conectividad'), datos({ enlace: 'PBA1', proveedorG1: 'Movistar' }), ahora, fed)
    expect(r.para).toBeNull()
    expect(r.porTelefono).toEqual({ telefono: '0800-333-0800', datos: [{ label: 'ANI (línea telefónica)', valor: '221-1111' }, { label: 'Recurso primario (servicio de internet)', valor: 'RP-9' }] })
  })
  it('PNCE sin piso: checklist de Z3; con piso: checklist USAP', () => {
    const pnce = { plan_enlace: 'PNCE', subplan_enlace: 'PNCE', proveedor_pnce: 'Cablevisión S.A.' }
    expect(armarReclamo(esc({ ...pnce, plan_piso_tecnologico: null }), tipo('sin_conectividad'), datos({ enlace: 'PNCE' }), ahora, fed).adjuntos[0].texto).toMatch(/Z3/)
    const con = armarReclamo(esc({ ...pnce, plan_piso_tecnologico: 'PNCE' }), tipo('sin_conectividad'), datos({ enlace: 'PNCE' }), ahora, fed)
    expect(con.adjuntos.map(a => a.texto)).toEqual(['Checklist USAP completo'])
    expect(con.avisos.join(' ')).toContain('0800-444-1115')
    expect(con.cuerpo).toContain('Enlace: PNCE (Nación) (Cablevisión S.A.)')
  })
})

describe('mensaje al CED', () => {
  const r = armarReclamo(esc(), tipo('sin_conectividad'), datos({ detalle: 'La antena está a punto de caerse' }), ahora, 'Julio')
  it('va dirigido al CED, sin firma ni fórmulas formales', () => {
    expect(r.cuerpo.startsWith('Hola Julio, ¿cómo estás?\n\nTe paso un reclamo de conectividad:')).toBe(true)
    expect(r.cuerpo.endsWith('\nSaludos')).toBe(true)
    expect(r.cuerpo).not.toMatch(/Quedamos a disposición|Facilitador|Silvio/)
    expect(armarReclamo(esc(), tipo('piso'), datos(), ahora, null).cuerpo.startsWith('Hola, ¿cómo estás?')).toBe(true)
  })
  it('el enlace y el piso van en renglones separados', () => {
    expect(r.cuerpo).toContain('Enlace: PBA Grupo 2 A (Orbith S.A)\nPiso tecnológico: PBA (Red Local Pequeña)\n')
  })
  it('el saludo es general: no depende de la hora', () => {
    for (const h of ['2026-10-02T12:00:00Z', '2026-10-02T23:30:00Z', '2026-10-03T07:00:00Z']) expect(armarReclamo(esc(), tipo('piso'), datos(), new Date(h), 'Julio').cuerpo.startsWith('Hola Julio, ¿cómo estás?\n')).toBe(true)
  })
  it('Gmail se abre con la cuenta institucional', () => {
    expect(gmailUrl(r, 'sridolfi@abc.gob.ar')).toContain('authuser=sridolfi%40abc.gob.ar&view=cm')
    expect(gmailUrl(r)).not.toContain('authuser')
  })
  it('en el celular se abre la app de Gmail', () => {
    expect(plataformaDe('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios')
    expect(plataformaDe('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android')
    expect(plataformaDe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('otra')
    expect(gmailAppUrl(r, 'ios')).toMatch(/^googlegmail:\/\/\/co\?to=/)
    expect(gmailAppUrl(r, 'android')).toContain('package=com.google.android.gm')
    expect(gmailAppUrl(r, 'android', 'a@abc.gob.ar')).toContain('S.browser_fallback_url=https%3A%2F%2Fmail.google.com')
    expect(gmailAppUrl(r, 'otra', 'a@abc.gob.ar')).toBe(gmailUrl(r, 'a@abc.gob.ar'))
  })
})

describe('formato del cuerpo', () => {
  it('pasa los nombres de la base a formato de oración', () => {
    const r = armarReclamo(esc({ nombre: 'ESCUELA DE EDUCACIÓN SECUNDARIA N° 31 GRAL. JOSÉ DE SAN MARTÍN' }), tipo('piso'), datos(), ahora, fed)
    expect(r.cuerpo).toContain('Escuela de Educación Secundaria N° 31 Gral. José de San Martín (CUE 60897700)')
  })
})

describe('otros tipos de reclamo', () => {
  const base = esc()
  it('mudanza y solicitudes: formulario y plano', () => {
    expect(armarReclamo(base, tipo('mudanza'), datos(), ahora, fed).adjuntos.map(a => a.texto)).toEqual(['Formulario completo con la información solicitada', 'Plano del nuevo edificio'])
    expect(armarReclamo(base, tipo('solicitud_piso'), datos(), ahora, fed).adjuntos).toHaveLength(2)
  })
  it('ampliación de ancho de banda: medición y checklist; extensión: aulas y matrícula', () => {
    expect(armarReclamo(base, tipo('ancho_banda'), datos({ matricula: '784' }), ahora, fed).adjuntos.map(a => a.texto)).toEqual(['Captura de pantalla de la medición de velocidad', 'Checklist USAP completo'])
    expect(armarReclamo(base, tipo('extension'), datos({ aulas: '12', matricula: '784' }), ahora, fed).cuerpo).toContain('Cantidad de aulas: 12')
  })
  it('error en dirección y cronograma llevan sus datos en el cuerpo', () => {
    expect(armarReclamo(base, tipo('error_direccion'), datos({ direccion: 'Calle 1 N° 2', coordenadas: '-34.9,-57.9' }), ahora, fed).cuerpo).toContain('Dirección correcta: Calle 1 N° 2')
    expect(armarReclamo(base, tipo('cronograma'), datos({ fechaCronograma: '2026-10-05' }), ahora, fed).cuerpo).toContain('05/10/2026')
  })
  it('instalación incorrecta: plano si el rack y el módem están separados, imágenes en los otros casos', () => {
    expect(armarReclamo(base, tipo('instalacion'), datos({ subtipo: 'rack_modem' }), ahora, fed).adjuntos[0].texto).toMatch(/Plano/)
    expect(armarReclamo(base, tipo('instalacion'), datos({ subtipo: 'cue_incorrecto' }), ahora, fed).adjuntos[0].texto).toMatch(/Imágenes/)
  })
})

describe('qué falta completar', () => {
  it('pide el contacto del directivo en los reclamos PBA y en "sin conectividad"', () => {
    expect(faltantes(tipo('danos_robo'), esc(), datos({ contactoNombre: '', contactoCargo: '', contactoTelefono: '' })).contacto).toBeTruthy()
    expect(faltantes(tipo('utm_switch'), esc(), datos({ contactoNombre: '', contactoCargo: '', contactoTelefono: '' })).contacto).toBeUndefined()
    expect(faltantes(tipo('utm_switch'), esc({ plan_enlace: 'PNCE', subplan_enlace: 'PNCE' }), datos({ enlace: 'PNCE', contactoNombre: '', contactoCargo: '', contactoTelefono: '' })).contacto).toBeUndefined()
    // Sin checklist (PBA con piso de PNCE: sólo la foto del módem) el contacto es obligatorio; con checklist, el checklist ya lo pide.
    expect(faltantes(tipo('sin_conectividad'), esc({ plan_piso_tecnologico: 'PNCE' }), datos({ contactoNombre: '' })).contacto).toBeTruthy()
    expect(faltantes(tipo('sin_conectividad'), esc({ plan_enlace: 'PNCE', subplan_enlace: 'PNCE' }), datos({ enlace: 'PNCE', contactoNombre: '' })).contacto).toBeUndefined()
    expect(faltantes(tipo('mudanza'), esc(), datos({ contactoNombre: '', contactoCargo: '', contactoTelefono: '' })).contacto).toBeUndefined()
  })
  it('con Movistar no pide contacto; con dos enlaces pide elegir; el CUE tiene que tener 8 dígitos', () => {
    expect(faltantes(tipo('sin_conectividad'), esc({ subplan_enlace: 'PBA GRUPO 1' }), datos({ enlace: 'PBA1', proveedorG1: 'Movistar', contactoNombre: '' })).contacto).toBeUndefined()
    expect(faltantes(tipo('piso'), esc({ plan_enlace: 'PNCE - PBA', subplan_enlace: 'PNCE - PBA GRUPO 1' }), datos({ enlace: null })).enlace).toBeTruthy()
    expect(faltantes(tipo('piso'), esc({ cue: 6089770 }), datos()).escuela).toMatch(/8 dígitos/)
  })
  it('una escuela sin enlace no puede reclamar "sin conectividad"', () => {
    expect(faltantes(tipo('sin_conectividad'), esc({ plan_enlace: 'Sin enlace', subplan_enlace: 'Sin enlace' }), datos({ enlace: null })).enlace).toMatch(/Solicitud de Conectividad/)
  })
})

describe('jardines, checklist y contactos', () => {
  const pnce = { plan_enlace: 'PNCE', subplan_enlace: 'PNCE', plan_piso_tecnologico: 'PNCE', tipo_piso_instalado: 'Red Local Pequeña - Instalada' }
  const jardin = { nivel: 'Nivel Inicial', ...pnce }
  const textos = (r: ReturnType<typeof armarReclamo>) => r.adjuntos.map(a => a.texto)
  it('esJardin: sólo nivel inicial a secas; pisoPnce: sólo PNCE', () => {
    expect(esJardin({ nivel: 'Nivel Inicial' })).toBe(true)
    expect(esJardin({ nivel: 'Formación Integral / Nivel Inicial / Nivel Primario' })).toBe(false)
    expect(esJardin({ nivel: null })).toBe(false)
    expect(pisoPnce({ plan_piso_tecnologico: 'PNCE' })).toBe(true)
    expect(pisoPnce({ plan_piso_tecnologico: 'PBA' })).toBe(false)
    expect(pisoPnce({ plan_piso_tecnologico: 'PBA - PNCE' })).toBe(false)
  })
  it('un jardín con piso PNCE lleva el checklist de predio pequeño (Z3), aunque el piso sea grande', () => {
    for (const piso of ['Red Local Pequeña - Instalada', 'Red Local Grande - Instalada']) {
      const r = armarReclamo(esc({ ...jardin, tipo_piso_instalado: piso }), tipo('sin_conectividad'), datos({ enlace: 'PNCE' }), ahora, fed)
      expect(textos(r)).toEqual(['Checklist de Z3 (predio pequeño TAC o GAP) completo'])
      expect(r.avisos.join(' ')).not.toContain('sin piso')
    }
    expect(textos(armarReclamo(esc({ ...jardin }), tipo('piso'), datos({ enlace: 'PNCE' }), ahora, fed))).toEqual(['Checklist de Z3 (predio pequeño TAC o GAP) completo'])
  })
  it('un establecimiento que no es jardín sigue con el USAP; un jardín con piso PBA también', () => {
    expect(textos(armarReclamo(esc({ ...pnce, nivel: 'Nivel Primario' }), tipo('piso'), datos({ enlace: 'PNCE' }), ahora, fed))).toEqual(['Checklist USAP completo'])
    expect(textos(armarReclamo(esc({ nivel: 'Nivel Inicial' }), tipo('piso'), datos(), ahora, fed))).toEqual(['Checklist USAP completo'])
  })
  it('enlace PBA con piso PNCE: problema del piso, sólo el checklist; del enlace, sólo la foto; de los dos, foto y checklist', () => {
    const pba = esc({ plan_piso_tecnologico: 'PNCE' })
    const foto = 'Fotos del módem (o de la antena, si el problema es ahí)'
    expect(textos(armarReclamo(pba, tipo('piso'), datos(), ahora, fed))).toEqual(['Checklist USAP completo'])
    expect(textos(armarReclamo(pba, tipo('utm_switch'), datos(), ahora, fed))).toEqual(['Checklist USAP completo'])
    expect(textos(armarReclamo(pba, tipo('sin_conectividad'), datos(), ahora, fed))).toEqual([foto])
    expect(textos(armarReclamo(pba, tipo('piso'), datos({ ambos: true }), ahora, fed))).toEqual([foto, 'Checklist USAP completo'])
    expect(textos(armarReclamo(pba, tipo('sin_conectividad'), datos({ ambos: true }), ahora, fed))).toEqual([foto, 'Checklist USAP completo'])
    expect(textos(armarReclamo(pba, tipo('sin_conectividad'), datos({ enlace: 'PBA1', proveedorG1: 'Claro', ambos: true }), ahora, fed))).toEqual([foto, 'Checklist USAP completo'])
    // Un jardín con ese piso lleva el de predio pequeño.
    expect(textos(armarReclamo(esc({ plan_piso_tecnologico: 'PNCE', nivel: 'Nivel Inicial' }), tipo('piso'), datos({ ambos: true }), ahora, fed))).toEqual([foto, 'Checklist de Z3 (predio pequeño TAC o GAP) completo'])
  })
  it('"ambos" sólo cuenta con enlace PBA y piso PNCE', () => {
    expect(puedeSerAmbos('piso', { plan_piso_tecnologico: 'PNCE' }, 'PBA2')).toBe(true)
    expect(puedeSerAmbos('piso', { plan_piso_tecnologico: 'PBA' }, 'PBA2')).toBe(false)
    expect(puedeSerAmbos('piso', { plan_piso_tecnologico: 'PNCE' }, 'PNCE')).toBe(false)
    expect(puedeSerAmbos('mudanza', { plan_piso_tecnologico: 'PNCE' }, 'PBA2')).toBe(false)
    // Con piso de PBA, "ambos" no cambia nada.
    expect(textos(armarReclamo(esc(), tipo('piso'), datos({ ambos: true }), ahora, fed))).toEqual(['Checklist USAP completo'])
  })
  it('con checklist el mensaje no lleva el contacto; con foto del módem sin checklist, sí', () => {
    const conChecklist = armarReclamo(esc({ ...jardin }), tipo('sin_conectividad'), datos({ enlace: 'PNCE' }), ahora, fed)
    expect(llevaChecklist(tipo('sin_conectividad'), esc({ ...jardin }), datos({ enlace: 'PNCE' }))).toBe(true)
    expect(conChecklist.cuerpo).not.toContain('Contacto del establecimiento')
    expect(conChecklist.cuerpo).toContain('Establecimiento: ')
    const soloFoto = armarReclamo(esc({ plan_piso_tecnologico: 'PNCE' }), tipo('sin_conectividad'), datos(), ahora, fed)
    expect(soloFoto.cuerpo).toContain('Contacto del establecimiento:\nNombre: María López')
  })
  it('los pedidos con formulario conservan el contacto opcional', () => {
    expect(armarReclamo(esc(), tipo('mudanza'), datos(), ahora, fed).cuerpo).toContain('Contacto del establecimiento')
  })
  it('directivoDe: el principal con cargo directivo, si no el director, si no el principal', () => {
    const c = (nombre: string, cargo: string | null, es_principal = false) => ({ nombre, apellido: 'X', cargo, telefono: '1', correo: null, correo_laboral: null, es_principal })
    expect(directivoDe([c('Ana', 'Secretaria'), c('Beto', 'Vicedirector'), c('Carla', 'Directora')])?.nombre).toBe('Carla')
    expect(directivoDe([c('Ana', 'Secretaria', true), c('Beto', 'Vicedirector')])?.nombre).toBe('Beto')
    expect(directivoDe([c('Ana', 'Secretaria', true), c('Beto', 'Preceptor')])?.nombre).toBe('Ana')
    expect(directivoDe([c('Ana', 'Secretaria'), c('Beto', 'Preceptor')])).toBeNull()
    expect(directivoDe([])).toBeNull()
  })
})
