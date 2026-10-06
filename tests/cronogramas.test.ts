import { describe, expect, it } from 'vitest'
import { esReprogramacion, esVespertino, limiteContactosPba, programaDe, validoHasta, avisoDe, avisoJefaturaFed, mensajeEscuela, personaDe, puedeAvisarJefatura, FILTROS_VACIOS, avisoNuevosCed, avisoNuevosFed, avisoRecordatorioCed, avisoRecordatorioFed, cuandoEmpieza, esHabil, estadoDe, proximoHabil, puedeMarcar, repartirPorFed, cuesDe, esDelFed, etiquetaTipo, fechaDe, filtrarCronogramas, haceDias, leerCronogramas, parsearCsv, resumenCronogramas, ventanaDe, type Cronograma } from '@/lib/cronogramas'

const ENC = 'ESTADO,PREDIO,Region,Fecha de Inicio,Fecha de Fin,Instalador Responsable,Proveedor,Cues involucrados,Nombre de las escuelas,Semana en que fue informado,Tipo,Distrito,Nro cronograma o incidencia,Descripcion de incidencia,Observaciones de territorio,Tipo de establecimiento'

describe('parsearCsv', () => {
  it('respeta comillas, comas y saltos de línea dentro de la celda', () => {
    expect(parsearCsv('a,"b, c","d\ne ""f"""\r\n1,2,3\n')).toEqual([['a', 'b, c', 'd\ne "f"'], ['1', '2', '3']])
  })
  it('ignora renglones vacíos', () => { expect(parsearCsv('a,b\n,\n\nc,d')).toEqual([['a', 'b'], ['c', 'd']]) })
})

describe('fechas y CUE', () => {
  it('fechaDe acepta d/m/aaaa con o sin ceros y rechaza lo inválido', () => {
    expect(fechaDe('6/10/2026')).toBe('2026-10-06')
    expect(fechaDe('06/10/2026')).toBe('2026-10-06')
    expect(fechaDe('31/02/2026')).toBeNull()
    expect(fechaDe('')).toBeNull()
    expect(fechaDe('hoy')).toBeNull()
  })
  it('cuesDe toma los de 8 dígitos, sin repetir', () => {
    expect(cuesDe('61457700 - 61520100')).toEqual([61457700, 61520100])
    expect(cuesDe('61457700, 61457700')).toEqual([61457700])
    expect(cuesDe('1234')).toEqual([])
  })
  it('haceDias resta días', () => { expect(haceDias('2026-10-06', 45)).toBe('2026-08-22') })
})

