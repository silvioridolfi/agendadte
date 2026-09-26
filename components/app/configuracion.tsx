'use client'

// Configuración (sólo coordinación): datos del equipo (distritos, carga horaria, DD.JJ.) y feriados/recesos.
import { useEffect, useState } from 'react'
import { Check, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/metrics'
import { titleCase } from '@/lib/format'
import type { DdjjDia, Fed, Feriado } from '@/lib/agenda'
import { az, cap, errMsg, fmt, parse, selectClass, getFeriados, updateFed, addFeriado, deleteFeriado, DIAS_HABILES, ErrorBox } from '@/components/app/comun'

const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
const TIPO_FERIADO: Record<Feriado['tipo'], string> = { nacional: 'Nacional', turistico: 'No laborable turístico', distrital: 'Aniversario distrital', receso: 'Receso escolar' }

function FedEditor({ fed, autorId, onSaved }: { fed: Fed, autorId: string, onSaved: (msg: string) => void }) {
  const [nombre, setNombre] = useState(fed.nombre_completo)
  const [distritos, setDistritos] = useState(fed.distritos_a_cargo.map(titleCase).join(', '))
  const [carga, setCarga] = useState(fed.carga_horaria ?? '')
  const [ddjj, setDdjj] = useState<DdjjDia[]>(() => [1, 2, 3, 4, 5].map(dia => fed.ddjj?.find(d => d.dia === dia) ?? { dia, dte: '' }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const setDia = (dia: number, patch: Partial<DdjjDia>) => setDdjj(l => l.map(d => (d.dia === dia ? { ...d, ...patch } : d)))
  async function guardar() {
    setBusy(true); setError('')
    // El texto del horario DTE se arma a partir de desde/hasta si no se escribió.
    const dias = ddjj.map(d => ({ ...d, dte: d.dte.trim() || (d.dte_desde && d.dte_hasta ? `${d.dte_desde} a ${d.dte_hasta}` : '') })).filter(d => d.dte || d.externo)
    try {
      await updateFed(autorId, { id: fed.id, nombre_completo: nombre, distritos_a_cargo: distritos.split(',').map(d => d.trim()).filter(Boolean), carga_horaria: carga, ddjj: dias })
      onSaved(`Se guardaron los datos de ${nombre}`)
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }
  return <div className="flex flex-col gap-3 border-t border-dte-linea pt-3">
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm font-semibold">Nombre<Input value={nombre} onChange={e => setNombre(e.target.value)} className="h-9" /></label>
      <label className="flex flex-col gap-1 text-sm font-semibold">Distritos a cargo <span className="text-xs font-normal text-dte-gris">(separados por coma)</span><Input value={distritos} onChange={e => setDistritos(e.target.value)} className="h-9" /></label>
      <label className="flex flex-col gap-1 text-sm font-semibold">Carga horaria<Input value={carga} onChange={e => setCarga(e.target.value)} placeholder="Ej.: 20 hs" className="h-9" /></label>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
      <thead><tr className="text-left text-xs text-dte-gris"><th className="pb-1 font-semibold">DD.JJ.</th><th className="pb-1 font-semibold">Desde</th><th className="pb-1 font-semibold">Hasta</th><th className="pb-1 font-semibold">Horario DTE (texto)</th><th className="pb-1 font-semibold">Otro cargo</th></tr></thead>
      <tbody>{ddjj.map((d, i) => <tr key={d.dia}>
        <td className="py-1 pr-2 font-semibold">{DIAS_LARGOS[i]}</td>
        <td className="py-1 pr-2"><Input type="time" value={d.dte_desde ?? ''} onChange={e => setDia(d.dia, { dte_desde: e.target.value })} className="h-8" /></td>
        <td className="py-1 pr-2"><Input type="time" value={d.dte_hasta ?? ''} onChange={e => setDia(d.dia, { dte_hasta: e.target.value })} className="h-8" /></td>
        <td className="py-1 pr-2"><Input value={d.dte} onChange={e => setDia(d.dia, { dte: e.target.value })} placeholder="Ej.: 8 a 12" className="h-8" /></td>
        <td className="py-1"><Input value={d.externo ?? ''} onChange={e => setDia(d.dia, { externo: e.target.value })} placeholder="Ej.: EP 5 de 13 a 17" className="h-8" /></td>
      </tr>)}</tbody>
    </table></div>
    {error && <ErrorBox message={error} />}
    <div><Button size="sm" disabled={busy} onClick={guardar} className="bg-dte-petroleo hover:bg-dte-petroleo-oscuro">{busy ? <Loader2 className="animate-spin" /> : <Check data-icon="inline-start" />}Guardar</Button></div>
  </div>
}

function Feriados({ autorId, distritos, onSaved }: { autorId: string, distritos: string[], onSaved: (msg: string) => void }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [list, setList] = useState<Feriado[] | null>(null)
  const [nuevo, setNuevo] = useState<Omit<Feriado, 'id'>>({ fecha: '', nombre: '', tipo: 'nacional', distrito: null, confirmado: true })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
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
    <div className="mb-4 grid gap-2 rounded-xl bg-dte-fondo p-3 sm:grid-cols-[9rem_1fr_12rem_10rem_auto_auto] sm:items-end">
      <label className="flex flex-col gap-1 text-xs font-semibold">Fecha<Input type="date" value={nuevo.fecha} onChange={e => setNuevo(n => ({ ...n, fecha: e.target.value }))} className="h-9 bg-white" /></label>
      <label className="flex flex-col gap-1 text-xs font-semibold">Nombre<Input value={nuevo.nombre} onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))} placeholder="Ej.: Receso invernal" className="h-9 bg-white" /></label>
      <label className="flex flex-col gap-1 text-xs font-semibold">Tipo<select className={selectClass} value={nuevo.tipo} onChange={e => setNuevo(n => ({ ...n, tipo: e.target.value as Feriado['tipo'] }))}>{(Object.keys(TIPO_FERIADO) as Feriado['tipo'][]).sort((a, b) => az(TIPO_FERIADO[a], TIPO_FERIADO[b])).map(t => <option key={t} value={t}>{TIPO_FERIADO[t]}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs font-semibold">Distrito<select className={selectClass} disabled={nuevo.tipo !== 'distrital'} value={nuevo.distrito ?? ''} onChange={e => setNuevo(n => ({ ...n, distrito: e.target.value || null }))}><option value="">—</option>{distritos.map(d => <option key={d} value={d}>{titleCase(d)}</option>)}</select></label>
      <label className="flex items-center gap-1.5 pb-2 text-xs font-semibold"><input type="checkbox" checked={nuevo.confirmado} onChange={e => setNuevo(n => ({ ...n, confirmado: e.target.checked }))} className="size-4" />Confirmado</label>
      <Button size="sm" disabled={busy === 'add' || !nuevo.fecha || !nuevo.nombre.trim() || (nuevo.tipo === 'distrital' && !nuevo.distrito)} onClick={agregar} className="h-9 bg-dte-magenta hover:bg-dte-magenta-oscuro">{busy === 'add' ? <Loader2 className="animate-spin" /> : <Plus data-icon="inline-start" />}Agregar</Button>
    </div>
    <p className="mb-3 text-xs text-dte-gris">Para un receso de varios días, cargá cada día hábil (los fines de semana ya no cuentan).</p>
    {error && <div className="mb-3"><ErrorBox message={error} /></div>}
    {!list ? <p className="text-sm text-dte-gris">Cargando…</p> : !list.length ? <p className="text-sm text-dte-gris">No hay feriados cargados en {year}.</p>
      : <ul className="divide-y divide-dte-linea rounded-xl border border-dte-linea">{list.map(f => <li key={f.id ?? f.fecha + f.nombre} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
        <span className="min-w-0"><b className="tabular-nums">{cap(fmt(parse(f.fecha), { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''))}</b> · {f.nombre}{!f.confirmado && <span className="text-dte-gris"> (a confirmar)</span>}
          <span className="block text-xs text-dte-gris">{TIPO_FERIADO[f.tipo]}{f.distrito ? ` · ${titleCase(f.distrito)}` : ''}</span></span>
        <Button variant="ghost" size="sm" disabled={busy === f.id} onClick={() => quitar(f)} aria-label={`Eliminar ${f.nombre}`} className="text-peligro hover:bg-peligro-fondo hover:text-peligro">{busy === f.id ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />}</Button>
      </li>)}</ul>}
  </Panel>
}

export function ConfiguracionView({ feds, autorId, onChanged }: { feds: Fed[], autorId: string, onChanged: (msg: string) => void }) {
  const [abierto, setAbierto] = useState('')
  const equipo = [...feds].filter(f => f.rol !== 'coordinacion').sort((a, b) => az(a.nombre_completo, b.nombre_completo))
  const distritos = [...new Set(feds.flatMap(f => f.distritos_a_cargo))].sort(az)
  return <div className="flex flex-col gap-4">
    <Panel title="Equipo" subtitle="Distritos a cargo, carga horaria y DD.JJ. de horarios de cada FED. Tocá un nombre para editarlo.">
      <ul className="flex flex-col gap-2">{equipo.map(f => <li key={f.id} className="rounded-xl border border-dte-linea p-3">
        <button type="button" onClick={() => setAbierto(abierto === f.id ? '' : f.id)} aria-expanded={abierto === f.id} className="flex w-full items-center justify-between gap-3 text-left">
          <span><b>{f.nombre_completo}</b><span className="block text-xs text-dte-gris">{f.distritos_a_cargo.map(titleCase).join(' · ') || 'Sin distritos'} · {f.carga_horaria ?? 'Sin carga horaria'} · DD.JJ.: {f.ddjj?.length ? f.ddjj.map(d => DIAS_HABILES[d.dia - 1]).join(', ') : 'sin cargar'}</span></span>
          <span className="text-xs font-semibold text-dte-petroleo">{abierto === f.id ? 'Cerrar' : 'Editar'}</span>
        </button>
        {abierto === f.id && <FedEditor fed={f} autorId={autorId} onSaved={m => { onChanged(m); setAbierto('') }} />}
      </li>)}</ul>
    </Panel>
    <Feriados autorId={autorId} distritos={distritos} onSaved={onChanged} />
  </div>
}
