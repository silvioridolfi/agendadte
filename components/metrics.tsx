'use client'

import { useMemo } from 'react'
import { titleCase } from '@/lib/format'
import { CATEGORIAS, CATEGORIA, CATEGORIA_LABEL, CON_ENCUENTRO, type Accion, type AgendaItem, type Categoria, type Fed } from '@/lib/agenda'

// Colores por categoría: validados con la guía de dataviz (CVD y contraste sobre fondo claro).
export const CAT_COLOR: Record<Categoria, string> = { tecnica: '#2a6fb0', pedagogica: '#d41c6c', institucional: '#6f5fc2' }

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
const nf = new Intl.NumberFormat('es-AR')

type Counts = Record<Categoria, number>
const emptyCounts = (): Counts => ({ tecnica: 0, pedagogica: 0, institucional: 0 })

function Legend() {
  return <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dte-gris" aria-label="Referencias">
    {CATEGORIAS.map(c => <li key={c} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: CAT_COLOR[c] }} />{CATEGORIA_LABEL[c]}</li>)}
  </ul>
}

function Panel({ title, subtitle, children, action }: { title: string, subtitle?: string, children: React.ReactNode, action?: React.ReactNode }) {
  return <section className="rounded-2xl border border-dte-linea bg-white p-4 shadow-xs sm:p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{title}</h3>{subtitle && <p className="text-xs text-dte-gris">{subtitle}</p>}</div>{action}</div>
    {children}
  </section>
}

function Kpi({ label, value, hint, color }: { label: string, value: string, hint?: string, color?: string }) {
  return <div className="rounded-2xl border border-dte-linea bg-white px-4 py-3">
    <p className="flex items-center gap-1.5 text-xs font-semibold text-dte-gris">{color && <span className="size-2.5 rounded-sm" style={{ background: color }} />}{label}</p>
    <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
    {hint && <p className="text-xs text-dte-gris">{hint}</p>}
  </div>
}

// Barra apilada técnica / pedagógica / institucional, con separación de 2px entre segmentos.
function StackedBar({ counts, max }: { counts: Counts, max: number }) {
  const total = CATEGORIAS.reduce((a, c) => a + counts[c], 0)
  return <div className="flex h-3 w-full gap-[2px]" role="img" aria-label={CATEGORIAS.map(c => `${CATEGORIA_LABEL[c]}: ${counts[c]}`).join(', ')}>
    {CATEGORIAS.filter(c => counts[c]).map((c, i, arr) => <div key={c} title={`${CATEGORIA_LABEL[c]}: ${counts[c]}`} className={`h-full ${i === 0 ? 'rounded-l' : ''} ${i === arr.length - 1 ? 'rounded-r' : ''}`} style={{ width: `${(counts[c] / Math.max(max, 1)) * 100}%`, background: CAT_COLOR[c] }} />)}
    {!total && <div className="h-full w-full rounded bg-dte-fondo" />}
  </div>
}

function HBar({ label, value, max, sub, color = CAT_COLOR.tecnica }: { label: string, value: number, max: number, sub?: string, color?: string }) {
  return <li className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_1fr_auto]" title={`${label}: ${value}${sub ? ` · ${sub}` : ''}`}>
    <span className="truncate text-dte-tinta">{label}</span>
    <span className="h-2.5 rounded-r bg-dte-fondo"><span className="block h-full rounded-r" style={{ width: `${(value / Math.max(max, 1)) * 100}%`, background: color }} /></span>
    <span className="text-right tabular-nums"><span className="font-semibold">{nf.format(value)}</span>{sub && <span className="ml-1 text-xs text-dte-gris">{sub}</span>}</span>
  </li>
}

