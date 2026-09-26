'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clock, Loader2, Plus, School as SchoolIcon, Search, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CAT_COLOR } from '@/components/metrics'
import { ACCIONES, CATEGORIAS, CATEGORIA, CATEGORIA_LABEL, CON_ENCUENTRO, ESTADOS, SUB_ACCIONES, type Accion, type AgendaItem, type AgendaItemInput, type Encuentro, type Estado, type Fed, type Feriado, type School, type Club, type Modalidad, type TipoJornada, MODALIDADES, TIPOS_JORNADA, CLUB_MIN_ENCUENTROS, clubEstado, clubEncuentrosRealizados, NIVELES, SECCIONES, nivelDeEscuela, esTrayecto, TRAYECTO_MARCA, RECORDATORIO_LICENCIA } from '@/lib/agenda'
import { actionStyle, statusStyle, az, azOtroAlFinal, selectClass, iso, parse, fmt, hhmm, schoolName, shortSchoolName, schoolPlace, ddjjFor, searchSchools, getClubes, getFedItems, getFeriados, saveItem, errMsg, ErrorBox, ItemPreset, addDays, cap, DIAS_HABILES } from '@/components/app/comun'
import { encolarOffline } from '@/components/app/offline'

// =====================================================================

export function SchoolPicker({ value, onChange }: { value: School | null, onChange: (s: School | null) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<School[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const seq = useRef(0)
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setLoading(false); return }
    const n = ++seq.current
    setLoading(true); setFailed(false)
    const t = setTimeout(() => searchSchools(query)
      .then(r => { if (n === seq.current) { setResults([...r].sort((a, b) => az(a.nombre ?? '', b.nombre ?? ''))); setActive(0) } })
      .catch(() => { if (n === seq.current) { setResults([]); setFailed(true) } })
      .finally(() => { if (n === seq.current) setLoading(false) }), 250)
    return () => clearTimeout(t)
  }, [query])
  const pick = (s: School) => { onChange(s); setQuery(''); setOpen(false) }

  if (value) return <div className="flex items-center gap-3 rounded-lg border border-pba-celeste/60 bg-pba-celeste/5 p-2.5 pl-3 font-normal">
    <SchoolIcon className="size-4 shrink-0 text-pba-celeste-texto" />
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{schoolName(value)}</p><p className="truncate text-xs text-dte-gris">CUE {value.cue ?? '—'}{schoolPlace(value) ? ` · ${schoolPlace(value)}` : ''}</p></div>
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>Cambiar</Button>
  </div>

  const showList = open && query.trim().length >= 2
  return <div className="relative">
    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dte-gris-claro" />
    <Input role="combobox" aria-expanded={showList} aria-controls="school-results" aria-autocomplete="list" className="h-10 pl-9 font-normal" placeholder="Nombre, localidad o CUE…" value={query}
      onChange={e => { setQuery(e.target.value); setOpen(true) }} onFocus={e => { setOpen(true); e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' }) }} onBlur={() => setTimeout(() => setOpen(false), 150)}
      onKeyDown={e => {
        if (!showList || !results.length) return
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
        else if (e.key === 'Enter') { e.preventDefault(); pick(results[active]) }
        else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
      }} />
    {showList && <div id="school-results" role="listbox" className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-dte-linea bg-white p-1 text-sm font-normal text-dte-tinta shadow-xl">
      {loading ? <p className="flex items-center gap-2 p-3 text-dte-gris"><Loader2 className="size-4 animate-spin" />Buscando…</p>
        : failed ? <p className="p-3 text-[#a3164f]">No se pudo buscar. Probá de nuevo.</p>
        : !results.length ? <p className="p-3 text-dte-gris">Sin resultados para “{query.trim()}”.</p>
        : results.map((s, i) => <button key={s.id} type="button" role="option" aria-selected={i === active} onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => pick(s)} className={`block w-full rounded-lg px-3 py-2 text-left ${i === active ? 'bg-dte-tinte' : ''}`}>
          <span className="block font-semibold leading-snug">{schoolName(s)}</span>
          <span className="block text-xs text-dte-gris">CUE {s.cue ?? '—'}{schoolPlace(s) ? ` · ${schoolPlace(s)}` : ''}</span>
        </button>)}
    </div>}
  </div>
}

