// Reclamos de conectividad: arma el asunto, el cuerpo y la lista de adjuntos según la "Guía para reclamos de conectividad" de la DTE.
// Todo es determinístico: sale de la infraestructura del establecimiento (enlace y piso, que ya están en la base) y del tipo de reclamo.
import type { ContactoEscuela } from '@/lib/mis-escuelas'
import { titleCase } from '@/lib/format'
import { ZONA } from '@/lib/hora'

export const RECLAMOS_PARA = 'region1dte@abc.gob.ar'
export const RECLAMOS_PARA_CLARO = 'conectividaddte@abc.gob.ar'
export const TEL_MOVISTAR = '0800-333-0800'
export const TEL_EDUCAR = '0800-444-1115'
export const DOC_CHECKLIST_USAP = 'https://docs.google.com/spreadsheets/d/1onaKMv_cbjCjjBBSJ6qIvrx6J-b_pvg52CUfRoWb-ZI/edit?gid=721317433#gid=721317433'
export const DOC_CHECKLIST_Z3 = 'https://docs.google.com/spreadsheets/d/1qz5mOphC7v8mrrNdJh5ynluudvfzOPROVrkDHb10nbA/edit?gid=1063477087#gid=1063477087'
export const DOC_FORMULARIO = 'https://docs.google.com/spreadsheets/d/1dcqoNFDnm9nv9gRmrC_Q_LsobeVlc0Tf-Rz2nCygLrw/edit?gid=382422117#gid=382422117'
export const DOC_BUSCADOR_CUE = 'https://docs.google.com/spreadsheets/d/1Y4k73frJATDXhrWDF1IIN7KGvTmKhgCbps7lRPjCkL8/edit?gid=0#gid=0'

export type Enlace = 'PNCE' | 'PBA1' | 'PBA2' | 'PBA2019'
export const ENLACE_LABEL: Record<Enlace, string> = { PNCE: 'PNCE (Nación)', PBA1: 'PBA Grupo 1', PBA2: 'PBA Grupo 2 A', PBA2019: 'PBA 2019' }
export const esPba = (e: Enlace | null) => !!e && e !== 'PNCE'

// Lo que la base sabe de la conectividad de un establecimiento (escuela, jardín, instituto, CENS…).
export type EscuelaConectividad = {
  id: string, cue: number | null, nombre: string | null, distrito: string | null, ciudad: string | null, direccion: string | null, matricula: number | null,
  plan_enlace: string | null, subplan_enlace: string | null, plan_piso_tecnologico: string | null, tipo_piso_instalado: string | null, tipo: string | null,
  proveedor_pnce: string | null, proveedor_pba: string | null, ani: string | null, recurso_primario: string | null, access_id: string | null,
  // Nivel (para distinguir los jardines) y contactos cargados en la base (para precargar el del directivo).
  nivel: string | null, contactos: ContactoEscuela[],
}

