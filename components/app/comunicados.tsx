'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, Loader2, Megaphone, OctagonAlert, Pencil, Plus, Trash2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Confirmar } from '@/components/ui/confirmar'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Fed } from '@/lib/agenda'
import { MAX_TEXTO_COMUNICADO, puedeEliminarComunicado, MAX_TITULO_COMUNICADO, NIVEL_COMUNICADO_LABEL, NIVELES_COMUNICADO, resumenLecturas, tramosConEnlaces, validarComunicado, type EntradaComunicado, type NivelComunicado } from '@/lib/comunicados'
import { hoyAR } from '@/lib/hora'
import { Field } from '@/components/app/formulario'
import { BotonVolver, ErrorBox, Skeleton, crearComunicado, editarComunicado, eliminarComunicado, errMsg, eyebrow, getComunicadosGestion, getComunicadosPendientes, marcarComunicadoLeido, retirarComunicado } from '@/components/app/comun'
import type * as api from '@/app/actions'
import { SelectorFecha } from '@/components/app/selectorfecha'

const fechaHoraAR = (iso: string) => new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
const fechaAR = (aaaammdd: string) => `${aaaammdd.slice(8, 10)}/${aaaammdd.slice(5, 7)}/${aaaammdd.slice(0, 4)}`

// Texto con los enlaces (solo http y https) clickeables, sin HTML.
function TextoConEnlaces({ texto }: { texto: string }) {
  return <>{tramosConEnlaces(texto).map((t, i) => (t.enlace
    ? <a key={i} href={t.enlace} target="_blank" rel="noopener noreferrer" className="break-all font-semibold underline underline-offset-2">{t.texto}</a>
    : <span key={i}>{t.texto}</span>))}</>
}

const ESTILO_BANNER: Record<NivelComunicado, { caja: string, Icono: typeof Info }> = {
  importante: { caja: 'border-peligro-borde bg-peligro-fondo text-peligro', Icono: OctagonAlert },
  informativo: { caja: 'border-pba-celeste/50 bg-pba-celeste/15 text-dte-petroleo', Icono: Info },
}

