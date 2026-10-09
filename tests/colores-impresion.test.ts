import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// El PDF de informes y los gráficos no pueden usar las variables de la app (son documentos aparte), así que repiten los colores en hexadecimal.
// Esta prueba avisa si alguno se desalinea de la paleta de globals.css.
const css = readFileSync('app/globals.css', 'utf8').toLowerCase()
const hexDe = (archivo: string) => [...new Set((readFileSync(archivo, 'utf8').match(/#[0-9a-fA-F]{6}\b/g) ?? []).map(h => h.toLowerCase()))]
// Sólo existen en los gráficos (tinte de inscriptos y neutro de "otras"); no son colores de la app.
const SOLO_GRAFICOS = ['#b7d0e8', '#8a93a3']

describe('colores de impresión y gráficos', () => {
  it('los del PDF de informes están en la paleta de globals.css', () => {
    const hex = hexDe('components/app/informes.tsx')
    expect(hex.length).toBeGreaterThan(5)
    expect(hex.filter(h => !css.includes(h))).toEqual([])
  })
  it('los de los gráficos están en la paleta de globals.css', () => {
    const hex = hexDe('lib/graficos.ts').filter(h => !SOLO_GRAFICOS.includes(h))
    expect(hex.length).toBeGreaterThan(5)
    expect(hex.filter(h => !css.includes(h))).toEqual([])
  })
})