describe('leerCronogramas', () => {
  const fila = (o: Record<number, string>) => Array.from({ length: 16 }, (_, i) => o[i] ?? '').map(x => (/[,\n"]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(',')
  it('una fila por CUE, con instaladores uno por renglón', () => {
    const r = leerCronogramas([ENC, fila({ 3: '6/10/2026', 4: '20/10/2026', 5: 'Juan Pérez\nDNI 1', 6: 'PBA', 7: '61457700 - 61520100', 10: 'LAC_M', 12: '456914 - NI-1' })].join('\n'))
    expect(r.filas).toHaveLength(2)
    expect(r.filas[0]).toMatchObject({ cue: 61457700, fecha_inicio: '2026-10-06', fecha_fin: '2026-10-20', tipo: 'LAC_M', proveedor: 'PBA', instaladores: 'Juan Pérez\nDNI 1' })
  })
  it('descarta las filas sin fecha o sin CUE y cuenta los duplicados', () => {
    const f = fila({ 3: '6/10/2026', 4: '6/10/2026', 7: '61457700', 10: 'LAC', 12: '1' })
    const r = leerCronogramas([ENC, f, f, fila({ 7: '61457700' }), fila({ 3: '6/10/2026' })].join('\n'))
    expect(r.filas).toHaveLength(1); expect(r.duplicadas).toBe(1); expect(r.descartadas).toBe(2)
  })
  it('encuentra el encabezado aunque no esté en el primer renglón', () => {
    const f = fila({ 3: '6/10/2026', 4: '6/10/2026', 7: '61457700', 10: 'LAC' })
    expect(leerCronogramas(['Cronogramas 2026', ENC, f].join('\n')).filas).toHaveLength(1)
  })
  it('el error dice qué se leyó', () => {
    expect(() => leerCronogramas('Total,Otra\n1,2')).toThrow(/Primer renglón leído: Total \| Otra/)
  })
  it('falla con un mensaje claro si cambiaron los encabezados', () => {
    expect(() => leerCronogramas('A,B\n1,2')).toThrow(/La planilla cambió/)
  })
})

describe('filtros de la sección', () => {
  const c = (o: Partial<Cronograma>): Cronograma => ({ id: '1', cue: 1, fecha_inicio: '2026-10-06', fecha_fin: '2026-10-10', tipo: 'LAC_M', proveedor: 'PBA', nro: null, semana: null, estado_planilla: null, instaladores: null, descripcion: null, observaciones: null, nombre_planilla: null, primera_vez_at: '', actualizado_at: '', historial: [], school: { id: 's', nombre: 'EES N° 1', distrito: 'LA PLATA', ciudad: null, fed_a_cargo: 'Macarena Duarte Buschiazzo' }, ...o })
  it('esDelFed compara el nombre del perfil con el de la base', () => {
    expect(esDelFed('Macarena Duarte Buschiazzo', 'Macarena Duarte')).toBe(true)
    expect(esDelFed('Marcos Pettiná', 'Macarena Duarte')).toBe(false)
    expect(esDelFed(null, 'Macarena Duarte')).toBe(false)
  })
  const lista = [c({ id: 'a' }), c({ id: 'b', fecha_fin: '2026-09-01', fecha_inicio: '2026-09-01' }), c({ id: 'c', school: { id: 's', nombre: 'EP 2', distrito: 'BERISSO', ciudad: null, fed_a_cargo: 'Sin FED asignado' }, tipo: 'LAC' })]
  it('separa próximos y pasados', () => {
    expect(filtrarCronogramas(lista, FILTROS_VACIOS, '2026-10-06').map(x => x.id)).toEqual(['a', 'c'])
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, pestana: 'pasados' }, '2026-10-06').map(x => x.id)).toEqual(['b'])
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, pestana: 'todos' }, '2026-10-06')).toHaveLength(3)
  })
  it('filtra por distrito, FED, tipo y búsqueda', () => {
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, distrito: 'berisso' }, '2026-10-06').map(x => x.id)).toEqual(['c'])
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, fed: 'Sin FED asignado' }, '2026-10-06').map(x => x.id)).toEqual(['c'])
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, fed: 'Macarena Duarte' }, '2026-10-06').map(x => x.id)).toEqual(['a'])
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, tipo: 'LAC' }, '2026-10-06').map(x => x.id)).toEqual(['c'])
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, busqueda: 'instalación de piso' }, '2026-10-06').map(x => x.id)).toEqual(['c'])
  })
  it('resume y formatea', () => {
    expect(resumenCronogramas(lista, '2026-10-06')).toMatchObject({ proximos: 2, pasados: 1, sinFed: 1 })
    expect(ventanaDe({ fecha_inicio: '2026-10-06', fecha_fin: '2026-10-20' })).toBe('06/10 al 20/10')
    expect(ventanaDe({ fecha_inicio: '2026-10-06', fecha_fin: '2026-10-06' })).toBe('06/10')
    expect(etiquetaTipo('LAC_R')).toBe('Reparación de piso')
    expect(etiquetaTipo(null)).toBe('Sin tipo')
  })
})

describe('estado anotado y permisos', () => {
  const base = { school: { id: 's', nombre: 'EES N° 1', distrito: 'LA PLATA', ciudad: null, fed_a_cargo: 'Macarena Duarte Buschiazzo' } }
  it('el estado vigente es el último anotado', () => {
    expect(estadoDe({ historial: [] })).toBeNull()
    expect(estadoDe({ historial: [{ estado: 'no_realizado', nota: 'x', fed_id: null, created_at: '2' }, { estado: 'realizado', nota: null, fed_id: null, created_at: '1' }] })).toBe('no_realizado')
  })
  it('anota el FED a cargo, el CED y la administración', () => {
    expect(puedeMarcar({ esAdmin: false, rol: 'fed', nombre: 'Macarena Duarte' }, base)).toBe(true)
    expect(puedeMarcar({ esAdmin: false, rol: 'fed', nombre: 'Marcos Pettiná' }, base)).toBe(false)
    expect(puedeMarcar({ esAdmin: false, rol: 'coordinacion', nombre: 'Julio Machado' }, base)).toBe(true)
    expect(puedeMarcar({ esAdmin: true, rol: 'fed', nombre: 'Silvio Ridolfi' }, base)).toBe(true)
    expect(puedeMarcar({ esAdmin: false, rol: 'fed', nombre: 'Macarena Duarte' }, { school: { ...base.school, fed_a_cargo: 'Sin FED asignado' } })).toBe(false)
  })
})

