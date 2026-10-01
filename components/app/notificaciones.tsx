'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bell, CheckCircle2, Info, OctagonAlert } from 'lucide-react'
import { type AgendaItem, type Fed, type Notificacion } from '@/lib/agenda'
import { bannerDe, clasePve, nivelDe, type Nivel } from '@/lib/avisos'
import { parse, fmt, cap, itemTitle, getNotificaciones, marcarLeidas } from '@/components/app/comun'

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
  if (n.tipo === 'pve') {
    const c = clasePve(n)
    return <>{quien} {c === 'devuelta' ? <>devolvió tu <b>PVE</b></> : c === 'entrega' ? <>entregó su <b>PVE</b></> : <>Recordatorio de <b>PVE</b></>}</>
  }
  if (n.tipo === 'evento') return <>{quien} cargó un <b>evento DTE</b></>
  return <>{quien} {n.tipo === 'etiqueta' ? (n.item?.accion === 'LICENCIA' ? 'cargó una' : 'te sumó a') : n.tipo === 'respuesta' ? 'respondió sobre' : n.tipo === 'cancelacion' ? (n.item ? 'canceló' : '') : 'modificó'} {n.item ? <b>{cap(n.item.accion.toLowerCase())}</b> : n.tipo === 'cancelacion' ? '' : 'una acción que ya no existe'}</>
}

export function NotificacionesBell({ feds, onOpen }: { feds: Fed[], onOpen: (item: AgendaItem) => void }) {
  const { list, unread, leer } = useNotif()
  const [open, setOpen] = useState(false)
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
      <Bell className="size-5" />{unread > 0 && <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-dte-magenta px-1 text-xs font-bold text-white">{unread}</span>}
    </button>
    {open && <div ref={panelRef} tabIndex={-1} role="dialog" aria-label="Notificaciones" className="animate-in fade-in-0 slide-in-from-top-1 duration-150 fixed inset-x-2 top-[calc(3.75rem+env(safe-area-inset-top,0px))] z-modal overflow-hidden rounded-card border border-dte-linea bg-white shadow-e3 outline-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[22rem]">
      <div className="flex items-center justify-between border-b border-dte-linea px-4 py-2.5"><p className="text-sm font-bold">Notificaciones</p>{unread > 0 && <button onClick={() => leer()} className="min-h-11 text-xs font-semibold text-dte-petroleo hover:opacity-80 sm:min-h-0">Marcar todas como leídas</button>}</div>
      {list.length ? <ul className="max-h-[70dvh] divide-y sm:max-h-96 divide-dte-linea overflow-y-auto">{list.map(n => {
        const nivel = nivelDe(n), e = ESTILO[nivel]
        return <li key={n.id}><button onClick={() => { leer([n.id]); setOpen(false); if (n.item) onOpen(n.item) }} className={`flex w-full gap-3 border-l-4 px-4 py-3 text-left text-sm transition hover:bg-dte-tinte ${e.borde} ${n.leida ? '' : e.fondo}`}>
          <e.Icono aria-label={e.nombre} className={`mt-0.5 size-4 shrink-0 ${e.icono} ${n.leida ? 'opacity-60' : ''}`} />
          <span className="min-w-0"><span className={`block ${n.leida ? '' : 'font-medium'}`}><Titulo n={n} autor={autor} /></span>
            {n.detalle && <span className={`block text-xs ${nivel === 'urgente' ? 'text-peligro' : 'text-dte-tinta'}`}>{n.detalle}</span>}
            {n.item && <span className="block truncate text-xs text-dte-gris">{cap(fmt(parse(n.item.fecha), { weekday: 'long', day: 'numeric', month: 'long' }))} · {itemTitle(n.item)}</span>}</span>
        </button></li>
      })}</ul> : <p className="px-4 py-6 text-center text-sm text-dte-gris">No tenés notificaciones.</p>}
    </div>}
  </div>
}

// Banner de arriba para lo que pide una acción (PVE a entregar o devuelta, FED sin actividad): sigue hasta leerlo o resolverlo.
export function AvisosBanner({ feds, puedeSubirPve, onIrAPve }: { feds: Fed[], puedeSubirPve: boolean, onIrAPve: () => void }) {
  const { list, leer } = useNotif()
  const b = bannerDe(list)
  if (!b) return null
  const { principal: n, otros } = b
  const urgente = nivelDe(n) === 'urgente', e = ESTILO[urgente ? 'urgente' : 'aviso']
  const autor = (id: string | null) => feds.find(f => f.id === id)?.nombre_completo ?? 'Un compañero'
  const irAPve = n.tipo === 'pve' && puedeSubirPve
  return <div role="status" className={`border-b px-4 py-2 text-sm ${urgente ? 'border-peligro-borde bg-peligro-fondo text-peligro' : 'border-aviso-borde bg-aviso-fondo-fuerte text-aviso-fuerte'}`}>
    <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 lg:px-6">
      <span className="flex min-w-0 items-start gap-1.5"><e.Icono className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{n.tipo === 'pve' && clasePve(n) === 'aviso' ? <b>{n.detalle}</b> : <><Titulo n={n} autor={autor} />{n.detalle && <>: {n.detalle}</>}</>}{otros > 0 && <span className="ml-1 font-semibold">· y {otros} {otros === 1 ? 'aviso más' : 'avisos más'} en las notificaciones</span>}</span></span>
      <span className="flex shrink-0 gap-2">
        {irAPve && <button type="button" onClick={() => { leer([n.id]); onIrAPve() }} className="min-h-10 rounded-full bg-white px-3 text-xs font-semibold text-dte-petroleo shadow-e1 hover:bg-dte-tinte md:min-h-8">Ir a mis PVE</button>}
        <button type="button" onClick={() => leer([n.id])} className="min-h-10 rounded-full border border-current px-3 text-xs font-semibold hover:bg-white/60 md:min-h-8">Entendido</button>
      </span>
    </div>
  </div>
}
