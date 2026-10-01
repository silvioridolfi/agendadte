'use client'

import { Pill } from '@/components/ui/segmented'
import { Input } from '@/components/ui/input'
import { SUB_ACCIONES } from '@/lib/agenda'
import { opcionesDestinatarios, partirDestinatarios, PROPUESTAS_DE_CLUB, unirDestinatarios } from '@/lib/encuentro'
import { selectClass } from '@/components/app/comun'
import { useState } from 'react'

const OTRA = '__otra__'

// Propuesta del club: lista corta (la primera es la de siempre) y "Otra…" para escribir una propia.
export function PropuestaClub({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const enLista = PROPUESTAS_DE_CLUB.includes(value)
  const otra = !!value && !enLista
  return <div className="flex flex-col gap-2">
    <select aria-label="Propuesta dictada" className={`${selectClass} h-11 md:h-10`} value={otra ? OTRA : value || PROPUESTAS_DE_CLUB[0]} onChange={e => onChange(e.target.value === OTRA ? ' ' : e.target.value)}>
      {PROPUESTAS_DE_CLUB.map(p => <option key={p} value={p}>{p}</option>)}
      <option value={OTRA}>Otra…</option>
    </select>
    {otra && <Input aria-label="Otra propuesta" placeholder="Escribí la propuesta" value={value.trimStart()} onChange={e => onChange(e.target.value || ' ')} className="h-10 bg-white" />}
  </div>
}

// Destinatarios: opciones para tildar (el grado del club ya viene como "Estudiantes de 5°") y un campo para sumar otros.
export function Destinatarios({ value, grupo, onChange }: { value: string, grupo: string | null | undefined, onChange: (v: string) => void }) {
  const opciones = opcionesDestinatarios(grupo)
  const elegidos = partirDestinatarios(value)
  const [otrosTxt, setOtrosTxt] = useState(() => elegidos.filter(x => !opciones.includes(x)).join(', '))
  const tildados = (l: string[]) => opciones.filter(o => l.includes(o))
  const juntar = (l: string[], txt: string) => unirDestinatarios([...tildados(l), ...partirDestinatarios(txt)])
  const alternar = (o: string) => onChange(juntar(elegidos.includes(o) ? elegidos.filter(x => x !== o) : [...elegidos, o], otrosTxt))
  return <div className="flex flex-col gap-2">
    <div className="flex flex-wrap gap-1.5">{opciones.map(o => <Pill key={o} on={elegidos.includes(o)} onClick={() => alternar(o)}>{o}</Pill>)}</div>
    <Input aria-label="Otros destinatarios" placeholder="Otros (opcional), separados por coma" value={otrosTxt} onChange={e => { setOtrosTxt(e.target.value); onChange(juntar(elegidos, e.target.value)) }} className="h-10 bg-white" />
  </div>
}

// Propuesta del taller o capacitación: una sola elección entre los temas habituales (volver a tocarla la quita) o un tema propio.
export function PropuestaTaller({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const temas = [...(SUB_ACCIONES['TALLER/CAPACITACIÓN'] ?? [])].sort((a, b) => a.localeCompare(b, 'es'))
  const propia = !!value && !temas.includes(value)
  return <div className="flex flex-col gap-2">
    <div className="flex flex-wrap gap-1.5">{temas.map(t => <Pill key={t} on={value === t} onClick={() => onChange(value === t ? '' : t)}>{t}</Pill>)}</div>
    <Input aria-label="Otra propuesta" placeholder="Otra propuesta (opcional)" value={propia ? value : ''} onChange={e => onChange(e.target.value)} className="h-10 bg-white" />
  </div>
}