// Enlaces del establecimiento según el plan cargado ("PNCE", "PBA GRUPO 2 A", "PNCE - PBA GRUPO 1", "PBA 2019 - PBA GRUPO 2 A"…). Sin enlace: lista vacía.
export function enlacesDe(plan: string | null, subplan: string | null): Enlace[] {
  const t = `${subplan ?? ''} ${plan ?? ''}`.toUpperCase(), out: Enlace[] = []
  if (/PNCE/.test(t)) out.push('PNCE')
  if (/GRUPO\s*1\b/.test(t)) out.push('PBA1')
  if (/GRUPO\s*2/.test(t)) out.push('PBA2')
  if (/2019/.test(t)) out.push('PBA2019')
  return out
}
export const tienePiso = (e: Pick<EscuelaConectividad, 'plan_piso_tecnologico'>) => !!e.plan_piso_tecnologico?.trim()
// Jardín: nivel inicial a secas (los mixtos, como "Formación Integral / Nivel Inicial / Nivel Primario", no cuentan).
export const esJardin = (e: Pick<EscuelaConectividad, 'nivel'>) => /^\s*Nivel Inicial\s*$/i.test(e.nivel ?? '')
// Piso tecnológico de PNCE (Nación) únicamente.
export const pisoPnce = (e: Pick<EscuelaConectividad, 'plan_piso_tecnologico'>) => /PNCE/i.test(e.plan_piso_tecnologico ?? '') && !/PBA/i.test(e.plan_piso_tecnologico ?? '')
// Enlace PBA con piso PNCE: es el caso en que hay que decir si el problema es del enlace, del piso o de los dos.
export const puedeSerAmbos = (tipoId: string, e: Pick<EscuelaConectividad, 'plan_piso_tecnologico'>, enlace: Enlace | null) => ['sin_conectividad', 'piso', 'utm_switch'].includes(tipoId) && esPba(enlace) && pisoPnce(e)
// Contacto del directivo para precargar: el director o vicedirector (o equivalente) y, si no hay, el marcado como principal.
const CARGO_DIRECTIVO = /\b(vice)?(direct|rector)|regente/i
export function directivoDe(contactos: ContactoEscuela[]): ContactoEscuela | null {
  const util = contactos.filter(c => (c.nombre ?? '').trim() || (c.apellido ?? '').trim())
  const dir = util.filter(c => CARGO_DIRECTIVO.test(c.cargo ?? ''))
  return dir.find(c => c.es_principal) ?? dir.find(c => !/vice/i.test(c.cargo ?? '')) ?? dir[0] ?? util.find(c => c.es_principal) ?? null
}
export const nombreContacto = (c: Pick<ContactoEscuela, 'nombre' | 'apellido'>) => [c.nombre, c.apellido].map(x => (x ?? '').trim()).filter(Boolean).join(' ')
// Aviso cuando el establecimiento figura en un régimen especial (la guía no los cubre igual).
export function avisoEspecial(e: Pick<EscuelaConectividad, 'plan_enlace' | 'tipo'>): string | null {
  const t = `${e.plan_enlace ?? ''} ${e.tipo ?? ''}`.toUpperCase()
  if (/CONTEXTO DE ENCIERRO/.test(t)) return 'Figura como contexto de encierro: confirmá que corresponda reclamarlo por este circuito.'
  if (/ESCUELA CERRADA/.test(t)) return 'Figura como escuela cerrada: confirmá que corresponda reclamarlo.'
  if (/ITINERANTE/.test(t)) return 'Figura como itinerante: confirmá que corresponda reclamarlo por este circuito.'
  return null
}

