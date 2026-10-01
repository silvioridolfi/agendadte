'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Info, OctagonAlert, Search, TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { eyebrow, storage } from '@/components/app/comun'
import { NOVEDADES, ultimaNovedad } from '@/lib/ayuda/novedades'
import { TEMAS, type Rol } from '@/lib/ayuda/temas'
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

const Texto = ({ s }: { s: string }) => <>{partesNegrita(s).map(([t, b], i) => (b ? <strong key={i} className="font-semibold text-dte-tinta">{t}</strong> : <span key={i}>{t}</span>))}</>

const AVISO = {
  info: { Icono: Info, clase: 'border-dte-petroleo/30 bg-info-fondo text-dte-tinta', nombre: 'Información' },
  importante: { Icono: TriangleAlert, clase: 'border-aviso-borde bg-aviso-fondo text-aviso', nombre: 'Importante' },
  atencion: { Icono: OctagonAlert, clase: 'border-peligro-borde bg-peligro-fondo text-peligro', nombre: 'Atención' },
} as const

function Bloques({ bloques }: { bloques: Bloque[] }) {
  return <div className="flex flex-col gap-3 text-sm leading-relaxed text-dte-gris">{bloques.map((b, i) => {
    switch (b.t) {
      case 'sub': return <h4 key={i} className="mt-2 text-sm font-bold text-dte-tinta">{b.texto}</h4>
      case 'p': return <p key={i}><Texto s={b.texto} /></p>
      case 'lista': return <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((x, j) => <li key={j}><Texto s={x} /></li>)}</ul>
      case 'pasos': return <ol key={i} className="list-decimal space-y-1 pl-5">{b.items.map((x, j) => <li key={j}><Texto s={x} /></li>)}</ol>
      case 'aviso': { const a = AVISO[b.nivel]; return <p key={i} role="note" className={`flex items-start gap-2 rounded-control border px-3 py-2 ${a.clase}`}><a.Icono aria-label={a.nombre} className="mt-0.5 size-4 shrink-0" /><span><Texto s={b.texto} /></span></p> }
      case 'tabla': {
        const [cabeza, ...filas] = b.filas
        return <div key={i} className="overflow-x-auto"><table className="w-full min-w-[20rem] border-collapse text-left">
          <thead><tr>{cabeza.map((c, j) => <th key={j} className="border-b border-dte-linea px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-dte-gris">{c}</th>)}</tr></thead>
          <tbody>{filas.map((f, j) => <tr key={j} className="align-top">{f.map((c, k) => <td key={k} className={`border-b border-dte-linea px-2 py-1.5 ${k === 0 ? 'font-semibold text-dte-tinta' : ''}`}><Texto s={c} /></td>)}</tr>)}</tbody>
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
  useEffect(() => { if (pestana === 'novedades') onVista() }, [pestana, onVista])
  const temas = useMemo(() => TEMAS.filter(t => t.para.includes(rol)).map(t => { const bloques = parsear(t.md()); return { ...t, bloques, plano: normalizar(`${t.titulo} ${bloques.map(textoPlano).join(' ')}`) } }), [rol])
  const nq = normalizar(q.trim())
  const visibles = nq ? temas.filter(t => nq.split(/\s+/).every(p => t.plano.includes(p))) : temas
  const novedades = NOVEDADES.filter(n => !n.para || n.para.includes(rol))
  return <main className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-32 pt-6 lg:px-10">
    <p className={eyebrow}>Ayuda</p>
    <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Cómo funciona la agenda</h2>
    <p className="mt-1.5 text-sm text-dte-gris">Esta ayuda se actualiza junto con la agenda: siempre describe la versión que estás usando.</p>
    <div role="tablist" aria-label="Ayuda" className="mt-4 flex gap-1 rounded-full border border-dte-linea bg-dte-fondo p-1 text-sm font-semibold sm:w-fit">
      {([['temas', 'Manual'], ['novedades', 'Novedades']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={pestana === k} onClick={() => setPestana(k)} className={`min-h-10 flex-1 rounded-full px-4 transition sm:flex-none ${pestana === k ? 'bg-dte-petroleo text-white shadow-e1' : 'text-dte-gris hover:text-dte-tinta'}`}>{l}</button>)}
    </div>
    {pestana === 'temas' ? <>
      <div className="relative mt-4"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dte-gris-claro" aria-hidden /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar en la ayuda (por ejemplo: PVE, fotos, licencia)" aria-label="Buscar en la ayuda" className="h-11 bg-white pl-9" /></div>
      <ul className="mt-4 flex flex-col gap-2">{visibles.map(t => {
        const open = !!nq || abierto === t.id
        return <li key={t.id} className="overflow-hidden rounded-card border border-dte-linea bg-white shadow-e1">
          <button type="button" aria-expanded={open} aria-controls={`ayuda-${t.id}`} onClick={() => setAbierto(a => (a === t.id ? null : t.id))} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-base font-bold transition hover:bg-dte-tinte">
            {t.titulo}<ChevronDown className={`size-4 shrink-0 text-dte-gris transition ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {open && <div id={`ayuda-${t.id}`} className="border-t border-dte-linea px-4 py-4"><Bloques bloques={t.bloques} /></div>}
        </li>
      })}</ul>
      {!visibles.length && <p className="mt-8 text-center text-sm text-dte-gris">No encontramos nada para “{q}”. Probá con otra palabra.</p>}
    </> : <ul className="mt-4 flex flex-col gap-3">{novedades.map((n, i) => <li key={i} className="rounded-card border border-dte-linea bg-white p-4 shadow-e1">
      <p className="text-xs font-semibold uppercase tracking-wider text-dte-gris">{fechaLarga(n.fecha)}</p>
      <p className="mt-1 text-base font-bold">{n.titulo}</p><p className="mt-1 text-sm text-dte-gris">{n.texto}</p>
    </li>)}</ul>}
  </main>
}
