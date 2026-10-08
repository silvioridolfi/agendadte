'use client'

import { Pill } from '@/components/ui/segmented'
import { useEffect, useMemo, useRef, useState } from 'react'
import { chequearHorario, franjasDte, textoFranjas } from '@/lib/ddjj'
import { Check, ChevronDown, Clock, Landmark, Loader2, School as SchoolIcon, Search, Star, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CAT_COLOR } from '@/components/app/metrics'
import { enlaceDe, esReunion, conEnlace, normalizarEnlace } from '@/lib/reunion'
import { sinTildes } from '@/lib/buscador'
import { cambiaLaSerie, clubesDelDia, destinatarioEstudiantes, escuelaDelClub, estadoAlCompletar, horariosSePisan, inscriptosDelClub, PROPUESTAS_DE_CLUB, proximoEncuentro, textoMinimo } from '@/lib/encuentro'
import { Destinatarios, PropuestaClub, PropuestaTaller } from '@/components/app/camposclub'
import { etiquetaAccion, nombreAccion, iniciado, ordenGrupo, ACCIONES, CATEGORIAS, CATEGORIA, CATEGORIA_LABEL, CON_ENCUENTRO, ESTADOS, SUB_ACCIONES, type Accion, type AgendaItem, type AgendaItemInput, type Estado, type Fed, type Feriado, type School, type Club, type Modalidad, type TipoJornada, MODALIDADES, TIPOS_JORNADA, CLUB_MIN_ENCUENTROS, clubEstado, clubEncuentrosRealizados, NIVELES, SECCIONES, nivelDeEscuela, esTrayecto, TRAYECTO_MARCA, RECORDATORIO_LICENCIA, esAusencia, ACCIONES_CED, SOLO_CED, MODALIDADES_EVENTO, ROLES_FORMACION, type ModalidadEvento, type RolFormacion } from '@/lib/agenda'
import type { Ocupacion, Organismo } from '@/app/actions'
import { titleCase } from '@/lib/format'
import { lineaPredio, buscarOrganismos, crearClubPorIniciar, actionStyle, statusStyle, az, azOtroAlFinal, selectClass, iso, parse, fmt, hhmm, schoolName, shortSchoolName, schoolPlace, ddjjFor, searchSchools, getClubes, getFedItems, getFeriados, misTiposFrecuentes, storage, saveItem, cambiarEstadoVarias, disponibilidad, guardarVisita, editarVisita, ActionChip, errMsg, ErrorBox, ItemPreset, addDays, cap, DIAS_HABILES } from '@/components/app/comun'
import { encolarOffline, encolarVisitaOffline } from '@/components/app/offline'
import { alternarTipo, esSumable, datosDeAccion, datosVacios, inputDeTipo, type DatosTipo } from '@/lib/visita'
import { hoyAR } from '@/lib/hora'


// =====================================================================

