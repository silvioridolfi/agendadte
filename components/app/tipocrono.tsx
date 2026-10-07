import { FAMILIAS_TIPO, etiquetaTipo, familiaTipo, type FamiliaTipo } from '@/lib/cronogramas'

// Colores por familia de tipo de cronograma (las clases van completas para que Tailwind las encuentre).
const CLASE: Record<FamiliaTipo, { chip: string, punto: string }> = {
  mantenimiento: { chip: 'border-[#8db3cc] bg-[#dbe9f2] text-[#05476e]', punto: 'bg-[#05476e]' },
  instalacion: { chip: 'border-[#86cdbf] bg-[#d5f0ea] text-[#0b6256]', punto: 'bg-[#0f8a78]' },
  reparacion: { chip: 'border-[#f0b18c] bg-[#fde4d4] text-[#8f3a0a]', punto: 'bg-[#e0661b]' },
  enlace: { chip: 'border-[#a7afe8] bg-[#e2e5fb] text-[#34389a]', punto: 'bg-[#4a52c9]' },
  otros: { chip: 'border-[#b9c0cc] bg-[#e9ecf1] text-[#3f4857]', punto: 'bg-[#7b8696]' },
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
