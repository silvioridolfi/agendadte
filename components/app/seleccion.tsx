'use client'

import { useState } from 'react'
import { Check, Loader2, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Confirmar } from '@/components/ui/confirmar'
import { ESTADOS, type AgendaItem, type Estado } from '@/lib/agenda'
import { cambiarEstadoVarias, eliminarVarias, errMsg, moverFinDeSemana, statusStyle, ErrorBox } from '@/components/app/comun'
import { ItemCard } from '@/components/app/agenda'

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`
const sinConexion = () => typeof navigator !== 'undefined' && !navigator.onLine

// Barra fija de la selección múltiple: cambiar el estado o eliminar varias acciones de una vez.
export function BarraSeleccion({ ids, onListo, onCambio }: { ids: string[], onListo: () => void, onCambio: (msg: string) => void }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [borrar, setBorrar] = useState(false)
  async function estado(e: Estado) {
    if (sinConexion()) { setError('Los cambios en bloque necesitan conexión.'); return }
    setBusy(e); setError('')
    try {
      const r = await cambiarEstadoVarias(ids, e)
      const partes = [r.actualizadas ? `${plural(r.actualizadas, 'acción marcada', 'acciones marcadas')} como ${statusStyle[e].label.toLowerCase()}` : 'No hubo cambios']
      if (r.futuras) partes.push(`${r.futuras} no se marcaron porque todavía no llegó la fecha`)
      if (r.sinDatos) partes.push(`${plural(r.sinDatos, 'encuentro quedó', 'encuentros quedaron')} sin datos de participación`)
      onCambio(partes.join(' · ')); onListo()
    } catch (err) { setError(errMsg(err)) } finally { setBusy('') }
  }
  async function eliminar() {
    if (sinConexion()) { setError('Los cambios en bloque necesitan conexión.'); return }
    setBusy('borrar'); setError('')
    try { const n = await eliminarVarias(ids); onCambio(`Se ${n === 1 ? 'eliminó 1 acción' : `eliminaron ${n} acciones`}`); onListo() } catch (err) { setError(errMsg(err)) } finally { setBusy('') }
  }
  return <div role="region" aria-label="Acciones sobre la selección" className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-header px-3 md:bottom-4">
    <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border border-dte-linea bg-white p-3 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">{ids.length ? plural(ids.length, 'acción seleccionada', 'acciones seleccionadas') : 'Tocá las acciones para seleccionarlas'}</p>
        <Button variant="ghost" size="sm" onClick={onListo}><X data-icon="inline-start" />Listo</Button>
      </div>
      {ids.length > 0 && <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-dte-gris">Marcar como:</span>
        {ESTADOS.map(e => <button key={e} type="button" disabled={!!busy} onClick={() => estado(e)} className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-50 md:min-h-8 ${statusStyle[e].badge}`}>{busy === e ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}{statusStyle[e].label}</button>)}
        <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => setBorrar(true)} className="ml-auto text-peligro hover:bg-peligro-fondo hover:text-peligro">{busy === 'borrar' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}Eliminar</Button>
      </div>}
      {error && <ErrorBox message={error} />}
    </div>
    <Confirmar abierto={borrar} peligro titulo={`¿Eliminar ${plural(ids.length, 'acción', 'acciones')}?`} accion="Eliminar"
      descripcion="Se borran definitivamente de tu agenda. Si alguna era compartida, tus compañeros reciben un aviso." onConfirmar={eliminar} onCerrar={() => setBorrar(false)} />
  </div>
}

// Aviso de acciones cargadas en fin de semana: selección, eliminar o mover al viernes anterior / lunes siguiente.
export function PanelFinDeSemana({ items, viewer, editable, onSelect, onCambio }: { items: AgendaItem[], viewer: string, editable: boolean, onSelect: (i: AgendaItem) => void, onCambio: (msg: string) => void }) {
  const propias = items.filter(i => i.fed_id === viewer)
  const [sel, setSel] = useState<string[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirmar, setConfirmar] = useState<'borrar' | 'viernes' | 'lunes' | null>(null)
  const toggle = (id: string) => setSel(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]))
  const todas = sel.length === propias.length && propias.length > 0
  async function ejecutar(accion: 'borrar' | 'viernes' | 'lunes') {
    if (sinConexion()) { setError('Los cambios en bloque necesitan conexión.'); return }
    setBusy(accion); setError('')
    try {
      const n = accion === 'borrar' ? await eliminarVarias(sel) : await moverFinDeSemana(sel, accion)
      onCambio(accion === 'borrar' ? `Se ${n === 1 ? 'eliminó 1 acción' : `eliminaron ${n} acciones`}` : `${plural(n, 'acción movida', 'acciones movidas')} al ${accion === 'viernes' ? 'viernes anterior' : 'lunes siguiente'}`)
      setSel([])
    } catch (err) { setError(errMsg(err)) } finally { setBusy('') }
  }
  const textos = { borrar: ['Eliminar', `¿Eliminar ${plural(sel.length, 'acción', 'acciones')}?`, 'Se borran definitivamente. No se puede deshacer.'], viernes: ['Mover al viernes', `¿Mover ${plural(sel.length, 'acción', 'acciones')} al viernes anterior?`, 'Cada acción pasa al viernes previo a su fecha, con el mismo horario.'], lunes: ['Mover al lunes', `¿Mover ${plural(sel.length, 'acción', 'acciones')} al lunes siguiente?`, 'Cada acción pasa al lunes posterior a su fecha, con el mismo horario.'] } as const
  return <details className="mt-4 rounded-2xl border border-aviso-borde bg-aviso-fondo p-3">
    <summary className="cursor-pointer text-sm font-semibold text-aviso-fuerte">{plural(items.length, 'acción cargada', 'acciones cargadas')} en fin de semana</summary>
    {editable && propias.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2">
      <label className="flex min-h-11 md:min-h-10 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={todas} onChange={() => setSel(todas ? [] : propias.map(i => i.id))} className="size-5" />Seleccionar todas</label>
      {sel.length > 0 && <>
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setConfirmar('viernes')} className="bg-white">{busy === 'viernes' && <Loader2 className="animate-spin" data-icon="inline-start" />}Mover al viernes</Button>
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setConfirmar('lunes')} className="bg-white">{busy === 'lunes' && <Loader2 className="animate-spin" data-icon="inline-start" />}Mover al lunes</Button>
        <Button size="sm" disabled={!!busy} onClick={() => setConfirmar('borrar')} className="bg-peligro text-white hover:bg-peligro/90">{busy === 'borrar' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}Eliminar ({sel.length})</Button>
      </>}
    </div>}
    {error && <div className="mt-2"><ErrorBox message={error} /></div>}
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{items.map(item => editable && item.fed_id === viewer
      ? <ItemCard key={item.id} item={item} viewer={viewer} onClick={() => toggle(item.id)} seleccionado={sel.includes(item.id)} />
      : <ItemCard key={item.id} item={item} viewer={viewer} onClick={() => onSelect(item)} />)}</div>
    {confirmar && <Confirmar abierto peligro={confirmar === 'borrar'} titulo={textos[confirmar][1]} accion={textos[confirmar][0]} descripcion={textos[confirmar][2]} onConfirmar={() => ejecutar(confirmar)} onCerrar={() => setConfirmar(null)} />}
  </details>
}
