'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CalendarDays, CalendarOff, Camera, ChevronDown, CircleHelp, FileText, Gauge, Info, KeyRound, LayoutDashboard, OctagonAlert, PlusCircle, Search, Sparkles, Stethoscope, TriangleAlert, UserRound, Users, ClipboardCheck, Trophy, type LucideIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { storage } from '@/components/app/comun'
import { NOVEDADES, ultimaNovedad } from '@/lib/ayuda/novedades'
import { TEMAS, type Rol } from '@/lib/ayuda/temas'
import { ATAJOS, ESTILO_TEMA, FAMILIAS, type Familia, type Icono } from '@/lib/ayuda/estilo'
import { normalizar, parsear, partesNegrita, textoPlano, type Bloque } from '@/lib/ayuda/formato'

const CLAVE = 'agenda-territorial:novedades-vistas'

// Hay novedades que esta persona todavía no abrió: enciende el puntito del menú.
export function useNovedadesNuevas(rol: Rol): [boolean, () => void] {
  // La pantalla se arma en el navegador (después de iniciar sesión), así que se puede leer lo guardado al crear el estado.
  const [vista, setVista] = useState<string>(() => storage(() => localStorage.getItem(CLAVE)) ?? '')
  const ultima = ultimaNovedad(rol)
  const marcar = useCallback(() => { if (ultima) { storage(() => localStorage.setItem(CLAVE, ultima)); setVista(ultima) } }, [ultima])
  return [!!ultima && vista < ultima, marcar]
}

const ICONOS: Record<Icono, LucideIcon> = {
  llave: KeyRound, usuario: UserRound, calendario: CalendarDays, nuevo: PlusCircle, estado: ClipboardCheck, licencia: CalendarOff, clubes: Trophy, fotos: Camera,
  pve: FileText, tablero: LayoutDashboard, campana: Bell, pregunta: CircleHelp, rol: Users, indicadores: Gauge, equipo: Users, ausencias: Stethoscope,
}

// Texto con **negrita**: lo que termina en ":" es un rótulo (negrita de color); el resto, el nombre de un botón o pantalla, va como etiqueta.
function Texto({ s, fam }: { s: string, fam: Familia }) {
  const f = FAMILIAS[fam]
  return <>{partesNegrita(s).map(([t, b], i) => {
    if (!b) return <span key={i}>{t}</span>
    return t.trimEnd().endsWith(':') ? <strong key={i} className={`font-bold ${f.texto}`}>{t}</strong>
      : <strong key={i} className={`mx-px whitespace-nowrap rounded-md px-1.5 py-px text-[0.8125rem] font-semibold ${f.fondo} ${f.texto}`}>{t}</strong>
  })}</>
}

const AVISO = {
  info: { Icono: Info, clase: 'border-l-pba-celeste bg-exito-fondo text-dte-tinta', icono: 'text-exito', nombre: 'Información' },
  importante: { Icono: TriangleAlert, clase: 'border-l-accion-reunion-punto bg-aviso-fondo-fuerte text-aviso', icono: 'text-aviso-fuerte', nombre: 'Importante' },
  atencion: { Icono: OctagonAlert, clase: 'border-l-peligro bg-peligro-fondo text-peligro', icono: 'text-peligro', nombre: 'Atención' },
} as const

function Bloques({ bloques, fam }: { bloques: Bloque[], fam: Familia }) {
  const f = FAMILIAS[fam]
  return <div className="flex flex-col gap-3 text-sm leading-relaxed text-dte-gris">{bloques.map((b, i) => {
    switch (b.t) {
      case 'sub': return <h4 key={i} className={`mt-3 flex items-center gap-2 text-sm font-bold ${f.texto}`}><span className={`size-2 rounded-full ${f.punto}`} aria-hidden />{b.texto}</h4>
      case 'p': return <p key={i}><Texto s={b.texto} fam={fam} /></p>
      case 'lista': return <ul key={i} className="space-y-1.5">{b.items.map((x, j) => <li key={j} className="flex gap-2.5"><span className={`mt-[0.45rem] size-1.5 shrink-0 rounded-full ${f.punto}`} aria-hidden /><span><Texto s={x} fam={fam} /></span></li>)}</ul>
      case 'pasos': return <ol key={i} className="space-y-2">{b.items.map((x, j) => <li key={j} className="flex gap-3"><span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${f.fondo} ${f.texto}`} aria-hidden>{j + 1}</span><span className="pt-0.5"><Texto s={x} fam={fam} /></span></li>)}</ol>
      case 'aviso': { const a = AVISO[b.nivel]; return <p key={i} role="note" className={`flex items-start gap-2.5 rounded-control border-l-4 px-3 py-2.5 ${a.clase}`}><a.Icono aria-label={a.nombre} className={`mt-0.5 size-5 shrink-0 ${a.icono}`} /><span><Texto s={b.texto} fam={fam} /></span></p> }
      case 'tabla': {
        const [cabeza, ...filas] = b.filas
        return <div key={i} className="overflow-x-auto rounded-control border border-dte-linea"><table className="w-full min-w-[20rem] border-collapse text-left">
          <thead><tr className={f.fondo}>{cabeza.map((c, j) => <th key={j} className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${f.texto}`}>{c}</th>)}</tr></thead>
          <tbody>{filas.map((fila, j) => <tr key={j} className={`align-top ${j % 2 ? f.fondoSuave : ''}`}>{fila.map((c, k) => <td key={k} className={`border-t border-dte-linea px-3 py-2 ${k === 0 ? 'font-semibold text-dte-tinta' : ''}`}><Texto s={c} fam={fam} /></td>)}</tr>)}</tbody>
        </table></div>
      }
    }
  })}</div>
}

