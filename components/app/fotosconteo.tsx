'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { Camera } from 'lucide-react'
import type { ConteoFotos } from '@/app/actions'
import type { AgendaItem } from '@/lib/agenda'
import { conteoFotos } from '@/components/app/comun'

// Cantidad de fotos ordenadas por acción y por día, compartida por calendario, listados, detalle y tablero.
const Ctx = createContext<ConteoFotos | null>(null)

export function ConteoFotosProvider({ reloadKey, children }: { reloadKey: number, children: React.ReactNode }) {
  const [conteo, setConteo] = useState<ConteoFotos | null>(null)
  useEffect(() => { let vivo = true; conteoFotos().then(c => vivo && setConteo(c)).catch(() => {}); return () => { vivo = false } }, [reloadKey])
  return <Ctx.Provider value={conteo}>{children}</Ctx.Provider>
}

export const useConteoFotos = () => useContext(Ctx)

// Fotos de una acción: las asignadas por hora a la acción; si no hay, las del día del responsable y de quienes participaron.
export function fotosDe(item: AgendaItem, c: ConteoFotos | null): { n: number, deAccion: boolean } | null {
  if (!c) return null
  const n = c.items[item.id] ?? 0
  if (n) return { n, deAccion: true }
  const dia = [item.fed_id, ...(item.participantes ?? []).map(p => p.fed_id)].reduce((a, f) => a + (c.dias[`${f}|${item.fecha}`] ?? 0), 0)
  return { n: dia, deAccion: false }
}

export function FotosChip({ item }: { item: AgendaItem }) {
  const f = fotosDe(item, useConteoFotos())
  if (!f?.n) return null
  return <span title={f.deAccion ? `${f.n} fotos de esta acción` : `${f.n} fotos de ese día`} className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums text-dte-petroleo ${f.deAccion ? 'bg-dte-tinte' : 'border border-dashed border-dte-petroleo/40'}`}>
    <Camera className="size-3" aria-hidden /><span className="sr-only">{f.deAccion ? 'Fotos de esta acción: ' : 'Fotos de ese día: '}</span>{f.n}
  </span>
}