export type Campo = 'detalle' | 'aulas' | 'matricula' | 'direccion' | 'coordenadas' | 'serie' | 'fechaCronograma' | 'subtipo'
export type TipoReclamo = {
  id: string, asunto: string, grupo: 'problemas' | 'pedidos', cuando: string, campos: Campo[], requeridos: Campo[]
  // Contacto del establecimiento: siempre, sólo si el enlace es PBA, o si se quiere.
  contacto: 'siempre' | 'pba' | 'opcional'
}
export const TIPOS: TipoReclamo[] = [
  { id: 'sin_conectividad', asunto: 'Sin Conectividad', grupo: 'problemas', cuando: 'No hay conectividad, intermitencia, módem quemado, cable cortado u otros problemas del enlace.', campos: ['detalle'], requeridos: ['detalle'], contacto: 'siempre' },
  { id: 'utm_switch', asunto: 'Problemas con UTM o Switch', grupo: 'problemas', cuando: 'Falla del UTM o de un switch.', campos: ['detalle'], requeridos: ['detalle'], contacto: 'pba' },
  { id: 'piso', asunto: 'Problemas con Piso Tecnológico', grupo: 'problemas', cuando: 'Cableado, access points, problemas eléctricos en el rack u otros problemas del piso que no sean UTM o switch.', campos: ['detalle'], requeridos: ['detalle'], contacto: 'pba' },
  { id: 'ancho_banda', asunto: 'Ampliación de Ancho de Banda', grupo: 'problemas', cuando: 'El establecimiento necesita más ancho de banda.', campos: ['matricula', 'detalle'], requeridos: ['matricula'], contacto: 'pba' },
  { id: 'danos_robo', asunto: 'Daños/Robo al Predio', grupo: 'problemas', cuando: 'Daño o robo del equipamiento del piso tecnológico.', campos: ['detalle', 'serie'], requeridos: ['detalle'], contacto: 'pba' },
  { id: 'instalacion', asunto: 'Instalación incorrecta', grupo: 'problemas', cuando: 'Rack y módem en lugares distintos, instalación en un CUE incorrecto o sin finalizar.', campos: ['subtipo', 'detalle'], requeridos: ['subtipo', 'detalle'], contacto: 'pba' },
  { id: 'instaladores', asunto: 'Problemas con instaladores', grupo: 'problemas', cuando: 'Inconvenientes con los técnicos que instalaron.', campos: ['detalle'], requeridos: ['detalle'], contacto: 'pba' },
  { id: 'cronograma', asunto: 'Incumplimiento en cronograma', grupo: 'problemas', cuando: 'No fueron al establecimiento en la fecha del cronograma.', campos: ['fechaCronograma', 'detalle'], requeridos: ['fechaCronograma'], contacto: 'pba' },
  { id: 'mudanza', asunto: 'Mudanza', grupo: 'pedidos', cuando: 'Mudanza de enlace o de piso tecnológico.', campos: ['detalle'], requeridos: [], contacto: 'opcional' },
  { id: 'unificacion', asunto: 'Unificación/Desunificación de predio', grupo: 'pedidos', cuando: 'Se unifican o se separan establecimientos de un predio.', campos: ['detalle'], requeridos: [], contacto: 'opcional' },
  { id: 'tac_usap', asunto: 'Cambio TAC a USAP', grupo: 'pedidos', cuando: 'Pasar de piso TAC a USAP.', campos: ['detalle'], requeridos: [], contacto: 'opcional' },
  { id: 'extension', asunto: 'Extensión/ampliación Piso', grupo: 'pedidos', cuando: 'Ampliar el piso tecnológico a más aulas.', campos: ['aulas', 'matricula', 'detalle'], requeridos: ['aulas', 'matricula'], contacto: 'opcional' },
  { id: 'solicitud_piso', asunto: 'Solicitud de Piso', grupo: 'pedidos', cuando: 'El establecimiento no tiene piso tecnológico y lo necesita.', campos: ['detalle'], requeridos: [], contacto: 'opcional' },
  { id: 'solicitud_conectividad', asunto: 'Solicitud de Conectividad', grupo: 'pedidos', cuando: 'El establecimiento no tiene enlace y lo necesita.', campos: ['detalle'], requeridos: [], contacto: 'opcional' },
  { id: 'error_direccion', asunto: 'Error en dirección', grupo: 'pedidos', cuando: 'La dirección del establecimiento figura mal en cronogramas o solicitudes.', campos: ['direccion', 'coordenadas'], requeridos: ['direccion', 'coordenadas'], contacto: 'opcional' },
]
export const tipoDe = (id: string) => TIPOS.find(t => t.id === id) ?? null
export const SUBTIPOS_INSTALACION = [
  { id: 'rack_modem', label: 'Rack y módem en lugares distintos' }, { id: 'cue_incorrecto', label: 'Instalación en CUE incorrecto' }, { id: 'sin_finalizar', label: 'Instalación sin finalizar correctamente' },
] as const

export type DatosReclamo = {
  enlace: Enlace | null, proveedorG1: 'Movistar' | 'Claro' | null, subtipo: string, detalle: string,
  contactoNombre: string, contactoCargo: string, contactoTelefono: string, contactoHorario: string,
  aulas: string, matricula: string, direccion: string, coordenadas: string, serie: string, fechaCronograma: string,
  // Enlace PBA con piso PNCE: el problema es del enlace y también del piso (se suman la foto del módem y el checklist).
  ambos: boolean,
}
export const DATOS_VACIOS: DatosReclamo = { enlace: null, proveedorG1: null, subtipo: '', detalle: '', contactoNombre: '', contactoCargo: '', contactoTelefono: '', contactoHorario: '', aulas: '', matricula: '', direccion: '', coordenadas: '', serie: '', fechaCronograma: '', ambos: false }

// Código de fecha y hora del asunto (hora argentina): DDMMAAAAHHMM, todo junto.
export function codigoFecha(ahora: Date): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ahora).map(x => [x.type, x.value]))
  return `${p.day}${p.month}${p.year}${p.hour}${p.minute}`
}
export const asuntoDe = (cue: number | string, tipo: TipoReclamo, ahora: Date) => `06-01-${codigoFecha(ahora)} - CUE ${cue} - ${tipo.asunto}`

