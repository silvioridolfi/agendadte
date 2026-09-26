'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { type AgendaItem, type Fed, type Notificacion } from '@/lib/agenda'
import { parse, fmt, cap, itemTitle, getNotificaciones, marcarLeidas } from '@/components/app/comun'

// Notificaciones del perfil: etiquetas en acciones de compañeros o de coordinación. Se revisan cada minuto.
export function NotificacionesBell({ profile, feds, reloadKey, onOpen }: { profile: Fed, feds: Fed[], reloadKey: number, onOpen: (item: AgendaItem) => void }) {
  const [list, setList] = useState<Notificacion[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const load = useCallback(() => { getNotificaciones(profile.id).then(setList).catch(() => {}) }, [profile.id])
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t) }, [load, reloadKey])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close)
  }, [open])
  const unread = list.filter(n => !n.leida).length
  const autor = (id: string | null) => feds.find(f => f.id === id)?.nombre_completo ?? 'Un compañero'
  const leer = (ids?: string[]) => { setList(l => l.map(n => (!ids || ids.includes(n.id) ? { ...n, leida: true } : n))); marcarLeidas(profile.id, ids).catch(() => {}) }
  return <div ref={ref} className="relative">
    <button onClick={() => setOpen(o => !o)} aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ''}`} aria-expanded={open} className="relative flex size-10 items-center justify-center rounded-full text-dte-gris transition hover:bg-dte-fondo hover:text-dte-tinta">
      <Bell className="size-5" />{unread > 0 && <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-dte-magenta px-1 text-[10px] font-bold text-white">{unread}</span>}
    </button>
    {open && <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-dte-linea bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-dte-linea px-4 py-2.5"><p className="text-sm font-bold">Notificaciones</p>{unread > 0 && <button onClick={() => leer()} className="text-xs font-semibold text-dte-petroleo hover:opacity-80">Marcar todas como leídas</button>}</div>
      {list.length ? <ul className="max-h-96 divide-y divide-dte-linea overflow-y-auto">{list.map(n => <li key={n.id}><button onClick={() => { leer([n.id]); setOpen(false); if (n.item) onOpen(n.item) }} className={`flex w-full gap-3 px-4 py-3 text-left text-sm transition hover:bg-dte-tinte ${n.leida ? '' : 'bg-[#f3f9fc]'}`}>
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.leida ? 'bg-transparent' : 'bg-dte-magenta'}`} />
        <span className="min-w-0"><span className="block"><b>{autor(n.autor_id)}</b> {n.tipo === 'etiqueta' ? 'te sumó a' : n.tipo === 'respuesta' ? 'respondió sobre' : n.tipo === 'cancelacion' ? (n.item ? 'canceló' : '') : 'modificó'} {n.item ? <b>{cap(n.item.accion.toLowerCase())}</b> : n.tipo === 'cancelacion' ? '' : 'una acción que ya no existe'}</span>
          {n.detalle && <span className={`block text-xs ${n.tipo === 'cancelacion' ? 'text-[#a3164f]' : 'text-dte-tinta'}`}>{n.detalle}</span>}
          {n.item && <span className="block truncate text-xs text-dte-gris">{cap(fmt(parse(n.item.fecha), { weekday: 'long', day: 'numeric', month: 'long' }))} · {itemTitle(n.item)}</span>}</span>
      </button></li>)}</ul> : <p className="px-4 py-6 text-center text-sm text-dte-gris">No tenés notificaciones.</p>}
    </div>}
  </div>
}
