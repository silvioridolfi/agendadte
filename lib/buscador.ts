// Reglas de búsqueda de escuelas, las mismas en toda la agenda: lupa y selector (que buscan en la base con search_establecimientos, ver supabase/migrations),
// Mis escuelas, Mapa, Cronogramas, Reclamos y Tablero. Si cambia una regla en la función SQL, se cambia acá también.
//  - Sin tildes ni mayúsculas; "n", "nro", "de", "la"… no cuentan.
//  - Con una sigla ("ees 31", "ep 4", "eest 1"): solo las escuelas de ese tipo y con ese número propio ("ees 1" no trae la N° 31 ni las técnicas).
//    Las extensiones y anexos de la escuela pedida también salen.
//  - Un solo número de 4 cifras o más: empieza con ese CUE.
//  - Si no, todas las palabras tienen que estar, en cualquier orden; un número solo coincide como número entero ("31" no es "310").

export const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const RUIDO = new Set(['n', 'nro', 'no', 'numero', 'de', 'la', 'el'])
// Palabra a la que equivale cada sigla cuando aparece suelta en el resto de la búsqueda.
const ALIAS: Record<string, string> = {
  eest: 'tecnica', est: 'tecnica', tec: 'tecnica', ees: 'secundaria', sec: 'secundaria', ep: 'primaria', eep: 'primaria', prim: 'primaria',
  ji: 'jardin', jim: 'jardin', eee: 'especial', esp: 'especial', cfp: 'formacion', dte: 'tecnologia',
}
const SIGLAS: Record<string, { p: string, numerada: boolean }> = {
  ees: { p: 'escuela de educacion secundaria', numerada: true }, sec: { p: 'escuela (de educacion )?secundaria', numerada: true }, es: { p: 'escuela secundaria', numerada: true },
  eest: { p: 'escuela de educacion secundaria tecnica', numerada: true }, est: { p: 'escuela de educacion secundaria tecnica', numerada: true }, tec: { p: 'escuela de educacion secundaria tecnica', numerada: true },
  eesa: { p: 'escuela de educacion secundaria agraria', numerada: true },
  ep: { p: 'escuela (de educacion )?primaria', numerada: true }, eep: { p: 'escuela (de educacion )?primaria', numerada: true }, prim: { p: 'escuela (de educacion )?primaria', numerada: true },
  ji: { p: 'jardin de infantes( rural( de matricula minima)?)?', numerada: true }, jim: { p: 'jardin maternal', numerada: true },
  eee: { p: 'escuela (de educacion )?(especial|estetica)', numerada: true }, esp: { p: 'escuela especial', numerada: true }, eepa: { p: 'escuela de adultos', numerada: true },
  cfp: { p: 'centro de formacion profesional', numerada: true }, isfd: { p: 'instituto superior de formacion docente', numerada: true }, isfdyt: { p: 'instituto superior de formacion docente y tecnica', numerada: true },
  isft: { p: 'instituto superior de formacion tecnica', numerada: true }, cef: { p: 'centro de educacion fisica', numerada: true }, cea: { p: 'centro de educacion agricola', numerada: true },
  cept: { p: 'centro educativo para la produccion total', numerada: true }, cens: { p: 'centro educativo (de )?nivel secundario', numerada: true },
  cec: { p: 'centro educativo complementario', numerada: true }, cie: { p: 'centro (de )?investigacion educativa', numerada: true }, dte: { p: 'direccion de tecnologia educativa', numerada: false },
}

export type DatosEscuela = { nombre?: string | null, ciudad?: string | null, distrito?: string | null, cue?: number | string | null }

// `extra`: otros textos de la pantalla donde se busca (domicilio, contacto, proveedor, N° de cronograma…); cuentan para las palabras sueltas.
export function coincideEscuela(consulta: string, e: DatosEscuela, extra = ''): boolean {
  const crudas = sinTildes(consulta.trim()).split(/[^a-z0-9]+/).filter(w => w && !RUIDO.has(w))
  if (!crudas.length) return true
  const nom = sinTildes(e.nombre ?? '')
  const cue = e.cue == null ? '' : String(e.cue)
  const txt = sinTildes(`${e.nombre ?? ''} ${e.ciudad ?? ''} ${e.distrito ?? ''} ${cue} ${extra}`)
  const k = crudas.find(w => w in SIGLAS)
  if (k) {
    const { p, numerada } = SIGLAS[k]
    const num = crudas.find(w => /^[0-9]{1,4}$/.test(w))
    const re = new RegExp(`^((extension|anexo)( n?[°º.]? ?[0-9]+| i{1,3})? (de|del) (la )?)?${p}${numerada ? `\\s+(n[°º.]?\\s*)?${num ? `${num}([^0-9]|$)` : '[0-9]'}` : '(\\s|$)'}`)
    const propia = ALIAS[k] ?? k
    const otras = crudas.map(w => ALIAS[w] ?? w).filter(w => !/^[0-9]+$/.test(w) && w !== propia)
    // Nombres ya abreviados ("EP N° 4 …") también cuentan.
    const corta = new RegExp(`^${k}${numerada ? `\\s+(n[°º.]?\\s*)?${num ? `${num}([^0-9]|$)` : '[0-9]'}` : '(\\s|$)'}`)
    return (re.test(nom) || corta.test(nom)) && otras.every(w => txt.includes(w))
  }
  const ws = crudas.map(w => ALIAS[w] ?? w)
  if (ws.length === 1 && /^[0-9]{4,}$/.test(ws[0]) && cue.startsWith(ws[0])) return true
  return ws.every(w => (/^[0-9]+$/.test(w) ? new RegExp(`(^|[^0-9])${w}([^0-9]|$)`).test(txt) : txt.includes(w)))
}
