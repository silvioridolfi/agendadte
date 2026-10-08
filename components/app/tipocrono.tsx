import { FAMILIAS_TIPO, etiquetaTipo, familiaTipo, type FamiliaTipo } from '@/lib/cronogramas'

// Colores por familia de tipo de cronograma (tokens tipo-* de globals.css; las clases van completas para que Tailwind las encuentre).
const CLASE: Record<FamiliaTipo, { chip: string, punto: string }> = {
  mantenimiento: { chip: 'border-tipo-mantenimiento-borde bg-tipo-mantenimiento text-tipo-mantenimiento-texto', punto: 'bg-tipo-mantenimiento-punto' },
  instalacion: { chip: 'border-tipo-instalacion-borde bg-tipo-instalacion text-tipo-instalacion-texto', punto: 'bg-tipo-instalacion-punto' },
  reparacion: { chip: 'border-tipo-reparacion-borde bg-tipo-reparacion text-tipo-reparacion-texto', punto: 'bg-tipo-reparacion-punto' },
  enlace: { chip: 'border-tipo-enlace-borde bg-tipo-enlace text-tipo-enlace-texto', punto: 'bg-tipo-enlace-punto' },
  otros: { chip: 'border-tipo-otros-borde bg-tipo-otros text-tipo-otros-texto', punto: 'bg-tipo-otros-punto' },
}

export function EtiquetaTipo({ tipo, extra }: { tipo: string | null | undefined, extra?: string }) {
  const c = CLASE[familiaTipo(tipo)]
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${c.chip}`}><span className={`size-1.5 shrink-0 rounded-full ${c.punto}`} aria-hidden />{etiquetaTipo(tipo)}{extra && <span className="font-normal tabular-nums">{extra}</span>}</span>
}

export function PuntoTipo({ tipo }: { tipo: string | null | undefined }) {
  return <span className={`mr-1.5 inline-block size-2 rounded-full align-middle ${CLASE[familiaTipo(tipo)].punto}`} aria-hidden />
}

export function LeyendaTipos() {
  return <ul aria-label="Colores por tipo de cronograma" className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-dte-gris">
    {FAMILIAS_TIPO.map(f => <li key={f.id} className="inline-flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${CLASE[f.id].punto}`} aria-hidden /><span><b className="font-semibold text-dte-tinta">{f.nombre}</b></span></li>)}
  </ul>
}
