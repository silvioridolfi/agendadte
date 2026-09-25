// Los nombres en `establecimientos` vienen en mayúsculas: se muestran en formato título para que sean legibles.
const lowerWords = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a', 'al', 'para', 'por', 'con'])
export function titleCase(s: string) {
  return s.toLowerCase().split(/(\s+)/).map((w, i) => {
    if (/^\s+$/.test(w) || (i > 0 && lowerWords.has(w))) return w
    if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/.test(w)) return w.toUpperCase()
    return w.replace(/^(["“(]?)(\p{L})/u, (_, p, c) => p + c.toUpperCase())
  }).join('')
}
