'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, ClipboardCheck, ClipboardList, GraduationCap, ListChecks, Router } from 'lucide-react'
import { type AgendaItem } from '@/lib/agenda'
import { etiquetaTipo, fechaCortaAR } from '@/lib/cronogramas'
import { titleCase } from '@/lib/format'
import { hayParaHacer, type DatosParaHacer, type Faltante } from '@/lib/parahacer'
import { siglaNombre } from '@/lib/siglas'
import { getParaHacer } from '@/components/app/comun'

const MAX = 5
const escuelaDe = (i: AgendaItem) => (i.school?.nombre ? siglaNombre(titleCase(i.school.nombre)) : i.lugar || 'Sin lugar')
const resumen = (i: AgendaItem) => `${fechaCortaAR(i.fecha)} · ${escuelaDe(i)} · ${titleCase(i.accion)}`
const faltanTxt = (f: Faltante[]) => `Falta${f.length > 1 ? 'n' : ''}: ${f.join(', ')}`

// Tarjeta de arriba de Mi agenda: lo que quedó pendiente desde que se usa la agenda (acciones sin cerrar, encuentros con datos que faltan para el formulario de Nivel Central,
// jornadas por cargar y cronogramas de conectividad de la semana). Si no hay nada, queda una línea. Se actualiza cada vez que cambia la agenda (`reloadKey`).
export function ParaHacer({ reloadKey, onSelect, onJornadas, onCronogramas }: { reloadKey: number, onSelect: (item: AgendaItem) => void, onJornadas: () => void, onCronogramas: () => void }) {
  const [datos, setDatos] = useState<DatosParaHacer | null>(null)
  const [abierta, setAbierta] = useState<'sinCerrar' | 'incompletos' | null>(null)
  useEffect(() => { let vivo = true; getParaHacer().then(d => { if (vivo) setDatos(d) }).catch(() => { if (vivo) setDatos(null) }); return () => { vivo = false } }, [reloadKey])
  if (!datos) return null
  if (!hayParaHacer(datos)) return <p className="mb-4 flex items-center gap-1.5 text-sm text-dte-gris"><CheckCircle2 className="size-4 text-exito" aria-hidden />Todo al día: no tenés nada pendiente.</p>
  const total = datos.sinCerrar.length + datos.incompletos.length + (datos.jornadasPendientes ? 1 : 0) + (datos.cronogramas.length ? 1 : 0)
  const fila = 'flex min-h-11 w-full items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-dte-fondo'
  const lista = (items: { item: AgendaItem, nota?: string }[]) => <ul className="mb-1 ml-7 flex flex-col">{items.slice(0, MAX).map(({ item, nota }) => <li key={item.id}>
    <button type="button" onClick={() => onSelect(item)} className="flex min-h-11 w-full flex-col items-start justify-center rounded-control px-2 text-left hover:bg-dte-fondo md:min-h-9">
      <span className="text-sm font-medium">{resumen(item)}</span>{nota && <span className="text-xs text-aviso-fuerte">{nota}</span>}</button></li>)}
    {items.length > MAX && <li className="px-2 py-1 text-xs text-dte-gris">y {items.length - MAX} más: mirá el calendario para el resto.</li>}</ul>
  return <section aria-label="Para hacer" className="anim-entrada mb-4 rounded-card border border-aviso-borde bg-aviso-fondo p-3 shadow-e1">
    <h2 className="flex items-center gap-1.5 px-2 text-sm font-bold text-aviso-fuerte"><ListChecks className="size-4" aria-hidden />Para hacer <span className="rounded-full bg-aviso-fondo-fuerte px-2 py-0.5 text-xs">{total}</span></h2>
    <ul className="mt-1 flex flex-col">
      {datos.sinCerrar.length > 0 && <li><button type="button" aria-expanded={abierta === 'sinCerrar'} onClick={() => setAbierta(a => (a === 'sinCerrar' ? null : 'sinCerrar'))} className={fila}>
        <ClipboardCheck className="size-5 shrink-0 text-aviso-fuerte" aria-hidden /><span className="min-w-0 flex-1"><b>{datos.sinCerrar.length}</b> {datos.sinCerrar.length === 1 ? 'acción planificada con fecha pasada' : 'acciones planificadas con fecha pasada'}: marcala como realizada o cancelada</span>
        <ChevronDown className={`size-4 shrink-0 text-dte-gris transition ${abierta === 'sinCerrar' ? 'rotate-180' : ''}`} aria-hidden /></button>
        {abierta === 'sinCerrar' && lista(datos.sinCerrar.map(item => ({ item })))}</li>}
      {datos.incompletos.length > 0 && <li><button type="button" aria-expanded={abierta === 'incompletos'} onClick={() => setAbierta(a => (a === 'incompletos' ? null : 'incompletos'))} className={fila}>
        <ClipboardList className="size-5 shrink-0 text-aviso-fuerte" aria-hidden /><span className="min-w-0 flex-1"><b>{datos.incompletos.length}</b> {datos.incompletos.length === 1 ? 'encuentro pedagógico con datos que faltan' : 'encuentros pedagógicos con datos que faltan'} para el formulario</span>
        <ChevronDown className={`size-4 shrink-0 text-dte-gris transition ${abierta === 'incompletos' ? 'rotate-180' : ''}`} aria-hidden /></button>
        {abierta === 'incompletos' && lista(datos.incompletos.map(({ item, faltan }) => ({ item, nota: faltanTxt(faltan) })))}</li>}
      {datos.jornadasPendientes > 0 && <li><button type="button" onClick={onJornadas} className={fila}>
        <GraduationCap className="size-5 shrink-0 text-aviso-fuerte" aria-hidden /><span className="min-w-0 flex-1"><b>{datos.jornadasPendientes}</b> {datos.jornadasPendientes === 1 ? 'jornada pendiente' : 'jornadas pendientes'} de cargar en el formulario de Nivel Central</span>
        <span className="shrink-0 text-xs font-semibold text-dte-petroleo">Ver</span></button></li>}
      {datos.cronogramas.length > 0 && <li><button type="button" onClick={onCronogramas} className={fila}>
        <Router className="size-5 shrink-0 text-aviso-fuerte" aria-hidden /><span className="min-w-0 flex-1"><b>{datos.cronogramas.length}</b> {datos.cronogramas.length === 1 ? 'cronograma de conectividad' : 'cronogramas de conectividad'} en tus escuelas esta semana
          <span className="block text-xs text-dte-gris">{datos.cronogramas.slice(0, 2).map(c => `${c.nombre ? siglaNombre(titleCase(c.nombre)) : `CUE ${c.cue}`} (${etiquetaTipo(c.tipo)}, ${fechaCortaAR(c.fecha_inicio)})`).join(' · ')}{datos.cronogramas.length > 2 ? ` · y ${datos.cronogramas.length - 2} más` : ''}</span></span>
        <span className="shrink-0 text-xs font-semibold text-dte-petroleo">Ver</span></button></li>}
    </ul>
  </section>
}
