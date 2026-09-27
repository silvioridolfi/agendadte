'use client'

import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { InformeBloque, personaDe } from '@/components/app/informes'
import { informeFed } from '@/lib/informes'
import { Camera, Clock, FileBarChart, MapPin } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { titleCase } from '@/lib/format'
import { franjasDte, textoFranjas } from '@/lib/ddjj'
import { clubEstado, iniciado, type AgendaItem, type Club, type Fed } from '@/lib/agenda'
import { fmt, iso, parse, fedColor, initials, Skeleton } from '@/components/app/comun'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']

// Mi equipo (coordinación, solo lectura): perfil, DD.JJ. de horarios y resumen del período de cada FED.
export function MiEquipoView({ feds, todos, items, clubes, noHabiles, periodo, desde, hasta, onSelect, onVerAcciones }: { feds: Fed[], todos: Fed[], items: AgendaItem[] | null, clubes: Club[] | null, noHabiles: Set<string>, periodo: string, desde: string, hasta: string, onSelect: (i: AgendaItem) => void, onVerAcciones: (fedId: string) => void }) {
  // Informe del período de un FED (el mismo que ve en su tablero), con descarga en Excel o PDF.
  const [informe, setInforme] = useState<Fed | null>(null)
  const hoy = iso(new Date())
  const resumen = useMemo(() => new Map(feds.map(f => {
    const propias = (items ?? []).filter(i => i.fed_id === f.id)
    const realizadas = propias.filter(i => i.estado === 'realizada')
    const planificadas = propias.filter(i => i.estado === 'planificada' || i.estado === 'reprogramada').length
    const ultima = realizadas.reduce<string | null>((m, i) => (!m || i.fecha > m ? i.fecha : m), null)
    const activos = (clubes ?? []).filter(iniciado).filter(c => c.fed_id === f.id && clubEstado(c, hoy, noHabiles) === 'activo')
    return [f.id, { realizadas: realizadas.length, planificadas, ultima, clubes: activos.filter(c => c.tipo === 'CLUB DE TECNOLOGÍA').length, practicas: activos.filter(c => c.tipo !== 'CLUB DE TECNOLOGÍA').length }]
  })), [feds, items, clubes, hoy, noHabiles])

  if (!items) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-72" />)}</div>
  return <div className="flex flex-col gap-3">
    <p className="text-sm text-dte-gris">Datos declarados por cada FED y resumen de {periodo.toLowerCase()}. Solo lectura.</p>
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{feds.map(f => {
      const r = resumen.get(f.id)!
      return <li key={f.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-dte-linea bg-white p-4 shadow-xs">
        <header className="flex items-center gap-3">
          <Avatar className="size-10"><AvatarFallback className={`${fedColor(feds, f.id)} text-sm font-bold text-dte-petroleo-oscuro`}>{initials(f.nombre_completo)}</AvatarFallback></Avatar>
          <div className="min-w-0">
            <h3 className="truncate font-bold">{f.nombre_completo}</h3>
            <p className="flex items-center gap-1 text-xs text-dte-gris"><MapPin className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{f.distritos_a_cargo.length ? f.distritos_a_cargo.map(titleCase).join(', ') : 'Sin distritos asignados'}</span></p>
            {f.carga_horaria && <p className="flex items-center gap-1 text-xs text-dte-gris"><Clock className="size-3.5 shrink-0" aria-hidden />{f.carga_horaria}</p>}
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {([['Realizadas', r.realizadas], ['Planificadas', r.planificadas], ['Clubes', r.clubes], ['Prácticas', r.practicas]] as const).map(([l, n]) =>
            <div key={l} className="rounded-xl bg-dte-fondo px-2 py-2"><dt className="text-xs text-dte-gris">{l}</dt><dd className="text-lg font-bold tabular-nums">{n}</dd></div>)}
        </dl>
        <p className="text-xs text-dte-gris">{r.ultima ? <>Última acción realizada: <b className="text-dte-tinta">{fmt(parse(r.ultima), { weekday: 'long', day: 'numeric', month: 'long' })}</b></> : 'Sin acciones realizadas en el período.'}</p>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-dte-gris">Horarios (DD.JJ.)</p>
          {f.ddjj?.length ? <ul className="divide-y divide-dte-linea rounded-xl border border-dte-linea text-sm">{DIAS.map((d, i) => {
            const dj = f.ddjj.find(x => x.dia === i + 1)
            const fr = franjasDte(dj), dte = fr.length ? textoFranjas(fr) : dj?.dte ?? ''
            return <li key={d} className="grid grid-cols-[2.5rem_1fr] gap-2 px-3 py-1.5">
              <span className="font-semibold">{d}</span>
              <span className="min-w-0">{dte ? <span className="block tabular-nums">DTE {dte}</span> : <span className="block text-dte-gris-claro">Sin horario DTE</span>}{dj?.cargos?.map(c => <span key={c.nombre + c.desde} className="block text-xs text-dte-gris">{c.nombre}: {c.desde} a {c.hasta}</span>)}{dj?.externo && <span className="block text-xs text-dte-gris">Nota: {dj.externo}</span>}</span>
            </li>
          })}</ul> : <p className="rounded-xl border border-dashed border-dte-linea px-3 py-3 text-sm text-dte-gris">Todavía no cargó su DD.JJ. de horarios.</p>}
        </div>

        <div className="mt-auto flex gap-2">
          <button type="button" onClick={() => setInforme(f)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-dte-linea px-3 text-sm font-semibold text-dte-petroleo transition hover:border-dte-petroleo hover:bg-dte-tinte md:min-h-9"><FileBarChart className="size-4" />Informe</button>
          <button type="button" onClick={() => onVerAcciones(f.id)} className="min-h-11 flex-1 rounded-lg border border-dte-linea text-sm font-semibold text-dte-petroleo transition hover:border-dte-petroleo hover:bg-dte-tinte md:min-h-9">Ver acciones del período</button>
          {f.carpeta_fotos_url ? <a href={f.carpeta_fotos_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-dte-linea px-3 text-sm font-semibold text-dte-petroleo transition hover:border-dte-petroleo hover:bg-dte-tinte md:min-h-9"><Camera className="size-4" />Fotos</a>
            : <span className="inline-flex min-h-11 items-center px-2 text-xs text-dte-gris md:min-h-9">Sin carpeta de fotos</span>}
        </div>
      </li>
    })}</ul>
    <Dialog open={!!informe} onOpenChange={o => !o && setInforme(null)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white sm:max-w-2xl">
        <DialogTitle className="sr-only">Informe de {informe?.nombre_completo}</DialogTitle>
        {informe && <InformeBloque titulo={`Informe de ${informe.nombre_completo}`} subtitulo={`Acciones realizadas en ${periodo.toLowerCase()}.`} persona={personaDe(informe)} desde={desde} hasta={hasta} indicadores={informeFed((items ?? []).filter(i => i.fed_id === informe.id))} items={(items ?? []).filter(i => i.fed_id === informe.id)} feds={todos} onSelect={i => { setInforme(null); onSelect(i) }} />}
      </DialogContent>
    </Dialog>
  </div>
}