export function Field({ label, hint, required, children, className = '' }: { label: string, hint?: string, required?: boolean, children: React.ReactNode, className?: string }) {
  return <label className={`flex flex-col gap-1.5 ${className}`}><span className="text-sm font-semibold text-dte-tinta">{label}{required && <span className="text-dte-magenta"> *</span>}{hint && <span className="ml-1 font-normal text-dte-gris">{hint}</span>}</span>{children}</label>
}

export function ItemForm({ fed, feds, item, defaultFecha, preset, onCancel, onSaved }: { fed: Fed, feds: Fed[], item: AgendaItem | null, defaultFecha?: string, preset?: ItemPreset, onCancel: () => void, onSaved: (r: { creadas: number, offline?: boolean }) => void }) {
  // Compañeros etiquetados: la acción aparece también en su calendario y reciben una notificación.
  const [participantes, setParticipantes] = useState<string[]>(() => item?.participantes?.map(p => p.fed_id) ?? preset?.participantes ?? [])
  const companeros = useMemo(() => feds.filter(f => f.id !== fed.id).sort((a, b) => (a.rol === b.rol ? az(a.nombre_completo, b.nombre_completo) : a.rol === 'coordinacion' ? 1 : -1)), [feds, fed.id])
  const togglePart = (id: string) => setParticipantes(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]))
  const [school, setSchool] = useState<School | null>(item?.school ?? null)
  // Encuentro editable desde la app: el propio (origen app) o, si no hay, el primero importado.
  const enc0 = item?.encuentros?.find(e => e.origen === 'app') ?? item?.encuentros?.[0]
  const [form, setForm] = useState({ fecha: item?.fecha ?? defaultFecha ?? iso(new Date()), hora_inicio: hhmm(item?.hora_inicio ?? null), hora_fin: hhmm(item?.hora_fin ?? null), accion: item?.accion ?? preset?.accion ?? null as Accion | null, estado: item?.estado ?? ('planificada' as Estado), sub_accion: item?.sub_accion ?? preset?.sub_accion ?? '', detalle: item?.detalle ?? '', lugar: item?.lugar ?? '', cantidad: item?.cantidad?.toString() ?? '', encuentro_n: enc0?.encuentro_n?.toString() ?? '', propuesta: enc0?.propuesta ?? '', destinatarios: enc0?.destinatarios ?? '', modalidad: enc0?.modalidad ?? ('Presencial' as Modalidad), inscriptos: enc0?.inscriptos?.toString() ?? '', asistentes: enc0?.asistentes?.toString() ?? '', tipo_jornada: enc0?.tipo_jornada ?? ('' as TipoJornada | ''), descripcion: enc0?.descripcion ?? '', club_id: enc0?.club_id ?? item?.club_id ?? '', nivel: '', curso: '', seccion: '', encuentros_previstos: '', es_cierre: enc0?.es_cierre ?? false })
  // Clubes y prácticas: registro por grupo con inicio y cierre (cada uno con su identidad visual).
  const esClub = esTrayecto(form.accion)
  const marca = esClub ? TRAYECTO_MARCA[form.accion as keyof typeof TRAYECTO_MARCA] : TRAYECTO_MARCA['CLUB DE TECNOLOGÍA']
  const esParo = form.accion === 'PARO', esLicencia = form.accion === 'LICENCIA'
  const conSubAccion = !!form.accion && !esClub && !esParo && !esLicencia
  // Clubes del FED (para elegir a cuál corresponde el encuentro). Los finalizados sólo si es el del encuentro que se edita.
  const [clubes, setClubes] = useState<Club[] | null>(null)
  useEffect(() => { if (esClub && !clubes) getClubes(fed.id).then(setClubes).catch(() => setClubes([])) }, [esClub, clubes, fed.id])
  const hoy = iso(new Date())
  const clubOpts = (clubes ?? []).filter(c => c.tipo === form.accion && (c.id === form.club_id || clubEstado(c, hoy) !== 'finalizado'))
  const club = clubOpts.find(c => c.id === form.club_id) ?? null
  const clubLabel = (c: Club) => `${c.school ? shortSchoolName(c.school) : c.lugar ?? 'Sin lugar'}${c.grupo ? ` · ${c.grupo}` : ''}${c.escuela_origen ? ` · estudiantes de ${shortSchoolName(c.escuela_origen)}` : ''} · desde ${fmt(parse(c.fecha_inicio), { day: 'numeric', month: 'short' })}${clubEstado(c, hoy) === 'sin_actividad' ? ' (sin actividad)' : ''}`
  // Grado/curso del club nuevo: nivel sugerido por el nombre de la escuela, editable (cualquier nivel o modalidad).
  const nivelId = form.nivel || nivelDeEscuela(school?.nombre)
  const nivel = NIVELES.find(n => n.id === nivelId) ?? NIVELES[0]
  const grupo = form.curso ? `${form.curso}${form.seccion ? ` ${form.seccion}` : ''}` : ''
  function pickClub(id: string) {
    const c = clubes?.find(x => x.id === id)
    setForm(f => ({ ...f, club_id: id, encuentros_previstos: c?.encuentros_previstos?.toString() ?? f.encuentros_previstos,
      encuentro_n: !item && c ? String(clubEncuentrosRealizados(c) + 1) : f.encuentro_n }))
    // La sede del club se sugiere sólo si todavía no se eligió escuela (las prácticas pueden hacerse en otras sedes).
    if (c?.school && !school) setSchool(c.school)
  }
  // Escuela de origen de los estudiantes, cuando el trayecto se desarrolla en otra sede (ej.: prácticas).
  const [origen, setOrigen] = useState<School | null>(null)
  const [otroOrigen, setOtroOrigen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))
  const toNum = (v: string) => (v.trim() === '' ? null : Number(v))
  const cat = form.accion ? CATEGORIA[form.accion] : null
  const conEncuentro = !!form.accion && CON_ENCUENTRO.includes(form.accion)
  const timeError = form.hora_inicio && form.hora_fin && form.hora_fin <= form.hora_inicio ? 'La hora de fin tiene que ser posterior a la de inicio.' : ''
  // Horario DTE declarado para ese día (DD.JJ.). Sólo avisa, no impide guardar.
  const ddjjDia = ddjjFor(fed, form.fecha)
  // Repetir (sólo al crear): mismos datos los días elegidos hasta una fecha, salteando feriados y recesos.
  const [repetir, setRepetir] = useState(false)
  const [dias, setDias] = useState<number[]>([])
  const [hasta, setHasta] = useState('')
  const diaFecha = parse(form.fecha).getDay()
  const diasSerie = dias.length ? dias : diaFecha >= 1 && diaFecha <= 5 ? [diaFecha] : []
  const hastaSerie = hasta || iso(addDays(parse(form.fecha), 7 * 8))
  // Avisos al cargar: superposición, feriado, fin de semana, sin DD.JJ., realizada a futuro. No impiden guardar.
  const [delDia, setDelDia] = useState<{ items: AgendaItem[], feriados: Feriado[] }>({ items: [], feriados: [] })
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fecha)) return
    let alive = true
    Promise.all([getFedItems(fed.id, form.fecha, form.fecha).catch(() => []), getFeriados(form.fecha, form.fecha).catch(() => [])])
      .then(([items, fer]) => alive && setDelDia({ items: items.filter(i => i.id !== item?.id), feriados: fer.filter(f => !f.distrito || fed.distritos_a_cargo.includes(f.distrito)) }))
    return () => { alive = false }
  }, [form.fecha, fed.id, fed.distritos_a_cargo, item?.id])
  const avisos = useMemo(() => {
    const out: string[] = []
    if (!form.accion || esLicencia) return out
    const d = parse(form.fecha).getDay()
    if (d === 0 || d === 6) out.push('La fecha cae en fin de semana.')
    for (const f of delDia.feriados) out.push(`${cap(fmt(parse(f.fecha), { weekday: 'long', day: 'numeric', month: 'long' }))} es ${f.tipo === 'receso' ? 'receso escolar' : 'feriado'}: ${f.nombre}${f.confirmado ? '' : ' (a confirmar)'}.`)
    if (!esParo && d >= 1 && d <= 5 && fed.ddjj?.length && !ddjjFor(fed, form.fecha)) out.push('No tenés horario DTE declarado ese día en la DD.JJ.')
    const solapa = delDia.items.filter(i => i.estado !== 'cancelada' && (
      (form.hora_inicio && i.hora_inicio && (form.hora_inicio < (hhmm(i.hora_fin) || hhmm(i.hora_inicio)) || form.hora_inicio === hhmm(i.hora_inicio)) && (hhmm(i.hora_inicio) < (form.hora_fin || form.hora_inicio) || form.hora_inicio === hhmm(i.hora_inicio)))
      || (school && i.school_id === school.id && i.accion === form.accion)))
    for (const i of solapa) out.push(`Ya tenés ${cap(i.accion.toLowerCase())} ${i.hora_inicio ? `a las ${hhmm(i.hora_inicio)} ` : ''}ese día${i.school ? ` en ${shortSchoolName(i.school)}` : ''}.`)
    if (form.estado === 'realizada' && form.fecha > iso(new Date())) out.push('Está marcada como realizada pero la fecha todavía no llegó.')
    return out
  }, [form.accion, form.fecha, form.hora_inicio, form.hora_fin, form.estado, delDia, fed, school, esLicencia, esParo])
  const fueraDeHorario = !!ddjjDia?.dte_desde && !!ddjjDia?.dte_hasta && ((!!form.hora_inicio && form.hora_inicio < ddjjDia.dte_desde) || (!!form.hora_fin && form.hora_fin > ddjjDia.dte_hasta))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.accion) { setError('Elegí el tipo de acción.'); return }
    if (timeError) { setError(timeError); return }
    if (esClub && !form.club_id) { setError(`Elegí a qué ${marca.corto} corresponde el encuentro, o iniciá uno nuevo.`); return }
    if (esClub && form.club_id === 'nuevo' && !form.curso) { setError(`Indicá el grado o curso (y sección): cada grupo es un ${marca.corto}.`); return }
    if (repetir && !item && (!diasSerie.length || hastaSerie <= form.fecha)) { setError('Para repetir, elegí al menos un día y una fecha de fin posterior.'); return }
    setSaving(true); setError('')
    const input: AgendaItemInput = {
      repeticion: repetir && !item ? { dias: diasSerie, hasta: hastaSerie } : null,
      fed_id: fed.id, school_id: esLicencia || esParo ? null : school?.id ?? null, lugar: school || esLicencia || esParo ? null : form.lugar || null, fecha: form.fecha, accion: form.accion, estado: form.estado,
      hora_inicio: esParo ? null : form.hora_inicio || null, hora_fin: esParo ? null : form.hora_fin || null, sub_accion: conSubAccion ? form.sub_accion : null, detalle: form.detalle,
      cantidad: cat === 'tecnica' ? toNum(form.cantidad) : null,
      participantes: esParo || esLicencia ? [] : participantes,
      encuentro: conEncuentro ? { id: enc0?.id, propuesta: form.propuesta, encuentro_n: toNum(form.encuentro_n), modalidad: form.modalidad, destinatarios: form.destinatarios, inscriptos: toNum(form.inscriptos), asistentes: toNum(form.asistentes),
        ...(esClub ? { tipo_jornada: form.tipo_jornada || null, descripcion: form.descripcion, club_id: form.club_id && form.club_id !== 'nuevo' ? form.club_id : null, nuevo_club: form.club_id === 'nuevo', grupo: grupo, escuela_origen_id: otroOrigen ? origen?.id ?? null : null, encuentros_previstos: toNum(form.encuentros_previstos), es_cierre: form.es_cierre } : {}) } : null,
    }
    // Sin conexión: queda en cola en este dispositivo y se envía al volver la señal.
    if (typeof navigator !== 'undefined' && !navigator.onLine) { encolarOffline(input, item?.id); onSaved({ creadas: 1, offline: true }); return }
    try { const r = await saveItem(input, item?.id); onSaved({ creadas: r.creadas }) } catch (err) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) { encolarOffline(input, item?.id); onSaved({ creadas: 1, offline: true }); return }
      setError(errMsg(err)); setSaving(false)
    }
  }

  return <form onSubmit={submit} className="flex flex-col gap-5">
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Tipo de acción <span className="text-dte-magenta">*</span></legend>
      <div className="flex flex-col gap-3">{CATEGORIAS.map(c => <div key={c}>
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-dte-gris"><span className="size-2 rounded-sm" style={{ background: CAT_COLOR[c] }} />{CATEGORIA_LABEL[c]}</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">{ACCIONES.filter(name => CATEGORIA[name] === c).sort(az).map(name => {
          const on = form.accion === name
          return <button key={name} type="button" aria-pressed={on} onClick={() => setForm(f => ({ ...f, accion: name, club_id: f.accion === name ? f.club_id : '', tipo_jornada: f.tipo_jornada && f.accion === name ? f.tipo_jornada : name === 'CLUB DE TECNOLOGÍA' ? 'Taller' : name === 'PRÁCTICAS PROFESIONALIZANTES' ? 'Formación' : f.tipo_jornada }))} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-bold uppercase leading-tight transition ${on ? `${actionStyle[name].chip} border-current ring-1 ring-current` : 'border-dte-linea bg-white text-dte-gris hover:border-dte-gris-claro hover:text-dte-tinta'}`}>
            <span className={`flex size-4 shrink-0 items-center justify-center rounded-full ${on ? actionStyle[name].dot : 'border border-dte-linea'}`}>{on && <Check className="size-3 text-white" />}</span>{name}
          </button>
        })}</div>
      </div>)}</div>
    </fieldset>

    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Fecha" required><Input type="date" required value={form.fecha} onChange={e => set('fecha', e.target.value)} className="h-10" /></Field>
      {!esParo && <><Field label="Desde" hint="(opcional)"><Input type="time" value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} className="h-10" /></Field>
      <Field label="Hasta" hint="(opcional)"><Input type="time" value={form.hora_fin} onChange={e => set('hora_fin', e.target.value)} aria-invalid={!!timeError} className="h-10" /></Field></>}
    </div>
    {esParo && <p className="-mt-2 rounded-lg border border-dte-linea bg-dte-fondo px-3 py-2 text-sm text-dte-gris">Adhesión a paro gremial/docente. Se registra en la <b className="text-dte-tinta">Dirección de Tecnología Educativa</b> (lugar de trabajo); no hace falta completar nada más.</p>}
    {esLicencia && <p className="-mt-2 rounded-lg border border-[#e9d8a6] bg-[#fdf6e3] px-3 py-2 text-sm text-[#6b5210]"><b>Recordatorio:</b> {RECORDATORIO_LICENCIA}</p>}
    {timeError && <p className="-mt-3 text-xs text-[#a3164f]">{timeError}</p>}
    {ddjjDia && !esParo && !esLicencia && <p className={`-mt-3 flex items-start gap-1.5 text-xs ${fueraDeHorario ? 'text-[#7a5a0c]' : 'text-dte-gris'}`}><Clock className="mt-px size-3.5 shrink-0" /><span>Tu horario DTE ese día (DD.JJ.): <b>{ddjjDia.dte}</b>{ddjjDia.externo ? ` · Otro cargo: ${ddjjDia.externo}` : ''}{fueraDeHorario ? '. La acción queda fuera de ese horario.' : ''}</span></p>}

    {!esParo && !esLicencia && <div className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Escuela <span className="font-normal text-dte-gris">(opcional)</span></span><SchoolPicker value={school} onChange={setSchool} />{!school && <Input placeholder="…o lugar, si no es una escuela (ej.: Jefatura Distrital, Feria de Ciencias)" value={form.lugar} onChange={e => set('lugar', e.target.value)} className="h-10" aria-label="Lugar" />}</div>}

    {!esParo && !esLicencia && companeros.length > 0 && <fieldset>
      <legend className="mb-1.5 flex w-full items-center justify-between text-sm font-semibold"><span>Acompañado por <span className="font-normal text-dte-gris">(opcional)</span></span>
        <button type="button" onClick={() => setParticipantes(participantes.length === companeros.length ? [] : companeros.map(c => c.id))} className="text-xs font-semibold text-dte-petroleo hover:opacity-80">{participantes.length === companeros.length ? 'Quitar a todos' : 'Todo el equipo'}</button></legend>
      <div className="flex flex-wrap gap-1.5">{companeros.map(c => { const on = participantes.includes(c.id); return <button key={c.id} type="button" aria-pressed={on} onClick={() => togglePart(c.id)} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${on ? 'border-dte-petroleo bg-dte-petroleo text-white' : 'border-dte-petroleo/20 bg-dte-petroleo/[0.06] text-dte-petroleo hover:bg-dte-petroleo/[0.12]'}`}>{on ? <Check className="size-3" /> : <Plus className="size-3 opacity-70" />}{c.nombre_completo}</button> })}</div>
      {participantes.length > 0 && <p className="mt-1.5 text-xs text-dte-gris">La acción va a aparecer en el calendario de {participantes.length === 1 ? 'esa persona' : `esas ${participantes.length} personas`} y les llega una notificación. Sólo vos podés editarla.</p>}
    </fieldset>}

    {conSubAccion && <div className={`grid gap-4 ${cat === 'tecnica' ? 'sm:grid-cols-[1fr_9rem]' : ''}`}>
      <Field label="Sub-acción" hint="(opcional)"><Input list="sub-acciones" placeholder={form.accion && SUB_ACCIONES[form.accion] ? `Ej.: ${SUB_ACCIONES[form.accion]!.slice(0, 2).join(', ')}` : 'Ej.: revisión de equipamiento'} value={form.sub_accion} onChange={e => set('sub_accion', e.target.value)} className="h-10" /></Field>
      {cat === 'tecnica' && <Field label="Cantidad" hint="(equipos)"><Input type="number" min={0} inputMode="numeric" placeholder="0" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} className="h-10" /></Field>}
    </div>}
    <datalist id="sub-acciones">{[...(form.accion ? SUB_ACCIONES[form.accion] ?? [] : [])].sort(az).map(o => <option key={o} value={o} />)}</datalist>
    {conSubAccion && form.accion && SUB_ACCIONES[form.accion] && <div className="-mt-3 flex flex-wrap items-center gap-1.5"><span className="mr-0.5 text-[11px] font-semibold uppercase tracking-wider text-dte-gris">Sugerencias</span>{[...SUB_ACCIONES[form.accion]!].sort(az).map(o => { const on = form.sub_accion.split(',').map(x => x.trim()).includes(o); return <button key={o} type="button" aria-pressed={on} onClick={() => { const cur = form.sub_accion.split(',').map(x => x.trim()).filter(Boolean); set('sub_accion', (on ? cur.filter(x => x !== o) : [...cur, o]).join(', ')) }} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${on ? 'border-dte-petroleo bg-dte-petroleo text-white shadow-xs' : 'border-dte-petroleo/20 bg-dte-petroleo/[0.06] text-dte-petroleo hover:border-dte-petroleo/40 hover:bg-dte-petroleo/[0.12]'}`}>{on ? <Check className="size-3" /> : <Plus className="size-3 opacity-70" />}{o}</button> })}</div>}

    {esClub && <fieldset className="grid gap-4 overflow-hidden rounded-xl border border-dte-linea bg-dte-fondo p-3 sm:grid-cols-6">
      <legend className="sr-only">Registro: {marca.nombre}</legend>
      <div className={`-m-3 mb-0 flex items-center gap-3 px-3 py-2.5 sm:col-span-6 ${marca.degradado}`}><img src={marca.logo} alt={marca.nombre} className="h-10 w-auto" /><span className="text-xs font-semibold text-white/95">{marca.nota}</span></div>
      <Field label={`¿A qué ${marca.corto} corresponde?`} required className="sm:col-span-6"><select className={`${selectClass} h-10`} value={form.club_id} onChange={e => pickClub(e.target.value)} disabled={!clubes}>
        <option value="">{clubes ? `Elegí ${marca.corto === 'club' ? 'un club' : 'una práctica'}…` : 'Cargando…'}</option>
        {[...clubOpts].sort((a, b) => az(a.school ? shortSchoolName(a.school) : a.lugar ?? '', b.school ? shortSchoolName(b.school) : b.lugar ?? '') || az(a.grupo ?? '', b.grupo ?? '')).map(c => <option key={c.id} value={c.id}>{clubLabel(c)}</option>)}
        <option value="nuevo">{marca.corto === 'club' ? '+ Iniciar un club nuevo' : '+ Iniciar una práctica nueva'} (comienza en esta fecha)</option>
      </select></Field>
      {form.club_id === 'nuevo' && <div className="grid gap-3 rounded-lg border border-dashed border-[#7d5a95]/50 bg-white p-3 sm:col-span-6 sm:grid-cols-6">
        <p className="text-xs text-dte-gris sm:col-span-6">Cada grado o curso es {marca.corto === 'club' ? 'un club' : 'una práctica'} en sí mismo. {school ? 'El nivel se sugiere según la escuela; podés cambiarlo.' : 'Elegí primero la escuela para sugerir el nivel.'}</p>
        <Field label="Nivel / modalidad" className="sm:col-span-3"><select className={`${selectClass} h-10`} value={nivel.id} onChange={e => setForm(f => ({ ...f, nivel: e.target.value, curso: '' }))}>{[...NIVELES].sort((a, b) => az(a.label, b.label)).map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></Field>
        <Field label={nivel.cursoLabel} required className="sm:col-span-2"><select className={`${selectClass} h-10`} value={form.curso} onChange={e => set('curso', e.target.value)}><option value="">Elegí…</option>{nivel.cursos.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Sección" className="sm:col-span-1"><select className={`${selectClass} h-10`} value={form.seccion} onChange={e => set('seccion', e.target.value)}><option value="">—</option>{SECCIONES.map(x => <option key={x}>{x}</option>)}</select></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-6"><input type="checkbox" checked={otroOrigen} onChange={e => setOtroOrigen(e.target.checked)} className="size-4" style={{ accentColor: marca.acento }} />Los estudiantes son de otra escuela (se desarrolla en esta sede o en territorio)</label>
        {otroOrigen && <div className="flex flex-col gap-1.5 sm:col-span-6"><span className="text-sm font-semibold">Escuela de origen de los estudiantes</span><SchoolPicker value={origen} onChange={setOrigen} /></div>}
        {grupo && <p className="text-xs sm:col-span-6">Se va a registrar como <b>{grupo}</b>{school ? ` · ${shortSchoolName(school)}` : ''}{otroOrigen && origen ? ` · estudiantes de ${shortSchoolName(origen)}` : ''}.</p>}
      </div>}
      {club && <p className="-mt-2 text-xs text-dte-gris sm:col-span-6">{clubEncuentrosRealizados(club)} encuentros registrados{club.encuentros_previstos ? ` de ${club.encuentros_previstos} previstos` : ''}{club.escuela_origen ? ` · Estudiantes de ${shortSchoolName(club.escuela_origen)}` : ''}. La escuela o lugar de arriba es donde se hizo este encuentro.</p>}
      <Field label="Propuesta dictada" hint={marca.corto === 'club' ? '(ej.: taller de redes dentro del club)' : undefined} className="sm:col-span-4"><Input placeholder={marca.propuesta} value={form.propuesta} onChange={e => set('propuesta', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Encuentros de la propuesta" hint="(previstos)" className="sm:col-span-2"><Input type="number" min={1} inputMode="numeric" placeholder={String(CLUB_MIN_ENCUENTROS)} value={form.encuentros_previstos} onChange={e => set('encuentros_previstos', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Encuentro N°" className="sm:col-span-2"><Input type="number" min={1} inputMode="numeric" value={form.encuentro_n} onChange={e => set('encuentro_n', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Tipo de jornada" className="sm:col-span-2"><select className={`${selectClass} h-10`} value={form.tipo_jornada} onChange={e => set('tipo_jornada', e.target.value as TipoJornada | '')}><option value="">Elegí…</option>{[...TIPOS_JORNADA].sort(azOtroAlFinal).map(t => <option key={t} value={t}>{t === 'Otro' ? 'Otro (aclarar en la descripción)' : t}</option>)}</select></Field>
      <Field label="Formato de participación" className="sm:col-span-2"><select className={`${selectClass} h-10`} value={form.modalidad} onChange={e => set('modalidad', e.target.value as Modalidad)}>{[...MODALIDADES].sort(az).map(m => <option key={m}>{m}</option>)}</select></Field>
      <Field label="Destinatarios" className="sm:col-span-6"><Input placeholder="Ej.: estudiantes de 5° y 6°, familias" value={form.destinatarios} onChange={e => set('destinatarios', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Cantidad de inscriptos" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={form.inscriptos} onChange={e => set('inscriptos', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Participantes reales" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={form.asistentes} onChange={e => set('asistentes', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Breve descripción de lo realizado" className="sm:col-span-6"><Textarea rows={3} placeholder="Qué se trabajó, con qué recursos, cómo participó el grupo…" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} className="bg-white" /></Field>
      <label className="flex items-start gap-2.5 rounded-lg border border-dte-linea bg-white p-2.5 text-sm sm:col-span-6"><input type="checkbox" checked={form.es_cierre} onChange={e => set('es_cierre', e.target.checked)} className="mt-0.5 size-4" style={{ accentColor: marca.acento }} /><span><b>Este es el encuentro de cierre {marca.corto === 'club' ? 'del club' : 'de la práctica'}</b><span className="block text-xs text-dte-gris">{marca.corto === 'club' ? 'El club queda finalizado' : 'La práctica queda finalizada'} con esta fecha y deja de figurar entre los activos.</span></span></label>
    </fieldset>}
    {conEncuentro && !esClub && <fieldset className="grid gap-4 rounded-xl border border-dte-linea bg-dte-fondo p-3 sm:grid-cols-6">
      <legend className="px-1 text-sm font-semibold">Datos del encuentro <span className="font-normal text-dte-gris">(para las métricas de participación)</span></legend>
      <Field label="Propuesta" className="sm:col-span-4"><Input placeholder={form.accion === 'CLUB DE TECNOLOGÍA' ? 'Club de Tecnología' : 'Ej.: Ciudadanía digital en el aula'} value={form.propuesta} onChange={e => set('propuesta', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Encuentro N°" className="sm:col-span-2"><Input type="number" min={1} inputMode="numeric" value={form.encuentro_n} onChange={e => set('encuentro_n', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Destinatarios" className="sm:col-span-4"><Input placeholder="Ej.: estudiantes de 6° A, docentes" value={form.destinatarios} onChange={e => set('destinatarios', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Modalidad" className="sm:col-span-2"><select className={`${selectClass} h-10`} value={form.modalidad} onChange={e => set('modalidad', e.target.value as Modalidad)}>{[...MODALIDADES].sort(az).map(m => <option key={m}>{m}</option>)}</select></Field>
      <Field label="Inscriptos" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={form.inscriptos} onChange={e => set('inscriptos', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Asistentes" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={form.asistentes} onChange={e => set('asistentes', e.target.value)} className="h-10 bg-white" /></Field>
    </fieldset>}
    {!esParo && <Field label={esLicencia ? 'Motivo' : 'Detalle'} hint="(opcional)"><Textarea placeholder={esLicencia ? 'Ej.: enfermedad, razones particulares (sin datos sensibles)' : 'Información útil para el seguimiento: con quién, qué se acordó, pendientes…'} rows={3} value={form.detalle} onChange={e => set('detalle', e.target.value)} /></Field>}

    {item && <fieldset><legend className="mb-2 text-sm font-semibold">Estado</legend><div className="flex flex-wrap gap-2">{ESTADOS.map(e => <button key={e} type="button" aria-pressed={form.estado === e} onClick={() => set('estado', e)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${form.estado === e ? statusStyle[e].badge : 'border-dte-linea text-dte-gris hover:text-dte-tinta'}`}>{form.estado === e && <Check className="size-3" />}{statusStyle[e].label}</button>)}</div></fieldset>}

    {!item && !esParo && !esLicencia && form.accion && <fieldset className="rounded-xl border border-dte-linea p-3">
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={repetir} onChange={e => setRepetir(e.target.checked)} className="size-4" />Se repite cada semana <span className="font-normal text-dte-gris">(ej.: el club todos los miércoles)</span></label>
      {repetir && <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-xs font-semibold uppercase tracking-wider text-dte-gris">Días</span>{DIAS_HABILES.map((d, i) => { const n = i + 1, on = diasSerie.includes(n); return <button key={d} type="button" aria-pressed={on} onClick={() => setDias((on ? diasSerie.filter(x => x !== n) : [...diasSerie, n]).sort())} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? 'border-dte-petroleo bg-dte-petroleo text-white' : 'border-dte-petroleo/20 bg-dte-petroleo/[0.06] text-dte-petroleo hover:bg-dte-petroleo/[0.12]'}`}>{d}</button> })}</div>
        <Field label="Hasta" className="max-w-48"><Input type="date" min={form.fecha} value={hastaSerie} onChange={e => setHasta(e.target.value)} className="h-10" /></Field>
        <p className="text-xs text-dte-gris">Se crean como <b>planificadas</b> con los mismos datos, salteando feriados y recesos. Después completás cada encuentro{esClub ? ` y queda asociado al ${marca.corto}` : ''}. Máximo 60 fechas.</p>
      </div>}
    </fieldset>}

    {avisos.length > 0 && <div role="status" className="rounded-xl border border-[#e9d8a6] bg-[#fdf6e3] px-3 py-2.5 text-sm text-[#6b5210]">
      <p className="mb-1 flex items-center gap-1.5 font-semibold"><TriangleAlert className="size-4" />Revisá antes de guardar</p>
      <ul className="list-disc pl-5 text-[13px]">{avisos.map(a => <li key={a}>{a}</li>)}</ul>
    </div>}
    {error && <ErrorBox message={error} />}
    <div className="sticky bottom-0 -mx-4 -mb-4 flex gap-2 border-t border-dte-linea bg-white px-4 py-3 sm:justify-end">
      <Button variant="outline" type="button" size="lg" className="flex-1 sm:flex-none" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" size="lg" disabled={saving} className="flex-1 bg-dte-petroleo px-4 sm:flex-none font-semibold hover:bg-dte-petroleo-oscuro">{saving && <Loader2 className="animate-spin" data-icon="inline-start" />}{item ? 'Guardar cambios' : 'Agregar a mi agenda'}</Button>
    </div>
  </form>
}
