'use client'

import { useEffect, useState } from 'react'
import { Building2, Check, Loader2, Mail, MapPin, Navigation, Pencil, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CAMPOS_ORGANISMO, type Jefatura } from '@/lib/organismos'
import { titleCase } from '@/lib/format'
import { Field } from '@/components/app/formulario'
import { ErrorBox, Skeleton, errMsg, getJefatura, guardarJefatura } from '@/components/app/comun'
import { MapaChico } from '@/components/app/mapabase'

const texto = (v: string | number | null | undefined) => (v == null || String(v).trim() === '' ? '' : String(v))

// Ficha de una jefatura (regional o distrital): datos de contacto para llamar o escribir y su ubicación en el mapa. La edita el CED o la administración.
export function FichaJefatura({ id, onClose }: { id: string, onClose: () => void }) {
  const [j, setJ] = useState<Jefatura | null>(null)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(false)
  useEffect(() => { getJefatura(id).then(setJ).catch(e => setError(errMsg(e))) }, [id])
  return <Dialog open onOpenChange={o => !o && onClose()}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white max-sm:top-[calc(env(safe-area-inset-top,0px)+0.5rem)]! max-sm:bottom-auto! max-sm:max-h-[calc(100dvh-1rem)]! max-sm:rounded-b-2xl! max-sm:pb-4! sm:max-w-xl">
      <DialogTitle className="flex items-center gap-2"><Building2 className="size-5 text-dte-violeta" aria-hidden />{j?.subtipo ?? 'Jefatura'}</DialogTitle>
      <DialogDescription className="break-words">{j ? titleCase(j.nombre.replace('|', '·')) : 'Datos de contacto y ubicación.'}</DialogDescription>
      {error ? <ErrorBox message={error} />
        : !j ? <div className="flex flex-col gap-3"><Skeleton className="h-10" /><Skeleton className="h-32" /></div>
        : editando ? <FormJefatura j={j} onCancelar={() => setEditando(false)} onGuardada={async () => { setJ(await getJefatura(id)); setEditando(false) }} />
        : <Vista j={j} onEditar={() => setEditando(true)} />}
    </DialogContent>
  </Dialog>
}

function Vista({ j, onEditar }: { j: Jefatura, onEditar: () => void }) {
  const v = j.valores, lat = v.latitud == null ? null : Number(v.latitud), lon = v.longitud == null ? null : Number(v.longitud)
  const contacto = [v.contacto_nombre, v.contacto_apellido].filter(Boolean).join(' ')
  const filas: [string, string][] = [['Distrito', texto(j.distrito)], ['Domicilio', [texto(v.domicilio), texto(v.localidad)].filter(Boolean).join(', ')], ['Contacto', [contacto, texto(v.contacto_cargo)].filter(Boolean).join(' · ')], ['Observaciones', texto(v.observaciones)]]
  return <div className="flex flex-col gap-4">
    <dl className="grid gap-2 sm:grid-cols-2">{filas.filter(([, x]) => x).map(([l, x]) => <div key={l} className="min-w-0 sm:last:col-span-2"><dt className="text-xs font-semibold text-dte-gris">{l}</dt><dd className="break-words text-sm font-medium">{x}</dd></div>)}</dl>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {v.telefono && <a href={`tel:${v.telefono}`} className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-dte-petroleo underline underline-offset-2"><Phone className="size-4" aria-hidden />{v.telefono}</a>}
      {v.email && <a href={`mailto:${v.email}`} className="inline-flex min-h-10 items-center gap-1.5 break-all font-semibold text-dte-petroleo underline underline-offset-2"><Mail className="size-4" aria-hidden />{v.email}</a>}
      {lat != null && lon != null && <a href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-dte-petroleo underline underline-offset-2"><Navigation className="size-4" aria-hidden />Cómo llegar</a>}
    </div>
    {lat != null && lon != null ? <MapaChico lat={lat} lon={lon} nombre={j.nombre} /> : <p className="flex items-center gap-1.5 rounded-tile border border-dashed border-dte-linea px-3 py-3 text-sm text-dte-gris"><MapPin className="size-4" aria-hidden />Sin ubicación en el mapa.</p>}
    {j.puedeEditar && <Button type="button" variant="outline" onClick={onEditar} className="w-full sm:w-auto sm:self-end"><Pencil data-icon="inline-start" />Editar jefatura</Button>}
  </div>
}

function FormJefatura({ j, onCancelar, onGuardada }: { j: Jefatura, onCancelar: () => void, onGuardada: () => Promise<unknown> }) {
  const inicial = Object.fromEntries(CAMPOS_ORGANISMO.map(c => [c.clave, texto(j.valores[c.clave])]))
  const [f, setF] = useState<Record<string, string>>(inicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const cambios = CAMPOS_ORGANISMO.filter(c => f[c.clave] !== inicial[c.clave])
  const poner = (k: string, v: string) => {
    // Pegar "lat, lon" (como lo da Google Maps) completa las dos casillas.
    const par = k === 'latitud' ? v.match(/^\s*(-?\d+\.\d+)\s*[, ]\s*(-?\d+\.\d+)\s*$/) : null
    setF(x => (par ? { ...x, latitud: par[1], longitud: par[2] } : { ...x, [k]: v }))
  }
  async function guardar() {
    setGuardando(true); setError('')
    try { await guardarJefatura(j.id, Object.fromEntries(cambios.map(c => [c.clave, f[c.clave]]))); await onGuardada() } catch (e) { setError(errMsg(e)); setGuardando(false) }
  }
  return <form onSubmit={e => { e.preventDefault(); guardar() }} className="flex flex-col gap-3">
    <div className="grid gap-3 sm:grid-cols-2">
      {CAMPOS_ORGANISMO.map(c => <Field key={c.clave} label={c.label} className={c.tipo === 'largo' || c.clave === 'domicilio' ? 'sm:col-span-2' : ''}>
        {c.tipo === 'largo' ? <Textarea value={f[c.clave]} onChange={e => poner(c.clave, e.target.value)} maxLength={c.max} className="min-h-20" />
          : <Input value={f[c.clave]} onChange={e => poner(c.clave, e.target.value)} maxLength={c.max} inputMode={c.tipo === 'telefono' ? 'tel' : c.tipo === 'decimal' ? 'decimal' : undefined} type={c.tipo === 'correo' ? 'email' : 'text'} className="h-11 md:h-9" />}
      </Field>)}
    </div>
    <p className="text-xs text-dte-gris">Para la latitud y la longitud podés pegar el par que te da Google Maps (por ejemplo -34.92145, -57.95500) en la casilla de latitud.</p>
    {error && <ErrorBox message={error} />}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancelar} disabled={guardando}>Cancelar</Button><Button type="submit" disabled={guardando || !cambios.length} className="bg-dte-petroleo hover:bg-dte-petroleo-oscuro">{guardando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}Guardar cambios{cambios.length > 0 && ` (${cambios.length})`}</Button></div>
  </form>
}
