'use client'

import { useRef, useState } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { cn } from 'cn'
import { DIAS_CORTOS, agruparMarcas, dentroDeRango, esFinDeSemana, esIso, fueraDeRango, partesFechaHora, type Marca, semanasDelMes, sumarDias, sumarMeses, textoFecha, textoFechaHora, tituloMes } from '@/lib/calendario'
import { hoyAR, horaAR } from '@/lib/hora'

// Selector de fechas con el estilo de la agenda (el calendario del navegador no se puede personalizar). Valores AAAA-MM-DD.
// Teclado: flechas (día y semana), Inicio y Fin (semana), RePág y AvPág (mes). Celdas de 44 px de alto en el celular.
type Comun = { marcas?: Record<string, Marca>, ariaLabel: string, min?: string, max?: string, limpiable?: boolean, className?: string, placeholder?: string, disabled?: boolean }

function Calendario({ valor, onElegir, min, max, limpiable, onBorrar, onHoy, pie, marcas }: { marcas?: Record<string, Marca>, valor: string, onElegir: (f: string) => void, min?: string, max?: string, limpiable?: boolean, onBorrar: () => void, onHoy: () => void, pie?: React.ReactNode }) {
  const hoy = hoyAR()
  const [mes, setMes] = useState(esIso(valor) ? valor : dentroDeRango(hoy, min, max))
  const [foco, setFoco] = useState(esIso(valor) ? valor : dentroDeRango(hoy, min, max))
  const grilla = useRef<HTMLDivElement>(null)
  const moverFoco = (f: string) => { const nueva = dentroDeRango(f, min, max); setFoco(nueva); setMes(nueva); requestAnimationFrame(() => grilla.current?.querySelector<HTMLButtonElement>(`[data-f="${nueva}"]`)?.focus()) }
  function tecla(e: React.KeyboardEvent) {
    const paso: Record<string, string> = { ArrowLeft: sumarDias(foco, -1), ArrowRight: sumarDias(foco, 1), ArrowUp: sumarDias(foco, -7), ArrowDown: sumarDias(foco, 7), PageUp: sumarMeses(foco, -1), PageDown: sumarMeses(foco, 1), Home: sumarDias(foco, -((new Date(`${foco}T12:00:00Z`).getUTCDay() + 6) % 7)), End: sumarDias(foco, 6 - ((new Date(`${foco}T12:00:00Z`).getUTCDay() + 6) % 7)) }
    if (paso[e.key]) { e.preventDefault(); moverFoco(paso[e.key]) }
  }
  const semanas = semanasDelMes(mes)
  // Los feriados y recesos del mes que se está viendo, juntando los días seguidos con el mismo nombre; se leen también en el celular (donde no hay cursor para ver el nombre del día).
  const delMesMarcas = agruparMarcas(Object.entries(marcas ?? {}).filter(([f]) => f.slice(0, 7) === mes.slice(0, 7)))
  const cambiarMes = (n: number) => { const m = sumarMeses(mes, n); setMes(m); setFoco(m) }
  return <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-1">
      <button type="button" aria-label="Mes anterior" onClick={() => cambiarMes(-1)} className="inline-flex size-11 items-center justify-center rounded-lg text-dte-petroleo hover:bg-dte-fondo md:size-9"><ChevronLeft className="size-5" aria-hidden /></button>
      <span aria-live="polite" className="text-base font-bold text-dte-tinta first-letter:uppercase">{tituloMes(mes)}</span>
      <button type="button" aria-label="Mes siguiente" onClick={() => cambiarMes(1)} className="inline-flex size-11 items-center justify-center rounded-lg text-dte-petroleo hover:bg-dte-fondo md:size-9"><ChevronRight className="size-5" aria-hidden /></button>
    </div>
    <div ref={grilla} role="group" aria-label={tituloMes(mes)} onKeyDown={tecla} className="grid grid-cols-7 gap-y-0.5">
      {DIAS_CORTOS.map(d => <span key={d} aria-hidden className="pb-1 text-center text-xs font-bold text-dte-gris">{d}</span>)}
      {semanas.flat().map(({ iso, delMes }, i) => {
        const elegido = iso === valor, esHoy = iso === hoy, fuera = fueraDeRango(iso, min, max), marca = marcas?.[iso], finde = esFinDeSemana(i % 7)
        return <button key={iso} type="button" data-f={iso} disabled={fuera} tabIndex={iso === foco ? 0 : -1} aria-pressed={elegido} aria-current={esHoy ? 'date' : undefined} aria-label={marca ? `${textoFecha(iso)}: ${marca.texto}` : textoFecha(iso)} title={marca?.texto} onClick={() => onElegir(iso)}
          className={cn('mx-auto flex h-11 w-full max-w-11 items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition md:h-9 md:max-w-9',
            elegido ? 'bg-dte-petroleo text-white' : marca ? (marca.tipo === 'feriado' ? 'bg-feriado-marca font-bold text-peligro hover:brightness-95' : 'bg-aniversario-marca font-bold text-aniversario-texto hover:brightness-95') : delMes ? (finde ? 'text-dte-gris hover:bg-dte-fondo' : 'text-dte-tinta hover:bg-dte-fondo') : 'text-dte-gris-claro hover:bg-dte-fondo',
            esHoy && !elegido && 'ring-2 ring-inset ring-dte-petroleo/50', fuera && 'cursor-not-allowed opacity-30 hover:bg-transparent')}>{Number(iso.slice(8, 10))}</button>
      })}
    </div>
    {delMesMarcas.length > 0 && <ul aria-label="Feriados y recesos del mes" className="flex flex-col gap-1 border-t border-dte-linea pt-2 text-xs text-dte-gris">{delMesMarcas.map(r => <li key={r.desde} className="flex items-start gap-1.5"><span aria-hidden className={cn('mt-0.5 size-2.5 shrink-0 rounded-sm ring-1', r.tipo === 'feriado' ? 'bg-feriado-marca ring-pba-fucsia/40' : 'bg-aniversario-marca ring-cat-institucional/40')} /><span><b className="tabular-nums text-dte-tinta">{r.desde === r.hasta ? Number(r.desde.slice(8, 10)) : `${Number(r.desde.slice(8, 10))} al ${Number(r.hasta.slice(8, 10))}`}</b> {r.texto}</span></li>)}</ul>}
    {pie}
    <div className="flex items-center justify-between border-t border-dte-linea pt-2">
      {limpiable ? <button type="button" onClick={onBorrar} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-dte-petroleo hover:bg-dte-fondo md:min-h-9">Borrar</button> : <span />}
      <button type="button" onClick={onHoy} disabled={fueraDeRango(hoy, min, max)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-dte-petroleo hover:bg-dte-fondo disabled:opacity-40 md:min-h-9">Hoy</button>
    </div>
  </div>
}

function Contenedor({ texto, placeholder, ariaLabel, className, disabled, children, icono: Icono = CalendarDays, ancho = 'w-[min(20rem,calc(100vw-1rem))]' }: { icono?: typeof CalendarDays, ancho?: string, texto: string, placeholder: string, ariaLabel: string, className?: string, disabled?: boolean, children: (cerrar: () => void) => React.ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  return <PopoverPrimitive.Root open={abierto} onOpenChange={setAbierto}>
    <PopoverPrimitive.Trigger disabled={disabled} aria-label={`${ariaLabel}${texto ? `: ${texto}` : ''}`}
      className={cn('inline-flex h-11 w-full items-center justify-between gap-2 rounded-control border border-input bg-white px-2.5 text-left text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:h-9 md:text-sm', texto ? 'text-dte-tinta' : 'text-dte-gris', className)}>
      <span className="truncate tabular-nums">{texto || placeholder}</span><Icono className="size-4 shrink-0 text-dte-gris" aria-hidden />
    </PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={8} className="z-toast">
        <PopoverPrimitive.Popup aria-label={ariaLabel} className={cn(ancho, 'rounded-card border border-dte-linea bg-white p-3 shadow-e3 outline-none')}>{children(() => setAbierto(false))}</PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>
}

export function SelectorFecha({ marcas, value, onChange, ariaLabel, min, max, limpiable = true, className, placeholder = 'dd/mm/aaaa', disabled }: Comun & { value: string, onChange: (v: string) => void }) {
  return <Contenedor texto={textoFecha(value)} placeholder={placeholder} ariaLabel={ariaLabel} className={className} disabled={disabled}>
    {cerrar => <Calendario marcas={marcas} valor={value} min={min} max={max} limpiable={limpiable} onElegir={f => { onChange(f); cerrar() }} onBorrar={() => { onChange(''); cerrar() }} onHoy={() => { onChange(dentroDeRango(hoyAR(), min, max)); cerrar() }} />}
  </Contenedor>
}

// Fecha y hora (AAAA-MM-DDTHH:mm): el calendario más dos selectores de hora y minutos.
export function SelectorFechaHora({ marcas, value, onChange, ariaLabel, min, max, className, placeholder = 'dd/mm/aaaa hh:mm', disabled }: Omit<Comun, 'limpiable'> & { value: string, onChange: (v: string) => void }) {
  const p = partesFechaHora(value)
  const hora = p.hora || horaAR().slice(0, 2), minuto = p.minuto || horaAR().slice(3, 5)
  const poner = (fecha: string, h: string, m: string) => onChange(fecha ? `${fecha}T${h}:${m}` : '')
  const opciones = (n: number) => Array.from({ length: n }, (_, i) => String(i).padStart(2, '0'))
  const selClase = 'h-11 rounded-control border border-input bg-white px-2 text-base text-dte-tinta tabular-nums md:h-9 md:text-sm'
  return <Contenedor texto={textoFechaHora(value)} placeholder={placeholder} ariaLabel={ariaLabel} className={className} disabled={disabled}>
    {cerrar => <Calendario marcas={marcas} valor={p.fecha} min={min} max={max} limpiable={false} onBorrar={() => undefined}
      onElegir={f => poner(f, hora, minuto)} onHoy={() => poner(dentroDeRango(hoyAR(), min, max), hora, minuto)}
      pie={<div className="flex items-center gap-2 border-t border-dte-linea pt-2"><span className="text-sm font-semibold text-dte-gris">Hora</span>
        <select aria-label="Hora" className={selClase} value={hora} onChange={e => poner(p.fecha || dentroDeRango(hoyAR(), min, max), e.target.value, minuto)}>{opciones(24).map(h => <option key={h} value={h}>{h}</option>)}</select><span aria-hidden>:</span>
        <select aria-label="Minutos" className={selClase} value={minuto} onChange={e => poner(p.fecha || dentroDeRango(hoyAR(), min, max), hora, e.target.value)}>{opciones(60).map(m => <option key={m} value={m}>{m}</option>)}</select>
        <button type="button" onClick={cerrar} className="ml-auto min-h-11 rounded-lg bg-dte-petroleo px-4 text-sm font-semibold text-white md:min-h-9">Listo</button></div>} />}
  </Contenedor>
}

// Hora (HH:mm) con el mismo estilo: dos selectores de hora y minutos. Sin valor, propone 08:00 al elegir.
export function SelectorHora({ value, onChange, ariaLabel, limpiable = true, className, placeholder = '--:--', disabled }: Pick<Comun, 'ariaLabel' | 'limpiable' | 'className' | 'placeholder' | 'disabled'> & { value: string, onChange: (v: string) => void }) {
  const [h, m] = /^\d{2}:\d{2}/.test(value) ? [value.slice(0, 2), value.slice(3, 5)] : ['08', '00']
  const opciones = (n: number) => Array.from({ length: n }, (_, i) => String(i).padStart(2, '0'))
  const selClase = 'h-11 rounded-control border border-input bg-white px-2 text-base text-dte-tinta tabular-nums md:h-9 md:text-sm'
  return <Contenedor icono={Clock} ancho="w-[min(17rem,calc(100vw-1rem))]" texto={/^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : ''} placeholder={placeholder} ariaLabel={ariaLabel} className={className} disabled={disabled}>
    {cerrar => <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Hora" className={selClase} value={h} onChange={e => onChange(`${e.target.value}:${m}`)}>{opciones(24).map(x => <option key={x} value={x}>{x}</option>)}</select><span aria-hidden>:</span>
      <select aria-label="Minutos" className={selClase} value={m} onChange={e => onChange(`${h}:${e.target.value}`)}>{opciones(60).map(x => <option key={x} value={x}>{x}</option>)}</select>
      <div className="ml-auto flex items-center gap-1">
        {limpiable && value && <button type="button" onClick={() => { onChange(''); cerrar() }} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-dte-petroleo md:min-h-9">Borrar</button>}
        <button type="button" onClick={() => { if (!value) onChange(`${h}:${m}`); cerrar() }} className="min-h-11 rounded-lg bg-dte-petroleo px-4 text-sm font-semibold text-white md:min-h-9">Listo</button></div></div>}
  </Contenedor>
}