describe('avisos', () => {
  const feds = [{ id: 'f1', nombre_completo: 'Macarena Duarte' }, { id: 'f2', nombre_completo: 'Marcos Pettiná' }]
  const c = (cue: number, fed: string | null) => ({ cue, fecha_inicio: '2026-10-12', fecha_fin: '2026-10-16', tipo: 'LAC_M', school: { nombre: 'ESCUELA DE EDUCACIÓN SECUNDARIA N° 31', fed_a_cargo: fed } })
  it('reparte por FED y deja aparte los que no tienen', () => {
    const { porFed, sinFed } = repartirPorFed([c(1, 'Macarena Duarte Buschiazzo'), c(2, 'Macarena Duarte Buschiazzo'), c(3, 'Marcos Pettiná'), c(4, 'Sin FED asignado'), c(5, null)], feds)
    expect(porFed.get('f1')).toHaveLength(2); expect(porFed.get('f2')).toHaveLength(1); expect(sinFed).toHaveLength(2)
  })
  it('arma los textos', () => {
    expect(avisoNuevosFed([c(1, 'x')])).toBe('1 cronograma nuevo en tus escuelas: EES N° 31 (Mantenimiento de piso, 12/10 al 16/10)')
    expect(avisoNuevosFed([c(1, 'x'), c(2, 'x'), c(3, 'x'), c(4, 'x'), c(5, 'x')])).toContain('· y 2 más')
    expect(avisoNuevosCed(8, 2)).toBe('Cronogramas nuevos en la planilla: 8 (2 sin FED asignado)')
    expect(avisoNuevosCed(3, 0)).toBe('Cronogramas nuevos en la planilla: 3')
    expect(avisoRecordatorioFed([c(1, 'x')], 'mañana')).toMatch(/^Recordatorio: empieza mañana 1 cronograma en tus escuelas/)
    expect(avisoRecordatorioCed(4, 1, 'el lunes 12/10')).toBe('Recordatorio: el lunes 12/10 empiezan 4 cronogramas (1 sin FED asignado)')
  })
  it('el recordatorio va el día hábil anterior', () => {
    expect(proximoHabil('2026-10-08')).toBe('2026-10-09')
    expect(proximoHabil('2026-10-09')).toBe('2026-10-12')
    expect(proximoHabil('2026-10-09', new Set(['2026-10-12']))).toBe('2026-10-13')
    expect(esHabil('2026-10-10')).toBe(false); expect(esHabil('2026-10-12', new Set(['2026-10-12']))).toBe(false); expect(esHabil('2026-10-07')).toBe(true)
    expect(cuandoEmpieza('2026-10-08', '2026-10-09')).toBe('mañana')
    expect(cuandoEmpieza('2026-10-09', '2026-10-12')).toBe('el lunes 12/10')
  })
})

