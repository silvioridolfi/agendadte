// Abreviaturas de establecimientos para calendarios y tarjetas angostas (el nombre completo se ve en el detalle).
// Trabajan sobre el nombre ya en formato título (titleCase), tal como se muestra en la app.

// Nombres sin número que se reducen a una palabra clave: el distrito y el resto del contexto evitan la confusión.
const PUNTUALES: [RegExp, string][] = [
  [/^Liceo Víctor Mercante/i, 'Liceo'], [/^Colegio Nacional Rafael Hernández/i, 'Nacional'],
  [/^Bachillerato de Bellas Artes/i, 'Bellas Artes'], [/^Escuela de Arte de Berisso$/i, 'Escuela de Arte'],
]

// Siglas de la DGCyE. Los prefijos más específicos van primero. Especial (N° 5xx) y Estética comparten sigla: las distingue el número.
export const siglas: [RegExp, string][] = [
  [/^Dirección de Tecnología Educativa/i, 'DTE'],
  [/^Escuela de Educación Secundaria Técnica/i, 'EEST'], [/^Escuela de Educación Secundaria Agraria/i, 'EESA'], [/^Escuela de Educación Secundaria/i, 'EES'], [/^Escuela Secundaria/i, 'ES'],
  [/^Escuela de Educación Primaria/i, 'EP'], [/^Escuela Primaria/i, 'EP'],
  [/^Escuela de Educación Especial/i, 'EEE'], [/^Escuela Especial/i, 'EEE'], [/^Escuela de Educación Estética/i, 'EEE'],
  [/^Escuela de Adultos/i, 'EEPA'],
  [/^Jardín de Infantes/i, 'JI'], [/^Jardín Maternal/i, 'JM'],
  [/^Instituto Superior de Formación Docente y Técnica/i, 'ISFDyT'], [/^Instituto Superior de Formación Docente/i, 'ISFD'], [/^Instituto Superior de Formación Técnica/i, 'ISFT'],
  [/^Centro de Educación Física/i, 'CEF'], [/^Centro de Educación Agrícola/i, 'CEA'], [/^Centro de Formación Profesional/i, 'CFP'],
  [/^Centro Educativo para la Producción Total/i, 'CEPT'], [/^Centro Educativo (?:de )?Nivel Secundario/i, 'CENS'],
  [/^(?:Centro Educativo Complementario|C\.\s?E\.\s?C\.)/i, 'CEC'], [/^Centro (?:de )?Investigación Educativa/i, 'CIE'],
]

// Extensiones y anexos: se abrevian junto con la escuela de la que dependen ("Ext. N° 1 de EES N° 28"), porque el número solo no alcanza.
const EXTENSION = /^(Extensión|Anexo)(\s+(?:N°\s*\d+|I|II|III))?\s+(de|del|a)\s+(.+)$/i
const extension = (n: string, madre: (s: string) => string) => {
  const m = n.match(EXTENSION)
  return m ? `${m[1].toLowerCase() === 'anexo' ? 'Anexo' : 'Ext.'}${m[2] ?? ''} ${m[3].toLowerCase()} ${madre(m[4])}` : null
}

// Nombre con la sigla puesta, sin recortar ("EES N° 31 Dr. Fulano").
export function nombreCorto(n: string): string {
  const p = PUNTUALES.find(([re]) => re.test(n))
  if (p) return p[1]
  const e = extension(n, nombreCorto)
  if (e) return e
  const m = siglas.find(([re]) => re.test(n))
  return m ? n.replace(m[0], m[1]) : n
}

// Nombre mínimo: sigla y número ("EES N° 31"); si no tiene número, el nombre abreviado.
export function siglaNombre(n: string): string {
  const p = PUNTUALES.find(([re]) => re.test(n))
  if (p) return p[1]
  const e = extension(n, siglaNombre)
  if (e) return e
  const c = nombreCorto(n)
  const m = c.match(/^(.*?N°\s*\d+)/)
  return m ? m[1] : c
}
