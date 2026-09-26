'use client'

import { ChevronRight, LayoutDashboard, MapPin } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { type Fed } from '@/lib/agenda'
import { avatarColors, initials, districtsLabel, ErrorBox, PieInstitucional } from '@/components/app/comun'

// =====================================================================

export function ProfileSelect({ feds, error, onRetry, onSelect }: { feds: Fed[] | null, error: string, onRetry: () => void, onSelect: (fed: Fed) => void }) {
  return <main className="bg-dte-degradado relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 pt-[calc(3rem+env(safe-area-inset-top,0px))] text-white">
    <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-44 rotate-45 rounded-[2.5rem] border-[22px] border-dte-rosa" />
    <span aria-hidden className="pointer-events-none absolute right-40 top-4 size-10 rounded-full bg-dte-celeste" />
    <span aria-hidden className="pointer-events-none absolute right-8 top-40 size-8 rounded-full bg-dte-lila" />
    <div className="relative my-auto w-full max-w-3xl">
      <div className="mb-10 flex items-center gap-3"><img src="/brand/dte1-160.png" alt="DTE Región 1" width={56} height={56} className="size-14 shrink-0 drop-shadow-lg" /><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-dte-celeste">Equipo FED</p><h1 className="text-xl font-bold">Agenda Territorial</h1></div></div>
      <div className="mb-8"><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">¿Con quién vas a trabajar hoy?</h2><span className="mt-4 inline-flex rounded-full bg-dte-magenta px-4 py-1.5 text-sm font-bold">Dirección de Tecnología Educativa</span><p className="mt-4 text-white/85">Seleccioná tu perfil para entrar a la agenda. Lo vamos a recordar en este dispositivo.</p></div>
      {error ? <ErrorBox message={error} onRetry={onRetry} />
        : !feds ? <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-white/15" />)}</div>
        : !feds.length ? <p className="rounded-2xl border border-dashed border-white/40 p-8 text-center text-sm text-white/90">Todavía no hay FEDs cargados en la tabla <code>feds</code>.</p>
        : <><div className="grid gap-3 sm:grid-cols-2">{feds.filter(f => f.rol !== 'coordinacion').map((fed, i) =>
          <button key={fed.id} onClick={() => onSelect(fed)} className="group flex items-center gap-4 rounded-2xl bg-white p-4 text-left text-dte-tinta shadow-sm ring-2 ring-transparent transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-pba-celeste focus-visible:ring-pba-celeste focus-visible:outline-none">
            <Avatar className="size-12"><AvatarFallback className={`${avatarColors[i % avatarColors.length]} font-bold text-dte-petroleo-oscuro`}>{initials(fed.nombre_completo)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{fed.nombre_completo}</p><p className="mt-0.5 flex items-center gap-1 truncate text-sm text-dte-gris"><MapPin className="size-3.5 shrink-0" />{districtsLabel(fed)}</p></div>
            <ChevronRight className="text-dte-gris-claro transition group-hover:translate-x-1 group-hover:text-dte-magenta" />
          </button>)}</div>
          {feds.filter(f => f.rol === 'coordinacion').map(c => <button key={c.id} onClick={() => onSelect(c)} className="group mt-4 flex w-full items-center gap-4 rounded-2xl border border-white/40 bg-white/10 p-4 text-left text-white backdrop-blur transition hover:bg-white/20">
            <div className="flex size-12 items-center justify-center rounded-full bg-white/20"><LayoutDashboard /></div>
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{c.nombre_completo}</p><p className="text-sm text-white/80">Coordinación: tablero del equipo y reuniones</p></div>
            <ChevronRight className="text-white/70 transition group-hover:translate-x-1" />
          </button>)}</>}
    </div>
    <div className="relative mt-12 w-full"><PieInstitucional oscuro /></div>
  </main>
}
