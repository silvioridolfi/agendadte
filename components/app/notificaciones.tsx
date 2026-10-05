'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Info, OctagonAlert, Sparkles, X } from 'lucide-react'
import { type AgendaItem, type Fed, type Notificacion } from '@/lib/agenda'
import { bannerDe, clasePve, claseReclamo, nivelDe, type Nivel } from '@/lib/avisos'
import { parse, fmt, cap, itemTitle, getNotificaciones, marcarLeidas, storage } from '@/components/app/comun'
import { bannerVigente } from '@/lib/ayuda/novedades'
import type { Rol } from '@/lib/ayuda/temas'
import { hoyAR } from '@/lib/hora'

// Notificaciones del perfil: etiquetas en acciones de compañeros o de coordinación. Se revisan cada 20 s y al volver a la pestaña o a la app.
// La campanita y el banner de arriba comparten la misma lista.
type Estado = { list: Notificacion[], unread: number, leer: (ids?: string[]) => void }
const Ctx = createContext<Estado | null>(null)
const useNotif = () => { const c = useContext(Ctx); if (!c) throw new Error('Falta NotificacionesProvider'); return c }

export function NotificacionesProvider({ profileId, reloadKey, children }: { profileId: string, reloadKey: number, children: React.ReactNode }) {
  const [list, setList] = useState<Notificacion[]>([])
  const load = useCallback(() => { getNotificaciones(profileId).then(setList).catch(() => {}) }, [profileId])
  useEffect(() => {
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 20_000)
    const alVolver = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', alVolver); window.addEventListener('focus', alVolver)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); window.removeEventListener('focus', alVolver) }
  }, [load, reloadKey])
  const leer = useCallback((ids?: string[]) => { setList(l => l.map(n => (!ids || ids.includes(n.id) ? { ...n, leida: true } : n))); marcarLeidas(profileId, ids).catch(() => {}) }, [profileId])
  const valor = useMemo(() => ({ list, unread: list.filter(n => !n.leida).length, leer }), [list, leer])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

// Color de cada nivel: rojo (urgente), amarillo (aviso), verde (confirmación) y neutro (informativa).
const ESTILO: Record<Nivel, { Icono: typeof Bell, icono: string, borde: string, fondo: string, nombre: string }> = {
  urgente: { Icono: OctagonAlert, icono: 'text-peligro', borde: 'border-l-peligro', fondo: 'bg-peligro-fondo', nombre: 'Urgente' },
  aviso: { Icono: AlertTriangle, icono: 'text-aviso-fuerte', borde: 'border-l-aviso-borde', fondo: 'bg-aviso-fondo', nombre: 'Aviso' },
  ok: { Icono: CheckCircle2, icono: 'text-exito', borde: 'border-l-exito', fondo: 'bg-exito-fondo', nombre: 'Confirmación' },
  info: { Icono: Info, icono: 'text-dte-petroleo', borde: 'border-l-dte-petroleo/40', fondo: 'bg-info-fondo', nombre: 'Informativa' },
}

function Titulo({ n, autor }: { n: Notificacion, autor: (id: string | null) => string }) {
  const quien = n.autor_id && <b>{autor(n.autor_id)}</b>
  if (n.tipo === 'inactividad') return <>{quien} sin actividad reciente en la agenda</>
  if (n.tipo === 'reclamo') return claseReclamo(n) === 'nuevo' ? <>{quien} registró un <b>reclamo de conectividad</b></> : <><b>Reclamo de conectividad</b></>
  if (n.tipo === 'pve') {
    const c = clasePve(n)
    return <>{quien} {c === 'devuelta' ? <>devolvió tu <b>PVE</b></> : c === 'entrega' ? <>entregó su <b>PVE</b></> : <>Recordatorio de <b>PVE</b></>}</>
  }
  if (n.tipo === 'evento') return <>{quien} cargó un <b>evento DTE</b></>
  return <>{quien} {n.tipo === 'etiqueta' ? (n.item?.accion === 'LICENCIA' ? 'cargó una' : 'te sumó a') : n.tipo === 'respuesta' ? 'respondió sobre' : n.tipo === 'cancelacion' ? (n.item ? 'canceló' : '') : 'modificó'} {n.item ? <b>{cap(n.item.accion.toLowerCase())}</b> : n.tipo === 'cancelacion' ? '' : 'una acción que ya no existe'}</>
}

