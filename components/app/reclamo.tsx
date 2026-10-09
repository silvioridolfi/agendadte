'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, ClipboardList, Copy, ExternalLink, Loader2, Mail, Paperclip, Phone, Wifi, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { type School } from '@/lib/agenda'
import { DATOS_VACIOS, DOC_BUSCADOR_CUE, ENLACE_LABEL, SUBTIPOS_INSTALACION, TIPOS, armarReclamo, avisoEspecial, directivoDe, enlacesDe, faltantes, llevaChecklist, nombreContacto, puedeSerAmbos, gmailAppUrl, gmailUrl, plataformaDe, tienePiso, tipoDe, type DatosReclamo, type Enlace, type EscuelaConectividad, type Reclamo } from '@/lib/reclamos'
import { titleCase } from '@/lib/format'
import { ESTADO_RECLAMO_LABEL, type Reclamo as ReclamoRegistrado } from '@/lib/reclamos-registro'
import { ErrorBox, errMsg, getConectividadEscuela, guardarBorradorReclamo, reclamosAbiertosDe, registrarReclamo, selectClass } from '@/components/app/comun'
import { Field, SchoolPicker } from '@/components/app/formulario'

type Errores = ReturnType<typeof faltantes>

// Reclamo de conectividad: con el establecimiento y el tipo de reclamo arma el asunto, el cuerpo del mail y la lista de adjuntos según la guía de la DTE.
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
  // Al cargar el establecimiento se precarga el contacto del directivo desde la base (se puede cambiar o editar).
  const recibir = (c: EscuelaConectividad) => {
    setCon(c)
    const dir = directivoDe(c.contactos)
    if (dir) setD(x => (x.contactoNombre || x.contactoTelefono ? x : { ...x, contactoNombre: nombreContacto(dir), contactoCargo: (dir.cargo ?? '').trim(), contactoTelefono: (dir.telefono ?? '').trim() }))
  }
  // Reclamos que el establecimiento ya tiene abiertos (para seguir esa cadena) y registro del reclamo armado.
  const [abiertos, setAbiertos] = useState<ReclamoRegistrado[]>([])
  const [registrando, setRegistrando] = useState(false)
  const [registrado, setRegistrado] = useState(false)
  // Asunto del reclamo que ya quedó guardado en borradores (el asunto lleva la hora, así que identifica este armado).
  const [borradorAsunto, setBorradorAsunto] = useState('')
  const [guardando, setGuardando] = useState(false)
  // El mensaje se puede adaptar: el texto editado vale mientras el mensaje armado sea el mismo (si se vuelve a armar, parte del nuevo).
  const [edicion, setEdicion] = useState<{ base: string, texto: string } | null>(null)

  // Establecimiento que viene elegido (desde su ficha o desde una acción de conectividad): se cargan sus datos al abrir.
  useEffect(() => {
    if (!escuelaInicial) return
    let vivo = true
    reclamosAbiertosDe(escuelaInicial.id).then(a => { if (vivo) setAbiertos(a) }).catch(() => {})
    getConectividadEscuela(escuelaInicial.id).then(c => { if (vivo) recibir(c) }).catch(e => { if (vivo) setError(errMsg(e)) }).finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [escuelaInicial])

  const elegir = (s: School | null) => {
    setEscuela(s); setCon(null); setError(''); setReclamo(null); setRegistrado(false); setAbiertos([]); setErrores({}); setD(DATOS_VACIOS); setTipoId('')
    if (!s) return
    setCargando(true)
    reclamosAbiertosDe(s.id).then(setAbiertos).catch(() => {})
    getConectividadEscuela(s.id).then(recibir).catch(e => setError(errMsg(e))).finally(() => setCargando(false))
  }
  const enlaces = con ? enlacesDe(con.plan_enlace, con.subplan_enlace) : []
  const tipo = tipoDe(tipoId)
  const set = <K extends keyof DatosReclamo>(k: K, v: DatosReclamo[K]) => { setD(x => ({ ...x, [k]: v })); setReclamo(null); setRegistrado(false); setErrores(e => ({ ...e, [k]: undefined })) }
  const elegirTipo = (id: string) => {
    setTipoId(id); setReclamo(null); setRegistrado(false); setErrores({})
    const t = tipoDe(id)
    setD(x => ({ ...x, subtipo: '', ambos: false, matricula: t?.campos.includes('matricula') && !x.matricula && con?.matricula ? String(con.matricula) : x.matricula, enlace: enlaces.length === 1 ? enlaces[0] : x.enlace }))
  }
  const enlaceElegido = d.enlace ?? (enlaces.length === 1 ? enlaces[0] : null)
  const datos: DatosReclamo = { ...d, enlace: enlaceElegido }
  const porTelefonoSeleccionado = tipoId === 'sin_conectividad' && enlaceElegido === 'PBA1' && d.proveedorG1 === 'Movistar'

  function armar() {
    if (!con || !tipo) return
    const f = faltantes(tipo, con, datos)
    setErrores(f)
    if (Object.keys(f).length) return
    setRegistrado(false); setReclamo(armarReclamo(con, tipo, datos, new Date(), ced))
  }
  async function registrar() {
    if (!con || !tipo || !reclamo) return
    setRegistrando(true); setError('')
    try { await registrarReclamo({ school_id: con.id, tipo: tipo.id, asunto: reclamo.asunto }); setRegistrado(true) } catch (e) { setError(errMsg(e)) } finally { setRegistrando(false) }
  }
  const cuerpo = reclamo ? (edicion?.base === reclamo.cuerpo ? edicion.texto : reclamo.cuerpo) : ''
  async function guardarBorrador() {
    if (!con || !tipo || !reclamo) return
    setGuardando(true); setError('')
    try { await guardarBorradorReclamo({ school_id: con.id, tipo: tipo.id, asunto: reclamo.asunto, para: reclamo.para, cuerpo, adjuntos: reclamo.adjuntos }); setBorradorAsunto(`${reclamo.asunto}\n${cuerpo}`) } catch (e) { setError(errMsg(e)) } finally { setGuardando(false) }
  }
  async function copiar(texto: string, clave: string) {
    try { await navigator.clipboard.writeText(texto); setCopiado(clave); setTimeout(() => setCopiado(c => (c === clave ? '' : c)), 2000) } catch { setError('No se pudo copiar: seleccioná el texto y copialo a mano.') }
  }
  const cerrar = () => onClose()
  // Con checklist adjunto, el checklist ya pide los datos de contacto: no se piden ni van en el mensaje.
  const conChecklist = !!con && !!tipo && llevaChecklist(tipo, con, datos)
  const contactoPide = !!tipo && !conChecklist && (tipo.contacto === 'siempre' || (tipo.contacto === 'pba' && !!enlaceElegido && enlaceElegido !== 'PNCE'))
  const cargarContacto = (c: { nombre: string | null, apellido: string | null, cargo: string | null, telefono: string | null }) => { setD(x => ({ ...x, contactoNombre: nombreContacto(c), contactoCargo: (c.cargo ?? '').trim(), contactoTelefono: (c.telefono ?? '').trim() })); setReclamo(null); setRegistrado(false); setErrores(e => ({ ...e, contacto: undefined })) }

  return <Dialog open={open} onOpenChange={o => !o && cerrar()}>
    {/* En el celular se ancla arriba: abajo el teclado taparía los campos. */}
    <DialogContent className="overflow-y-auto bg-white max-sm:top-[calc(env(safe-area-inset-top,0px)+0.5rem)]! max-sm:bottom-auto! max-sm:max-h-[calc(100dvh-1rem)]! max-sm:rounded-b-2xl! max-sm:pb-4! sm:max-w-xl">
      <DialogTitle className="flex items-center gap-2"><Wifi className="size-5 text-dte-petroleo" aria-hidden />Reclamo de conectividad</DialogTitle>
      <DialogDescription className="text-sm text-dte-gris">Elegí el establecimiento y el tipo de reclamo: se arma el asunto, el cuerpo del mail y la lista de lo que hay que adjuntar, según la guía de la DTE.</DialogDescription>

      <div className="flex flex-col gap-1.5"><span className="text-sm font-semibold">1. Establecimiento</span><SchoolPicker enLinea value={escuela} onChange={elegir} /></div>
      {cargando && <div className="flex items-center gap-2 text-sm text-dte-gris"><Loader2 className="size-4 animate-spin" aria-hidden />Buscando los datos de conectividad…</div>}
      {error && <ErrorBox message={error} />}

      {con && <>
        {abiertos.length > 0 && <section role="status" className="rounded-card border-l-4 border-l-aviso-borde bg-aviso-fondo p-3.5 text-sm">
          <h3 className="mb-1 flex items-center gap-1.5 font-bold text-aviso-fuerte"><AlertTriangle className="size-4" aria-hidden />Este establecimiento ya tiene {abiertos.length === 1 ? 'un reclamo abierto' : `${abiertos.length} reclamos abiertos`}</h3>
          <p className="text-xs">No abras una cadena nueva: seguí la original (respondé ese mail, sin el “Fwd” antes del código) o consultá con el CED.</p>
          <ul className="mt-2 flex flex-col gap-1.5">{abiertos.map(a => <li key={a.id} className="rounded-control bg-white/70 px-2.5 py-1.5"><span className="block break-words font-mono text-[0.75rem] font-medium">{a.asunto}</span><span className="text-xs text-dte-gris">{ESTADO_RECLAMO_LABEL[a.estado]} · enviado el {new Date(a.enviado_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}{a.nro_incidencia ? ` · ${a.nro_incidencia}` : ''}</span></li>)}</ul>
        </section>}
        <section className="rounded-card border-l-4 border-l-accion-asistencia-remota-punto bg-accion-asistencia-remota p-3.5 text-sm">
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-accion-asistencia-remota-texto">Infraestructura de conectividad</h3>
          <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-dte-gris">Enlace</dt><dd className="font-medium">{enlaces.length ? enlaces.map(e => ENLACE_LABEL[e]).join(' + ') : 'Sin enlace cargado'}{(con.proveedor_pnce || con.proveedor_pba) && <span className="font-normal text-dte-gris"> · {[enlaces.includes('PNCE') ? con.proveedor_pnce : null, enlaces.some(e => e !== 'PNCE') ? con.proveedor_pba : null].filter(Boolean).join(' / ')}</span>}</dd></div>
            <div><dt className="text-xs font-semibold text-dte-gris">Piso tecnológico</dt><dd className="font-medium">{tienePiso(con) ? `${con.plan_piso_tecnologico}${con.tipo_piso_instalado ? ` · ${con.tipo_piso_instalado.replace(/\s*-\s*Instalada$/i, '')}` : ''}` : 'Sin piso'}</dd></div>
          </dl>
          <p className="mt-1.5 text-xs text-dte-gris">Datos de la base de conectividad de la región; si algo no coincide con lo que ves en el establecimiento, corregilo en el cuerpo del mail.</p>
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
          {con && puedeSerAmbos(tipo.id, con, enlaceElegido) && !porTelefonoSeleccionado && <label className="flex items-start gap-2.5 rounded-control border border-dte-linea bg-dte-fondo p-2.5 text-sm"><input type="checkbox" checked={d.ambos} onChange={e => set('ambos', e.target.checked)} className="mt-0.5 size-5 shrink-0" /><span>{tipo.id === 'sin_conectividad' ? <>El problema es del enlace y <b>también del piso tecnológico</b> (suma el checklist).</> : <>El problema es del piso y <b>también del enlace</b> (suma la foto del módem).</>}</span></label>}
          {tipo.campos.includes('serie') && <Field label="N° de serie del equipamiento" hint="(si lo tenés)"><Input value={d.serie} onChange={e => set('serie', e.target.value)} className="h-11 md:h-10" /></Field>}
          {tipo.campos.includes('detalle') && <Field label={tipo.id === 'instaladores' ? 'Explicá la situación' : 'Descripción'} required={tipo.requeridos.includes('detalle')} hint={tipo.requeridos.includes('detalle') ? undefined : '(opcional)'} error={errores.detalle}><Textarea value={d.detalle} onChange={e => set('detalle', e.target.value)} placeholder="Qué pasa, desde cuándo y qué se probó" className="min-h-20" /></Field>}

          {!porTelefonoSeleccionado && conChecklist && <p className="text-xs text-dte-gris">El checklist que adjuntás ya pide los datos de contacto del establecimiento: no hace falta incluirlos en el mensaje.</p>}
          {!porTelefonoSeleccionado && !conChecklist && <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-sm font-semibold">Contacto del directivo o jerárquico{contactoPide ? <span className="text-dte-magenta" aria-hidden> *</span> : <span className="ml-1 text-xs font-normal text-dte-gris">(opcional)</span>}</legend>
            {con && con.contactos.length > 1 && <select aria-label="Elegir el contacto de la base" className={`${selectClass} h-11 md:h-10`} value="" onChange={e => { const c = con.contactos[Number(e.target.value)]; if (c) cargarContacto(c) }}><option value="">Elegir otro contacto de la base…</option>{con.contactos.map((c, i) => <option key={i} value={i}>{nombreContacto(c) || 'Sin nombre'}{c.cargo ? ` · ${c.cargo}` : ''}</option>)}</select>}
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
            <p className="mt-1">PBA Grupo 1 con Movistar: el establecimiento tiene que llamar al <b>{reclamo.porTelefono.telefono}</b> e indicar los ID del establecimiento.</p>
            {reclamo.porTelefono.datos.length ? <ul className="mt-2 flex flex-col gap-1">{reclamo.porTelefono.datos.map(x => <li key={x.label}><span className="text-xs text-dte-gris">{x.label}: </span><b className="tabular-nums">{x.valor}</b></li>)}</ul> : <p className="mt-2 text-xs text-dte-gris">No hay ID cargados para esta escuela: buscalos en el consolidado de la región (columnas AQ, AR y AS).</p>}
          </div> : <>
            <div className="flex flex-col gap-1"><span className="text-xs font-semibold text-dte-gris">Para</span><div className="flex items-center justify-between gap-2 rounded-control bg-dte-fondo px-3 py-2 text-sm"><span className="min-w-0 break-all font-medium">{reclamo.para}</span><Button type="button" variant="ghost" size="sm" onClick={() => copiar(reclamo.para!, 'para')}>{copiado === 'para' ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado === 'para' ? 'Copiado' : 'Copiar'}</Button></div></div>
            <div className="flex flex-col gap-1"><span className="text-xs font-semibold text-dte-gris">Asunto</span><div className="flex items-start justify-between gap-2 rounded-control bg-dte-fondo px-3 py-2 text-sm"><span className="min-w-0 break-words font-mono text-[0.8125rem] font-medium">{reclamo.asunto}</span><Button type="button" variant="ghost" size="sm" onClick={() => copiar(reclamo.asunto, 'asunto')}>{copiado === 'asunto' ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado === 'asunto' ? 'Copiado' : 'Copiar'}</Button></div></div>
            <div className="flex flex-col gap-1"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-dte-gris">Cuerpo del mail</span><Button type="button" variant="ghost" size="sm" onClick={() => copiar(cuerpo, 'cuerpo')}>{copiado === 'cuerpo' ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado === 'cuerpo' ? 'Copiado' : 'Copiar'}</Button></div><Textarea aria-label="Cuerpo del mail" value={cuerpo} onChange={e => setEdicion({ base: reclamo.cuerpo, texto: e.target.value })} className="min-h-72 bg-dte-fondo font-sans text-sm leading-relaxed" /><p className="text-xs text-dte-gris">Podés adaptar el texto (el saludo, por ejemplo) antes de copiarlo, abrir el correo o guardarlo en borradores.</p></div>
            {reclamo.adjuntos.length > 0 && <div className="rounded-card border-l-4 border-l-club-lila bg-club-violeta-fondo p-3.5"><h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-club-violeta"><Paperclip className="size-3.5" aria-hidden />Adjuntá al mail</h4>
              <ul className="flex flex-col gap-1 text-sm">{reclamo.adjuntos.map(a => <li key={a.texto} className="flex flex-wrap items-center gap-x-2">{a.texto}{a.enlace && <a href={a.enlace} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-dte-petroleo underline underline-offset-2">Abrir modelo<ExternalLink className="size-3" aria-hidden /></a>}</li>)}</ul></div>}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <a href={gmailUrl({ ...reclamo, cuerpo }, cuenta)} target="_blank" rel="noopener noreferrer" onClick={e => { const p = plataformaDe(navigator.userAgent); if (p === 'otra') return; e.preventDefault(); window.location.href = gmailAppUrl({ ...reclamo, cuerpo }, p, cuenta) }} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control bg-dte-petroleo px-4 text-sm font-semibold text-white transition hover:bg-dte-petroleo-oscuro md:min-h-9"><Mail className="size-4" aria-hidden />Abrir en mi correo ({cuenta})</a>
              <Button type="button" variant="outline" onClick={cerrar} className="min-h-11 border-dte-gris/60 font-semibold text-dte-tinta hover:bg-dte-fondo md:min-h-9"><X className="size-4" aria-hidden />{registrado ? 'Cerrar' : 'Cancelar'}</Button>
            </div>
            {registrado ? <p role="status" className="flex items-start gap-1.5 rounded-control bg-exito-fondo px-3 py-2 text-sm font-semibold text-exito"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />Registrado en el panel de reclamos. El CED va a anotar el número de ticket o de incidencia cuando llegue.</p>
              : <div className="rounded-card border border-dte-linea bg-dte-fondo p-3"><p className="text-xs text-dte-gris">Cuando lo hayas mandado por mail al CED, registralo para llevar el seguimiento.</p><Button type="button" onClick={registrar} disabled={registrando || guardando} className="mt-2 w-full sm:w-auto">{registrando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}Reclamo enviado</Button>
                <div className="mt-3 border-t border-dte-linea pt-3">
                  {borradorAsunto === `${reclamo.asunto}\n${cuerpo}` ? <p role="status" className="flex items-start gap-1.5 text-sm font-semibold text-exito"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />Guardado en borradores. Cuando salga el mail, marcalo como enviado desde el Registro de reclamos.</p>
                    : <><p className="text-xs text-dte-gris">¿Lo dejaste programado o lo vas a mandar después? Guardalo en borradores y marcalo como enviado cuando salga: no se avisa al CED hasta entonces.</p><Button type="button" variant="outline" onClick={guardarBorrador} disabled={guardando || registrando} className="mt-2 w-full sm:w-auto">{guardando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <ClipboardList data-icon="inline-start" />}Guardar en borradores</Button></>}
                </div></div>}
            <p className="text-xs text-dte-gris">El mensaje va al correo regional y de ahí lo deriva el CED. Se abre con tu cuenta institucional (en el celular, en la app de Gmail); los archivos los adjuntás vos. El asunto lleva la hora de este momento: si lo enviás más tarde, volvé a armarlo. Si el establecimiento ya tiene un reclamo abierto, <b>no abras una cadena nueva</b>: respondé en la original (sin el “Fwd” antes del código). <a href={DOC_BUSCADOR_CUE} target="_blank" rel="noopener noreferrer" className="font-semibold text-dte-petroleo underline underline-offset-2">Buscar reclamos anteriores por CUE</a>.</p>
          </>}
        </section>}
      </>}
    </DialogContent>
  </Dialog>
}