describe('avisos a la jefatura y a la escuela', () => {
  const h = (estado: 'realizado' | 'jefatura_avisada' | 'escuela_avisada' | 'no_realizado', created_at: string) => ({ estado, nota: null, fed_id: null, created_at })
  it('los avisos no cuentan como cómo salió', () => {
    expect(estadoDe({ historial: [h('escuela_avisada', '3'), h('jefatura_avisada', '2')] })).toBeNull()
    expect(estadoDe({ historial: [h('escuela_avisada', '4'), h('realizado', '3'), h('jefatura_avisada', '2')] })).toBe('realizado')
    expect(avisoDe({ historial: [h('escuela_avisada', '4'), h('realizado', '3')] }, 'escuela_avisada')?.created_at).toBe('4')
    expect(avisoDe({ historial: [h('realizado', '3')] }, 'jefatura_avisada')).toBeNull()
  })
  it('la jefatura la avisa el CED o la administración', () => {
    expect(puedeAvisarJefatura({ esAdmin: false, rol: 'coordinacion' })).toBe(true)
    expect(puedeAvisarJefatura({ esAdmin: true, rol: 'fed' })).toBe(true)
    expect(puedeAvisarJefatura({ esAdmin: false, rol: 'fed' })).toBe(false)
  })
  const c = { cue: 61000001, fecha_inicio: '2026-10-12', fecha_fin: '2026-10-16', tipo: 'LAC_M', proveedor: 'PBA', instaladores: 'Juan Pérez DNI 30111222\nANA GÓMEZ CUIL 27-30111222-4', school: { nombre: 'ESCUELA DE EDUCACIÓN SECUNDARIA N° 31' } }
  it('arma el mensaje informativo para el directivo', () => {
    const m = mensajeEscuela(c, 'Silvio Ridolfi', new Date('2026-10-06T13:00:00Z'))
    expect(m.asunto).toBe('Trabajos en EES N° 31: 12/10 al 16/10')
    expect(m.cuerpo).toContain('Hola, buen día.')
    expect(m.cuerpo).toContain('Soy Silvio Ridolfi, de la Dirección de Tecnología Educativa (Región 1). Les informo que en la escuela está previsto el siguiente trabajo, según el cronograma establecido:')
    expect(m.cuerpo).toContain('Escuela: EES N° 31 (CUE 61000001)\nTrabajo: Mantenimiento de piso\nFecha: del 12/10 al 16/10\nEmpresa: PBA\nResponsables:\n- Juan Pérez (DNI 30111222)\n- Ana Gómez (CUIL 27-30111222-4)')
    expect(m.cuerpo).toContain('Quedo a disposición por cualquier consulta.\nSaludos cordiales.')
    expect(m.cuerpo).not.toMatch(/programó|facilit|avisen/)
  })
  it('un responsable, un solo día y sin empresa', () => {
    const m = mensajeEscuela({ ...c, fecha_fin: '2026-10-12', proveedor: null, instaladores: 'DT01 Cañete.Zenteno' }, 'Silvio Ridolfi', new Date('2026-10-06T23:00:00Z'))
    expect(m.cuerpo).toContain('Hola, buenas noches.')
    expect(m.cuerpo).toContain('Fecha: el 12/10')
    expect(m.cuerpo).not.toContain('Empresa')
    expect(m.cuerpo).toContain('Responsable: Cañete Zenteno')
  })
  it('un enlace en lugar de nombres', () => {
    const m = mensajeEscuela({ ...c, instaladores: 'https://drive.google.com/abc' }, 'X', new Date())
    expect(m.cuerpo).toContain('Datos del responsable: https://drive.google.com/abc')
    expect(m.cuerpo).not.toContain('Responsable:')
  })
  it('sin escuela cargada usa el CUE', () => {
    expect(mensajeEscuela({ ...c, school: null }, 'X', new Date()).cuerpo).toContain('Escuela: CUE 61000001\n')
  })
  it('ordena el nombre del responsable', () => {
    expect(personaDe('DT01 Cañete.Zenteno')).toBe('Cañete Zenteno')
    expect(personaDe('DT01 Cañete.Martin')).toBe('Cañete Martin')
    expect(personaDe('SADOSKI VICTOR HERNAN DNI 35610950')).toBe('Sadoski Victor Hernan (DNI 35610950)')
    expect(personaDe('Ivan Bento, DNI 30958127')).toBe('Ivan Bento (DNI 30958127)')
    expect(personaDe('PADOVANI LLANOS FACUNDO HUMBER DNI: 45038779')).toBe('Padovani Llanos Facundo Humber (DNI 45038779)')
    expect(personaDe('Maquieira Santiago Luis DNI 29.371.730')).toBe('Maquieira Santiago Luis (DNI 29371730)')
    expect(personaDe('Walter Villalba')).toBe('Walter Villalba')
    expect(personaDe('Leonardo Hector Rodriguez')).toBe('Leonardo Hector Rodriguez')
  })
  it('lo que no es un nombre se deja como viene', () => {
    expect(personaDe('DINA BA15')).toBe('DINA BA15')
    expect(personaDe('DINA BA3')).toBe('DINA BA3')
  })
  it('avisa al FED que falta la escuela', () => {
    expect(avisoJefaturaFed(c)).toContain('Se avisó a la jefatura: EES N° 31')
    expect(avisoJefaturaFed(c)).toContain('Falta avisar a la escuela')
  })
})

describe('referencia de la guía', () => {
  it('programa y reprogramación salen de la semana informada', () => {
    expect(programaDe('407 - Cronograma Educar 1/10/26')).toBe('Educar')
    expect(programaDe('409 - Cronograma PBA 5/10/26 REPROGRAMACION')).toBe('PBA')
    expect(programaDe('Cronograma Telecom')).toBeNull()
    expect(programaDe(null)).toBeNull()
    expect(esReprogramacion('394 - Cronograma PBA 4/9/26 REPROGRAMACION')).toBe(true)
    expect(esReprogramacion('407 - Cronograma Educar 1/10/26')).toBe(false)
  })
  it('vigencia de 10 días y límite de 48 hs para los contactos de PBA', () => {
    expect(validoHasta({ fecha_fin: '2026-10-08' })).toBe('2026-10-18')
    expect(validoHasta({ fecha_fin: '2026-10-25' })).toBe('2026-11-04')
    expect(limiteContactosPba({ fecha_inicio: '2026-10-12' })).toBe('2026-10-10')
  })
  it('detecta el turno vespertino', () => {
    expect(esVespertino('Mañana, Tarde y Vespertino')).toBe(true)
    expect(esVespertino('"Mañana","Tarde"')).toBe(false)
    expect(esVespertino(null)).toBe(false)
  })
})