// `onOrganismo`: si se pasa, la búsqueda incluye jefaturas distritales y regional; al elegir una se recibe "NOMBRE (CÓDIGO)" como lugar.
// `enLinea`: la lista de resultados empuja el contenido en vez de flotar (para diálogos con scroll propio, donde un desplegable flotante se recorta).
export function SchoolPicker({ value, onChange, onOrganismo, enLinea }: { value: School | null, onChange: (s: School | null) => void, onOrganismo?: (lugar: string) => void, enLinea?: boolean }) {
  const [query, setQuery] = useState('')
  const [orgs, setOrgs] = useState<Organismo[]>([])
  const [results, setResults] = useState<School[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // Al escribir: con menos de 2 letras se limpian los resultados; si no, se marca la búsqueda en curso.
  const buscar = (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) { setResults([]); setOrgs([]); setLoading(false) } else { setLoading(true); setFailed(false) }
  }
  useEffect(() => {
    if (query.trim().length < 2) return
    // `vigente`: si la consulta cambió antes de que llegue la respuesta, se descarta.
    let vigente = true
    const t = setTimeout(() => Promise.all([searchSchools(query), onOrganismo ? buscarOrganismos(query) : Promise.resolve([])])
      .then(([r, o]) => { if (vigente) { setOrgs(o); setResults([...r].sort((a, b) => az(a.nombre ?? '', b.nombre ?? ''))); setActive(0) } })
      .catch(() => { if (vigente) { setResults([]); setOrgs([]); setFailed(true) } })
      .finally(() => { if (vigente) setLoading(false) }), 250)
    return () => { vigente = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])
  // Opciones: primero las jefaturas que coinciden y después las escuelas.
  const opciones: ({ tipo: 'org', o: Organismo } | { tipo: 'esc', s: School })[] = [...orgs.map(o => ({ tipo: 'org' as const, o })), ...results.map(s => ({ tipo: 'esc' as const, s }))]
  const pick = (x: typeof opciones[number]) => { if (x.tipo === 'org') onOrganismo?.(`${x.o.nombre} (${x.o.codigo})`); else onChange(x.s); buscar(''); setOpen(false) }

  if (value) return <div className="flex items-center gap-3 rounded-control border border-pba-celeste/60 bg-pba-celeste/5 p-2.5 pl-3 font-normal">
    <SchoolIcon className="size-4 shrink-0 text-pba-celeste-texto" />
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" title={schoolName(value)}>{schoolName(value)}</p><p className="truncate text-xs text-dte-gris">CUE {value.cue ?? '—'}{schoolPlace(value) ? ` · ${schoolPlace(value)}` : ''}</p></div>
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>Cambiar</Button>
  </div>

  const showList = open && query.trim().length >= 2
  return <div className="relative">
    <div className="relative">
    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dte-gris-claro" />
    <Input role="combobox" aria-label="Buscar escuela por nombre, localidad o CUE" aria-expanded={showList} aria-controls="school-results" aria-autocomplete="list" className="h-11 md:h-10 pl-9 font-normal" placeholder="Nombre, localidad o CUE…" value={query}
      onChange={e => { buscar(e.target.value); setOpen(true) }} onFocus={e => { setOpen(true); e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' }) }} onBlur={() => setTimeout(() => setOpen(false), 150)}
      onKeyDown={e => {
        if (!showList || !opciones.length) return
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, opciones.length - 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
        else if (e.key === 'Enter') { e.preventDefault(); pick(opciones[active]) }
        else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
      }} />
    </div>
    {showList && <div id="school-results" role="listbox" className={`${enLinea ? 'max-h-60' : 'absolute z-50 max-h-72'} mt-1 w-full overflow-y-auto rounded-tile border border-dte-linea bg-white p-1 text-sm font-normal text-dte-tinta shadow-e3`}>
      {loading ? <p className="flex items-center gap-2 p-3 text-dte-gris"><Loader2 className="size-4 animate-spin" />Buscando…</p>
        : failed ? <p className="p-3 text-peligro">No se pudo buscar. Probá de nuevo.</p>
        : !opciones.length ? <p className="p-3 text-dte-gris">Sin resultados para “{query.trim()}”.</p>
        : opciones.map((x, i) => <button key={x.tipo === 'org' ? `o-${x.o.id}` : x.s.id} type="button" role="option" aria-selected={i === active} onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => pick(x)} className={`block w-full rounded-control px-3 py-2 text-left ${i === active ? 'bg-dte-tinte' : ''}`}>
          {x.tipo === 'org' ? <><span className="flex items-center gap-1.5 font-semibold leading-snug"><Landmark className="size-3.5 shrink-0 text-dte-violeta" aria-hidden />{x.o.nombre.split(' | ').map(titleCase).join(' · ')}</span>
            <span className="block text-xs text-dte-gris">Código {x.o.codigo}{x.o.localidad ? ` · ${titleCase(x.o.localidad)}` : ''}</span></>
          : <><span className="block font-semibold leading-snug">{schoolName(x.s)}</span>
            <span className="block text-xs text-dte-gris">CUE {x.s.cue ?? '—'}{schoolPlace(x.s) ? ` · ${schoolPlace(x.s)}` : ''}</span>
            {lineaPredio(x.s) && <span className="block break-words text-xs font-medium text-club-violeta">{lineaPredio(x.s)}</span>}
            {x.s.crono && <span className="block break-words text-xs font-medium text-pba-celeste-texto">Cronograma próximo: {x.s.crono}</span>}</>}
        </button>)}
    </div>}
  </div>
}

// Campo con label visible y mensaje de error debajo (vinculado por aria-describedby desde el control).
export function Field({ label, hint, required, children, className = '', error, errorId, id }: { label: string, hint?: string, required?: boolean, children: React.ReactNode, className?: string, error?: string, errorId?: string, id?: string }) {
  return <label id={id} className={`flex flex-col gap-1.5 ${className}`}><span className="text-sm font-semibold text-dte-tinta">{label}{required && <span className="text-dte-magenta" aria-hidden> *</span>}{hint && <span className="ml-1 font-normal text-dte-gris">{hint}</span>}</span>{children}
    {error && <span id={errorId} role="alert" className="text-sm font-medium text-peligro">{error}</span>}</label>
}

export function ItemForm({ fed, feds, item, defaultFecha, preset, onCancel, onSaved }: { fed: Fed, feds: Fed[], item: AgendaItem | null, defaultFecha?: string, preset?: ItemPreset, onCancel: () => void, onSaved: (r: { creadas: number, id?: string, mensaje?: string, offline?: boolean }) => void }) {
  // Compañeros etiquetados: la acción aparece también en su calendario y reciben una notificación.
  const [participantes, setParticipantes] = useState<string[]>(() => item?.participantes?.map(p => p.fed_id) ?? preset?.participantes ?? [])
  const companeros = useMemo(() => feds.filter(f => f.id !== fed.id).sort((a, b) => (a.rol === b.rol ? az(a.nombre_completo, b.nombre_completo) : a.rol === 'coordinacion' ? 1 : -1)), [feds, fed.id])
  const togglePart = (id: string) => setParticipantes(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]))
  const [school, setSchool] = useState<School | null>(item?.school ?? preset?.school ?? null)
  // Encuentro editable desde la app: el propio (origen app) o, si no hay, el primero importado.
  const enc0 = item?.encuentros?.find(e => e.origen === 'app') ?? item?.encuentros?.[0]
  // Formulario exclusivo de clubes y prácticas (abierto desde su sección, o al editar un encuentro): sin tipos de acción ni campos generales.
  const modoT = preset?.modo ?? (item && esTrayecto(item.accion) ? 'encuentro' : null)
  const [form, setForm] = useState({ fecha: item?.fecha ?? defaultFecha ?? hoyAR(), hora_inicio: hhmm(item?.hora_inicio ?? null), hora_fin: hhmm(item?.hora_fin ?? null), accion: item?.accion ?? preset?.accion ?? null as Accion | null, estado: item?.estado ?? (((defaultFecha ?? hoyAR()) < hoyAR() ? 'realizada' : 'planificada') as Estado), sub_accion: item?.sub_accion ?? preset?.sub_accion ?? '', detalle: item?.detalle ?? '', lugar: item?.lugar ?? '', cantidad: item?.cantidad?.toString() ?? '', encuentro_n: enc0?.encuentro_n?.toString() ?? '', propuesta: enc0?.propuesta ?? (item?.accion === 'TALLER/CAPACITACIÓN' ? item.sub_accion ?? '' : ''), destinatarios: enc0?.destinatarios ?? '', modalidad: enc0?.modalidad ?? ('Presencial' as Modalidad), inscriptos: enc0?.inscriptos?.toString() ?? '', asistentes: enc0?.asistentes?.toString() ?? '', tipo_jornada: enc0?.tipo_jornada ?? ('' as TipoJornada | ''), descripcion: enc0?.descripcion ?? '', modalidad_ev: item?.modalidad ?? ('Presencial' as ModalidadEvento), enlace: item?.enlace ?? '', rol_formacion: item?.rol_formacion ?? ('Asistí' as RolFormacion), dictada_por: item?.dictada_por ?? '', club_id: enc0?.club_id ?? item?.club_id ?? (preset?.modo === 'nuevo' ? 'nuevo' : preset?.club_id) ?? '', nivel: '', curso: '', seccion: '', subgrupo: '', encuentros_previstos: '', es_cierre: enc0?.es_cierre ?? false })
  // Clubes y prácticas: registro por grupo con inicio y cierre (cada uno con su identidad visual).
  const esClub = esTrayecto(form.accion)
  const marca = esClub ? TRAYECTO_MARCA[form.accion as keyof typeof TRAYECTO_MARCA] : TRAYECTO_MARCA['CLUB DE TECNOLOGÍA']
  const esParo = form.accion === 'PARO', esLicencia = form.accion === 'LICENCIA'
  // Formación interna y eventos DTE: el lugar es opcional (suelen ser virtuales o en la DTE).
  const esFormacion = form.accion === 'FORMACIÓN INTERNA', esEvento = form.accion === 'EVENTO DTE'
  // Coordinación (CED): sus tareas propias van primero y el lugar es opcional.
  // Tipos de acción más usados por esta persona: se muestran primero. Se guardan en el dispositivo para tenerlos al instante.
  const claveFrecuentes = `tipos-frecuentes:${fed.id}`
  const [frecuentes, setFrecuentes] = useState<Accion[]>(() => { try { return JSON.parse(storage(() => localStorage.getItem(claveFrecuentes)) ?? '[]') } catch { return [] } })
  useEffect(() => { let vivo = true; misTiposFrecuentes().then(l => { if (!vivo) return; setFrecuentes(l); storage(() => localStorage.setItem(claveFrecuentes, JSON.stringify(l))) }).catch(() => {}); return () => { vivo = false } }, [claveFrecuentes])
  const [buscaTipo, setBuscaTipo] = useState('')
  // Visita con varias acciones: el primer tipo usa los campos de siempre; los demás, un bloque propio cada uno.
  // Al editar una visita se abre con todos sus tipos marcados y sus datos.
  const multiple = !modoT
  const otrosDeVisita = (item?.visita ?? []).filter(v => v.id !== item?.id)
  const [extras, setExtras] = useState<Accion[]>(() => otrosDeVisita.map(v => v.accion))
  const [datosExtra, setDatosExtra] = useState<Partial<Record<Accion, DatosTipo>>>(() => Object.fromEntries(otrosDeVisita.map(v => [v.accion, datosDeAccion(v)])))
  // Encuentro guardado del tipo principal (cambia si se quita el principal y otro ocupa su lugar).
  const [encPrincipal, setEncPrincipal] = useState<string | undefined>(enc0?.id)
  const esVisita = !!item?.visita || extras.length > 0
  const setExtra = (a: Accion, k: keyof DatosTipo, v: string) => setDatosExtra(d => ({ ...d, [a]: { ...(d[a] ?? datosVacios()), [k]: v } }))
  const esCed = fed.rol === 'coordinacion', lugarOpcional = esFormacion || esEvento || (!!form.accion && (SOLO_CED.includes(form.accion) || form.accion === 'REUNIÓN CON JEFATURA')) || (esReunion(form.accion) && conEnlace(form.modalidad_ev))
  // En talleres/capacitaciones la sub-acción pasa a ser la propuesta (se guarda en ambos para listados y exportaciones).
  const esTaller = form.accion === 'TALLER/CAPACITACIÓN'
  const conSubAccion = !!form.accion && !esClub && !esParo && !esLicencia && !esTaller
  // Clubes del FED (para elegir a cuál corresponde el encuentro). Los finalizados sólo si es el del encuentro que se edita.
  const [clubes, setClubes] = useState<Club[] | null>(null)
  useEffect(() => { if (esClub && !clubes) getClubes(fed.id).then(setClubes).catch(() => setClubes([])) }, [esClub, clubes, fed.id])
  const hoy = hoyAR()
  const clubOpts = (clubes ?? []).filter(c => c.tipo === form.accion && (c.id === form.club_id || (modoT === 'encuentro' ? iniciado(c) && clubEstado(c, hoy) !== 'finalizado' : !iniciado(c) || clubEstado(c, hoy) !== 'finalizado')))
  const club = clubOpts.find(c => c.id === form.club_id) ?? null
  const clubLabel = (c: Club) => `${escuelaDelClub(c) ? shortSchoolName(escuelaDelClub(c)!) : c.lugar ?? 'Sin lugar'}${c.grupo ? ` · ${c.grupo}` : ''}${c.escuela_origen && escuelaDelClub(c) !== c.escuela_origen ? ` · estudiantes de ${shortSchoolName(c.escuela_origen)}` : ''} ${iniciado(c) ? ` · desde ${fmt(parse(c.fecha_inicio), { day: 'numeric', month: 'short' })}${clubEstado(c, hoy) === 'sin_actividad' ? ' (sin actividad)' : ''}` : ' · por iniciar'}`
  // Grado/curso del club nuevo: nivel sugerido por el nombre de la escuela, editable (cualquier nivel o modalidad).
  const nivelId = form.nivel || nivelDeEscuela(school?.nombre)
  const nivel = NIVELES.find(n => n.id === nivelId) ?? NIVELES[0]
  // Práctica de un curso dividido en grupos (ej.: "7° Informática - Grupo 1"): el curso completo (cohorte) agrupa a los grupos en las métricas.
  const cursoBase = form.curso ? `${form.curso}${form.seccion ? ` ${form.seccion}` : ''}` : ''
  const subgrupo = form.accion === 'PRÁCTICAS PROFESIONALIZANTES' ? form.subgrupo.trim() : ''
  const grupo = cursoBase && subgrupo ? `${cursoBase} - ${subgrupo}` : cursoBase
  const cohorte = cursoBase && subgrupo ? cursoBase : null
  function pickClub(id: string) {
    const c = clubes?.find(x => x.id === id)
    setForm(f => ({ ...f, club_id: id, encuentros_previstos: c?.encuentros_previstos?.toString() ?? f.encuentros_previstos,
      encuentro_n: !item && c ? String(proximoEncuentro(c.encuentros, f.fecha)) : f.encuentro_n,
      inscriptos: !item && c ? (inscriptosDelClub(c.encuentros)?.toString() ?? '') : f.inscriptos,
      destinatarios: !item && c ? destinatarioEstudiantes(c.grupo) : f.destinatarios }))
    // La sede del club se sugiere sólo si todavía no se eligió escuela (las prácticas pueden hacerse en otras sedes).
    if (c?.school && !school) setSchool(c.school)
  }
  // Abierto desde la sección de clubes/prácticas con un club elegido: completa sede y N° de encuentro.
  const presetAplicado = useRef(false)
  useEffect(() => {
    if (presetAplicado.current || item || !clubes || !preset?.club_id || preset.club_id === 'nuevo') return
    presetAplicado.current = true
    pickClub(preset.club_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubes])
  // Datos que no cambian de un encuentro a otro: destinatarios (el grado del club) e inscriptos (los del primer encuentro).
  // Al elegir el club en un encuentro nuevo se reemplazan (pickClub); si quedan vacíos, se usan estos valores.
  const grupoDest = club?.grupo ?? (form.club_id === 'nuevo' ? grupo : '')
  const inscriptosClub = club ? inscriptosDelClub(club.encuentros) : null
  const inscriptosEf = form.inscriptos !== '' ? form.inscriptos : inscriptosClub != null ? String(inscriptosClub) : ''
  const destinatariosEf = form.destinatarios || (grupoDest ? destinatarioEstudiantes(grupoDest) : '')
  const propuestaVista = form.propuesta === '' && form.accion === 'CLUB DE TECNOLOGÍA' ? PROPUESTAS_DE_CLUB[0] : form.propuesta
  const esPeat = form.accion === 'PRÁCTICAS PROFESIONALIZANTES'
  const propuestaEf = esPeat ? TRAYECTO_MARCA['PRÁCTICAS PROFESIONALIZANTES'].propuesta : propuestaVista.trim() || (form.accion === 'CLUB DE TECNOLOGÍA' ? PROPUESTAS_DE_CLUB[0] : '')
  // Escuela de origen de los estudiantes, cuando el trayecto se desarrolla en otra sede (ej.: prácticas).
  const [origen, setOrigen] = useState<School | null>(null)
  const [otroOrigen, setOtroOrigen] = useState(false)
  // En las prácticas la escuela de origen es obligatoria: identifica al grupo (se desarrollan en varios lugares y el grupo no lleva sede propia).
  const usaOrigen = form.accion === 'PRÁCTICAS PROFESIONALIZANTES' || otroOrigen
  const [saving, setSaving] = useState(false)
  const [preguntarSerie, setPreguntarSerie] = useState(false)
  // Club o práctica nueva sin fecha: queda "por iniciar" y no se agrega a la agenda hasta programar el primer encuentro.
  const [aDefinirMarcado, setADefinir] = useState(false)
  const aDefinir = aDefinirMarcado && !item && esClub && form.club_id === 'nuevo'
  const [error, setError] = useState('')
  const [errores, setErrores] = useState<Partial<Record<'fecha' | 'establecimiento' | 'accion' | 'hora' | 'club' | 'curso' | 'origen' | 'serie' | 'enlace', string>>>({})
  const limpiar = (k: keyof typeof errores) => setErrores(e => (e[k] ? { ...e, [k]: undefined } : e))
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))
  const toNum = (v: string) => (v.trim() === '' ? null : Number(v))
  const cat = form.accion ? CATEGORIA[form.accion] : null
  const conEncuentro = !!form.accion && CON_ENCUENTRO.includes(form.accion)
  const timeError = form.hora_inicio && form.hora_fin && form.hora_fin <= form.hora_inicio ? 'La hora de fin tiene que ser posterior a la de inicio.' : ''
  // Horario DTE declarado para ese día (DD.JJ.). Sólo avisa, no impide guardar.
  const ddjjDia = ddjjFor(fed, form.fecha)
  // Repetir (sólo al crear): mismos datos los días elegidos hasta una fecha, salteando feriados y recesos.
  const [repetir, setRepetir] = useState(false)
  // null = sin tocar: se propone el día de la fecha elegida.
  const [dias, setDias] = useState<number[] | null>(null)
  const [hasta, setHasta] = useState('')
  const diaFecha = parse(form.fecha).getDay()
  const diasSerie = dias ?? (diaFecha >= 1 && diaFecha <= 5 ? [diaFecha] : [])
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
  // Clubes o prácticas que ya tengo ese día: se sugieren para precargar sus datos.
  const clubesSugeridos = useMemo(() => (esClub && !item ? clubesDelDia(delDia.items, form.accion, fed.id).map(id => clubOpts.find(c => c.id === id)).filter((c): c is Club => !!c) : []), [esClub, item, delDia.items, form.accion, fed.id, clubOpts])
  const avisos = useMemo(() => {
    const out: string[] = []
    if (!form.accion || esLicencia) return out
    const d = parse(form.fecha).getDay()
    for (const f of delDia.feriados.filter(f => f.tipo === 'distrital')) out.push(`${cap(fmt(parse(f.fecha), { weekday: 'long', day: 'numeric', month: 'long' }))} es ${f.tipo === 'receso' ? 'receso escolar' : 'feriado'}: ${f.nombre}${f.confirmado ? '' : ' (a confirmar)'}.`)
    if (!esParo && d >= 1 && d <= 5 && fed.ddjj?.length && !franjasDte(ddjjFor(fed, form.fecha)).length && !ddjjFor(fed, form.fecha)?.dte) out.push('No tenés horario DTE declarado ese día en la DD.JJ.')
    const solapa = delDia.items.filter(i => i.estado !== 'cancelada' && (
      horariosSePisan({ ini: form.hora_inicio, fin: form.hora_fin }, { ini: hhmm(i.hora_inicio), fin: hhmm(i.hora_fin) })
      || (school && i.school_id === school.id && i.accion === form.accion && !esTrayecto(form.accion))))
    for (const i of solapa) out.push(`Ya tenés ${cap(i.accion.toLowerCase())} ${i.hora_inicio ? `a las ${hhmm(i.hora_inicio)} ` : ''}ese día${i.school ? ` en ${shortSchoolName(i.school)}` : ''}.`)
    if (form.estado === 'realizada' && form.fecha > hoyAR() && !esParo) out.push('Está marcada como realizada pero la fecha todavía no llegó.')
    return out
  }, [form.accion, form.fecha, form.hora_inicio, form.hora_fin, form.estado, delDia, fed, school, esLicencia, esParo])
  // Sólo días hábiles: ni fines de semana ni feriados o recesos (al editar sin cambiar la fecha, se respeta lo cargado).
  const diaSemana = parse(form.fecha).getDay(), noHabil = delDia.feriados.find(f => f.tipo !== 'distrital')
  const fechaError = aDefinir || item?.fecha === form.fecha ? ''
    : diaSemana === 0 || diaSemana === 6 ? 'Es fin de semana: sólo se pueden cargar acciones de lunes a viernes.'
    : noHabil ? `Es ${noHabil.tipo === 'receso' ? 'receso escolar' : 'feriado'} (${noHabil.nombre}): elegí un día hábil.` : ''
  // Licencia por período: desde la fecha elegida hasta `licHasta`, un registro por día hábil, sin horario (todo el día).
  const [licHasta, setLicHasta] = useState('')
  const licFin = esLicencia && !item && licHasta > form.fecha ? licHasta : form.fecha
  const [licRango, setLicRango] = useState<{ clave: string, dias: string[], choques: AgendaItem[] } | null>(null)
  const [reprogramar, setReprogramar] = useState(true)
  useEffect(() => {
    if (!esLicencia || item || !/^\d{4}-\d{2}-\d{2}$/.test(form.fecha) || !/^\d{4}-\d{2}-\d{2}$/.test(licFin)) return
    let vivo = true
    const clave = `${form.fecha}:${licFin}`
    Promise.all([getFeriados(form.fecha, licFin).catch(() => []), getFedItems(fed.id, form.fecha, licFin).catch(() => [])]).then(([fer, its]) => {
      if (!vivo) return
      const no = new Set(fer.filter(f => f.tipo !== 'distrital' || (!!f.distrito && fed.distritos_a_cargo.includes(f.distrito))).map(f => f.fecha))
      const dias: string[] = []
      for (let d = parse(form.fecha); iso(d) <= licFin; d = addDays(d, 1)) { const w = d.getDay(); if (w >= 1 && w <= 5 && !no.has(iso(d))) dias.push(iso(d)) }
      setLicRango({ clave, dias, choques: its.filter(i => i.fed_id === fed.id && !esAusencia(i.accion) && (i.estado === 'planificada' || i.estado === 'reprogramada')) })
    })
    return () => { vivo = false }
  }, [esLicencia, item, form.fecha, licFin, fed.id, fed.distritos_a_cargo])
  const rango = licRango?.clave === `${form.fecha}:${licFin}` ? licRango : null
  const diaCorto = (s: string) => fmt(parse(s), { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
  const horario = chequearHorario(ddjjDia, form.hora_inicio, form.hora_fin)
  const fueraDeHorario = horario.fuera || horario.choques.length > 0

  // Tipo principal: el de los campos de siempre (al cambiarlo se reinician club y tipo de jornada).
  const setPrincipal = (name: Accion | null, datos?: DatosTipo) => { if (datos || name !== form.accion) setEncPrincipal(datos?.enc_id); setForm(f => ({ ...f, accion: name, club_id: f.accion === name ? f.club_id : '',
    tipo_jornada: name && f.tipo_jornada && f.accion === name ? f.tipo_jornada : name === 'CLUB DE TECNOLOGÍA' ? 'Taller' : name === 'PRÁCTICAS PROFESIONALIZANTES' ? 'Formación' : f.tipo_jornada,
    ...(datos ? { sub_accion: datos.sub_accion, cantidad: datos.cantidad, detalle: datos.detalle, propuesta: datos.propuesta, encuentro_n: datos.encuentro_n, destinatarios: datos.destinatarios, modalidad: datos.modalidad, inscriptos: datos.inscriptos, asistentes: datos.asistentes } : {}) })) }
  const [avisoCombinar, setAvisoCombinar] = useState('')
  function elegirTipo(name: Accion) {
    if (!multiple) { setPrincipal(name); return }
    const actuales = form.accion ? [form.accion, ...extras] : []
    const nuevos = alternarTipo(actuales, name)
    // Un tipo que no se combina reemplaza la selección: se avisa para que no parezca un error.
    const reemplaza = actuales.length > 0 && !actuales.includes(name) && nuevos.length === 1
    setAvisoCombinar(reemplaza ? `${nombreAccion(!esSumable(name) ? name : actuales.find(a => !esSumable(a)) ?? name)} no se combina con otras acciones en una misma visita: se carga aparte. Guardá esta y después cargá la otra con la misma escuela, fecha y horario.` : '')
    // Si se quita el principal, el siguiente pasa a ocupar su lugar con los datos que ya tenía cargados.
    if (nuevos[0] !== form.accion) setPrincipal(nuevos[0] ?? null, nuevos[0] && extras.includes(nuevos[0]) ? datosExtra[nuevos[0]] ?? datosVacios() : undefined)
    setExtras(nuevos.slice(1))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    // Validación: mensaje debajo de cada campo y foco/scroll al primero con error.
    const errs: typeof errores = {}
    if (!esParo && !esLicencia && !lugarOpcional && !school && !form.lugar.trim()) errs.establecimiento = 'Indicá el establecimiento (o el lugar, si no es una escuela).'
    if (fechaError) errs.fecha = fechaError
    else if (esLicencia && !item && licHasta && licHasta < form.fecha) errs.fecha = 'La fecha de fin de la licencia tiene que ser igual o posterior al inicio.'
    if (!form.accion) errs.accion = 'Elegí el tipo de acción.'
    if (timeError) errs.hora = timeError
    if (esReunion(form.accion) && conEnlace(form.modalidad_ev)) { try { enlaceDe(form.accion, form.modalidad_ev, form.enlace) } catch (e) { errs.enlace = errMsg(e) } }
    if (esClub && !form.club_id) errs.club = `Elegí a qué ${marca.corto} corresponde el encuentro, o iniciá uno nuevo.`
    if (esClub && form.club_id === 'nuevo' && !form.curso) errs.curso = `Indicá el grado o curso: cada grupo es un ${marca.corto}.`
    if (esClub && esPeat && (form.club_id === 'nuevo' || aDefinir) && !origen) errs.origen = 'Indicá la escuela de origen de los estudiantes: identifica al grupo.'
    if (repetir && !item && (!diasSerie.length || hastaSerie <= form.fecha)) errs.serie = 'Elegí al menos un día y una fecha de fin posterior.'
    setErrores(errs)
    const primero = (['fecha', 'establecimiento', 'hora', 'accion', 'club', 'curso', 'origen', 'serie', 'enlace'] as const).find(k => errs[k])
    if (primero || !form.accion) { document.getElementById(`campo-${primero ?? 'accion'}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setError(''); return }
    // Encuentro de una serie: se pregunta (sólo si cambia fecha, horario, lugar o tipo) si el cambio es para esta fecha o también para las siguientes.
    if (item?.serie_id && !repetir && cambiaLaSerie(item, { fecha: form.fecha, hora_inicio: form.hora_inicio, hora_fin: form.hora_fin, school_id: school?.id ?? null, lugar: form.lugar, accion: form.accion })) { setError(''); setPreguntarSerie(true); return }
    await guardar('uno')
  }

  async function guardar(alcance: 'uno' | 'siguientes') {
    if (!form.accion) return
    setPreguntarSerie(false)
    setSaving(true); setError('')
    if (aDefinir) {
      try {
        await crearClubPorIniciar({ fed_id: fed.id, tipo: form.accion as 'CLUB DE TECNOLOGÍA' | 'PRÁCTICAS PROFESIONALIZANTES', school_id: esPeat ? null : school?.id ?? null, lugar: esPeat || school ? null : form.lugar || null, grupo, escuela_origen_id: usaOrigen ? origen?.id ?? null : null, encuentros_previstos: toNum(form.encuentros_previstos), cohorte })
        onSaved({ creadas: 0, mensaje: marca.corto === 'club' ? `Club ${grupo} guardado como “por iniciar”` : `Práctica ${grupo} guardada como “por iniciar”` })
      } catch (err) { setError(errMsg(err)); setSaving(false) }
      return
    }
    // Club o práctica de hoy o anterior con datos del encuentro cargados: pasa a realizada.
    const estadoFinal = estadoAlCompletar({ accion: form.accion, estado: form.estado, fecha: form.fecha, hoy: hoyAR(), inscriptos: form.inscriptos, asistentes: form.asistentes, descripcion: form.descripcion, esCierre: form.es_cierre })
    const input: AgendaItemInput = {
      repeticion: repetir && !item ? { dias: diasSerie, hasta: hastaSerie } : esLicencia && !item && licFin > form.fecha ? { dias: [1, 2, 3, 4, 5], hasta: licFin } : null,
      fed_id: fed.id, school_id: esLicencia || esParo ? null : school?.id ?? null, lugar: school || esLicencia || esParo ? null : form.lugar || null, fecha: form.fecha, accion: form.accion, estado: estadoFinal,
      hora_inicio: esParo || esLicencia ? null : form.hora_inicio || null, hora_fin: esParo || esLicencia ? null : form.hora_fin || null, sub_accion: conSubAccion ? form.sub_accion : esTaller ? form.propuesta.trim() || null : null, detalle: form.detalle,
      modalidad: lugarOpcional || esReunion(form.accion) ? form.modalidad_ev : null, enlace: form.enlace.trim() || null, rol_formacion: esFormacion ? form.rol_formacion : null, dictada_por: esFormacion ? form.dictada_por : null,
      cantidad: cat === 'tecnica' ? toNum(form.cantidad) : null,
      participantes: esParo || esLicencia ? [] : participantes,
      encuentro: conEncuentro ? { id: encPrincipal, propuesta: propuestaEf, encuentro_n: toNum(form.encuentro_n), modalidad: form.modalidad, destinatarios: destinatariosEf, inscriptos: toNum(inscriptosEf), asistentes: toNum(form.asistentes),
        ...(esTaller ? { descripcion: form.descripcion } : {}),
        ...(esClub ? { tipo_jornada: form.tipo_jornada || null, descripcion: form.descripcion, club_id: form.club_id && form.club_id !== 'nuevo' ? form.club_id : null, nuevo_club: form.club_id === 'nuevo', grupo: grupo, cohorte, escuela_origen_id: usaOrigen ? origen?.id ?? null : null, encuentros_previstos: toNum(form.encuentros_previstos), es_cierre: form.es_cierre } : {}) } : null,
    }
    // Editar una visita (o sumar tipos a una acción): los datos comunes van a todas; los tipos desmarcados se eliminan.
    if (item && esVisita) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) { setError('Para editar una visita con varias acciones necesitás conexión.'); setSaving(false); return }
      try {
        const inputs = [input, ...extras.map(a => inputDeTipo(input, a, datosExtra[a] ?? datosVacios()))]
        const r = await editarVisita(item.id, inputs, alcance)
        onSaved({ creadas: r.creadas, mensaje: `Visita actualizada${r.quitadas ? ` (se quitaron ${r.quitadas} ${r.quitadas === 1 ? 'acción' : 'acciones'})` : ''}` })
      } catch (err) { setError(errMsg(err)); setSaving(false) }
      return
    }
    // Visita con varias acciones: una por tipo, con los mismos datos comunes y un solo aviso a los acompañantes.
    if (extras.length) {
      const inputs = [input, ...extras.map(a => inputDeTipo(input, a, datosExtra[a] ?? datosVacios()))]
      const offline = () => { encolarVisitaOffline(inputs); onSaved({ creadas: inputs.length, offline: true }) }
      if (typeof navigator !== 'undefined' && !navigator.onLine) { offline(); return }
      try {
        const r = await guardarVisita(inputs)
        if (r.error && !r.guardadas.length) { setError(`No se pudo guardar ${r.error}`); setSaving(false); return }
        onSaved({ creadas: r.creadas, mensaje: r.error ? `Se guardaron ${r.guardadas.map(a => a.toLowerCase()).join(', ')}. No se pudo guardar ${r.error}. Cargala de nuevo.` : `Se agregaron ${inputs.length} acciones de la visita` })
      } catch (err) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) { offline(); return }
        setError(errMsg(err)); setSaving(false)
      }
      return
    }
    // Sin conexión: queda en cola en este dispositivo y se envía al volver la señal.
    if (typeof navigator !== 'undefined' && !navigator.onLine) { encolarOffline(input, item?.id); onSaved({ creadas: 1, offline: true }); return }
    try {
      const r = await saveItem(input, item?.id, alcance)
      // Licencia: las acciones planificadas de esos días pasan a reprogramadas (si se eligió).
      if (esLicencia && !item) {
        const ids = reprogramar ? (rango?.choques ?? []).map(i => i.id) : []
        if (ids.length) await cambiarEstadoVarias(ids, 'reprogramada').catch(() => null)
        onSaved({ creadas: r.creadas, mensaje: `Licencia cargada: ${r.creadas} ${r.creadas === 1 ? 'día hábil' : 'días hábiles'}${ids.length ? ` · ${ids.length} ${ids.length === 1 ? 'acción reprogramada' : 'acciones reprogramadas'}` : ''}` })
        return
      }
      onSaved({ creadas: r.creadas, id: r.id, mensaje: alcance === 'siguientes' && r.creadas > 1 ? `Se actualizaron este encuentro y ${r.creadas - 1} ${r.creadas === 2 ? 'fecha siguiente' : 'fechas siguientes'} de la serie` : estadoFinal !== form.estado ? 'La acción se marcó como realizada' : undefined }) } catch (err) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) { encolarOffline(input, item?.id); onSaved({ creadas: 1, offline: true }); return }
      setError(errMsg(err)); setSaving(false)
    }
  }

  return <form onSubmit={submit} className="flex flex-col gap-5">
    {!esParo && !esLicencia && <div id="campo-establecimiento" className="flex scroll-mt-24 flex-col gap-1.5"><span className="text-sm font-semibold">Establecimiento {!lugarOpcional && <span className="text-dte-magenta">*</span>} <span className="font-normal text-dte-gris">{modoT ? '(sede donde se desarrolla)' : lugarOpcional ? '(opcional)' : '(escuela o lugar; no hace falta para Licencia ni Paro)'}</span></span><SchoolPicker value={school} onChange={v => { setSchool(v); limpiar('establecimiento') }} onOrganismo={l => { set('lugar', l); limpiar('establecimiento') }} />{!school && <Input placeholder="Otro lugar, si no aparece en la búsqueda (ej.: Feria de Ciencias)" value={form.lugar} onChange={e => { set('lugar', e.target.value); limpiar('establecimiento') }} aria-invalid={!!errores.establecimiento || undefined} aria-describedby={errores.establecimiento ? 'err-establecimiento' : undefined} className="md:h-10" aria-label="Lugar" />}{errores.establecimiento && <p id="err-establecimiento" role="alert" className="text-sm font-medium text-peligro">{errores.establecimiento}</p>}</div>}

    {modoT === 'nuevo' && <label className="flex items-start gap-2.5 rounded-control border border-dte-linea bg-dte-fondo p-2.5 text-sm"><input type="checkbox" checked={aDefinirMarcado} onChange={e => setADefinir(e.target.checked)} className="mt-0.5 size-5" style={{ accentColor: marca.acento }} /><span><b>Fecha a definir.</b> {marca.corto === 'club' ? 'El club queda' : 'La práctica queda'} “por iniciar” y no se agrega a tu agenda hasta que programes el primer encuentro.</span></label>}
    {!aDefinir && <div className="grid gap-4 sm:grid-cols-3">
      <Field id="campo-fecha" label={modoT === 'nuevo' ? 'Fecha del primer encuentro' : esLicencia && !item ? 'Desde' : 'Fecha'} required className="scroll-mt-24" error={fechaError} errorId="err-fecha"><Input type="date" required value={form.fecha} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, fecha: v, estado: item?.estado === 'reprogramada' && f.estado === 'reprogramada' && v !== item.fecha ? 'planificada' : !item && v && v < hoyAR() ? 'realizada' : !item && v > hoyAR() && f.estado === 'realizada' ? 'planificada' : f.estado })) }} aria-invalid={!!fechaError || undefined} aria-describedby={fechaError ? 'err-fecha' : undefined} className="md:h-10" /></Field>
      {esLicencia ? !item && <Field label="Hasta" hint="(si dura más de un día)"><Input type="date" min={form.fecha} value={licHasta} onChange={e => { setLicHasta(e.target.value); limpiar('fecha') }} className="md:h-10" aria-label="Último día de la licencia" /></Field>
      : !esParo && <><Field label="Desde" hint="(opcional)"><Input type="time" value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} className="md:h-10" /></Field>
      <Field label="Hasta" hint="(opcional)"><Input type="time" value={form.hora_fin} onChange={e => set('hora_fin', e.target.value)} aria-invalid={!!timeError} className="md:h-10" /></Field></>}
    </div>}
    {!aDefinir && timeError && <p id="campo-hora" role="alert" className="-mt-3 scroll-mt-24 text-sm font-medium text-peligro">{timeError}</p>}
    {!aDefinir && ddjjDia && !esParo && !esLicencia && <p className={`-mt-3 flex items-start gap-1.5 text-xs ${fueraDeHorario ? 'text-aviso-fuerte' : 'text-dte-gris'}`}><Clock className="mt-px size-3.5 shrink-0" /><span>Tu horario DTE ese día (DD.JJ.): <b>{horario.franjas.length ? textoFranjas(horario.franjas) : ddjjDia.dte || 'sin horario DTE'}</b>{(ddjjDia.cargos ?? []).map(c => ` · ${c.nombre}: ${c.desde} a ${c.hasta}`).join('')}{horario.fuera ? '. La acción queda fuera de tu horario DTE.' : ''}{horario.choques.length ? `. Se superpone con ${horario.choques.map(c => c.nombre).join(' y ')}.` : ''}</span></p>}
    {!aDefinir && modoT && <fieldset><legend className="mb-2 text-sm font-semibold">Estado</legend><div className="flex flex-wrap gap-2">{(item ? ESTADOS : (['planificada', 'realizada'] as const)).map(e => <button key={e} type="button" aria-pressed={form.estado === e} onClick={() => set('estado', e)} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition md:min-h-8 md:text-xs ${form.estado === e ? statusStyle[e].badge : 'border-dte-linea text-dte-gris hover:text-dte-tinta'}`}>{form.estado === e && <Check className="size-3" />}{statusStyle[e].label}</button>)}</div></fieldset>}

    {!modoT && <fieldset id="campo-accion" className="scroll-mt-24" aria-describedby={errores.accion ? 'err-accion' : undefined}>
      <legend className="mb-2 text-sm font-semibold">Tipo de acción <span className="text-dte-magenta" aria-hidden>*</span></legend>
      {multiple && <p className="-mt-1 mb-2 text-xs text-dte-gris">Si en la misma visita hiciste más de una acción, marcalas todas: se guarda una por tipo, con la misma escuela, fecha y horario.</p>}
      {avisoCombinar && <p role="status" className="-mt-1 mb-2 rounded-control bg-info-fondo px-3 py-2 text-xs text-dte-tinta">{avisoCombinar}</p>}
      {errores.accion && <p id="err-accion" role="alert" className="-mt-1 mb-2 text-sm font-medium text-peligro">{errores.accion}</p>}
      {(() => {
        // Botón de cada tipo de acción.
        const boton = (name: Accion) => {
          const on = form.accion === name || extras.includes(name)
          return <button key={name} type="button" title={nombreAccion(name)} aria-pressed={on} onClick={() => { limpiar('accion'); elegirTipo(name) }} className={`flex min-h-11 min-w-0 items-center gap-1.5 rounded-control border px-2 py-2 text-left sm:gap-2 sm:px-2.5 text-xs font-bold uppercase leading-tight tracking-tight sm:tracking-normal break-words hyphens-auto transition ${on ? `${actionStyle[name].chip} border-current ring-1 ring-current` : 'border-dte-linea bg-white text-dte-gris hover:border-dte-gris-claro hover:text-dte-tinta'}`}>
            <span className={`flex size-4 shrink-0 items-center justify-center rounded-full ${on ? actionStyle[name].dot : 'border border-dte-linea'}`}>{on && <Check className="size-3 text-white" />}</span><span className="min-w-0">{etiquetaAccion(name).replace('/', '/\u200b')}</span>
          </button>
        }
        const visible = (name: Accion) => (name !== 'EVENTO DTE' || item?.accion === 'EVENTO DTE') && (esCed || !SOLO_CED.includes(name) || item?.accion === name) && (!esCed || !ACCIONES_CED.includes(name))
        const grilla = (lista: Accion[]) => <div className="grid grid-cols-1 gap-1.5 min-[360px]:grid-cols-2 sm:grid-cols-3">{lista.map(boton)}</div>
        const rotulo = 'mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-dte-gris'
        const buscador = <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dte-gris" aria-hidden />
          <Input type="search" value={buscaTipo} onChange={e => setBuscaTipo(e.target.value)} placeholder="Buscar tipo de acción…" aria-label="Buscar tipo de acción" className="pl-9 md:h-10" /></div>
        // Buscando: lista plana con las coincidencias (sin tildes ni mayúsculas).
        if (buscaTipo.trim()) {
          const q = sinTildes(buscaTipo.trim())
          const hallados = [...(esCed ? ACCIONES_CED : []), ...ACCIONES.filter(visible)].filter(n => sinTildes(`${n} ${nombreAccion(n)}`).includes(q))
          return <>{buscador}{hallados.length ? grilla(hallados) : <p className="text-sm text-dte-gris">No hay tipos de acción que coincidan con “{buscaTipo.trim()}”.</p>}</>
        }
        // Tus más usadas (de tu propia agenda) primero; el resto, por categoría y plegado. Sin historial, todo abierto como antes.
        const top = esCed ? [] : frecuentes.filter(n => ACCIONES.includes(n) && visible(n)).slice(0, 6)
        const grupos = <div className="flex flex-col gap-2">{CATEGORIAS.map(c => {
          const lista = ACCIONES.filter(name => CATEGORIA[name] === c && visible(name)).sort(az)
          const abierta = !top.length || (!!form.accion && CATEGORIA[form.accion] === c && !top.includes(form.accion))
          return <details key={`${c}-${abierta}`} open={abierta} className="group rounded-tile border border-dte-linea px-3 py-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-dte-gris md:min-h-9"><span className="size-2 rounded-sm" style={{ background: CAT_COLOR[c] }} />{CATEGORIA_LABEL[c]}<span className="font-normal normal-case tracking-normal">· {lista.length}</span><ChevronDown className="ml-auto size-4 transition group-open:rotate-180" aria-hidden /></summary>
            <div className="pb-2 pt-1">{grilla(lista)}</div>
          </details>
        })}</div>
        if (!esCed) return <>{buscador}{top.length > 0 && <div className="mb-3"><p className={rotulo}><Star className="size-3.5" aria-hidden />Tus más usadas</p>{grilla(top)}</div>}{grupos}</>
        // Coordinación: primero sus tareas; las acciones territoriales, plegadas (abiertas si ya hay una elegida).
        const territorial = !!form.accion && !ACCIONES_CED.includes(form.accion)
        return <div className="flex flex-col gap-3">{buscador}
          <div><p className={rotulo}>Coordinación</p>
            <div className="grid grid-cols-1 gap-1.5 min-[360px]:grid-cols-2 sm:grid-cols-3">{ACCIONES_CED.map(boton)}</div></div>
          <details open={territorial} className="rounded-tile border border-dte-linea p-3"><summary className="cursor-pointer text-sm font-semibold text-dte-petroleo">Acciones territoriales (como FED)</summary><div className="mt-3">{grupos}</div></details>
        </div>
      })()}
    </fieldset>}
    {esParo && <p className="rounded-control border border-dte-linea bg-dte-fondo px-3 py-2 text-sm text-dte-gris">Adhesión a paro gremial/docente. Se registra en la <b className="text-dte-tinta">Dirección de Tecnología Educativa</b> (lugar de trabajo); no hace falta completar nada más.</p>}
    {esLicencia && !item && rango && <div role="status" className="rounded-control border border-dte-linea bg-dte-fondo px-3 py-2 text-sm">
      <p><b>Licencia {licFin > form.fecha ? `del ${diaCorto(form.fecha)} al ${diaCorto(licFin)}` : `el ${diaCorto(form.fecha)}`}</b> · {rango.dias.length} {rango.dias.length === 1 ? 'día hábil' : 'días hábiles'} · todo el día</p>
      {rango.choques.length > 0 && <label className="mt-2 flex items-start gap-2"><input type="checkbox" checked={reprogramar} onChange={e => setReprogramar(e.target.checked)} className="mt-0.5 size-5 shrink-0" /><span>Tenés {rango.choques.length} {rango.choques.length === 1 ? 'acción planificada' : 'acciones planificadas'} en esos días. Marcarlas como <b>reprogramadas</b>.</span></label>}
    </div>}
    {esLicencia && <p className="rounded-control border border-aviso-borde bg-aviso-fondo px-3 py-2 text-sm text-aviso"><b>Recordatorio:</b> {RECORDATORIO_LICENCIA}</p>}


    {esReunion(form.accion) && <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Modalidad"><select className={`${selectClass} h-10`} value={form.modalidad_ev} onChange={e => { set('modalidad_ev', e.target.value as ModalidadEvento); limpiar('establecimiento'); limpiar('enlace') }}>{MODALIDADES_EVENTO.map(m => <option key={m}>{m}</option>)}</select></Field>
      {conEnlace(form.modalidad_ev) && <Field id="campo-enlace" label="Enlace de la reunión" hint="(opcional)" className="scroll-mt-24 sm:col-span-2" error={errores.enlace} errorId="err-enlace"><Input type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" placeholder="https://meet.google.com/…" value={form.enlace} onChange={e => { set('enlace', e.target.value); limpiar('enlace') }} onBlur={() => { try { const n = normalizarEnlace(form.enlace); if (n && n !== form.enlace) set('enlace', n) } catch { /* el error se muestra al guardar */ } }} aria-invalid={!!errores.enlace || undefined} aria-describedby={errores.enlace ? 'err-enlace' : undefined} className="md:h-10" /></Field>}
    </div>}
    {!aDefinir && !esParo && !esLicencia && companeros.length > 0 && <fieldset>
      <legend className="mb-1.5 flex w-full items-center justify-between text-sm font-semibold"><span>Acompañado por <span className="font-normal text-dte-gris">(opcional)</span></span>
        <button type="button" onClick={() => setParticipantes(participantes.length === companeros.length ? [] : companeros.map(c => c.id))} className="-my-2 min-h-11 px-1 text-xs font-semibold text-dte-petroleo hover:opacity-80 md:my-0 md:min-h-0">{participantes.length === companeros.length ? 'Quitar a todos' : 'Todo el equipo'}</button></legend>
      <div className="flex flex-wrap gap-1.5">{companeros.map(c => { const on = participantes.includes(c.id); return <Pill key={c.id} on={on} onClick={() => togglePart(c.id)}>{c.nombre_completo}</Pill> })}</div>
      {participantes.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(form.fecha) && <Disponibilidad fecha={form.fecha} desde={form.hora_inicio} hasta={form.hora_fin} personas={companeros.filter(c => participantes.includes(c.id))} excluir={item?.id} />}
      {participantes.length > 0 && <p className="mt-1.5 text-xs text-dte-gris">La acción va a aparecer en el calendario de {participantes.length === 1 ? 'esa persona' : `esas ${participantes.length} personas`} y les llega una notificación. Sólo vos podés editarla.</p>}
    </fieldset>}

    {extras.length > 0 && form.accion && <p className="-mb-2 flex items-center gap-2 text-sm font-semibold">Datos de <ActionChip label={form.accion} /></p>}
    {conSubAccion && <div className={`grid gap-4 ${cat === 'tecnica' ? 'sm:grid-cols-[1fr_9rem]' : ''}`}>
      <Field label={esFormacion ? 'Tema' : esEvento ? 'Evento' : 'Sub-acción'} hint="(opcional)"><Input list="sub-acciones" placeholder={esFormacion ? 'Ej.: Inteligencia artificial en el aula' : esEvento ? 'Ej.: JED 2026' : form.accion && SUB_ACCIONES[form.accion] ? `Ej.: ${SUB_ACCIONES[form.accion]!.slice(0, 2).join(', ')}` : 'Ej.: revisión de equipamiento'} value={form.sub_accion} onChange={e => set('sub_accion', e.target.value)} className="md:h-10" /></Field>
      {cat === 'tecnica' && <Field label="Cantidad" hint="(equipos)"><Input type="number" min={0} inputMode="numeric" placeholder="0" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} className="md:h-10" /></Field>}
    </div>}
    {esFormacion && <div className="grid gap-4 sm:grid-cols-3">
      <fieldset className="flex flex-col gap-1.5"><legend className="mb-1.5 text-sm font-semibold">Participación</legend><div className="flex flex-wrap gap-1.5">{ROLES_FORMACION.map(r => <Pill key={r} on={form.rol_formacion === r} onClick={() => set('rol_formacion', r)}>{r}</Pill>)}</div></fieldset>
      <Field label="Dictada por" hint="(opcional)"><Input placeholder="Ej.: DTE, Región 1, otro equipo" value={form.dictada_por} onChange={e => set('dictada_por', e.target.value)} className="md:h-10" /></Field>
      <Field label="Modalidad"><select className={`${selectClass} h-10`} value={form.modalidad_ev} onChange={e => set('modalidad_ev', e.target.value as ModalidadEvento)}>{MODALIDADES_EVENTO.map(m => <option key={m}>{m}</option>)}</select></Field>
    </div>}
    <datalist id="sub-acciones">{[...(form.accion ? SUB_ACCIONES[form.accion] ?? [] : [])].sort(az).map(o => <option key={o} value={o} />)}</datalist>
    {conSubAccion && form.accion && SUB_ACCIONES[form.accion] && <div className="-mt-3 flex flex-wrap items-center gap-1.5"><span className="mr-0.5 text-xs font-semibold uppercase tracking-wider text-dte-gris">Sugerencias</span>{[...SUB_ACCIONES[form.accion]!].sort(az).map(o => { const on = form.sub_accion.split(',').map(x => x.trim()).includes(o); return <Pill key={o} on={on} onClick={() => { const cur = form.sub_accion.split(',').map(x => x.trim()).filter(Boolean); set('sub_accion', (on ? cur.filter(x => x !== o) : [...cur, o]).join(', ')) }}>{o}</Pill> })}</div>}

    {esClub && <fieldset className="grid gap-4 overflow-hidden rounded-tile border border-dte-linea bg-dte-fondo p-3 sm:grid-cols-6">
      <legend className="sr-only">Registro: {marca.nombre}</legend>
      <div className={`-m-3 mb-0 flex items-center gap-3 px-3 py-2.5 sm:col-span-6 ${marca.degradado}`}><img src={marca.logo} alt={marca.nombre} className="h-10 w-auto" /><span className="text-xs font-semibold text-white/95">{marca.nota}</span></div>
      {modoT !== 'nuevo' && <Field id="campo-club" label={`¿A qué ${marca.corto} corresponde?`} required className="scroll-mt-24 sm:col-span-6" error={errores.club} errorId="err-club"><select className={`${selectClass} h-11 md:h-10`} value={form.club_id} onChange={e => { pickClub(e.target.value); limpiar('club') }} aria-invalid={!!errores.club || undefined} aria-describedby={errores.club ? 'err-club' : undefined} disabled={!clubes}>
        <option value="">{!clubes ? 'Cargando…' : modoT === 'encuentro' && !clubOpts.length ? `No tenés ${marca.corto === 'club' ? 'clubes activos' : 'prácticas activas'}` : `Elegí ${marca.corto === 'club' ? 'un club' : 'una práctica'}…`}</option>
        {[...clubOpts].sort((a, b) => az(a.school ? shortSchoolName(a.school) : a.lugar ?? '', b.school ? shortSchoolName(b.school) : b.lugar ?? '') || ordenGrupo(a.grupo, b.grupo)).map(c => <option key={c.id} value={c.id}>{clubLabel(c)}</option>)}
        {!modoT && <option value="nuevo">{marca.corto === 'club' ? '+ Iniciar un club nuevo' : '+ Iniciar una práctica nueva'} (comienza en esta fecha)</option>}
      </select></Field>}
      {!item && !form.club_id && clubesSugeridos.length > 0 && <div className="flex flex-col gap-2 rounded-control border border-club-lila/40 bg-white p-3 text-sm sm:col-span-6">
        <p>Ese día ya tenés {marca.corto === 'club' ? 'clubes' : 'prácticas'} en tu agenda. ¿Cargás un encuentro de alguno?</p>
        <div className="flex flex-wrap gap-1.5">{clubesSugeridos.map(c => { const it = delDia.items.find(i => i.club_id === c.id); return <Pill key={c.id} on={false} conIcono={false} onClick={() => pickClub(c.id)}>{c.grupo ?? 'Sin grupo'}{escuelaDelClub(c) ? ` · ${shortSchoolName(escuelaDelClub(c)!)}` : ''}{it?.hora_inicio ? ` · ${hhmm(it.hora_inicio)}` : ''}</Pill> })}</div>
        <p className="text-xs text-dte-gris">Si es el mismo encuentro que ya agendaste, abrilo desde la agenda y usá “Completar encuentro”.</p>
      </div>}
      {form.club_id === 'nuevo' && <div className="grid gap-3 rounded-control border border-dashed border-club-lila/50 bg-white p-3 sm:col-span-6 sm:grid-cols-6">
        {!item && !modoT && <label className="flex items-start gap-2.5 rounded-control border border-dte-linea bg-dte-fondo p-2.5 text-sm sm:col-span-6"><input type="checkbox" checked={aDefinirMarcado} onChange={e => setADefinir(e.target.checked)} className="mt-0.5 size-5" style={{ accentColor: marca.acento }} /><span><b>Fecha a definir.</b> {marca.corto === 'club' ? 'El club queda' : 'La práctica queda'} “por iniciar” y no se agrega a tu agenda hasta que programes el primer encuentro.</span></label>}
        <p className="text-xs text-dte-gris sm:col-span-6">Cada grado o curso es {marca.corto === 'club' ? 'un club' : 'una práctica'} en sí mismo. {school ? 'El nivel se sugiere según la escuela; podés cambiarlo.' : 'Elegí primero la escuela para sugerir el nivel.'}</p>
        <Field label="Nivel / modalidad" className="sm:col-span-3"><select className={`${selectClass} h-11 md:h-10`} value={nivel.id} onChange={e => setForm(f => ({ ...f, nivel: e.target.value, curso: '' }))}>{[...NIVELES].sort((a, b) => az(a.label, b.label)).map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></Field>
        <Field id="campo-curso" label={nivel.cursoLabel} required className="scroll-mt-24 sm:col-span-2" error={errores.curso} errorId="err-curso"><select className={`${selectClass} h-11 md:h-10`} value={form.curso} onChange={e => { set('curso', e.target.value); limpiar('curso') }} aria-invalid={!!errores.curso || undefined} aria-describedby={errores.curso ? 'err-curso' : undefined}><option value="">Elegí…</option>{nivel.cursos.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Sección" className="sm:col-span-1"><select className={`${selectClass} h-11 md:h-10`} value={form.seccion} onChange={e => set('seccion', e.target.value)}><option value="">—</option>{SECCIONES.map(x => <option key={x}>{x}</option>)}</select></Field>
        {form.accion === 'PRÁCTICAS PROFESIONALIZANTES' && <Field label="Grupo" hint="(opcional)" className="sm:col-span-6"><Input placeholder="Ej.: Grupo 1 (si el curso se dividió en grupos)" value={form.subgrupo} onChange={e => set('subgrupo', e.target.value)} className="h-10 bg-white" /><span className="text-xs text-dte-gris">Si el curso se dividió en grupos, cada grupo se carga por separado y las métricas los cuentan como un solo curso.</span></Field>}
        {!esPeat && <label className="flex items-center gap-2 text-sm sm:col-span-6"><input type="checkbox" checked={otroOrigen} onChange={e => setOtroOrigen(e.target.checked)} className="size-4" style={{ accentColor: marca.acento }} />Los estudiantes son de otra escuela (se desarrolla en esta sede o en territorio)</label>}
        {usaOrigen && <div id="campo-origen" className="flex scroll-mt-24 flex-col gap-1.5 sm:col-span-6"><span className="text-sm font-semibold">Escuela de origen de los estudiantes{esPeat && <span className="text-peligro"> *</span>}</span><SchoolPicker value={origen} onChange={setOrigen} />{esPeat && <span className="text-xs text-dte-gris">Identifica al grupo: las prácticas se hacen en varios lugares y cada encuentro lleva el suyo (el establecimiento de arriba).</span>}{errores.origen && <p role="alert" className="text-sm font-medium text-peligro">{errores.origen}</p>}</div>}
        {grupo && <p className="text-xs sm:col-span-6">Se va a registrar como <b>{grupo}</b>{esPeat ? (origen ? ` · ${shortSchoolName(origen)}` : '') : <>{school ? ` · ${shortSchoolName(school)}` : ''}{otroOrigen && origen ? ` · estudiantes de ${shortSchoolName(origen)}` : ''}</>}.</p>}
      </div>}
      {!aDefinir && club && <p className="-mt-2 text-xs text-dte-gris sm:col-span-6">{clubEncuentrosRealizados(club)} encuentros registrados{textoMinimo(club.tipo, clubEncuentrosRealizados(club)) ? ` · ${textoMinimo(club.tipo, clubEncuentrosRealizados(club))}` : ''}{club.escuela_origen ? ` · Estudiantes de ${shortSchoolName(club.escuela_origen)}` : ''}. La escuela o lugar de arriba es donde se hizo este encuentro.</p>}
      {!aDefinir && <Field label="Propuesta dictada" hint={marca.corto === 'club' ? undefined : undefined} className="self-end sm:col-span-4">{form.accion === 'CLUB DE TECNOLOGÍA' ? <PropuestaClub value={propuestaVista} onChange={v => set('propuesta', v)} /> : <Input readOnly aria-readonly value={propuestaEf} className="h-10 bg-dte-fondo text-dte-gris" />}</Field>}
      {form.accion === 'CLUB DE TECNOLOGÍA' && <Field label="Encuentros previstos" hint="(opcional)" className="self-end sm:col-span-2"><Input type="number" min={1} inputMode="numeric" placeholder={String(CLUB_MIN_ENCUENTROS)} value={form.encuentros_previstos} onChange={e => set('encuentros_previstos', e.target.value)} className="h-10 bg-white" /></Field>}
      {!aDefinir && <Field label="Encuentro N°" hint={modoT ? '(se asigna solo)' : undefined} className="sm:col-span-2"><Input type="number" min={1} inputMode="numeric" placeholder={modoT ? String(club ? proximoEncuentro(club.encuentros, form.fecha, item?.id) : 1) : undefined} value={form.encuentro_n} onChange={e => set('encuentro_n', e.target.value)} className="h-10 bg-white" /></Field>}
      {!aDefinir && <Field label="Tipo de jornada" className="sm:col-span-2"><select className={`${selectClass} h-11 md:h-10`} value={form.tipo_jornada} onChange={e => set('tipo_jornada', e.target.value as TipoJornada | '')}><option value="">Elegí…</option>{[...TIPOS_JORNADA].sort(azOtroAlFinal).map(t => <option key={t} value={t}>{t}</option>)}</select></Field>}
      {!aDefinir && <Field label="Formato de participación" className="sm:col-span-2"><select className={`${selectClass} h-11 md:h-10`} value={form.modalidad} onChange={e => set('modalidad', e.target.value as Modalidad)}>{[...MODALIDADES].sort(az).map(m => <option key={m}>{m}</option>)}</select></Field>}
      {!aDefinir && <div role="group" aria-labelledby="rotulo-destinatarios-1" className="flex flex-col gap-1.5 sm:col-span-6"><span id="rotulo-destinatarios-1" className="text-sm font-semibold text-dte-tinta">Destinatarios</span><Destinatarios key={`${form.club_id}-${grupoDest}`} value={destinatariosEf} grupo={grupoDest} onChange={v => set('destinatarios', v)} /></div>}
      {!aDefinir && modoT && form.estado !== 'realizada' && form.estado !== 'cancelada' && form.fecha <= hoyAR() && <p className="text-xs text-dte-gris sm:col-span-6">Si cargás los participantes reales o la descripción, al guardar la acción se marca como realizada.</p>}
      {!aDefinir && (!modoT || form.estado === 'realizada' || form.fecha <= hoyAR()) && <Field label="Cantidad de inscriptos" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={inscriptosEf} onChange={e => set('inscriptos', e.target.value)} className="h-10 bg-white" /></Field>}
      {!aDefinir && (!modoT || form.estado === 'realizada' || form.fecha <= hoyAR()) && <Field label="Participantes reales" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={form.asistentes} onChange={e => set('asistentes', e.target.value)} className="h-10 bg-white" /></Field>}
      {!aDefinir && (!modoT || form.estado === 'realizada' || form.fecha <= hoyAR()) && <Field label="Breve descripción de lo realizado" className="sm:col-span-6"><Textarea rows={3} placeholder="Qué se trabajó, con qué recursos, cómo participó el grupo…" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} className="bg-white" /></Field>}
      {!aDefinir && (!modoT || form.estado === 'realizada' || form.fecha <= hoyAR()) && <label className="flex items-start gap-2.5 rounded-control border border-dte-linea bg-white p-2.5 text-sm sm:col-span-6"><input type="checkbox" checked={form.es_cierre} onChange={e => set('es_cierre', e.target.checked)} className="mt-0.5 size-5" style={{ accentColor: marca.acento }} /><span><b>Este es el encuentro de cierre {marca.corto === 'club' ? 'del club' : 'de la práctica'}</b><span className="block text-xs text-dte-gris">{marca.corto === 'club' ? 'El club queda finalizado' : 'La práctica queda finalizada'} con esta fecha y deja de figurar entre los activos.</span></span></label>}
    </fieldset>}
    {conEncuentro && !esClub && <fieldset className="grid gap-4 rounded-tile border border-dte-linea bg-dte-fondo p-3 sm:grid-cols-6">
      <legend className="px-1 text-sm font-semibold">Datos del encuentro <span className="font-normal text-dte-gris">(para las métricas de participación)</span></legend>
      <div role="group" aria-labelledby="rotulo-propuesta" className="flex flex-col gap-1.5 sm:col-span-6"><span id="rotulo-propuesta" className="text-sm font-semibold text-dte-tinta">Propuesta</span>
        {esTaller ? <PropuestaTaller value={form.propuesta} onChange={v => set('propuesta', v)} /> : <Input aria-label="Propuesta" placeholder="Ej.: Ciudadanía digital en el aula" value={form.propuesta} onChange={e => set('propuesta', e.target.value)} className="h-10 bg-white" />}</div>
      <Field label="Encuentro N°" className="sm:col-span-2"><Input type="number" min={1} inputMode="numeric" value={form.encuentro_n} onChange={e => set('encuentro_n', e.target.value)} className="h-10 bg-white" /></Field>
      <Field label="Modalidad" className="sm:col-span-4"><select className={`${selectClass} h-11 md:h-10`} value={form.modalidad} onChange={e => set('modalidad', e.target.value as Modalidad)}>{[...MODALIDADES].sort(az).map(m => <option key={m}>{m}</option>)}</select></Field>
      <div role="group" aria-labelledby="rotulo-destinatarios-2" className="flex flex-col gap-1.5 sm:col-span-6"><span id="rotulo-destinatarios-2" className="text-sm font-semibold text-dte-tinta">Destinatarios</span>{esTaller ? <Destinatarios value={form.destinatarios} grupo={null} onChange={v => set('destinatarios', v)} /> : <Input aria-label="Destinatarios" placeholder="Ej.: estudiantes de 6° A, docentes" value={form.destinatarios} onChange={e => set('destinatarios', e.target.value)} className="h-10 bg-white" />}</div>
      {(!esTaller || form.estado === 'realizada' || form.fecha <= hoyAR()) && <>
        <Field label="Inscriptos" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={form.inscriptos} onChange={e => set('inscriptos', e.target.value)} className="h-10 bg-white" /></Field>
        <Field label="Asistentes" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={form.asistentes} onChange={e => set('asistentes', e.target.value)} className="h-10 bg-white" /></Field>
        {esTaller && <Field label="Breve descripción de lo realizado" className="sm:col-span-6"><Textarea rows={3} placeholder="Qué se trabajó, con qué recursos, cómo participó el grupo…" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} className="bg-white" /></Field>}
      </>}
    </fieldset>}
    {!aDefinir && !modoT && !esParo && <Field label={esLicencia ? 'Motivo' : 'Detalle'} hint="(opcional)"><Textarea placeholder={esLicencia ? 'Ej.: enfermedad, razones particulares (sin datos sensibles)' : 'Información útil para el seguimiento: con quién, qué se acordó, pendientes…'} rows={3} value={form.detalle} onChange={e => set('detalle', e.target.value)} /></Field>}

    {extras.map(a => { const d = datosExtra[a] ?? datosVacios(), sug = SUB_ACCIONES[a]; return <fieldset key={a} className="flex flex-col gap-3 rounded-tile border border-dte-linea p-3">
      <legend className="flex items-center gap-2 px-1 text-sm font-semibold">Datos de <ActionChip label={a} /></legend>
      <div className={`grid gap-4 ${CATEGORIA[a] === 'tecnica' ? 'sm:grid-cols-[1fr_9rem]' : ''}`}>
        <Field label="Sub-acción" hint="(opcional)"><Input list={`sub-${a}`} value={d.sub_accion} onChange={e => setExtra(a, 'sub_accion', e.target.value)} placeholder={sug ? `Ej.: ${sug.slice(0, 2).join(', ')}` : 'Ej.: revisión de equipamiento'} className="md:h-10" /></Field>
        {CATEGORIA[a] === 'tecnica' && <Field label="Cantidad" hint="(equipos)"><Input type="number" min={0} inputMode="numeric" placeholder="0" value={d.cantidad} onChange={e => setExtra(a, 'cantidad', e.target.value)} className="md:h-10" /></Field>}
      </div>
      <datalist id={`sub-${a}`}>{[...(sug ?? [])].sort(az).map(o => <option key={o} value={o} />)}</datalist>
      {sug && <div className="-mt-1 flex flex-wrap items-center gap-1.5"><span className="mr-0.5 text-xs font-semibold uppercase tracking-wider text-dte-gris">Sugerencias</span>{[...sug].sort(az).map(o => { const cur = d.sub_accion.split(',').map(x => x.trim()).filter(Boolean), on = cur.includes(o); return <Pill key={o} on={on} onClick={() => setExtra(a, 'sub_accion', (on ? cur.filter(x => x !== o) : [...cur, o]).join(', '))}>{o}</Pill> })}</div>}
      {CON_ENCUENTRO.includes(a) && <div className="grid gap-4 rounded-tile bg-dte-fondo p-3 sm:grid-cols-6">
        <Field label="Propuesta" className="sm:col-span-4"><Input placeholder="Ej.: Ciudadanía digital en el aula" value={d.propuesta} onChange={e => setExtra(a, 'propuesta', e.target.value)} className="h-10 bg-white" /></Field>
        <Field label="Encuentro N°" className="sm:col-span-2"><Input type="number" min={1} inputMode="numeric" value={d.encuentro_n} onChange={e => setExtra(a, 'encuentro_n', e.target.value)} className="h-10 bg-white" /></Field>
        <Field label="Destinatarios" className="sm:col-span-4"><Input placeholder="Ej.: estudiantes de 6° A, docentes" value={d.destinatarios} onChange={e => setExtra(a, 'destinatarios', e.target.value)} className="h-10 bg-white" /></Field>
        <Field label="Modalidad" className="sm:col-span-2"><select className={`${selectClass} h-11 md:h-10`} value={d.modalidad} onChange={e => setExtra(a, 'modalidad', e.target.value)}>{[...MODALIDADES].sort(az).map(m => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Inscriptos" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={d.inscriptos} onChange={e => setExtra(a, 'inscriptos', e.target.value)} className="h-10 bg-white" /></Field>
        <Field label="Asistentes" className="sm:col-span-3"><Input type="number" min={0} inputMode="numeric" value={d.asistentes} onChange={e => setExtra(a, 'asistentes', e.target.value)} className="h-10 bg-white" /></Field>
      </div>}
      <Field label="Detalle" hint="(opcional)"><Textarea rows={2} value={d.detalle} onChange={e => setExtra(a, 'detalle', e.target.value)} placeholder="Información útil para el seguimiento de esta acción" /></Field>
      <Button type="button" variant="ghost" size="sm" className="self-start text-peligro hover:bg-peligro-fondo hover:text-peligro" onClick={() => elegirTipo(a)}>Quitar {etiquetaAccion(a).toLowerCase()} de la visita</Button>
    </fieldset> })}

    {!aDefinir && item && !modoT && <fieldset><legend className="mb-2 text-sm font-semibold">Estado</legend><div className="flex flex-wrap gap-2">{(item ? ESTADOS : (['planificada', 'realizada'] as const)).map(e => <button key={e} type="button" aria-pressed={form.estado === e} onClick={() => set('estado', e)} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition md:min-h-8 md:text-xs ${form.estado === e ? statusStyle[e].badge : 'border-dte-linea text-dte-gris hover:text-dte-tinta'}`}>{form.estado === e && <Check className="size-3" />}{statusStyle[e].label}</button>)}</div>{form.estado === 'reprogramada' && <p className="mt-1.5 text-xs text-dte-gris">Reprogramada: se suspendió y queda pendiente de nueva fecha. Al cambiarle la fecha, vuelve a Planificada.</p>}</fieldset>}

    {!aDefinir && !item && !esParo && !esLicencia && form.accion && <fieldset id="campo-serie" className="scroll-mt-24 rounded-tile border border-dte-linea p-3">
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={repetir} onChange={e => { setRepetir(e.target.checked); limpiar('serie') }} className="size-5" />Se repite cada semana <span className="font-normal text-dte-gris">(ej.: el club todos los miércoles)</span></label>
      {repetir && <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-xs font-semibold uppercase tracking-wider text-dte-gris">Días</span>{DIAS_HABILES.map((d, i) => { const n = i + 1, on = diasSerie.includes(n); return <Pill key={d} on={on} conIcono={false} className="min-w-11 justify-center font-semibold" onClick={() => { limpiar('serie'); setDias((on ? diasSerie.filter(x => x !== n) : [...diasSerie, n]).sort()) }}>{d}</Pill> })}</div>
        <Field label="Hasta" className="max-w-48"><Input type="date" min={form.fecha} value={hastaSerie} onChange={e => setHasta(e.target.value)} className="md:h-10" /></Field>
        <p className="text-xs text-dte-gris">Se crean como <b>planificadas</b> con los mismos datos, salteando feriados y recesos. Después completás cada encuentro{esClub ? ` y queda asociado al ${marca.corto}` : ''}. Máximo 60 fechas.</p>
        {errores.serie && <p role="alert" className="text-sm font-medium text-peligro">{errores.serie}</p>}
      </div>}
    </fieldset>}

    {!aDefinir && avisos.length > 0 && <div role="status" className="rounded-tile border border-aviso-borde bg-aviso-fondo px-3 py-2.5 text-sm text-aviso">
      <p className="mb-1 flex items-center gap-1.5 font-semibold"><TriangleAlert className="size-4" />Revisá antes de guardar</p>
      <ul className="list-disc pl-5 text-sm">{avisos.map(a => <li key={a}>{a}</li>)}</ul>
    </div>}
    {error && <ErrorBox message={error} />}
    <div className="sticky -bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] -mx-4 -mb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex gap-2 border-t border-dte-linea bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:-bottom-4 sm:-mb-4 sm:justify-end sm:pb-3">
      <Button variant="outline" type="button" size="lg" className="flex-1 sm:flex-none" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" size="lg" disabled={saving} className="flex-1 bg-dte-petroleo px-4 sm:flex-none font-semibold hover:bg-dte-petroleo-oscuro">{saving && <Loader2 className="animate-spin" data-icon="inline-start" />}{item ? 'Guardar cambios' : aDefinir ? 'Guardar como “por iniciar”' : extras.length ? `Agregar ${extras.length + 1} acciones` : 'Agregar a mi agenda'}</Button>
    </div>
    <Dialog open={preguntarSerie} onOpenChange={setPreguntarSerie}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader><DialogTitle className="text-lg">Esta acción es parte de una serie</DialogTitle><DialogDescription>¿Aplicás el cambio sólo a esta fecha o también a las fechas planificadas que siguen? En las siguientes se actualizan horario, lugar y datos de la propuesta; no se cambia la fecha de cada una ni los datos de participación.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => guardar('uno')}>Sólo este encuentro</Button>
          <Button type="button" onClick={() => guardar('siguientes')} className="bg-dte-petroleo hover:bg-dte-petroleo-oscuro">Este y los siguientes</Button>
        </div>
      </DialogContent>
    </Dialog>
  </form>
}

// Disponibilidad de los acompañantes en la fecha y el horario elegidos: horario DTE (DD.JJ.), otros cargos,
// otras acciones y licencias. Sólo avisa; no impide guardar.
function Disponibilidad({ fecha, desde, hasta, personas, excluir }: { fecha: string, desde: string, hasta: string, personas: Fed[], excluir?: string }) {
  const ids = personas.map(p => p.id).sort().join(',')
  const clave = `${fecha}|${ids}|${excluir ?? ''}`
  const [res, setRes] = useState<{ clave: string, ocup: Ocupacion[] } | null>(null)
  useEffect(() => {
    let vivo = true
    const t = setTimeout(() => disponibilidad(fecha, ids.split(','), excluir).then(o => vivo && setRes({ clave, ocup: o })).catch(() => vivo && setRes({ clave, ocup: [] })), 300)
    return () => { vivo = false; clearTimeout(t) }
  }, [clave, fecha, ids, excluir])
  const ocup = res?.clave === clave ? res.ocup : null
  if (!ocup) return <p className="mt-2 flex items-center gap-1.5 text-xs text-dte-gris"><Loader2 className="size-3.5 animate-spin" />Revisando disponibilidad…</p>
  const fin = hasta && hasta > desde ? hasta : desde
  const cruza = (o: Ocupacion) => { const a = hhmm(o.hora_inicio), b = hhmm(o.hora_fin) || a; return !!a && (a === desde || (a < fin && desde < b)) }
  const rango = (o: Ocupacion) => (o.hora_inicio ? `${hhmm(o.hora_inicio)}${o.hora_fin ? ` a ${hhmm(o.hora_fin)}` : ''}` : 'sin horario')
  const filas = personas.map(p => {
    const suyas = ocup.filter(o => o.fed_id === p.id)
    const aus = suyas.find(o => esAusencia(o.accion))
    const notas: string[] = []
    if (aus) return { p, nivel: 2, notas: [aus.accion === 'PARO' ? 'Adhiere al paro ese día' : 'De licencia ese día'] }
    if (desde) {
      const h = chequearHorario(ddjjFor(p, fecha), desde, hasta)
      if (h.fuera) notas.push('Fuera de su horario DTE')
      for (const c of h.choques) notas.push(`En horario de ${c.nombre}`)
      for (const o of suyas.filter(cruza)) notas.push(`Tiene ${cap(o.accion.toLowerCase())} ${rango(o)}${o.lugar ? ` · ${titleCase(o.lugar)}` : ''}`)
    }
    return { p, nivel: notas.length ? 1 : 0, notas }
  })
  const libres = filas.filter(f => f.nivel === 0).length
  return <div className="mt-2 rounded-control border border-dte-linea bg-dte-fondo p-2.5 text-sm" role="status">
    <p className="font-semibold">{desde ? `Disponibilidad: ${libres} de ${filas.length} ${filas.length === 1 ? 'persona disponible' : 'disponibles'}` : 'Disponibilidad'}{!desde && <span className="font-normal text-dte-gris"> · cargá el horario para revisar coincidencias</span>}</p>
    <ul className="mt-1.5 flex flex-col gap-1">{filas.map(({ p, nivel, notas }) => <li key={p.id} className="flex items-start gap-2 text-xs">
      <span aria-hidden className={`mt-0.5 size-2.5 shrink-0 rounded-full ${nivel === 2 ? 'bg-peligro' : nivel === 1 ? 'bg-aviso-fuerte' : 'bg-exito'}`} />
      <span><b>{p.nombre_completo}</b>{notas.length ? `: ${notas.join(' · ')}` : desde ? ': disponible' : ''}</span></li>)}</ul>
  </div>
}