const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

// Ayuda de la agenda: temas según el rol, con buscador, y las novedades. El contenido sale de lib/ayuda.
export function AyudaView({ rol, onVista }: { rol: Rol, onVista: () => void }) {
  const [pestana, setPestana] = useState<'temas' | 'novedades'>('temas')
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const refs = useRef<Record<string, HTMLLIElement | null>>({})
  useEffect(() => { if (pestana === 'novedades') onVista() }, [pestana, onVista])
  const temas = useMemo(() => TEMAS.filter(t => t.para.includes(rol)).map(t => { const bloques = parsear(t.md()); return { ...t, bloques, plano: normalizar(`${t.titulo} ${bloques.map(textoPlano).join(' ')}`) } }), [rol])
  const nq = normalizar(q.trim())
  const visibles = nq ? temas.filter(t => nq.split(/\s+/).every(p => t.plano.includes(p))) : temas
  const novedades = NOVEDADES.filter(n => !n.para || n.para.includes(rol))
  const ir = (id: string) => { setAbierto(id); setQ(''); requestAnimationFrame(() => refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }
  return <main className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-32 pt-6 lg:px-10">
    <header className="relative overflow-hidden rounded-card bg-dte-degradado px-5 py-6 text-white shadow-e2 sm:px-7 sm:py-8">
      <Sparkles className="absolute -right-3 -top-3 size-28 text-white/10" aria-hidden />
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/85">Ayuda · {rol === 'ced' ? 'Coordinación' : 'Equipo FED'}</p>
      <h2 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">Cómo funciona la agenda</h2>
      <p className="mt-2 max-w-xl text-sm text-white/90">Todo lo que necesitás para usarla, siempre al día: esta ayuda se actualiza junto con la agenda y describe la versión que estás usando.</p>
    </header>
    <div role="tablist" aria-label="Ayuda" className="mt-4 flex gap-1 rounded-full border border-dte-linea bg-white p-1 text-sm font-semibold shadow-e1 sm:w-fit">
      {([['temas', 'Manual'], ['novedades', 'Novedades']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={pestana === k} onClick={() => setPestana(k)} className={`min-h-10 flex-1 rounded-full px-5 transition sm:flex-none ${pestana === k ? 'bg-dte-degradado text-white shadow-e1' : 'text-dte-gris hover:text-dte-tinta'}`}>{l}</button>)}
    </div>
    {pestana === 'temas' ? <>
      <div className="relative mt-4"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dte-magenta" aria-hidden /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar en la ayuda (por ejemplo: PVE, fotos, licencia)" aria-label="Buscar en la ayuda" className="h-11 border-dte-linea bg-white pl-9 focus-visible:border-dte-magenta focus-visible:ring-dte-magenta/25" /></div>
      {!nq && <section aria-label="Accesos directos" className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-dte-gris">Lo más consultado</p>
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{ATAJOS[rol].map(a => {
          const e = ESTILO_TEMA[a.id], f = FAMILIAS[e.familia], I = ICONOS[e.icono]
          return <li key={a.id}><button type="button" onClick={() => ir(a.id)} className={`flex h-full min-h-20 w-full flex-col items-start gap-2 rounded-card border border-transparent p-3 text-left text-sm font-bold shadow-e1 transition hover:-translate-y-0.5 hover:shadow-e2 active:scale-[0.98] ${f.fondo} ${f.texto}`}>
            <I className="size-5" aria-hidden />{a.texto}</button></li>
        })}</ul>
      </section>}
      <ul className="mt-5 flex flex-col gap-2.5">{visibles.map(t => {
        const e = ESTILO_TEMA[t.id] ?? { familia: 'azul' as const, icono: 'pregunta' as const }, f = FAMILIAS[e.familia], I = ICONOS[e.icono]
        const open = !!nq || abierto === t.id
        return <li key={t.id} ref={el => { refs.current[t.id] = el }} className={`scroll-mt-20 overflow-hidden rounded-card border border-dte-linea border-l-4 bg-white shadow-e1 ${f.borde}`}>
          <button type="button" aria-expanded={open} aria-controls={`ayuda-${t.id}`} onClick={() => setAbierto(a => (a === t.id ? null : t.id))} className={`flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-dte-tinte ${open ? f.fondoSuave : ''}`}>
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${f.fondo} ${f.texto}`}><I className="size-[1.125rem]" aria-hidden /></span>
            <span className="flex-1 text-base font-bold">{t.titulo}</span>
            <ChevronDown className={`size-4 shrink-0 text-dte-gris transition ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {open && <div id={`ayuda-${t.id}`} className="border-t border-dte-linea px-4 py-4"><Bloques bloques={t.bloques} fam={e.familia} /></div>}
        </li>
      })}</ul>
      {!visibles.length && <p className="mt-8 text-center text-sm text-dte-gris">No encontramos nada para “{q}”. Probá con otra palabra.</p>}
    </> : <ul className="mt-4 flex flex-col gap-3">{novedades.map((n, i) => <li key={i} className="rounded-card border border-dte-linea border-l-4 border-l-dte-magenta bg-white p-4 shadow-e1">
      <p className="inline-flex rounded-full bg-feriado-marca px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-peligro">{fechaLarga(n.fecha)}</p>
      <p className="mt-2 text-base font-bold">{n.titulo}</p><p className="mt-1 text-sm text-dte-gris">{n.texto}</p>
    </li>)}</ul>}
  </main>
}
