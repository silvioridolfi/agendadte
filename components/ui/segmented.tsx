'use client'

import { Check, Plus } from 'lucide-react'
import { cn } from 'cn'

// Control segmentado (una opción activa entre varias): vistas de calendario, períodos.
// Mobile: ocupa el ancho y cada opción mide 44px de alto; desde sm se compacta a su contenido.
export function Segmented<T extends string>({ label, value, options, onChange, className }: { label: string, value: T, options: readonly (readonly [T, string])[], onChange: (v: T) => void, className?: string }) {
  return <div role="group" aria-label={label} className={cn('grid w-full rounded-lg border border-dte-linea bg-white p-1 shadow-xs sm:flex sm:w-auto', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
    {options.map(([v, l]) => <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
      className={cn('min-h-11 whitespace-nowrap rounded-md px-1.5 text-sm font-semibold transition active:scale-[0.97] sm:min-h-8 sm:px-3', value === v ? 'bg-dte-petroleo text-white' : 'text-dte-gris hover:bg-dte-fondo hover:text-dte-tinta')}>{l}</button>)}
  </div>
}

// Pastilla seleccionable (chip): sugerencias de sub-acción, compañeros, días de la semana.
// 40px de alto en mobile (con separación de 6px) y 32px desde md.
export function Pill({ on, onClick, children, conIcono = true, className }: { on: boolean, onClick: () => void, children: React.ReactNode, conIcono?: boolean, className?: string }) {
  return <button type="button" aria-pressed={on} onClick={onClick}
    className={cn('inline-flex min-h-10 items-center gap-1 rounded-full border px-3 text-sm font-medium transition active:scale-[0.97] md:min-h-8 md:px-2.5 md:text-xs',
      on ? 'border-dte-petroleo bg-dte-petroleo text-white shadow-xs' : 'border-dte-petroleo/20 bg-dte-petroleo/[0.06] text-dte-petroleo hover:border-dte-petroleo/40 hover:bg-dte-petroleo/[0.12]', className)}>
    {conIcono && (on ? <Check className="size-3.5" /> : <Plus className="size-3.5 opacity-70" />)}{children}
  </button>
}
