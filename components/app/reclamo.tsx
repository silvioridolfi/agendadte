'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, Mail, Paperclip, Phone, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { type School } from '@/lib/agenda'
import { DATOS_VACIOS, DOC_BUSCADOR_CUE, ENLACE_LABEL, SUBTIPOS_INSTALACION, TIPOS, armarReclamo, avisoEspecial, enlacesDe, faltantes, gmailUrl, tienePiso, tipoDe, type DatosReclamo, type Enlace, type EscuelaConectividad, type Reclamo } from '@/lib/reclamos'
import { titleCase } from '@/lib/format'
import { ErrorBox, errMsg, getConectividadEscuela, selectClass } from '@/components/app/comun'
import { Field, SchoolPicker } from '@/components/app/formulario'

type Errores = ReturnType<typeof faltantes>

// Reclamo de conectividad: con la escuela y el tipo de reclamo arma el asunto, el cuerpo del mail y la lista de adjuntos según la guía de la DTE.
// `cuenta`: correo institucional con el que se inició sesión (Gmail se abre con esa cuenta). `ced`: nombre de pila del CED, a quien va dirigido el mensaje.
export function ReclamoConectividad({ open, onClose, cuenta, ced, escuelaInicial }: { open: boolean, onClose: () => void, cuenta: string, ced: string | null, escuelaInicial: School | null }) {
  const [escuela, setEscuela] = useState<School | null>(escuelaInicial)
  const [con, setCon] = useState<EscuelaConectividad | null>(null)
  const [cargando, setCargando] = useState(!!escuelaInicial)
  const [error, setError] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [d, setD] = useState<DatosReclamo>(DATOS_VACIOS)
  const [errores, setErrores] = useState<Errores>({})
  const [reclamo, setReclamo] = useState<Reclamo | null>(null)
  const [copiado, setCopiado] = useState('')

  // Escuela que viene elegida (desde su ficha o desde una acción de conectividad): se cargan sus datos al abrir.
  useEffect(() => {
    if (!escuelaInicial) return
    let vivo = true
    getConectividadEscuela(escuelaInicial.id).then(c => { if (vivo) setCon(c) }).catch(e => { if (vivo) setError(errMsg(e)) }).finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [escuelaInicial])

  const elegir = (s: School | null) => {
    setEscuela(s); setCon(null); setError(''); setReclamo(null); setErrores({}); setD(DATOS_VACIOS); setTipoId('')
    if (!s) return
    setCargando(true)
    getConectividadEscuela(s.id).then(setCon).catch(e => setError(errMsg(e))).finally(() => setCargando(false))
  }
  const enlaces = con ? enlacesDe(con.plan_enlace, con.subplan_enlace) : []
  const tipo = tipoDe(tipoId)
  const set = <K extends keyof DatosReclamo>(k: K, v: DatosReclamo[K]) => { setD(x => ({ ...x, [k]: v })); setReclamo(null); setErrores(e => ({ ...e, [k]: undefined })) }
  const elegirTipo = (id: string) => {
    setTipoId(id); setReclamo(null); setErrores({})
    const t = tipoDe(id)
    setD(x => ({ ...x, subtipo: '', matricula: t?.campos.includes('matricula') && !x.matricula && con?.matricula ? String(con.matricula) : x.matricula, enlace: enlaces.length === 1 ? enlaces[0] : x.enlace }))
  }
  const enlaceElegido = d.enlace ?? (enlaces.length === 1 ? enlaces[0] : null)
  const datos: DatosReclamo = { ...d, enlace: enlaceElegido }
  const porTelefonoSeleccionado = tipoId === 'sin_conectividad' && enlaceElegido === 'PBA1' && d.proveedorG1 === 'Movistar'

  function armar() {
    if (!con || !tipo) return
    const f = faltantes(tipo, con, datos)
    setErrores(f)
    if (Object.keys(f).length) return
    setReclamo(armarReclamo(con, tipo, datos, new Date(), ced))
  }
  async function copiar(texto: string, clave: string) {
    try { await navigator.clipboard.writeText(texto); setCopiado(clave); setTimeout(() => setCopiado(c => (c === clave ? '' : c)), 2000) } catch { setError('No se pudo copiar: seleccioná el texto y copialo a mano.') }
  }
  const cerrar = () => onClose()
  const contactoPide = !!tipo && (tipo.contacto === 'siempre' || (tipo.contacto === 'pba' && !!enlaceElegido && enlaceElegido !== 'PNCE'))

  return <Dialog open={open} onOpenChange={o => !o && cerrar()}>
    {/* En el celular se ancla arriba: abajo el teclado taparía los campos. */}
    <DialogContent className="overflow-y-auto bg-white max-sm:top-[calc(env(safe-area-inset-top,0px)+0.5rem)]! max-sm:bottom-auto! max-sm:max-h-[calc(100dvh-1rem)]! max-sm:rounded-b-2xl! max-sm:pb-4! sm:max-w-xl">
      <DialogTitle className="flex items-center gap-2"><Wifi className="size-5 text-dte-petroleo" aria-hidden />Reclamo de conectividad</DialogTitle>
      <DialogDescription className="text-sm text-dte-gris">Elegí la escuela y el tipo de reclamo: se arma el asunto, el cuerpo del mail y la lista de lo que hay que adjuntar, según la guía de la DTE.</DialogDescription>

      <div className="flex flex-col gap-1.5"><span className="text-sm font-semibold">1. Escuela</span><SchoolPicker value={escuela} onChange={elegir} /></div>
      {cargando && <div className="flex items-center gap-2 text-sm text-dte-gris"><Loader2 className="size-4 animate-spin" aria-hidden />Buscando los datos de conectividad…</div>}
      {error && <ErrorBox message={error} />}

      {con && <>
        <section className="rounded-card border-l-4 border-l-accion-asistencia-remota-punto bg-accion-asistencia-remota p-3.5 text-sm">
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-accion-asistencia-remota-texto">Infraestructura de conectividad</h3>
          <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-dte-gris">Enlace</dt><dd className="font-medium">{enlaces.length ? enlaces.map(e => ENLACE_LABEL[e]).join(' + ') : 'Sin enlace cargado'}{(con.proveedor_pnce || con.proveedor_pba) && <span className="font-normal text-dte-gris"> · {[enlaces.includes('PNCE') ? con.proveedor_pnce : null, enlaces.some(e => e !== 'PNCE') ? con.proveedor_pba : null].filter(Boolean).join(' / ')}</span>}</dd></div>
            <div><dt className="text-xs font-semibold text-dte-gris">Piso tecnológico</dt><dd className="font-medium">{tienePiso(con) ? `${con.plan_piso_tecnologico}${con.tipo_piso_instalado ? ` · ${con.tipo_piso_instalado.replace(/\s*-\s*Instalada$/i, '')}` : ''}` : 'Sin piso'}</dd></div>
          </dl>
          <p className="mt-1.5 text-xs text-dte-gris">Datos de la base de conectividad de la región; si algo no coincide con lo que ves en la escuela, corregilo en el cuerpo del mail.</p>
          {avisoEspecial(con) && <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-aviso-fuerte"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />{avisoEspecial(con)}</p>}
        </section>
        {errores.escuela && <p role="alert" className="text-sm font-medium text-peligro">{errores.escuela}</p>}

        <Field label="2. Tipo de reclamo" required>
          <select className={`${selectClass} h-11 md:h-10`} value={tipoId} onChange={e => elegirTipo(e.target.value)}>
            <option value="">Elegí…</option>
            <optgroup label="Problemas">{TIPOS.filter(t => t.grupo === 'problemas').map(t => <option key={t.id} value={t.id}>{t.asunto}</option>)}</optgroup>
            <optgroup label="Pedidos y cambios">{TIPOS.filter(t => t.grupo === 'pedidos').map(t => <option key={t.id} value={t.id}>{t.asunto}</option>)}</optgroup>
          </select>
          {tipo && <span className="text-xs text-dte-gris">{tipo.cuando}</span>}
        </Field>

        {tipo && <>
          {enlaces.length > 1 && <Field label="¿Qué enlace tiene el problema?" required error={errores.enlace}><select className={`${selectClass} h-11 md:h-10`} value={d.enlace ?? ''} onChange={e => set('enlace', (e.target.value || null) as Enlace | null)}><option value="">Elegí…</option>{enlaces.map(e => <option key={e} value={e}>{ENLACE_LABEL[e]}</option>)}</select></Field>}
          {enlaces.length === 0 && errores.enlace && <p role="alert" className="text-sm font-medium text-peligro">{errores.enlace}</p>}
          {enlaceElegido === 'PBA1' && tipo.id === 'sin_conectividad' && <Field label="Proveedor del enlace (PBA Grupo 1)" required error={errores.proveedor}><select className={`${selectClass} h-11 md:h-10`} value={d.proveedorG1 ?? ''} onChange={e => set('proveedorG1', (e.target.value || null) as DatosReclamo['proveedorG1'])}><option value="">Elegí…</option><option>Movistar</option><option>Claro</option></select></Field>}

          {tipo.campos.includes('subtipo') && <Field label="Caso" required error={errores.subtipo}><select className={`${selectClass} h-11 md:h-10`} value={d.subtipo} onChange={e => set('subtipo', e.target.value)}><option value="">Elegí…</option>{SUBTIPOS_INSTALACION.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>}
          {tipo.campos.includes('fechaCronograma') && <Field label="Fecha en la que tendrían que haber visitado el establecimiento" required error={errores.fechaCronograma}><Input type="date" value={d.fechaCronograma} onChange={e => set('fechaCronograma', e.target.value)} className="h-11 md:h-10" /></Field>}
          {(tipo.campos.includes('aulas') || tipo.campos.includes('matricula')) && <div className="grid gap-3 sm:grid-cols-2">
            {tipo.campos.includes('aulas') && <Field label="Cantidad de aulas" required error={errores.aulas}><Input inputMode="numeric" value={d.aulas} onChange={e => set('aulas', e.target.value.replace(/\D/g, ''))} className="h-11 md:h-10" /></Field>}
            {tipo.campos.includes('matricula') && <Field label="Matrícula del establecimiento" required error={errores.matricula}><Input inputMode="numeric" value={d.matricula} onChange={e => set('matricula', e.target.value.replace(/\D/g, ''))} className="h-11 md:h-10" /></Field>}
          </div>}
          {tipo.campos.includes('direccion') && <Field label="Dirección correcta" required error={errores.direccion}><Input value={d.direccion} onChange={e => set('direccion', e.target.value)} placeholder={con.direccion ? `Figura: ${titleCase(con.direccion)}` : undefined} className="h-11 md:h-10" /></Field>}
          {tipo.campos.includes('coordenadas') && <Field label="Coordenadas geográficas" required error={errores.coordenadas}><Input value={d.coordenadas} onChange={e => set('coordenadas', e.target.value)} placeholder="Ej.: -34.9205, -57.9536" className="h-11 md:h-10" /></Field>}
          {tipo.campos.includes('serie') && <Field label="N° de serie del equipamiento" hint="(si lo tenés)"><Input value={d.serie} onChange={e => set('serie', e.target.value)} className="h-11 md:h-10" /></Field>}
          {tipo.campos.includes('detalle') && <Field label={tipo.id === 'instaladores' ? 'Explicá la situación' : 'Descripción'} required={tipo.requeridos.includes('detalle')} hint={tipo.requeridos.includes('detalle') ? undefined : '(opcional)'} error={errores.detalle}><Textarea value={d.detalle} onChange={e => set('detalle', e.target.value)} placeholder="Qué pasa, desde cuándo y qué se probó" className="min-h-20" /></Field>}

          {!porTelefonoSeleccionado && <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-sm font-semibold">Contacto del directivo o jerárquico{contactoPide ? <span className="text-dte-magenta" aria-hidden> *</span> : <span className="ml-1 text-xs font-normal text-dte-gris">(opcional)</span>}</legend>
            <div className="grid gap-2 sm:grid-cols-2"><Input placeholder="Nombre y apellido" aria-label="Nombre del contacto" value={d.contactoNombre} onChange={e => set('contactoNombre', e.target.value)} className="h-11 md:h-10" />
              <Input list="cargos-contacto" placeholder="Cargo (director/a, secretario/a…)" aria-label="Cargo del contacto" value={d.contactoCargo} onChange={e => set('contactoCargo', e.target.value)} className="h-11 md:h-10" /><datalist id="cargos-contacto"><option value="Director/a" /><option value="Vicedirector/a" /><option value="Secretario/a" /><option value="Prosecretario/a" /><option value="Jefe/a de área" /><option value="Referente técnico" /></datalist>
              <Input type="tel" placeholder="Teléfono" aria-label="Teléfono del contacto" value={d.contactoTelefono} onChange={e => set('contactoTelefono', e.target.value)} className="h-11 md:h-10" /></div>
            <Input placeholder="Horario en que se puede llamar (ej.: 8 a 16)" aria-label="Horario del contacto" value={d.contactoHorario} onChange={e => set('contactoHorario', e.target.value)} className="h-11 md:h-10" />
            {errores.contacto && <p role="alert" className="text-sm font-medium text-peligro">{errores.contacto}</p>}
          </fieldset>}

          <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" onClick={armar} className="w-full sm:w-auto"><Mail data-icon="inline-start" />Armar reclamo</Button><Button type="button" variant="outline" onClick={cerrar} className="w-full sm:w-auto">Cancelar</Button></div>
        </>}

        {reclamo && <section aria-live="polite" className="flex flex-col gap-3 border-t border-dte-linea pt-4">
          <h3 className="text-sm font-semibold">3. Reclamo listo</h3>
          {reclamo.avisos.map(a => <p key={a} className="flex items-start gap-1.5 rounded-control bg-aviso-fondo-fuerte px-3 py-2 text-xs font-semibold text-aviso-fuerte"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />{a}</p>)}
          {reclamo.porTelefono ? <div className="rounded-card border-l-4 border-l-aviso-borde bg-aviso-fondo p-3.5 text-sm">
            <p className="flex items-center gap-1.5 font-bold"><Phone className="size-4" aria-hidden />Este reclamo no va por mail</p>
            <p className="mt-1">PBA Grupo 1 con Movistar: el establecimiento tiene que llamar al <b>{reclamo.porTelefono.telefono}</b> e indicar los ID de la escuela.</p>
            {reclamo.porTelefono.datos.length ? <ul className="mt-2 flex flex-col gap-1">{reclamo.porTelefono.datos.map(x => <li key={x.label}><span className="text-xs text-dte-gris">{x.label}: </span><b className="tabular-nums">{x.valor}</b></li>)}</ul> : <p className="mt-2 text-xs text-dte-gris">No hay ID cargados para esta escuela: buscalos en el consolidado de la región (columnas AQ, AR y AS).</p>}
          </div> : <>
            <div className="flex flex-col gap-1"><span className="text-xs font-semibold text-dte-gris">Para</span><div className="flex items-center justify-between gap-2 rounded-control bg-dte-fondo px-3 py-2 text-sm"><span className="min-w-0 break-all font-medium">{reclamo.para}</span><Button type="button" variant="ghost" size="sm" onClick={() => copiar(reclamo.para!, 'para')}>{copiado === 'para' ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado === 'para' ? 'Copiado' : 'Copiar'}</Button></div></div>
            <div className="flex flex-col gap-1"><span className="text-xs font-semibold text-dte-gris">Asunto</span><div className="flex items-start justify-between gap-2 rounded-control bg-dte-fondo px-3 py-2 text-sm"><span className="min-w-0 break-words font-mono text-[0.8125rem] font-medium">{reclamo.asunto}</span><Button type="button" variant="ghost" size="sm" onClick={() => copiar(reclamo.asunto, 'asunto')}>{copiado === 'asunto' ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado === 'asunto' ? 'Copiado' : 'Copiar'}</Button></div></div>
            <div className="flex flex-col gap-1"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-dte-gris">Cuerpo del mail</span><Button type="button" variant="ghost" size="sm" onClick={() => copiar(reclamo.cuerpo, 'cuerpo')}>{copiado === 'cuerpo' ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado === 'cuerpo' ? 'Copiado' : 'Copiar'}</Button></div><pre className="whitespace-pre-wrap break-words rounded-control bg-dte-fondo px-3 py-2.5 font-sans text-sm leading-relaxed">{reclamo.cuerpo}</pre></div>
            {reclamo.adjuntos.length > 0 && <div className="rounded-card border-l-4 border-l-club-lila bg-club-violeta-fondo p-3.5"><h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-club-violeta"><Paperclip className="size-3.5" aria-hidden />Adjuntá al mail</h4>
              <ul className="flex flex-col gap-1 text-sm">{reclamo.adjuntos.map(a => <li key={a.texto} className="flex flex-wrap items-center gap-x-2">{a.texto}{a.enlace && <a href={a.enlace} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-dte-petroleo underline underline-offset-2">Abrir modelo<ExternalLink className="size-3" aria-hidden /></a>}</li>)}</ul></div>}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <a href={gmailUrl(reclamo, cuenta)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control bg-dte-petroleo px-4 text-sm font-semibold text-white transition hover:bg-dte-petroleo-oscuro md:min-h-9"><Mail className="size-4" aria-hidden />Abrir en mi correo ({cuenta})</a>
              <Button type="button" variant="outline" onClick={cerrar} className="min-h-11 md:min-h-9">Cancelar</Button>
            </div>
            <p className="text-xs text-dte-gris">El mensaje va al correo regional y de ahí lo deriva el CED. Se abre con tu cuenta institucional; los archivos los adjuntás vos. El asunto lleva la hora de este momento: si lo enviás más tarde, volvé a armarlo. Si la escuela ya tiene un reclamo abierto, <b>no abras una cadena nueva</b>: respondé en la original (sin el “Fwd” antes del código). <a href={DOC_BUSCADOR_CUE} target="_blank" rel="noopener noreferrer" className="font-semibold text-dte-petroleo underline underline-offset-2">Buscar reclamos anteriores por CUE</a>.</p>
          </>}
        </section>}
      </>}
    </DialogContent>
  </Dialog>
}
