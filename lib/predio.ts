// Predio compartido: varias escuelas (por ejemplo un jardín, una primaria y una secundaria) funcionan en el mismo edificio y tienen el mismo número de predio.
export type Hermana = { id: string, cue: number | null, nombre: string | null }
type Fila = { id: string, cue: number | null, nombre: string | null, predio: number | string | null | undefined }

// El predio vacío o en cero no cuenta: no quiere decir que compartan edificio.
export const predioValido = (p: number | string | null | undefined): number | null => {
  const n = typeof p === 'string' ? Number(p.trim()) : p
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

// Escuelas agrupadas por número de predio.
export function gruposPorPredio(filas: Fila[]): Map<number, Hermana[]> {
  const grupos = new Map<number, Hermana[]>()
  for (const f of filas) {
    const p = predioValido(f.predio)
    if (p != null) grupos.set(p, [...(grupos.get(p) ?? []), { id: f.id, cue: f.cue, nombre: f.nombre }])
  }
  return grupos
}

// Las otras escuelas del mismo predio (sin la propia), por nombre.
export function hermanasDe(grupos: Map<number, Hermana[]>, id: string, predio: number | string | null | undefined): Hermana[] {
  const p = predioValido(predio)
  return p == null ? [] : (grupos.get(p) ?? []).filter(h => h.id !== id).sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'))
}

export const textoPredio = (predio: number | null, n: number) => (predio != null && n > 0 ? `Predio ${predio} · comparte con ${n} ${n === 1 ? 'escuela' : 'escuelas'}` : '')
