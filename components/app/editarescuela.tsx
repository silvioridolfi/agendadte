'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Confirmar } from '@/components/ui/confirmar'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { CAMPOS_ESCUELA, DOMINIO_LABORAL, fechaAIso, fechaDeIso, resumenContacto, type CampoEscuela, type ContactoEditable, type ContactoInput, type EdicionEscuela } from '@/lib/escuelas-edicion'
import { Field } from '@/components/app/formulario'
import { ErrorBox, Skeleton, borrarContacto, contactoPrincipal, errMsg, fmt, getEdicionEscuela, guardarContacto, guardarEscuela, selectClass } from '@/components/app/comun'

type Vista = 'datos' | 'conectividad' | 'contactos' | 'historial'
const GRUPOS: { titulo: string, claves: string[], avanzado?: boolean }[] = [
  { titulo: 'Ubicación', claves: ['direccion', 'lat', 'lon'] },
  { titulo: 'Institución', claves: ['alias', 'nivel', 'modalidad', 'turnos'] },
  { titulo: 'Alumnado', claves: ['matricula', 'varones', 'mujeres', 'secciones'] },
  { titulo: 'Notas', claves: ['observaciones'] },
  { titulo: 'Datos de la escuela (solo CED y administración)', claves: ['nombre', 'predio', 'distrito', 'ciudad', 'fed_a_cargo', 'tipo_establecimiento', 'ambito'], avanzado: true },
]
const GRUPOS_CONECTIVIDAD: typeof GRUPOS = [
  { titulo: 'Enlace', claves: ['plan_enlace', 'subplan_enlace', 'fecha_inicio_conectividad', 'mb', 'listado_conexion_internet'] },
  { titulo: 'PNCE', claves: ['proveedor_internet_pnce', 'fecha_instalacion_pnce'] },
  { titulo: 'PBA', claves: ['estado_instalacion_pba', 'proveedor_asignado_pba'] },
  { titulo: 'Piso tecnológico', claves: ['plan_piso_tecnologico', 'tipo_piso_instalado', 'proveedor_piso_tecnologico_cue', 'fecha_terminado_piso_tecnologico_cue'] },
  { titulo: 'Otros', claves: ['reclamos_grupo_1_ani', 'recurso_primario', 'access_id'] },
]
const hora = (iso: string) => fmt(new Date(iso), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(/\./g, '')

// Edición de los datos de una escuela, en tres solapas: datos, contactos e historial de cambios. El servidor vuelve a validar todo y no se avisa a nadie.
export function EditarEscuela({ id, nombre, onClose, onCambio }: { id: string, nombre: string, onClose: () => void, onCambio: () => void }) {
  const [datos, setDatos] = useState<EdicionEscuela | null>(null)
  const [error, setError] = useState('')
  const [vista, setVista] = useState<Vista>('datos')
  const cargar = useCallback(() => getEdicionEscuela(id).then(d => { setDatos(d); return d }).catch(e => { setError(errMsg(e)); return null }), [id])
  useEffect(() => { cargar() }, [cargar])
  const cambio = () => { onCambio(); return cargar() }
  return <Dialog open onOpenChange={o => !o && onClose()}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white max-sm:top-[calc(env(safe-area-inset-top,0px)+0.5rem)]! max-sm:bottom-auto! max-sm:max-h-[calc(100dvh-1rem)]! max-sm:rounded-b-2xl! max-sm:pb-4! sm:max-w-xl">
      <DialogTitle className="flex items-center gap-2"><Pencil className="size-5 text-dte-petroleo" aria-hidden />Editar escuela</DialogTitle>
      <DialogDescription className="break-words">{nombre}. Los cambios quedan en el historial con tu nombre y no se avisa a nadie.</DialogDescription>
      {error ? <ErrorBox message={error} onRetry={() => { setError(''); cargar() }} />
        : !datos ? <div className="flex flex-col gap-3"><Skeleton className="h-10" /><Skeleton className="h-40" /><Skeleton className="h-24" /></div>
        : <>
          <Segmented<Vista> label="Qué editar" value={vista} onChange={setVista} options={[['datos', 'Datos'], ...(datos.nivel === 'todo' ? [['conectividad', 'Conectividad'] as const] : []), ['contactos', `Contactos (${datos.contactos.length})`], ['historial', 'Historial']]} className="sm:w-full" />
          {vista === 'datos' && <Datos datos={datos} grupos={GRUPOS} onGuardado={cambio} />}
          {vista === 'conectividad' && datos.nivel === 'todo' && <Datos datos={datos} grupos={GRUPOS_CONECTIVIDAD} onGuardado={cambio} />}
          {vista === 'contactos' && <Contactos datos={datos} onCambio={cambio} />}
          {vista === 'historial' && <Historial datos={datos} />}
        </>}
    </DialogContent>
  </Dialog>
}

function Control({ campo, valor, onChange, datos }: { campo: CampoEscuela, valor: string, onChange: (v: string) => void, datos: EdicionEscuela }) {
  const opciones = datos.opciones[campo.clave] ?? []
  if (campo.tipo === 'largo') return <Textarea value={valor} onChange={e => onChange(e.target.value)} maxLength={campo.max} className="min-h-20" />
  if (campo.tipo === 'fecha') return <Input type="date" value={fechaAIso(valor)} onChange={e => onChange(fechaDeIso(e.target.value))} min="2000-01-01" max="2100-12-31" className="h-11 md:h-9" />
  if (campo.tipo === 'lista') return <select value={valor} onChange={e => onChange(e.target.value)} className={selectClass}>
    {(campo.clave === 'fed_a_cargo' || valor === '' || campo.clave === 'plan_piso_tecnologico') && <option value="">{campo.clave === 'fed_a_cargo' ? 'Sin FED asignado' : 'Sin dato'}</option>}
    {valor && !opciones.includes(valor) && <option value={valor}>{valor}</option>}
    {opciones.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
  const listId = campo.sugerencias ? `lista-${campo.clave}` : undefined
  return <>
    <Input value={valor} onChange={e => onChange(e.target.value)} inputMode={campo.tipo === 'entero' || campo.tipo === 'cifras' ? 'numeric' : campo.tipo === 'decimal' ? 'decimal' : undefined} maxLength={campo.tipo === 'entero' ? 8 : campo.max} list={listId} className="h-11 md:h-9" />
    {listId && <datalist id={listId}>{opciones.map(o => <option key={o} value={o} />)}</datalist>}
  </>
}

// Pegar "lat, lon" en la casilla de latitud (como lo da Google Maps) completa las dos.
function pegarUbicacion(f: Record<string, string>, clave: string, v: string) {
  const par = clave === 'lat' ? v.match(/^\s*(-?\d+\.\d+)\s*[, ]\s*(-?\d+\.\d+)\s*$/) : null
  return par ? { ...f, lat: par[1], lon: par[2] } : { ...f, [clave]: v }
}
const formDe = (d: EdicionEscuela): Record<string, string> => Object.fromEntries(CAMPOS_ESCUELA.map(c => [c.clave, d.valores[c.clave] == null ? '' : String(d.valores[c.clave])]))
function Datos({ datos, grupos, onGuardado }: { datos: EdicionEscuela, grupos: typeof GRUPOS, onGuardado: () => Promise<EdicionEscuela | null> }) {
  const claves = grupos.flatMap(g => g.claves)
  const campos = CAMPOS_ESCUELA.filter(c => claves.includes(c.clave))
  const [inicial, setInicial] = useState(() => formDe(datos))
  const [form, setForm] = useState<Record<string, string>>(inicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState('')
  const cambios = campos.filter(c => form[c.clave] !== inicial[c.clave])
  async function guardar() {
    setGuardando(true); setError(''); setHecho('')
    try {
      const n = await guardarEscuela(datos.id, Object.fromEntries(cambios.map(c => [c.clave, form[c.clave]])))
      const fresco = await onGuardado()
      if (fresco) { const f = formDe(fresco); setInicial(f); setForm(f) }
      setHecho(n ? `Guardado (${n} ${n === 1 ? 'dato' : 'datos'}).` : 'No había cambios.')
    } catch (e) { setError(errMsg(e)) } finally { setGuardando(false) }
  }
  return <div className="flex flex-col gap-5">
    {grupos.filter(g => !g.avanzado || datos.nivel === 'todo').map(g => <fieldset key={g.titulo} className="flex flex-col gap-3 rounded-tile border border-dte-linea p-3">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-dte-gris">{g.titulo}</legend>
      {g.titulo === 'Ubicación' && <p className="text-xs text-dte-gris">Latitud y longitud ubican la escuela en el mapa. Podés pegar el par que te da Google Maps (por ejemplo -34.92145, -57.95500) en la casilla de latitud.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {g.claves.map(k => CAMPOS_ESCUELA.find(c => c.clave === k)!).map(c => <Field key={c.clave} label={c.label} className={c.tipo === 'largo' || c.clave === 'direccion' || c.clave === 'nombre' ? 'sm:col-span-2' : ''}>
          <Control campo={c} valor={form[c.clave]} onChange={v => { setForm(f => pegarUbicacion(f, c.clave, v)); setHecho('') }} datos={datos} />
        </Field>)}
      </div>
    </fieldset>)}
    {error && <ErrorBox message={error} />}
    {hecho && <p role="status" className="flex items-center gap-1.5 text-sm font-semibold text-exito"><Check className="size-4" aria-hidden />{hecho}</p>}
    <Button type="button" onClick={guardar} disabled={guardando || !cambios.length} className="w-full bg-dte-petroleo hover:bg-dte-petroleo-oscuro sm:self-end sm:w-auto">{guardando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}Guardar cambios{cambios.length > 0 && ` (${cambios.length})`}</Button>
  </div>
}

const VACIO: ContactoInput = { nombre: '', apellido: '', cargo: '', telefono: '', correo: '', correo_laboral: '' }
function Contactos({ datos, onCambio }: { datos: EdicionEscuela, onCambio: () => Promise<unknown> }) {
  const [editando, setEditando] = useState<ContactoEditable | 'nuevo' | null>(null)
  const [borrar, setBorrar] = useState<ContactoEditable | null>(null)
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const accion = async (fn: () => Promise<unknown>) => { setTrabajando(true); setError(''); try { await fn(); await onCambio() } catch (e) { setError(errMsg(e)) } finally { setTrabajando(false) } }
  if (editando) return <FormContacto escuelaId={datos.id} contacto={editando === 'nuevo' ? null : editando} onCancelar={() => setEditando(null)} onGuardado={async () => { await onCambio(); setEditando(null) }} />
  return <div className="flex flex-col gap-3">
    {datos.contactos.length ? <ul className="divide-y divide-dte-linea overflow-hidden rounded-tile border border-dte-linea">{datos.contactos.map(c => <li key={c.id} className="flex flex-col gap-2 px-3 py-2.5">
      <span className="min-w-0 break-words text-sm"><span className="font-semibold">{[c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre'}</span>{c.cargo && <span className="text-dte-gris"> · {c.cargo}</span>}{c.es_principal && <span className="ml-1.5 text-xs text-dte-gris">(principal)</span>}
        <span className="block text-xs text-dte-gris">{[c.telefono, c.correo_laboral, c.correo].filter(Boolean).join(' · ') || 'Sin teléfono ni correo'}</span></span>
      <span className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditando(c)} disabled={trabajando}><Pencil data-icon="inline-start" />Editar</Button>
        {!c.es_principal && <Button type="button" variant="outline" size="sm" onClick={() => accion(() => contactoPrincipal(datos.id, c.id))} disabled={trabajando}><Star data-icon="inline-start" />Hacer principal</Button>}
        <Button type="button" variant="outline" size="sm" onClick={() => setBorrar(c)} disabled={trabajando} className="text-peligro"><Trash2 data-icon="inline-start" />Eliminar</Button>
      </span>
    </li>)}</ul> : <p className="rounded-tile border border-dashed border-dte-linea px-3 py-3 text-center text-sm text-dte-gris">Sin contactos cargados.</p>}
    {error && <ErrorBox message={error} />}
    <Button type="button" onClick={() => setEditando('nuevo')} className="w-full bg-dte-petroleo hover:bg-dte-petroleo-oscuro sm:self-end sm:w-auto"><Plus data-icon="inline-start" />Agregar contacto</Button>
    <Confirmar abierto={!!borrar} titulo="¿Eliminar este contacto?" descripcion={borrar ? `${resumenContacto(borrar)}. Queda anotado en el historial de la escuela.` : ''} accion="Eliminar" peligro onCerrar={() => setBorrar(null)} onConfirmar={() => borrar && accion(() => borrarContacto(datos.id, borrar.id))} />
  </div>
}

function FormContacto({ escuelaId, contacto, onCancelar, onGuardado }: { escuelaId: string, contacto: ContactoEditable | null, onCancelar: () => void, onGuardado: () => Promise<unknown> }) {
  const [f, setF] = useState<ContactoInput>(() => contacto ? { nombre: contacto.nombre ?? '', apellido: contacto.apellido ?? '', cargo: contacto.cargo ?? '', telefono: contacto.telefono ?? '', correo: contacto.correo ?? '', correo_laboral: contacto.correo_laboral ?? '' } : VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof ContactoInput) => (e: React.ChangeEvent<HTMLInputElement>) => setF(x => ({ ...x, [k]: e.target.value }))
  async function guardar() {
    setGuardando(true); setError('')
    try { await guardarContacto(escuelaId, contacto?.id ?? null, f); await onGuardado() } catch (e) { setError(errMsg(e)); setGuardando(false) }
  }
  return <form onSubmit={e => { e.preventDefault(); guardar() }} className="flex flex-col gap-3">
    <h3 className="text-sm font-bold">{contacto ? 'Editar contacto' : 'Agregar contacto'}</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre"><Input value={f.nombre ?? ''} onChange={set('nombre')} maxLength={100} autoComplete="off" className="h-11 md:h-9" /></Field>
      <Field label="Apellido"><Input value={f.apellido ?? ''} onChange={set('apellido')} maxLength={100} autoComplete="off" className="h-11 md:h-9" /></Field>
      <Field label="Cargo" className="sm:col-span-2"><Input value={f.cargo ?? ''} onChange={set('cargo')} maxLength={100} placeholder="Ej.: Director/a" autoComplete="off" className="h-11 md:h-9" /></Field>
      <Field label="Teléfono"><Input value={f.telefono ?? ''} onChange={set('telefono')} inputMode="tel" maxLength={30} autoComplete="off" className="h-11 md:h-9" /></Field>
      <Field label="Correo"><Input value={f.correo ?? ''} onChange={set('correo')} type="email" maxLength={120} autoComplete="off" className="h-11 md:h-9" /></Field>
      <Field label="Correo laboral" hint={`(termina en ${DOMINIO_LABORAL})`} className="sm:col-span-2"><Input value={f.correo_laboral ?? ''} onChange={set('correo_laboral')} type="email" maxLength={120} autoComplete="off" className="h-11 md:h-9" /></Field>
    </div>
    {error && <ErrorBox message={error} />}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancelar} disabled={guardando}>Cancelar</Button><Button type="submit" disabled={guardando} className="bg-dte-petroleo hover:bg-dte-petroleo-oscuro">{guardando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}Guardar</Button></div>
  </form>
}

function Historial({ datos }: { datos: EdicionEscuela }) {
  if (!datos.historial.length) return <p className="rounded-tile border border-dashed border-dte-linea px-3 py-3 text-center text-sm text-dte-gris">Todavía no hay cambios registrados en esta escuela.</p>
  return <ul className="divide-y divide-dte-linea overflow-hidden rounded-tile border border-dte-linea">{datos.historial.map(h => <li key={h.id} className="flex flex-col gap-0.5 px-3 py-2.5">
    <span className="text-xs text-dte-gris">{hora(h.created_at)} · {h.autor ?? 'Sin autor registrado'} · {h.seccion}</span>
    <span className="break-words text-sm"><span className="font-semibold">{h.campo}:</span> {h.valor_anterior ?? <em className="text-dte-gris">vacío</em>} → {h.valor_nuevo ?? <em className="text-dte-gris">vacío</em>}</span>
  </li>)}</ul>
}

// Botón de la ficha que abre la edición. Al guardar avisa a la ficha para que se recargue.
export function BotonEditar({ id, nombre, onCambio }: { id: string, nombre: string, onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false)
  return <>
    <Button type="button" variant="outline" onClick={() => setAbierto(true)} className="w-full border-white/60 bg-transparent text-white hover:bg-white/15 hover:text-white sm:w-auto"><Pencil data-icon="inline-start" />Editar datos</Button>
    {abierto && <EditarEscuela id={id} nombre={nombre} onClose={() => setAbierto(false)} onCambio={onCambio} />}
  </>
}