// Banner arriba de la agenda: el primer comunicado sin leer (los importantes primero). No se cierra con una cruz: se marca como leído.
export function ComunicadosBanner({ reloadKey }: { reloadKey: number }) {
  const [lista, setLista] = useState<api.ComunicadoPendiente[]>([])
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState('')
  const cargar = useCallback(() => { getComunicadosPendientes().then(setLista).catch(() => {}) }, [])
  useEffect(() => {
    cargar()
    const t = setInterval(() => { if (document.visibilityState === 'visible') cargar() }, 60_000)
    const alVolver = () => { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', alVolver); window.addEventListener('focus', alVolver)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); window.removeEventListener('focus', alVolver) }
  }, [cargar, reloadKey])
  const c = lista[0]
  if (!c) return null
  async function leido() {
    setLeyendo(true); setError('')
    try { await marcarComunicadoLeido(c.id); setLista(l => l.filter(x => x.id !== c.id)) } catch (er) { setError(errMsg(er)); cargar() } finally { setLeyendo(false) }
  }
  return <CajaBanner key={c.id} c={c} total={lista.length} leyendo={leyendo} error={error} onLeido={leido} />
}

export function CajaBanner({ c, total, leyendo, error, onLeido }: { c: api.ComunicadoPendiente, total: number, leyendo: boolean, error: string, onLeido: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const e = ESTILO_BANNER[c.nivel]
  return <div role={c.nivel === 'importante' ? 'alert' : 'status'} className={`anim-banner border-b px-4 py-2 text-sm ${e.caja}`}>
    <div className="mx-auto flex max-w-[1440px] items-start justify-between gap-2 lg:px-6">
      <div className="flex min-w-0 items-start gap-1.5">
        <e.Icono className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="break-words text-[0.8125rem] font-bold leading-snug sm:text-sm">{c.titulo}{total > 1 && <span className="font-normal"> · +{total - 1} {total === 2 ? 'comunicado más' : 'comunicados más'}</span>}</p>
          <p className={`whitespace-pre-line break-words text-[0.8125rem] leading-snug sm:text-sm ${abierto ? '' : 'line-clamp-2'}`}><TextoConEnlaces texto={c.texto} /></p>
          <button type="button" onClick={() => setAbierto(a => !a)} aria-expanded={abierto} className="mt-0.5 inline-flex min-h-10 items-center md:min-h-8 gap-1 text-xs font-semibold underline underline-offset-2">{abierto ? 'Ver menos' : 'Ver completo'}<ChevronDown className={`size-3.5 transition ${abierto ? 'rotate-180' : ''}`} aria-hidden /></button>
          {abierto && <p className="text-xs opacity-80">De {c.autor}</p>}
          {error && <p role="alert" className="text-xs font-semibold">{error}</p>}
        </div>
      </div>
      <button type="button" onClick={onLeido} disabled={leyendo} aria-label="Marcar como leído" className="flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-xs font-semibold text-dte-petroleo shadow-e1 hover:bg-dte-tinte disabled:opacity-60 md:min-h-8">{leyendo ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}Leído</button>
    </div>
  </div>
}

const ESTADO_CHIP: Record<api.ComunicadoGestion['estado'], string> = {
  vigente: 'border-exito/30 bg-exito/10 text-exito', vencido: 'border-dte-linea bg-dte-fondo text-dte-gris', retirado: 'border-dte-linea bg-dte-fondo text-dte-gris',
}
const ESTADO_TEXTO = { vigente: 'Vigente', vencido: 'Vencido', retirado: 'Retirado' } as const

// Sección del CED y la administración: enviar comunicados, ver quién los leyó y cuándo, editarlos o retirarlos.
export function Comunicados({ feds, volver }: { feds: Fed[], volver?: { destino: string, ir: () => void } }) {
  const [lista, setLista] = useState<api.ComunicadoGestion[] | null>(null)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState<api.ComunicadoGestion | 'nuevo' | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [aRetirar, setARetirar] = useState<api.ComunicadoGestion | null>(null)
  const [aEliminar, setAEliminar] = useState<api.ComunicadoGestion | null>(null)
  const [mensaje, setMensaje] = useState('')
  const cargar = useCallback(() => { getComunicadosGestion().then(setLista).catch(e => setError(errMsg(e))) }, [])
  useEffect(() => { cargar() }, [cargar])
  async function retirar(c: api.ComunicadoGestion) {
    try { await retirarComunicado(c.id); setMensaje('Se retiró el comunicado'); cargar() } catch (e) { setError(errMsg(e)) }
  }
  async function eliminar(c: api.ComunicadoGestion) {
    try { await eliminarComunicado(c.id); setMensaje('Se eliminó el comunicado'); cargar() } catch (e) { setError(errMsg(e)) }
  }
  return <main className="mx-auto w-full min-w-0 max-w-4xl px-4 pb-32 pt-6 lg:px-10">
    {volver && <BotonVolver onClick={volver.ir} destino={volver.destino} />}
    <p className={eyebrow}>Equipo</p>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold">Comunicados</h2>
      <Button type="button" onClick={() => { setMensaje(''); setEditando('nuevo') }} className="bg-dte-petroleo hover:bg-dte-petroleo-oscuro"><Plus data-icon="inline-start" />Nuevo comunicado</Button></div>
    <p className="mt-1 text-sm text-dte-gris">Avisos importantes para los FED: les aparecen como un banner arriba de la agenda hasta que los marcan como leídos. Acá ves quién los leyó y cuándo.</p>
    {mensaje && <p className="mt-3 rounded-control bg-exito/10 px-3 py-2 text-sm font-semibold text-exito" role="status">{mensaje}</p>}
    {error && <div className="mt-3"><ErrorBox message={error} /></div>}
    {!lista && !error ? <div className="mt-4 flex flex-col gap-2"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      : lista && !lista.length ? <p className="mt-4 rounded-tile border border-dashed border-dte-linea px-3 py-8 text-center text-sm text-dte-gris">Todavía no enviaste ningún comunicado.</p>
      : <ul className="mt-4 flex flex-col gap-2">{(lista ?? []).map(c => {
        const r = resumenLecturas(c.destinatarios), abiertoC = abierto === c.id, vigente = c.estado === 'vigente'
        return <li key={c.id} className="rounded-card border border-dte-linea bg-white shadow-e1">
          <div className="flex flex-col gap-2 p-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${c.nivel === 'importante' ? 'border-peligro-borde bg-peligro-fondo text-peligro' : 'border-pba-celeste/40 bg-pba-celeste/10 text-pba-celeste-texto'}`}>{c.nivel === 'importante' ? <OctagonAlert className="size-3" aria-hidden /> : <Info className="size-3" aria-hidden />}{NIVEL_COMUNICADO_LABEL[c.nivel]}</span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${ESTADO_CHIP[c.estado]}`}>{ESTADO_TEXTO[c.estado]}</span>
              <span className="text-xs text-dte-gris">{fechaHoraAR(c.created_at)} · {c.autor}{c.editado_at && ' · editado'}{c.vence_el && ` · vence el ${fechaAR(c.vence_el)}`}</span>
            </div>
            <p className="break-words text-sm font-bold">{c.titulo}</p>
            <p className="whitespace-pre-line break-words text-sm"><TextoConEnlaces texto={c.texto} /></p>
            <button type="button" onClick={() => setAbierto(abiertoC ? null : c.id)} aria-expanded={abiertoC} className="flex min-h-10 items-center justify-between gap-2 rounded-control bg-dte-fondo px-3 text-left text-sm font-semibold">
              <span>{c.fed_ids ? 'A los FED elegidos' : 'A todos los FED'}: {r.leidos} de {r.total} {r.total === 1 ? 'lo leyó' : 'lo leyeron'}</span><ChevronDown className={`size-4 shrink-0 transition ${abiertoC ? 'rotate-180' : ''}`} aria-hidden /></button>
            {abiertoC && <ul className="divide-y divide-dte-linea overflow-hidden rounded-tile border border-dte-linea">{c.destinatarios.map(d => <li key={d.fedId} className="flex flex-wrap items-center justify-between gap-x-3 px-3 py-2 text-sm">
              <span className="font-medium">{d.nombre}</span>
              {d.leidoAt ? <span className="inline-flex items-center gap-1 text-exito"><Check className="size-3.5" aria-hidden />Leído el {fechaHoraAR(d.leidoAt)}</span> : <span className="text-dte-gris">Sin leer</span>}
            </li>)}</ul>}
            <div className="flex flex-wrap gap-2">
              {c.estado !== 'retirado' && <Button type="button" variant="outline" size="sm" onClick={() => { setMensaje(''); setEditando(c) }}><Pencil data-icon="inline-start" />Editar</Button>}
              {vigente && <Button type="button" variant="outline" size="sm" onClick={() => setARetirar(c)} className="text-peligro"><Trash2 data-icon="inline-start" />Retirar</Button>}
              {puedeEliminarComunicado(c.estado) && <Button type="button" variant="outline" size="sm" onClick={() => setAEliminar(c)} className="text-peligro"><Trash2 data-icon="inline-start" />Eliminar</Button>}
            </div>
          </div>
        </li>
      })}</ul>}
    {editando && <FormComunicado feds={feds} actual={editando === 'nuevo' ? null : editando} onClose={() => setEditando(null)} onGuardado={m => { setEditando(null); setMensaje(m); cargar() }} />}
    <Confirmar abierto={!!aEliminar} peligro titulo="¿Eliminar este comunicado?" descripcion="Se borra del todo, junto con el registro de quién lo leyó. No se puede deshacer." accion="Eliminar" onCerrar={() => setAEliminar(null)} onConfirmar={() => { if (aEliminar) eliminar(aEliminar) }} />
    <Confirmar abierto={!!aRetirar} peligro titulo="¿Retirar este comunicado?" descripcion="Deja de mostrarse como banner a los FED. Queda en la lista con las lecturas que tenía." accion="Retirar" onCerrar={() => setARetirar(null)} onConfirmar={() => { if (aRetirar) retirar(aRetirar) }} />
  </main>
}

export function FormComunicado({ feds, actual, onClose, onGuardado }: { feds: Fed[], actual: api.ComunicadoGestion | null, onClose: () => void, onGuardado: (mensaje: string) => void }) {
  const solo = feds.filter(f => f.rol === 'fed')
  const [titulo, setTitulo] = useState(actual?.titulo ?? '')
  const [texto, setTexto] = useState(actual?.texto ?? '')
  const [nivel, setNivel] = useState<NivelComunicado>(actual?.nivel ?? 'informativo')
  const [aTodos, setATodos] = useState(!actual?.fed_ids)
  const [elegidos, setElegidos] = useState<string[]>(actual?.fed_ids ?? [])
  const [venceEl, setVenceEl] = useState(actual?.vence_el ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const entrada: EntradaComunicado = { titulo, texto, nivel, fedIds: aTodos ? null : elegidos, venceEl: venceEl || null }
  const cambiaMensaje = !!actual && (actual.titulo !== titulo.trim() || actual.texto !== texto.trim() || actual.nivel !== nivel)
  async function guardar() {
    const problema = validarComunicado(entrada, hoyAR())
    if (problema) { setError(problema); return }
    setGuardando(true); setError('')
    try {
      if (actual) { await editarComunicado(actual.id, entrada); onGuardado(cambiaMensaje ? 'Se guardó. Se les pide leerlo de nuevo.' : 'Se guardaron los cambios') }
      else { await crearComunicado(entrada); onGuardado('Se envió el comunicado') }
    } catch (e) { setError(errMsg(e)); setGuardando(false) }
  }
  return <Dialog open onOpenChange={o => !o && !guardando && onClose()}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white max-sm:top-[calc(env(safe-area-inset-top,0px)+0.5rem)]! max-sm:bottom-auto! max-sm:max-h-[calc(100dvh-1rem)]! max-sm:rounded-b-2xl! max-sm:pb-4! sm:max-w-xl">
      <DialogTitle className="flex items-center gap-2"><Megaphone className="size-5 text-dte-petroleo" aria-hidden />{actual ? 'Editar comunicado' : 'Nuevo comunicado'}</DialogTitle>
      <DialogDescription>Se muestra como banner a los FED que lo reciben, hasta que lo marquen como leído.</DialogDescription>
      <form onSubmit={e => { e.preventDefault(); guardar() }} className="flex flex-col gap-3">
        <Field label="Título" required hint={`(hasta ${MAX_TITULO_COMUNICADO} caracteres)`}><Input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={MAX_TITULO_COMUNICADO} className="h-11 md:h-9" /></Field>
        <Field label="Mensaje" required hint="(podés pegar enlaces)"><Textarea value={texto} onChange={e => setTexto(e.target.value)} maxLength={MAX_TEXTO_COMUNICADO} className="min-h-32" />
          <span className="self-end text-xs text-dte-gris">{texto.length} / {MAX_TEXTO_COMUNICADO}</span></Field>
        <fieldset className="flex flex-col gap-1.5"><legend className="text-sm font-semibold">Nivel</legend>
          <div className="flex flex-wrap gap-2">{NIVELES_COMUNICADO.map(n => <label key={n} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border px-3 text-sm font-semibold md:min-h-9 ${nivel === n ? (n === 'importante' ? 'border-peligro-borde bg-peligro-fondo text-peligro' : 'border-pba-celeste/50 bg-pba-celeste/15 text-dte-petroleo') : 'border-dte-linea'}`}>
            <input type="radio" name="nivel" checked={nivel === n} onChange={() => setNivel(n)} className="size-4" />{NIVEL_COMUNICADO_LABEL[n]}</label>)}</div>
          <p className="text-xs text-dte-gris">Importante se muestra en rojo; Informativo, en celeste.</p></fieldset>
        <fieldset className="flex flex-col gap-1.5"><legend className="text-sm font-semibold">Para quién</legend>
          <label className="inline-flex min-h-10 items-center gap-2 text-sm"><input type="radio" name="para" checked={aTodos} onChange={() => setATodos(true)} className="size-4" />Todos los FED</label>
          <label className="inline-flex min-h-10 items-center gap-2 text-sm"><input type="radio" name="para" checked={!aTodos} onChange={() => setATodos(false)} className="size-4" />Elegir FED</label>
          {!aTodos && <ul className="grid gap-x-3 sm:grid-cols-2">{solo.map(f => <li key={f.id}><label className="inline-flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={elegidos.includes(f.id)} onChange={e => setElegidos(l => (e.target.checked ? [...l, f.id] : l.filter(x => x !== f.id)))} className="size-4" />{f.nombre_completo}</label></li>)}</ul>}
        </fieldset>
        <Field label="Vence el" hint="(opcional: después de esa fecha deja de mostrarse)"><SelectorFecha ariaLabel="Vence el" value={venceEl} min={hoyAR()} onChange={setVenceEl} className="sm:max-w-48" /></Field>
        {actual && cambiaMensaje && <p className="rounded-control bg-aviso-fondo px-3 py-2 text-xs font-semibold text-aviso-fuerte">Cambiaste el título, el mensaje o el nivel: los FED que ya lo leyeron tienen que leerlo de nuevo.</p>}
        {error && <ErrorBox message={error} />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button type="submit" disabled={guardando} className="bg-dte-petroleo hover:bg-dte-petroleo-oscuro">{guardando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}{actual ? 'Guardar cambios' : 'Enviar'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>
}