export function MetricsView({ items, feds }: { items: AgendaItem[], feds: Fed[] }) {
  // Las métricas cuentan trabajo hecho: sólo acciones realizadas.
  const done = useMemo(() => items.filter(i => i.estado === 'realizada'), [items])
  const planned = items.filter(i => i.estado === 'planificada').length

  const m = useMemo(() => {
    const total = emptyCounts()
    const byFed = new Map<string, { counts: Counts, schools: Set<string>, last: string }>()
    const byDistrict = new Map<string, Map<Accion, number>>()
    const acciones = new Set<Accion>()
    const sub = new Map<string, { visitas: number, equipos: number }>()
    const schools = new Set<string>()
    let equipos = 0
    for (const i of done) {
      const cat = CATEGORIA[i.accion] ?? 'institucional'
      total[cat]++
      const f = byFed.get(i.fed_id) ?? { counts: emptyCounts(), schools: new Set(), last: '' }
      f.counts[cat]++; if (i.school_id) f.schools.add(i.school_id); if (i.fecha > f.last) f.last = i.fecha
      byFed.set(i.fed_id, f)
      if (i.school_id) schools.add(i.school_id)
      const d = i.school?.distrito ?? 'Sin escuela'
      const row = byDistrict.get(d) ?? new Map<Accion, number>(); row.set(i.accion, (row.get(i.accion) ?? 0) + 1); byDistrict.set(d, row); acciones.add(i.accion)
      if (cat === 'tecnica') {
        equipos += i.cantidad ?? 0
        // "Desbloqueos, Actualización de S.O." cuenta para cada sub-acción mencionada.
        for (const s of (i.sub_accion ?? '').split(',').map(x => x.trim()).filter(Boolean)) {
          const k = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace('s.o.', 'S.O.')
          const e = sub.get(k) ?? { visitas: 0, equipos: 0 }; e.visitas++; e.equipos += i.cantidad ?? 0; sub.set(k, e)
        }
      }
    }
    // Encuentros de clubes, talleres y prácticas
    const enc = done.filter(i => CON_ENCUENTRO.includes(i.accion))
    const paired = enc.filter(i => i.inscriptos != null && i.asistentes != null)
    const byPropuesta = new Map<string, number>(), clubSchools = new Map<string, { name: string, distrito: string, encuentros: number, asistentes: number }>()
    const encByDistrict = new Map<string, number>()
    for (const i of enc) {
      const p = i.propuesta || titleCase(i.accion); byPropuesta.set(p, (byPropuesta.get(p) ?? 0) + (i.asistentes ?? 0))
      const d = i.school?.distrito ?? 'Sin escuela'; encByDistrict.set(d, (encByDistrict.get(d) ?? 0) + (i.asistentes ?? 0))
      if (i.accion === 'CLUB DE TECNOLOGÍA' && i.school) {
        const c = clubSchools.get(i.school.id) ?? { name: i.school.nombre ?? '', distrito: i.school.distrito ?? '', encuentros: 0, asistentes: 0 }
        c.encuentros++; c.asistentes += i.asistentes ?? 0; clubSchools.set(i.school.id, c)
      }
    }
    return {
      total, byFed, byDistrict, acciones: [...acciones].sort((a, b) => CATEGORIAS.indexOf(CATEGORIA[a]) - CATEGORIAS.indexOf(CATEGORIA[b]) || a.localeCompare(b)),
      sub: [...sub.entries()].sort((a, b) => b[1].visitas - a[1].visitas), schools: schools.size, equipos,
      enc: { count: enc.length, asistentes: enc.reduce((a, i) => a + (i.asistentes ?? 0), 0), inscriptosP: paired.reduce((a, i) => a + (i.inscriptos ?? 0), 0), asistentesP: paired.reduce((a, i) => a + (i.asistentes ?? 0), 0) },
      byPropuesta: [...byPropuesta.entries()].sort((a, b) => b[1] - a[1]), encByDistrict: [...encByDistrict.entries()].sort((a, b) => b[1] - a[1]),
      clubSchools: [...clubSchools.values()].sort((a, b) => b.encuentros - a.encuentros).slice(0, 8),
    }
  }, [done])

  const totalDone = done.length
  const fedRows = feds.map(f => ({ fed: f, ...(m.byFed.get(f.id) ?? { counts: emptyCounts(), schools: new Set<string>(), last: '' }) }))
    .map(r => ({ ...r, total: r.counts.tecnica + r.counts.pedagogica + r.counts.institucional })).sort((a, b) => b.total - a.total)
  const maxFed = Math.max(1, ...fedRows.map(r => r.total))
  const cellMax = Math.max(1, ...[...m.byDistrict.values()].flatMap(r => [...r.values()]))
  const districts = [...m.byDistrict.keys()].sort((a, b) => (a === 'Sin escuela' ? 1 : b === 'Sin escuela' ? -1 : a.localeCompare(b)))

  if (!totalDone) return <div className="rounded-2xl border border-dashed border-dte-linea bg-white/60 p-10 text-center">
    <p className="font-semibold">Todavía no hay acciones realizadas en este período</p>
    <p className="mt-1 text-sm text-dte-gris">Las métricas cuentan las acciones marcadas como realizadas{planned ? ` (hay ${planned} planificadas)` : ''}.</p>
  </div>

  return <div className="flex flex-col gap-4">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi label="Acciones realizadas" value={nf.format(totalDone)} hint={planned ? `+${planned} planificadas` : undefined} />
      {CATEGORIAS.map(c => <Kpi key={c} label={CATEGORIA_LABEL[c]} value={nf.format(m.total[c])} hint={`${pct(m.total[c], totalDone)}% del total`} color={CAT_COLOR[c]} />)}
      <Kpi label="Escuelas alcanzadas" value={nf.format(m.schools)} />
      <Kpi label="Equipos intervenidos" value={nf.format(m.equipos)} hint="según la cantidad cargada" />
    </div>

    <Panel title="Acciones por FED" subtitle="Técnicas y pedagógicas realizadas por cada integrante del equipo" action={<Legend />}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-dte-gris"><th className="pb-2 font-semibold">FED</th><th className="pb-2 font-semibold">Distribución</th><th className="hidden pb-2 text-right font-semibold sm:table-cell">Técnicas</th><th className="hidden pb-2 text-right font-semibold sm:table-cell">Pedagógicas</th><th className="hidden pb-2 text-right font-semibold sm:table-cell">Instit.</th><th className="hidden pb-2 text-right font-semibold sm:table-cell">Total</th><th className="hidden pb-2 text-right font-semibold sm:table-cell">Escuelas</th></tr></thead>
          <tbody className="divide-y divide-dte-linea">{fedRows.map(r => <tr key={r.fed.id}>
            <td className="py-2.5 pr-3"><span className="block font-semibold">{r.fed.nombre_completo}</span><span className="block text-xs text-dte-tinta sm:hidden">{r.counts.tecnica} téc. · {r.counts.pedagogica} ped. · {r.counts.institucional} inst. · <b>{r.total}</b></span><span className="text-xs text-dte-gris">{r.last ? `Última: ${new Date(r.last + 'T00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}` : 'Sin acciones realizadas'}</span></td>
            <td className="w-[40%] py-2.5 sm:w-[30%] sm:pr-4"><StackedBar counts={r.counts} max={maxFed} /></td>
            <td className="hidden py-2.5 text-right tabular-nums sm:table-cell">{r.counts.tecnica}</td>
            <td className="hidden py-2.5 text-right tabular-nums sm:table-cell">{r.counts.pedagogica}</td>
            <td className="hidden py-2.5 text-right tabular-nums text-dte-gris sm:table-cell">{r.counts.institucional}</td>
            <td className="hidden py-2.5 text-right font-bold tabular-nums sm:table-cell">{r.total}</td>
            <td className="hidden py-2.5 text-right tabular-nums sm:table-cell">{r.schools.size}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </Panel>

    <Panel title="Acciones por distrito" subtitle="Cantidad de acciones realizadas por tipo en cada distrito">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr><th className="sticky left-0 bg-white pb-2 pr-3 text-left font-semibold text-dte-gris">Distrito</th>{m.acciones.map(a => <th key={a} className="px-1 pb-2 align-bottom font-semibold text-dte-gris"><span className="mx-auto block max-w-24 leading-tight" style={{ borderBottom: `2px solid ${CAT_COLOR[CATEGORIA[a]]}` }}>{titleCase(a)}</span></th>)}<th className="pb-2 pl-2 text-right font-semibold text-dte-gris">Total</th></tr></thead>
          <tbody>{districts.map(d => { const row = m.byDistrict.get(d)!; const tot = [...row.values()].reduce((a, b) => a + b, 0); return <tr key={d} className="border-t border-dte-linea">
            <td className="sticky left-0 bg-white py-1.5 pr-3 text-sm font-semibold">{titleCase(d)}</td>
            {m.acciones.map(a => { const v = row.get(a) ?? 0; return <td key={a} className="p-[2px] text-center"><span title={`${titleCase(d)} · ${titleCase(a)}: ${v}`} className={`block rounded py-1.5 tabular-nums ${v ? 'font-semibold' : 'text-dte-gris-claro'}`} style={v ? { background: `color-mix(in oklab, ${CAT_COLOR[CATEGORIA[a]]} ${Math.round(10 + (v / cellMax) * 35)}%, white)` } : undefined}>{v || '·'}</span></td> })}
            <td className="py-1.5 pl-2 text-right text-sm font-bold tabular-nums">{tot}</td>
          </tr> })}</tbody>
        </table>
      </div>
    </Panel>

    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Trabajo técnico" subtitle="Sub-acciones de las acciones técnicas · visitas y equipos">
        {m.sub.length ? <ul className="flex flex-col gap-2.5">{m.sub.slice(0, 10).map(([k, v]) => <HBar key={k} label={k} value={v.visitas} max={m.sub[0][1].visitas} sub={v.equipos ? `· ${v.equipos} equipos` : undefined} />)}</ul>
          : <p className="text-sm text-dte-gris">No hay sub-acciones cargadas en las acciones técnicas.</p>}
      </Panel>

      <Panel title="Clubes, talleres y prácticas" subtitle="Encuentros realizados y participación">
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-dte-fondo p-2"><p className="text-xl font-bold tabular-nums">{nf.format(m.enc.count)}</p><p className="text-[11px] text-dte-gris">encuentros</p></div>
          <div className="rounded-xl bg-dte-fondo p-2"><p className="text-xl font-bold tabular-nums">{nf.format(m.enc.asistentes)}</p><p className="text-[11px] text-dte-gris">asistentes</p></div>
          <div className="rounded-xl bg-dte-fondo p-2" title="Asistentes sobre inscriptos, sólo en encuentros que tienen ambos datos"><p className="text-xl font-bold tabular-nums">{m.enc.inscriptosP ? `${pct(m.enc.asistentesP, m.enc.inscriptosP)}%` : '—'}</p><p className="text-[11px] text-dte-gris">asistencia</p></div>
        </div>
        {m.byPropuesta.length > 0 && <><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dte-gris">Asistentes por propuesta</p><ul className="flex flex-col gap-2.5">{m.byPropuesta.slice(0, 6).map(([k, v]) => <HBar key={k} label={k} value={v} max={m.byPropuesta[0][1]} color={CAT_COLOR.pedagogica} />)}</ul></>}
        {m.encByDistrict.length > 0 && <><p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-dte-gris">Asistentes por distrito</p><ul className="flex flex-col gap-2.5">{m.encByDistrict.map(([k, v]) => <HBar key={k} label={titleCase(k)} value={v} max={m.encByDistrict[0][1]} color={CAT_COLOR.pedagogica} />)}</ul></>}
      </Panel>
    </div>

    {m.clubSchools.length > 0 && <Panel title="Escuelas con clubes activos" subtitle="Ordenadas por cantidad de encuentros del Club de Tecnología">
      <ul className="divide-y divide-dte-linea">{m.clubSchools.map(c => <li key={c.name + c.distrito} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0"><span className="line-clamp-2 font-semibold leading-snug">{titleCase(c.name)}</span><span className="text-xs text-dte-gris">{titleCase(c.distrito)}</span></span><span className="shrink-0 text-right tabular-nums"><span className="font-semibold">{c.encuentros}</span> <span className="text-xs text-dte-gris">encuentros · {c.asistentes} asistentes</span></span></li>)}</ul>
    </Panel>}
  </div>
}