// Qué falta completar (mensajes para mostrar al lado de cada campo).
export function faltantes(tipo: TipoReclamo, esc: EscuelaConectividad, d: DatosReclamo): Partial<Record<Campo | 'contacto' | 'enlace' | 'proveedor' | 'escuela', string>> {
  const err: ReturnType<typeof faltantes> = {}
  const enlaces = enlacesDe(esc.plan_enlace, esc.subplan_enlace)
  if (!esc.cue) err.escuela = 'El establecimiento no tiene CUE cargado.'
  else if (String(esc.cue).length !== 8) err.escuela = `El CUE tiene que tener 8 dígitos (figura ${esc.cue}).`
  if (tipo.id === 'sin_conectividad' && !enlaces.length) err.enlace = 'El establecimiento figura sin enlace: para pedirlo usá "Solicitud de Conectividad".'
  else if (enlaces.length > 1 && !d.enlace) err.enlace = 'Elegí qué enlace tiene el problema.'
  if (d.enlace === 'PBA1' && tipo.id === 'sin_conectividad' && !d.proveedorG1) err.proveedor = 'Elegí el proveedor (Movistar o Claro).'
  for (const c of tipo.requeridos) if (!d[c].trim()) err[c] = c === 'subtipo' ? 'Elegí el caso.' : 'Completá este dato.'
  // Con checklist adjunto (ya pide los datos del contacto) no se piden en el mensaje; sólo cuando va la foto del módem sin checklist.
  const pidePba = !llevaChecklist(tipo, esc, { ...d, enlace: d.enlace ?? (enlaces.length === 1 ? enlaces[0] : null) }) && (tipo.contacto === 'siempre' || (tipo.contacto === 'pba' && esPba(d.enlace ?? enlaces[0] ?? null)))
  const porTelefono = tipo.id === 'sin_conectividad' && d.enlace === 'PBA1' && d.proveedorG1 === 'Movistar'
  if (pidePba && !porTelefono && (!d.contactoNombre.trim() || !d.contactoCargo.trim() || !d.contactoTelefono.trim())) err.contacto = 'Completá el nombre, el cargo y el teléfono del contacto del establecimiento.'
  return err
}

export type Adjunto = { texto: string, enlace?: string }
export type Reclamo = {
  asunto: string, para: string | null, cuerpo: string, adjuntos: Adjunto[], avisos: string[],
  // PBA Grupo 1 con Movistar: no es un mail; el establecimiento llama al 0800 con estos datos.
  porTelefono: null | { telefono: string, datos: { label: string, valor: string }[] },
}

function adjuntosDe(tipo: TipoReclamo, esc: EscuelaConectividad, d: DatosReclamo, avisos: string[]): Adjunto[] {
  const z3: Adjunto = { texto: 'Checklist de Z3 (predio pequeño TAC o GAP) completo', enlace: DOC_CHECKLIST_Z3 }
  const checklist = (): Adjunto => {
    // Los jardines con piso de PNCE llevan siempre el de predio pequeño; el USAP es para los establecimientos más grandes.
    if (tienePiso(esc)) return esJardin(esc) && pisoPnce(esc) ? z3 : { texto: 'Checklist USAP completo', enlace: DOC_CHECKLIST_USAP }
    avisos.push('El establecimiento figura sin piso tecnológico: se sugiere el checklist de Z3 (predio pequeño). Verificá que corresponda.')
    return z3
  }
  const modem: Adjunto = { texto: 'Fotos del módem (o de la antena, si el problema es ahí)' }
  const formulario: Adjunto = { texto: 'Formulario completo con la información solicitada', enlace: DOC_FORMULARIO }
  switch (tipo.id) {
    case 'sin_conectividad':
      if (d.enlace === 'PNCE') return [checklist()]
      // Problema del enlace PBA y también del piso (de PNCE): foto del módem y checklist.
      if (d.ambos && puedeSerAmbos(tipo.id, esc, d.enlace)) return [modem, checklist()]
      if (d.enlace === 'PBA1') return [modem]
      // PBA Grupo 2 o 2019: el checklist USAP se suma sólo cuando el piso tecnológico también es de PBA (si el piso es de PNCE alcanza con las fotos).
      return /PBA/i.test(esc.plan_piso_tecnologico ?? '') ? [modem, { texto: 'Checklist USAP completo', enlace: DOC_CHECKLIST_USAP }] : [modem]
    // Problema sólo del piso: el checklist. Si el enlace es PBA, el piso de PNCE y el problema es también del enlace, se suma la foto del módem.
    case 'utm_switch': case 'piso': return d.ambos && puedeSerAmbos(tipo.id, esc, d.enlace) ? [modem, checklist()] : [checklist()]
    case 'ancho_banda': return [{ texto: 'Captura de pantalla de la medición de velocidad' }, checklist()]
    case 'danos_robo': return [{ texto: 'Denuncia policial con el N° de serie del equipamiento robado' }, { texto: 'Imágenes que constaten el hecho' }]
    case 'instalacion': return [d.subtipo === 'rack_modem' ? { texto: 'Plano marcando el lugar del módem y del rack' } : { texto: 'Imágenes que constaten el hecho' }]
    case 'mudanza': return [formulario, { texto: 'Plano del nuevo edificio' }]
    case 'unificacion': case 'tac_usap': case 'solicitud_piso': case 'solicitud_conectividad': return [formulario, { texto: 'Plano del establecimiento' }]
    case 'extension': return [{ texto: 'Plano del establecimiento marcando la zona con conectividad y la zona sin conectividad' }]
    default: return []
  }
}

