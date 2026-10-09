'use client'

import { useEffect, useState } from 'react'
import { SelectorFecha as Base, SelectorFechaHora as BaseHora, SelectorHora } from '@/components/ui/selector-fecha'
import { getFeriados } from '@/components/app/comun'
import { marcasFeriados, type Marca } from '@/lib/calendario'
import { anioAR } from '@/lib/hora'

// Selectores de fecha de la agenda: el calendario marca los feriados y recesos cargados, a nivel global (los mismos para todos los distritos).
// Se piden una sola vez por sesión (del año anterior al siguiente) y los comparten todos los selectores.
let cache: Promise<Record<string, Marca>> | null = null
function marcasGlobales(): Promise<Record<string, Marca>> {
  if (!cache) { const y = anioAR(); cache = getFeriados(`${y - 1}-01-01`, `${y + 1}-12-31`).then(marcasFeriados).catch(() => { cache = null; return {} }) }
  return cache
}
function useMarcas() {
  const [marcas, setMarcas] = useState<Record<string, Marca> | undefined>(undefined)
  useEffect(() => { let vivo = true; marcasGlobales().then(m => { if (vivo) setMarcas(m) }); return () => { vivo = false } }, [])
  return marcas
}

export function SelectorFecha(props: Omit<React.ComponentProps<typeof Base>, 'marcas'>) { return <Base {...props} marcas={useMarcas()} /> }
export function SelectorFechaHora(props: Omit<React.ComponentProps<typeof BaseHora>, 'marcas'>) { return <BaseHora {...props} marcas={useMarcas()} /> }
export { SelectorHora }
