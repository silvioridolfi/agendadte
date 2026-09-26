'use client'

import { useMemo, useState } from 'react'
import { titleCase } from '@/lib/format'
import { CLUB_MAX_PARTICIPANTES, CLUB_MIN_ENCUENTROS, CLUB_DIAS_SIN_ACTIVIDAD, MODALIDADES, TIPOS_JORNADA, TRAYECTO_MARCA, clubEstado, ultimaActividad, type Club, type ClubEstado, type Fed, type Trayecto } from '@/lib/agenda'
import { DrillDialog, HBar, Kpi, Panel, type DrillRow } from '@/components/metrics'

const nf = new Intl.NumberFormat('es-AR')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const corta = (s: string) => parse(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')

export const ESTADO_CLUB: Record<ClubEstado, { label: string, color: string, badge: string }> = {
  activo: { label: 'Activo', color: '#00808f', badge: 'bg-[#e0f4f6] text-[#00606c]' },
  sin_actividad: { label: 'Sin actividad', color: '#b07400', badge: 'bg-[#fdf1d8] text-[#7a5200]' },
  finalizado: { label: 'Finalizado', color: '#5a2583', badge: 'bg-[#efe7f5] text-[#5a2583]' },
}
const ORDEN: ClubEstado[] = ['activo', 'sin_actividad', 'finalizado']

// Participación por club: por fecha se suman los grupos; inscriptos = máximo registrado, reales = promedio por encuentro.
function participacion(c: Club) {
  const porFecha = new Map<string, { ins: number, asi: number, hasIns: boolean, hasAsi: boolean }>()
  for (const e of c.encuentros) {
    const f = porFecha.get(e.fecha) ?? { ins: 0, asi: 0, hasIns: false, hasAsi: false }
    if (e.inscriptos != null) { f.ins += e.inscriptos; f.hasIns = true }
    if (e.asistentes != null) { f.asi += e.asistentes; f.hasAsi = true }
    porFecha.set(e.fecha, f)
  }
  const vals = [...porFecha.values()]
  const inscriptos = Math.max(0, ...vals.filter(v => v.hasIns).map(v => v.ins))
  const conAsi = vals.filter(v => v.hasAsi)
  const promedio = conAsi.length ? conAsi.reduce((a, v) => a + v.asi, 0) / conAsi.length : 0
  return { inscriptos, promedio }
}

// Clubes de Tecnología o Prácticas (PEAT). `desde`/`hasta`: período del tablero; se muestran los trayectos
// con actividad en el período y se cuentan sólo los encuentros de ese período.
export function ClubesView({ clubes: todos, feds, onCierre, schoolLabel, tipo = 'CLUB DE TECNOLOGÍA', desde, hasta, periodo }: { clubes: Club[], feds: Fed[], onCierre: (club: Club, fecha: string | null) => Promise<void>, schoolLabel: (c: Club) => string, tipo?: Trayecto, desde: string, hasta: string, periodo: string }) {
  const hoy = new Date().toISOString().slice(0, 10)
  const [busy, setBusy] = useState('')
  const [drill, setDrill] = useState<{ title: string, subtitle?: string, rows: DrillRow[] } | null>(null)
  const marca = TRAYECTO_MARCA[tipo]
  const clubesTxt = marca.plural
  // Trayectos con actividad en el período (del inicio al cierre o, si sigue abierto, hasta hoy) y sus encuentros del período.
  const clubes = useMemo(() => todos.filter(c => c.tipo === tipo && c.fecha_inicio <= hasta && (c.fecha_cierre ?? (clubEstado(c, hoy) === 'activo' ? hoy : ultimaActividad(c))) >= desde)
    .map(c => ({ ...c, encuentros: c.encuentros.filter(e => e.fecha >= desde && e.fecha <= hasta) })), [todos, tipo, desde, hasta, hoy])
  const completos = useMemo(() => new Map(todos.map(c => [c.id, c])), [todos])
  const fedName = (id: string) => feds.find(f => f.id === id)?.nombre_completo ?? '—'
  const rows = useMemo(() => clubes.map(c => { const full = completos.get(c.id)!; return { c, estado: clubEstado(full, hoy), realizados: new Set(c.encuentros.map(e => e.fecha)).size, total: new Set(full.encuentros.map(e => e.fecha)).size, ultima: ultimaActividad(full), fechas: [...new Set(full.encuentros.map(e => e.fecha))], ...participacion(c) } })
    .sort((a, b) => ORDEN.indexOf(a.estado) - ORDEN.indexOf(b.estado) || a.c.fecha_inicio.localeCompare(b.c.fecha_inicio)), [clubes, completos, hoy])
  const n = (e: ClubEstado) => rows.filter(r => r.estado === e).length
  const encuentros = rows.reduce((a, r) => a + r.realizados, 0)
  const cumplen = rows.filter(r => r.total >= CLUB_MIN_ENCUENTROS).length
  const conIns = rows.filter(r => r.inscriptos > 0 && r.promedio > 0)
  const retencion = pct(conIns.reduce((a, r) => a + r.promedio, 0), conIns.reduce((a, r) => a + r.inscriptos, 0))
  const alcance = rows.reduce((a, r) => a + r.inscriptos, 0)
  const encs = clubes.flatMap(c => c.encuentros)
  const jornadas = TIPOS_JORNADA.map(t => [t, encs.filter(e => e.tipo_jornada === t).length] as const)
  const formatos = MODALIDADES.map(m => [m, encs.filter(e => e.modalidad === m).length] as const)
  const sinJornada = encs.filter(e => !e.tipo_jornada).length
  // Propuestas dictadas dentro de los clubes (encuentros por propuesta).
  const propuestas = [...encs.reduce((m, e) => { const k = (e.propuesta ?? marca.propuesta).trim(); return m.set(k, (m.get(k) ?? 0) + 1) }, new Map<string, number>())].sort((a, b) => b[1] - a[1])
  // Escuelas y sedes donde se desarrollaron los encuentros (clubes y prácticas pueden hacerse fuera de la sede principal).
  const sedes = [...encs.reduce((m, e) => { const k = e.school?.nombre ? schoolLabel({ school: e.school, lugar: null } as Club) : e.lugar ?? 'Sin escuela'; return m.set(k, (m.get(k) ?? 0) + 1) }, new Map<string, number>())].sort((a, b) => b[1] - a[1])
  const porFed = feds.map(f => ({ f, r: rows.filter(r => r.c.fed_id === f.id) })).filter(x => x.r.length).sort((a, b) => b.r.length - a.r.length)
  const maxFed = Math.max(1, ...porFed.map(x => x.r.length))

  // Línea de tiempo: de marzo a diciembre del ciclo.
  const year = Number(hoy.slice(0, 4))
  const t0 = new Date(year, 2, 1).getTime(), t1 = new Date(year, 11, 31).getTime()
  const pos = (s: string) => Math.min(100, Math.max(0, ((parse(s).getTime() - t0) / (t1 - t0)) * 100))
  const meses = Array.from({ length: 10 }, (_, i) => new Date(year, 2 + i, 1))

  const nombre = (c: Club) => `${c.grupo ? `${c.grupo} · ` : ''}${schoolLabel(c)}`
  const clubRows = (list: typeof rows): DrillRow[] => list.map(r => ({ key: r.c.id, title: nombre(r.c), sub: [fedName(r.c.fed_id), `${r.total} encuentros`, r.c.fecha_cierre ? `cierre ${corta(r.c.fecha_cierre)}` : `último ${corta(r.ultima)}`].join(' · '), right: ESTADO_CLUB[r.estado].label }))
  const verEstado = (e: ClubEstado, titulo: string) => { const l = rows.filter(r => r.estado === e); setDrill({ title: titulo, subtitle: `${l.length} ${clubesTxt} · ${periodo}`, rows: clubRows(l) }) }
  const verEncuentros = () => {
    const l = rows.flatMap(r => [...new Set(r.c.encuentros.map(e => e.fecha))].map(f => ({ r, f, props: [...new Set(r.c.encuentros.filter(e => e.fecha === f).map(e => e.propuesta ?? marca.propuesta))] }))).sort((a, b) => b.f.localeCompare(a.f))
    setDrill({ title: 'Encuentros realizados', subtitle: `${l.length} encuentros · ${periodo}`, rows: l.map(({ r, f, props }) => ({ key: `${r.c.id}-${f}`, title: nombre(r.c), sub: [fedName(r.c.fed_id), props.join(', ')].join(' · '), right: corta(f) })) })
  }
  const verParticipacion = () => setDrill({ title: 'Participación real', subtitle: `Promedio de participantes por encuentro vs. inscriptos · ${periodo}`, rows: conIns.map(r => ({ key: r.c.id, title: nombre(r.c), sub: `${nf.format(Math.round(r.promedio * 10) / 10)} participantes promedio de ${r.inscriptos} inscriptos`, right: `${pct(r.promedio, r.inscriptos)}%` })) })

  async function cierre(club: Club, fecha: string | null) { setBusy(club.id); try { await onCierre(club, fecha) } finally { setBusy('') } }

  return <div className="flex flex-col gap-4">
    <DrillDialog drill={drill} onClose={() => setDrill(null)} />
    <div className={`relative overflow-hidden rounded-2xl px-5 py-4 text-white shadow-xs ${marca.degradado}`}>
      <div className="flex flex-wrap items-center gap-4">
        <img src={marca.logo} alt={marca.nombre} className="h-14 w-auto drop-shadow" />
        <div><p className="text-xs font-semibold uppercase tracking-wider text-white/85">{tipo === 'CLUB DE TECNOLOGÍA' ? 'Línea prioritaria DTE 2025–2027' : marca.nombre} · {periodo}</p><p className="mt-0.5 text-sm text-white/95">{tipo === 'CLUB DE TECNOLOGÍA' ? `Mínimo ${CLUB_MIN_ENCUENTROS} encuentros por club y hasta ${CLUB_MAX_PARTICIPANTES} participantes. Cada grado es un club. ` : 'Cada grupo de estudiantes es una práctica con inicio y cierre. '}Pasa a “sin actividad” tras {CLUB_DIAS_SIN_ACTIVIDAD} días hábiles sin encuentros (sin contar el receso invernal).</p></div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi label={`${cap(clubesTxt)} activ${tipo === 'CLUB DE TECNOLOGÍA' ? 'os' : 'as'}`} value={nf.format(n('activo'))} hint={`de ${rows.length} con actividad en el período`} color={ESTADO_CLUB.activo.color} onClick={() => verEstado('activo', `${cap(clubesTxt)} activ${tipo === 'CLUB DE TECNOLOGÍA' ? 'os' : 'as'}`)} />
      <Kpi label="Sin actividad" value={nf.format(n('sin_actividad'))} hint="a confirmar cierre" color={ESTADO_CLUB.sin_actividad.color} onClick={() => verEstado('sin_actividad', 'Sin actividad')} />
      <Kpi label={tipo === 'CLUB DE TECNOLOGÍA' ? 'Finalizados' : 'Finalizadas'} value={nf.format(n('finalizado'))} color={ESTADO_CLUB.finalizado.color} onClick={() => verEstado('finalizado', tipo === 'CLUB DE TECNOLOGÍA' ? 'Finalizados' : 'Finalizadas')} />
      <Kpi label="Encuentros realizados" value={nf.format(encuentros)} hint={`${cumplen} con ${CLUB_MIN_ENCUENTROS} o más en total`} onClick={verEncuentros} />
      <Kpi label="Participación real" value={conIns.length ? `${retencion}%` : '—'} hint={`promedio por encuentro vs. ${nf.format(alcance)} inscriptos`} onClick={verParticipacion} />
    </div>

    <Panel title={`Recorrido de cada ${marca.corto}`} subtitle="Del primer encuentro al cierre (o al último registro). Cada marca es un encuentro.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead><tr className="text-left text-xs text-dte-gris">
            <th className="pb-2 pr-3 font-semibold">Grupo y escuela</th>
            <th className="w-[34%] pb-2 pr-3 font-semibold"><div className="relative h-4">{meses.map(m => <span key={m.getMonth()} className="absolute -translate-x-0 capitalize" style={{ left: `${pos(`${year}-${String(m.getMonth() + 1).padStart(2, '0')}-01`)}%` }}>{m.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</span>)}</div></th>
            <th className="pb-2 pr-3 font-semibold">Encuentros</th>
            <th className="pb-2 pr-3 text-right font-semibold">Inscriptos</th>
            <th className="pb-2 pr-3 text-right font-semibold">Prom. reales</th>
            <th className="pb-2 font-semibold">Estado</th>
          </tr></thead>
          <tbody className="divide-y divide-dte-linea">{rows.map(({ c, estado, realizados, total, fechas, ultima, inscriptos, promedio }) => {
            const st = ESTADO_CLUB[estado], prev = c.encuentros_previstos ?? CLUB_MIN_ENCUENTROS
            const fin = c.fecha_cierre ?? ultima
            return <tr key={c.id} className="align-middle">
              <td className="py-2.5 pr-3"><p className="flex max-w-[20rem] items-center gap-1.5 font-semibold" title={c.school?.nombre ?? c.lugar ?? ''}>{c.grupo && <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: marca.acento }}>{c.grupo}</span>}<span className="truncate">{schoolLabel(c)}</span></p><p className="text-xs text-dte-gris">{[c.escuela_origen ? `Estudiantes de ${schoolLabel({ school: c.escuela_origen, lugar: null } as Club)}` : null, c.school?.distrito ? titleCase(c.school.distrito) : null, fedName(c.fed_id)].filter(Boolean).join(' · ')}</p>{(() => { const n = new Set(completos.get(c.id)!.encuentros.map(e => e.school_id ?? e.lugar)).size; return n > 1 ? <p className="text-[11px] font-semibold" style={{ color: marca.acento }}>{n} sedes</p> : null })()}</td>
              <td className="py-2.5 pr-3"><div className="relative h-5" role="img" aria-label={`Del ${corta(c.fecha_inicio)} al ${corta(fin)}`}>
                <div className="absolute inset-y-[7px] left-0 right-0 rounded bg-dte-fondo" />
                <div className="absolute inset-y-[5px] rounded" style={{ left: `${pos(c.fecha_inicio)}%`, width: `${Math.max(0.8, pos(fin) - pos(c.fecha_inicio))}%`, background: st.color, opacity: estado === 'finalizado' ? 0.55 : 0.85 }} title={`${corta(c.fecha_inicio)} → ${c.fecha_cierre ? `cierre ${corta(c.fecha_cierre)}` : `último ${corta(ultima)}`}`} />
                {fechas.map(f => <span key={f} className="absolute top-[3px] h-[14px] w-[2px] rounded bg-white/90" style={{ left: `${pos(f)}%` }} />)}
                <span className="absolute top-0 h-5 w-px bg-dte-magenta" style={{ left: `${pos(hoy)}%` }} title="Hoy" />
              </div><p className="text-[11px] text-dte-gris">{corta(c.fecha_inicio)} → {c.fecha_cierre ? `cierre ${corta(c.fecha_cierre)}` : `último ${corta(ultima)}`}</p></td>
              <td className="py-2.5 pr-3"><div className="flex items-center gap-2"><div className="h-2 w-20 rounded bg-dte-fondo"><div className="h-full rounded" style={{ width: `${Math.min(100, pct(total, prev))}%`, background: total >= CLUB_MIN_ENCUENTROS ? '#00808f' : '#7d5a95' }} /></div><span className="tabular-nums" title={realizados !== total ? `${realizados} en el período` : undefined}><b>{total}</b><span className="text-dte-gris">/{prev}</span></span></div></td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{inscriptos || '—'}{inscriptos > CLUB_MAX_PARTICIPANTES && <span className="ml-1 text-[11px] text-[#7a5200]" title={`Supera los ${CLUB_MAX_PARTICIPANTES} sugeridos`}>▲</span>}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{promedio ? nf.format(Math.round(promedio * 10) / 10) : '—'}</td>
              <td className="py-2.5"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.badge}`}>{st.label}</span>
                {estado === 'finalizado' ? <button disabled={busy === c.id} onClick={() => cierre(c, null)} className="rounded-full border border-dte-linea px-2.5 py-0.5 text-xs font-semibold text-dte-petroleo transition hover:border-dte-petroleo hover:bg-dte-tinte disabled:opacity-50">Reactivar</button>
                  : <button disabled={busy === c.id} onClick={() => cierre(c, ultima)} title={`Finalizar con fecha ${corta(ultima)} (último encuentro)`} className="rounded-full border border-dte-linea px-2.5 py-0.5 text-xs font-semibold text-[#5a2583] transition hover:border-[#5a2583] hover:bg-[#efe7f5] disabled:opacity-50">Finalizar</button>}
              </div></td>
            </tr>
          })}</tbody>
        </table>
        {!rows.length && <p className="py-8 text-center text-sm text-dte-gris">No hay {clubesTxt} con actividad en este período.</p>}
      </div>
    </Panel>

    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={`${cap(clubesTxt)} por FED`} subtitle="Activos, sin actividad y finalizados">
        <ul className="flex flex-col gap-2.5">{porFed.map(({ f, r }) => <li key={f.id} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{f.nombre_completo}</span>
          <span className="flex h-2.5 gap-[2px]">{ORDEN.map(e => { const k = r.filter(x => x.estado === e).length; return k ? <span key={e} title={`${ESTADO_CLUB[e].label}: ${k}`} className="h-full first:rounded-l last:rounded-r" style={{ width: `${(k / maxFed) * 100}%`, background: ESTADO_CLUB[e].color }} /> : null })}</span>
          <span className="tabular-nums font-semibold">{r.length}</span>
        </li>)}</ul>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dte-gris">{ORDEN.map(e => <li key={e} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: ESTADO_CLUB[e].color }} />{ESTADO_CLUB[e].label}</li>)}</ul>
      </Panel>
      <Panel title={`Propuestas dictadas en ${tipo === 'CLUB DE TECNOLOGÍA' ? 'los clubes' : 'las prácticas'}`} subtitle="Registros por propuesta (talleres y actividades dentro del trayecto)">
        <ul className="flex flex-col gap-2">{propuestas.map(([k, v]) => <HBar key={k} label={k} value={v} max={Math.max(1, ...propuestas.map(x => x[1]))} color="#c21d6a" />)}</ul>
      </Panel>
      <Panel title="Escuelas y sedes" subtitle={`Dónde se desarrollaron los encuentros de ${tipo === 'CLUB DE TECNOLOGÍA' ? 'los clubes' : 'las prácticas'} (registros)`}>
        <ul className="flex flex-col gap-2">{sedes.map(([k, v]) => <HBar key={k} label={k} value={v} max={Math.max(1, ...sedes.map(x => x[1]))} color="#0e4870" />)}</ul>
      </Panel>
      <Panel title="Tipo de jornada" subtitle={sinJornada ? `${sinJornada} registros previos sin este dato` : 'Registros de encuentros'}>
        <ul className="flex flex-col gap-2">{jornadas.map(([t, k]) => <HBar key={t} label={t} value={k} max={Math.max(1, ...jornadas.map(x => x[1]))} color="#7d5a95" />)}</ul>
      </Panel>
      <Panel title="Formato de participación" subtitle="Registros de encuentros">
        <ul className="flex flex-col gap-2">{formatos.map(([m, k]) => <HBar key={m} label={m} value={k} max={Math.max(1, ...formatos.map(x => x[1]))} color="#00808f" />)}</ul>
      </Panel>
    </div>
  </div>
}