export function NotificacionesBell({ feds, onOpen, onReclamos }: { feds: Fed[], onOpen: (item: AgendaItem) => void, onReclamos?: () => void }) {
  const { list, unread, leer } = useNotif()
  const [open, setOpen] = useState(false)
  // La campanita se sacude una vez cuando llega una notificación sin leer más.
  const [previas, setPrevias] = useState(unread), [sacudidas, setSacudidas] = useState(0)
  if (unread !== previas) { setPrevias(unread); if (unread > previas) setSacudidas(k => k + 1) }
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null), panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() } }
    panelRef.current?.focus()
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])
  const autor = (id: string | null) => feds.find(f => f.id === id)?.nombre_completo ?? 'Un compañero'
  return <div ref={ref} className="relative">
    <button ref={btnRef} onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ''}`} aria-expanded={open} className="relative flex size-11 items-center justify-center rounded-full text-dte-gris transition hover:bg-dte-fondo hover:text-dte-tinta">
      <Bell key={sacudidas} className={`size-5 ${sacudidas ? 'anim-campana' : ''}`} />{unread > 0 && <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-dte-magenta px-1 text-xs font-bold text-white">{unread}</span>}
    </button>
    {open && <div ref={panelRef} tabIndex={-1} role="dialog" aria-label="Notificaciones" className="animate-in fade-in-0 slide-in-from-top-1 duration-150 fixed inset-x-2 top-[calc(3.75rem+env(safe-area-inset-top,0px))] z-modal overflow-hidden rounded-card border border-dte-linea bg-white shadow-e3 outline-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[22rem]">
      <div className="flex items-center justify-between border-b border-dte-linea px-4 py-2.5"><p className="text-sm font-bold">Notificaciones</p>{unread > 0 && <button onClick={() => leer()} className="min-h-11 text-xs font-semibold text-dte-petroleo hover:opacity-80 sm:min-h-0">Marcar todas como leídas</button>}</div>
      {list.length ? <ul className="max-h-[70dvh] divide-y sm:max-h-96 divide-dte-linea overflow-y-auto">{list.map(n => {
        const nivel = nivelDe(n), e = ESTILO[nivel]
        return <li key={n.id}><button onClick={() => { leer([n.id]); setOpen(false); if (n.item) onOpen(n.item); else if (n.tipo === 'reclamo') onReclamos?.() }} className={`flex w-full gap-3 border-l-4 px-4 py-3 text-left text-sm transition hover:bg-dte-tinte ${e.borde} ${n.leida ? '' : e.fondo}`}>
          <e.Icono aria-label={e.nombre} className={`mt-0.5 size-4 shrink-0 ${e.icono} ${n.leida ? 'opacity-60' : ''}`} />
          <span className="min-w-0"><span className={`block ${n.leida ? '' : 'font-medium'}`}><Titulo n={n} autor={autor} /></span>
            {n.detalle && <span className={`block text-xs ${nivel === 'urgente' ? 'text-peligro' : 'text-dte-tinta'}`}>{n.detalle}</span>}
            {n.item && <span className="block truncate text-xs text-dte-gris">{cap(fmt(parse(n.item.fecha), { weekday: 'long', day: 'numeric', month: 'long' }))} · {itemTitle(n.item)}</span>}</span>
        </button></li>
      })}</ul> : <p className="px-4 py-6 text-center text-sm text-dte-gris">No tenés notificaciones.</p>}
    </div>}
  </div>
}

// Banner de arriba para lo que pide una acción (PVE a entregar o devuelta, FED sin actividad) y los avisos de reclamos de conectividad
// (varios juntos se muestran como un solo banner): sigue hasta leerlo o resolverlo.
export function AvisosBanner({ feds, puedeSubirPve, onIrAPve, onReclamos, rol, onNovedad }: { feds: Fed[], puedeSubirPve: boolean, onIrAPve: () => void, onReclamos?: () => void, rol: Rol, onNovedad: (tema: string) => void }) {
  const { list, leer } = useNotif()
  const b = bannerDe(list)
  // Sin avisos pendientes, se muestra el banner de la novedad vigente (si hay).
  if (!b) return <BannerNovedad rol={rol} onVer={onNovedad} />
  const { principal: n, otros, nivel, reclamos } = b
  const e = ESTILO[nivel === 'urgente' ? 'urgente' : nivel === 'ok' ? 'ok' : 'aviso']
  const color = nivel === 'urgente' ? 'border-peligro-borde bg-peligro-fondo text-peligro' : nivel === 'ok' ? 'border-exito/40 bg-exito-fondo text-exito' : 'border-aviso-borde bg-aviso-fondo-fuerte text-aviso-fuerte'
  const autor = (id: string | null) => feds.find(f => f.id === id)?.nombre_completo ?? 'Un compañero'
  const irAPve = n.tipo === 'pve' && puedeSubirPve
  const esReclamo = n.tipo === 'reclamo'
  const ids = esReclamo ? reclamos.map(r => r.id) : [n.id]
  // Compacto: una fila, el texto en hasta dos renglones y los botones al lado (en el celular, "Entendido" es una cruz).
  return <div role="status" className={`anim-banner border-b px-4 py-1.5 text-sm ${color}`}>
    <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 lg:px-6">
      <span className="flex min-w-0 items-center gap-1.5"><e.Icono className="size-4 shrink-0" aria-hidden />
        <span className="line-clamp-2 min-w-0 text-[0.8125rem] leading-snug sm:text-sm">{esReclamo && reclamos.length > 1 ? <b>Tenés {reclamos.length} avisos de reclamos de conectividad</b> : n.tipo === 'pve' && clasePve(n) === 'aviso' ? <b><span className="sm:hidden">{(n.detalle ?? '').replace(/^Ya podés subir tu /, '')}</span><span className="hidden sm:inline">{n.detalle}</span></b> : <><Titulo n={n} autor={autor} />{n.detalle && <>: {n.detalle}</>}</>}{otros > 0 && <span className="ml-1 hidden font-semibold sm:inline">· y {otros} {otros === 1 ? 'aviso más' : 'avisos más'} en las notificaciones</span>}</span></span>
      <span className="flex shrink-0 items-center gap-1.5">
        {irAPve && <button type="button" onClick={() => { leer([n.id]); onIrAPve() }} aria-label="Ir a mis PVE" className="flex min-h-9 min-w-9 items-center justify-center rounded-full bg-white px-0 text-xs font-semibold text-dte-petroleo shadow-e1 hover:bg-dte-tinte min-[24rem]:px-3 md:min-h-8"><ArrowRight className="size-4 min-[24rem]:hidden" aria-hidden /><span className="hidden min-[24rem]:inline sm:hidden">Ir a PVE</span><span className="hidden sm:inline">Ir a mis PVE</span></button>}
        {esReclamo && onReclamos && <button type="button" onClick={() => { leer(ids); onReclamos() }} aria-label="Ver registro de reclamos" className="flex min-h-9 min-w-9 items-center justify-center rounded-full bg-white px-0 text-xs font-semibold text-dte-petroleo shadow-e1 hover:bg-dte-tinte min-[24rem]:px-3 md:min-h-8"><ArrowRight className="size-4 min-[24rem]:hidden" aria-hidden /><span className="hidden min-[24rem]:inline">Ver registro</span></button>}
        <button type="button" onClick={() => leer(ids)} aria-label="Entendido" className="flex min-h-9 min-w-9 items-center justify-center rounded-full border border-current px-0 text-xs font-semibold hover:bg-white/60 sm:px-3 md:min-h-8"><X className="size-4 sm:hidden" aria-hidden /><span className="hidden sm:inline">Entendido</span></button>
      </span>
    </div>
  </div>
}

const CLAVE_BANNER = 'agenda-territorial:banners-cerrados'
const leerCerrados = (): string[] => storage(() => { const v = JSON.parse(localStorage.getItem(CLAVE_BANNER) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [] }) ?? []

// Banner de una novedad importante (celeste): lleva al tema de la ayuda y se recuerda como cerrado en este dispositivo.
function BannerNovedad({ rol, onVer }: { rol: Rol, onVer: (tema: string) => void }) {
  const [cerrados, setCerrados] = useState<string[]>(leerCerrados)
  const b = bannerVigente(rol, hoyAR(), cerrados)
  if (!b) return null
  const cerrar = () => { const sig = [...cerrados, b.id]; setCerrados(sig); storage(() => localStorage.setItem(CLAVE_BANNER, JSON.stringify(sig))) }
  return <div role="status" className="anim-banner border-b border-pba-celeste/50 bg-pba-celeste/15 px-4 py-1.5 text-sm text-dte-petroleo">
    <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 lg:px-6">
      <span className="flex min-w-0 items-center gap-1.5"><Sparkles className="size-4 shrink-0" aria-hidden />
        <span className="line-clamp-2 min-w-0 text-[0.8125rem] font-semibold leading-snug sm:text-sm"><span className="sm:hidden">{b.corto}</span><span className="hidden sm:inline">{b.texto}</span></span></span>
      <span className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={() => { cerrar(); onVer(b.tema) }} aria-label="Ver cómo en la ayuda" className="flex min-h-9 min-w-9 items-center justify-center rounded-full bg-white px-0 text-xs font-semibold text-dte-petroleo shadow-e1 hover:bg-dte-tinte min-[24rem]:px-3 md:min-h-8"><ArrowRight className="size-4 min-[24rem]:hidden" aria-hidden /><span className="hidden min-[24rem]:inline">Ver cómo</span></button>
        <button type="button" onClick={cerrar} aria-label="Entendido" className="flex min-h-9 min-w-9 items-center justify-center rounded-full border border-current px-0 text-xs font-semibold hover:bg-white/60 sm:px-3 md:min-h-8"><X className="size-4 sm:hidden" aria-hidden /><span className="hidden sm:inline">Entendido</span></button>
      </span>
    </div>
  </div>
}
