'use client'

import { useEffect, useRef, useState } from 'react'

const nf = new Intl.NumberFormat('es-AR')

// Número que sube (o baja) hasta su valor en poco más de medio segundo. Con "reducir movimiento" se muestra directo.
export function Contador({ valor }: { valor: number }) {
  const [mostrado, setMostrado] = useState(0)
  const desde = useRef(0)
  useEffect(() => {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ini = performance.now(), d0 = desde.current
    let id = requestAnimationFrame(function paso(t) {
      const k = reducido ? 1 : Math.min(1, Math.max(0, (t - ini) / 600))
      const v = Math.round(d0 + (valor - d0) * (1 - (1 - k) ** 3))
      desde.current = v; setMostrado(v)
      if (k < 1) id = requestAnimationFrame(paso)
    })
    return () => cancelAnimationFrame(id)
  }, [valor])
  return <><span aria-hidden>{nf.format(mostrado)}</span><span className="sr-only">{nf.format(valor)}</span></>
}

// Un texto que es sólo un número (con o sin puntos de miles) → ese número; cualquier otra cosa → null.
export const numeroDe = (s: string): number | null => (/^\d+$/.test(s) ? Number(s) : /^\d{1,3}(\.\d{3})+$/.test(s) ? Number(s.replace(/\./g, '')) : null)