// Si el reclamo lleva checklist (el que completa el establecimiento con sus datos de contacto).
export const llevaChecklist = (tipo: TipoReclamo, esc: EscuelaConectividad, d: DatosReclamo) => adjuntosDe(tipo, esc, d, []).some(a => a.enlace === DOC_CHECKLIST_USAP || a.enlace === DOC_CHECKLIST_Z3)

// Nombres de la base (en mayúsculas) en formato de oración, con las preposiciones en minúscula.
const nombrePropio = (s: string) => titleCase(s).replace(/ (De|Del|La|Las|Los|Y|E|Con|Para)(?= )/g, m => m.toLowerCase())
const linea = (k: string, v: string | null | undefined) => (v && v.trim() ? `${k}: ${v.trim()}\n` : '')
// Saludo según la hora argentina: buen día hasta las 12, buenas tardes hasta las 20 y buenas noches después.
export function saludoDe(ahora: Date): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', hourCycle: 'h23' }).format(ahora))
  return h < 12 ? 'buen día' : h < 20 ? 'buenas tardes' : 'buenas noches'
}

// Arma el reclamo. Lo recibe el CED por el correo regional, y es él quien lo reenvía a la DTE (que lo deriva a PBA o a Educar): por eso el mensaje
// va dirigido al CED, sin firma ni cargo (el correo oficial ya los lleva). `ced`: nombre de pila del CED, si se conoce. Si faltan datos, usar `faltantes` antes.
export function armarReclamo(esc: EscuelaConectividad, tipo: TipoReclamo, d: DatosReclamo, ahora: Date, ced: string | null): Reclamo {
  const enlaces = enlacesDe(esc.plan_enlace, esc.subplan_enlace)
  const enlace = d.enlace ?? (enlaces.length === 1 ? enlaces[0] : null)
  const datos = { ...d, enlace }
  const avisos: string[] = []
  const especial = avisoEspecial(esc)
  if (especial) avisos.push(especial)

  const porTelefono = tipo.id === 'sin_conectividad' && enlace === 'PBA1' && d.proveedorG1 === 'Movistar'
  if (porTelefono) {
    return { asunto: '', para: null, cuerpo: '', adjuntos: [], avisos, porTelefono: { telefono: TEL_MOVISTAR, datos: [
      ...(esc.ani ? [{ label: 'ANI (línea telefónica)', valor: esc.ani }] : []), ...(esc.recurso_primario ? [{ label: 'Recurso primario (servicio de internet)', valor: esc.recurso_primario }] : []), ...(esc.access_id ? [{ label: 'ID de acceso', valor: esc.access_id }] : []),
    ] } }
  }
  if (enlace === 'PNCE' && tipo.id === 'sin_conectividad') avisos.push(`También puede reclamar el establecimiento al ${TEL_EDUCAR} (Mesa de Ayuda Educar).`)
  const adjuntos = adjuntosDe(tipo, esc, datos, avisos)
  const para = tipo.id === 'sin_conectividad' && enlace === 'PBA1' && d.proveedorG1 === 'Claro' ? RECLAMOS_PARA_CLARO : RECLAMOS_PARA
  const proveedor = enlace === 'PNCE' ? esc.proveedor_pnce : esc.proveedor_pba
  const piso = tienePiso(esc) ? `${esc.plan_piso_tecnologico}${esc.tipo_piso_instalado ? ` (${esc.tipo_piso_instalado.replace(/\s*-\s*Instalada$/i, '')})` : ''}` : 'sin piso tecnológico'
  const subtipo = SUBTIPOS_INSTALACION.find(s => s.id === d.subtipo)?.label
  const contacto = !adjuntos.some(a => a.enlace === DOC_CHECKLIST_USAP || a.enlace === DOC_CHECKLIST_Z3) && (d.contactoNombre.trim() || d.contactoTelefono.trim())
    ? `\nContacto del establecimiento:\n${linea('Nombre', d.contactoNombre)}${linea('Cargo', d.contactoCargo)}${linea('Teléfono', d.contactoTelefono)}${linea('Horario', d.contactoHorario)}`
    : ''
  const cuerpo = `Hola${ced ? ` ${ced}` : ''}, ${saludoDe(ahora)}.\n\nTe paso un reclamo de conectividad:\n\n`
    + linea('Establecimiento', `${esc.nombre ? nombrePropio(esc.nombre) : 'Sin nombre'} (CUE ${esc.cue})`)
    + linea('Localidad', [esc.ciudad, esc.distrito].filter((x, i, a) => x && a.indexOf(x) === i).map(x => nombrePropio(x!)).join(', '))
    + linea('Dirección', esc.direccion ? nombrePropio(esc.direccion) : null)
    + linea('Enlace', enlace ? `${ENLACE_LABEL[enlace]}${proveedor ? ` (${proveedor})` : ''}` : 'sin enlace cargado')
    + linea('Piso tecnológico', piso.charAt(0).toUpperCase() + piso.slice(1))
    + linea('Tipo de reclamo', tipo.asunto)
    + linea('Caso', subtipo) + linea('Matrícula', d.matricula) + linea('Cantidad de aulas', d.aulas)
    + linea('Dirección que figura', tipo.id === 'error_direccion' ? esc.direccion : null) + linea('Dirección correcta', d.direccion) + linea('Coordenadas geográficas', d.coordenadas)
    + linea('N° de serie del equipamiento', d.serie) + linea('Fecha en la que tendrían que haber visitado el establecimiento', d.fechaCronograma && d.fechaCronograma.split('-').reverse().join('/'))
    + (d.detalle.trim() ? `\n${d.detalle.trim()}\n` : '')
    + contacto
    + (adjuntos.length ? `\nAdjunto:\n${adjuntos.map(a => `- ${a.texto}`).join('\n')}\n` : '')
    + `\nSaludos`
  return { asunto: asuntoDe(esc.cue ?? '', tipo, ahora), para, cuerpo, adjuntos, avisos, porTelefono: null }
}

