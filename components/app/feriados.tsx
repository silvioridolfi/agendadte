'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Confirmar } from '@/components/ui/confirmar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/metrics'
import { titleCase } from '@/lib/format'
import { DISTRITOS_REGION, type Feriado } from '@/lib/agenda'
import { az, cap, errMsg, fmt, parse, selectClass, getFeriados, addFeriado, deleteFeriado, ErrorBox, Skeleton } from '@/components/app/comun'

const TIPO_FERIADO: Record<Feriado['tipo'], string> = { nacional: 'Nacional', turistico: 'No laborable turístico', distrital: 'Aniversario distrital', receso: 'Receso escolar' }

// Feriados, aniversarios distritales y recesos (sólo administración).
export function FeriadosView({ autorId, onSaved }: { autorId: string, onSaved: (msg: string) => void }) {
  const distritos = DISTRITOS_REGION
  const [year, setYear] = useState(new Date().getFullYear())
  const [list, setList] = useState<Feriado[] | null>(null)
  const [nuevo, setNuevo] = useState<Omit<Feriado, 'id'>>({ fecha: '', nombre: '', tipo: 'nacional', distrito: null, confirmado: true })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [aQuitar, setAQuitar] = useState<Feriado | null>(null)
  const cargar = () => { setList(null); getFeriados(`${year}-01-01`, `${year}-12-31`).then(setList).catch(e => { setList([]); setError(errMsg(e)) }) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(cargar, [year])
  async function agregar() {
    setBusy('add'); setError('')
    try { await addFeriado(autorId, nuevo); onSaved('Feriado agregado'); setNuevo(n => ({ ...n, fecha: '', nombre: '' })); cargar() } catch (e) { setError(errMsg(e)) } finally { setBusy('') }
  }
  async function quitar(f: Feriado) {
    if (!f.id) return
    setBusy(f.id); setError('')
    try { await deleteFeriado(autorId, f.id); onSaved('Feriado eliminado'); cargar() } catch (e) { setError(errMsg(e)) } finally { setBusy('') }
  }
  return <Panel title="Feriados, aniversarios y recesos" subtitle="Se muestran en los calendarios, se saltean en las series y no cuentan para “sin actividad” de clubes y prácticas."
    action={<div className="flex items-center gap-1"><Button variant="outline" size="sm" onClick={() => setYear(y => y - 1)}>‹</Button><span className="px-2 text-sm font-bold tabular-nums">{year}</span><Button variant="outline" size="sm" onClick={() => setYear(y => y + 1)}>›</Button></div>}>
    <div className="mb-4 grid gap-2 rounded-xl bg-dte-fondo p-3 sm:grid-cols-2 sm:items-end lg:grid-cols-[9rem_1fr_12rem_10rem_auto_auto]">
      <label className="flex flex-col gap-1 text-xs font-semibold">Fecha<Input type="date" value={nuevo.fecha} onChange={e => setNuevo(n => ({ ...n, fecha: e.target.value }))} className="h-11 bg-white md:h-9" /></label>
      <label className="flex flex-col gap-1 text-xs font-semibold">Nombre<Input value={nuevo.nombre} onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))} placeholder="Ej.: Receso invernal" className="h-11 bg-white md:h-9" /></label>
      <label className="flex flex-col gap-1 text-xs font-semibold">Tipo<select className={selectClass} value={nuevo.tipo} onChange={e => setNuevo(n => ({ ...n, tipo: e.target.value as Feriado['tipo'] }))}>{(Object.keys(TIPO_FERIADO) as Feriado['tipo'][]).sort((a, b) => az(TIPO_FERIADO[a], TIPO_FERIADO[b])).map(t => <option key={t} value={t}>{TIPO_FERIADO[t]}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs font-semibold">Distrito<select className={selectClass} disabled={nuevo.tipo !== 'distrital'} value={nuevo.distrito ?? ''} onChange={e => setNuevo(n => ({ ...n, distrito: e.target.value || null }))}><option value="">—</option>{distritos.map(d => <option key={d} value={d}>{titleCase(d)}</option>)}</select></label>
      <label className="flex items-center gap-1.5 pb-2 text-xs font-semibold"><input type="checkbox" checked={nuevo.confirmado} onChange={e => setNuevo(n => ({ ...n, confirmado: e.target.checked }))} className="size-4" />Confirmado</label>
      <Button size="sm" disabled={busy === 'add' || !nuevo.fecha || !nuevo.nombre.trim() || (nuevo.tipo === 'distrital' && !nuevo.distrito)} onClick={agregar} variant="marca" className="md:h-9">{busy === 'add' ? <Loader2 className="animate-spin" /> : <Plus data-icon="inline-start" />}Agregar</Button>
    </div>
    <p className="mb-3 text-xs text-dte-gris">Para un receso de varios días, cargá cada día hábil (los fines de semana ya no cuentan).</p>
    {error && <div className="mb-3"><ErrorBox message={error} /></div>}
    {!list ? <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando feriados"><Skeleton className="h-11" /><Skeleton className="h-11" /><Skeleton className="h-11" /></div> : !list.length ? <p className="text-sm text-dte-gris">No hay feriados cargados en {year}.</p>
      : <ul className="divide-y divide-dte-linea rounded-xl border border-dte-linea">{list.map(f => <li key={f.id ?? f.fecha + f.nombre} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
        <span className="min-w-0"><b className="tabular-nums">{cap(fmt(parse(f.fecha), { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''))}</b> · {f.nombre}{!f.confirmado && <span className="text-dte-gris"> (a confirmar)</span>}
          <span className="block text-xs text-dte-gris">{TIPO_FERIADO[f.tipo]}{f.distrito ? ` · ${titleCase(f.distrito)}` : ''}</span></span>
        <Button variant="ghost" size="sm" disabled={busy === f.id} onClick={() => setAQuitar(f)} aria-label={`Eliminar ${f.nombre}`} className="text-peligro hover:bg-peligro-fondo hover:text-peligro">{busy === f.id ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />}</Button>
      </li>)}</ul>}
    <Confirmar abierto={!!aQuitar} peligro titulo="¿Eliminar este feriado?" accion="Eliminar"
      descripcion={aQuitar ? <><b>{aQuitar.nombre}</b> ({cap(fmt(parse(aQuitar.fecha), { weekday: 'long', day: 'numeric', month: 'long' }))}) deja de mostrarse en los calendarios y de saltearse en las series.</> : ''}
      onConfirmar={() => aQuitar && quitar(aQuitar)} onCerrar={() => setAQuitar(null)} />
  </Panel>
}
