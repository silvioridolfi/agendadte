// Formato de los textos de ayuda (sin dependencias): párrafos, listas, pasos numerados, tablas y avisos.
//   ## Subtítulo          - Viñeta        1. Paso        | A | B |  (la primera fila es el encabezado)
//   [i] Información       [!] Importante  [!!] Atención  **negrita** en cualquier texto
export type Bloque =
  | { t: 'sub', texto: string }
  | { t: 'p', texto: string }
  | { t: 'lista', items: string[] }
  | { t: 'pasos', items: string[] }
  | { t: 'tabla', filas: string[][] }
  | { t: 'aviso', nivel: 'info' | 'importante' | 'atencion', texto: string }

const AVISOS = [['[!!]', 'atencion'], ['[!]', 'importante'], ['[i]', 'info']] as const

export function parsear(md: string): Bloque[] {
  const out: Bloque[] = []
  for (const cruda of md.split('\n')) {
    const l = cruda.trim()
    if (!l) continue
    const aviso = AVISOS.find(([m]) => l.startsWith(m))
    const ult = out[out.length - 1]
    if (l.startsWith('## ')) out.push({ t: 'sub', texto: l.slice(3) })
    else if (aviso) out.push({ t: 'aviso', nivel: aviso[1], texto: l.slice(aviso[0].length).trim() })
    else if (l.startsWith('- ')) { if (ult?.t === 'lista') ult.items.push(l.slice(2)); else out.push({ t: 'lista', items: [l.slice(2)] }) }
    else if (/^\d+\.\s/.test(l)) { const x = l.replace(/^\d+\.\s/, ''); if (ult?.t === 'pasos') ult.items.push(x); else out.push({ t: 'pasos', items: [x] }) }
    else if (l.startsWith('|')) {
      if (/^\|[\s|:-]+\|$/.test(l)) continue
      const fila = l.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      if (ult?.t === 'tabla') ult.filas.push(fila); else out.push({ t: 'tabla', filas: [fila] })
    } else out.push({ t: 'p', texto: l })
  }
  return out
}

// Texto plano de un bloque (para el buscador).
export const textoPlano = (b: Bloque): string => {
  const sinNegrita = (s: string) => s.replace(/\*\*/g, '')
  switch (b.t) {
    case 'lista': case 'pasos': return b.items.map(sinNegrita).join(' ')
    case 'tabla': return b.filas.map(f => f.map(sinNegrita).join(' ')).join(' ')
    default: return sinNegrita(b.texto)
  }
}

// Partes de un texto con **negrita**: [texto, esNegrita][].
export const partesNegrita = (s: string): [string, boolean][] => s.split('**').map((p, i) => [p, i % 2 === 1] as [string, boolean]).filter(([p]) => p !== '')

// Sin tildes ni mayúsculas, para buscar.
export const normalizar = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