// Abre Gmail con la cuenta institucional (abc.gob.ar) con la que se inició sesión en la agenda.
export const gmailUrl = (r: Pick<Reclamo, 'asunto' | 'para' | 'cuerpo'>, cuenta?: string | null) => `https://mail.google.com/mail/?${cuenta ? `authuser=${encodeURIComponent(cuenta)}&` : ''}view=cm&fs=1&to=${encodeURIComponent(r.para ?? '')}&su=${encodeURIComponent(r.asunto)}&body=${encodeURIComponent(r.cuerpo)}`

// En el celular el mensaje se abre directo en la app de Gmail (en el navegador pide iniciar sesión y pierde el borrador).
// iOS: esquema googlegmail://. Android: intent dirigido al paquete de Gmail, con el navegador como respaldo si no está instalada.
export type Plataforma = 'ios' | 'android' | 'otra'
export const plataformaDe = (ua: string): Plataforma => /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'otra'
export const gmailAppUrl = (r: Pick<Reclamo, 'asunto' | 'para' | 'cuerpo'>, plataforma: Plataforma, cuenta?: string | null): string => {
  const q = `subject=${encodeURIComponent(r.asunto)}&body=${encodeURIComponent(r.cuerpo)}`
  if (plataforma === 'ios') return `googlegmail:///co?to=${encodeURIComponent(r.para ?? '')}&${q}`
  if (plataforma === 'android') return `intent:${encodeURIComponent(r.para ?? '')}?${q}#Intent;scheme=mailto;package=com.google.android.gm;S.browser_fallback_url=${encodeURIComponent(gmailUrl(r, cuenta))};end`
  return gmailUrl(r, cuenta)
}
