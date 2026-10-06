'use client'

import { useEffect, useState } from 'react'
import { Building2, CalendarClock, ChevronRight, ClipboardList } from 'lucide-react'
import { type Fed } from '@/lib/agenda'
import { FAMILIAS, type Familia } from '@/lib/ayuda/estilo'
import { type Accesos } from '@/lib/mis-escuelas'
import { Skeleton, eyebrow, getAccesos } from '@/components/app/comun'

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

// Franja del Tablero con los accesos a Mis escuelas, Mis reclamos y Cronogramas, cada uno con un número para ver qué hay pendiente.
// El CED ve los de todo el equipo. Si no se pueden traer los números, la franja no se muestra (los accesos siguen en el menú de las iniciales).
export function AccesosRapidos({ profile, onEscuelas, onReclamos, onCronogramas }: { profile: Fed, onEscuelas: () => void, onReclamos: () => void, onCronogramas: () => void }) {
  const [datos, setDatos] = useState<Accesos | null | 'error'>(null)
  useEffect(() => { let vigente = true; getAccesos().then(d => { if (vigente) setDatos(d) }).catch(() => { if (vigente) setDatos('error') }); return () => { vigente = false } }, [])
  if (datos === 'error') return null
  const ced = profile.rol === 'coordinacion'
  const d = datos === null ? null : datos
  const tarjetas: { clave: string, titulo: string, texto: string, Icono: typeof Building2, familia: Familia, ir: () => void }[] = [
    { clave: 'escuelas', titulo: ced ? 'Escuelas' : 'Mis escuelas', Icono: Building2, familia: 'celeste', ir: onEscuelas,
      texto: d ? `${d.escuelas}|${d.escuelas === 1 ? 'escuela' : 'escuelas'}${d.conReclamo ? ` · ${plural(d.conReclamo, 'con reclamo abierto', 'con reclamo abierto')}` : ''}` : '' },
    { clave: 'reclamos', titulo: ced ? 'Registro de reclamos' : 'Mis reclamos', Icono: ClipboardList, familia: 'amarillo', ir: onReclamos,
      texto: d ? `${d.reclamosAbiertos}|${d.reclamosAbiertos === 1 ? 'abierto' : 'abiertos'}${ced ? '' : ' en tus escuelas'}` : '' },
    { clave: 'cronogramas', titulo: 'Cronogramas', Icono: CalendarClock, familia: 'violeta', ir: onCronogramas,
      texto: d ? `${d.cronogramasProximos}|${d.cronogramasProximos === 1 ? 'próximo' : 'próximos'}${ced ? '' : ' en tus escuelas'}` : '' },
  ]
  return <section aria-label="Accesos rápidos" className="mt-5">
    <p className={eyebrow}>Accesos rápidos</p>
    <ul className="mt-2 grid gap-2 md:grid-cols-3">{tarjetas.map(t => {
      const f = FAMILIAS[t.familia], [n, resto] = t.texto.split('|')
      return <li key={t.clave}><button type="button" onClick={t.ir} className="flex h-full min-h-16 w-full items-center gap-3 rounded-card border border-dte-linea bg-white p-3.5 text-left shadow-e1 transition hover:shadow-e2">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${f.fondo} ${f.texto}`}><t.Icono className="size-5" aria-hidden /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t.titulo}</span>
          {d ? <span className="block text-xs text-dte-gris"><b className="text-base tabular-nums text-dte-tinta">{n}</b> {resto}</span> : <Skeleton className="mt-1 h-5 w-32" />}</span>
        <ChevronRight className="size-4 shrink-0 text-dte-gris-claro" aria-hidden />
      </button></li>
    })}</ul>
  </section>
}
