'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/segmented'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, SchoolPicker } from '@/components/app/formulario'
import { CLUB_MIN_ENCUENTROS, MODALIDADES, TIPOS_JORNADA, TRAYECTO_MARCA, clubEncuentrosRealizados, clubEstado, iniciado, ordenGrupo, type Club, type Fed, type School, type Modalidad, type TipoJornada, type Trayecto } from '@/lib/agenda'
import { az, errMsg, getClubes, iso, saveItem, selectClass, shortSchoolName, ErrorBox } from '@/components/app/comun'

const OTRA = '__otra'
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']

// Registro de un encuentro de un club o práctica activo, con los campos de la planilla de seguimiento.
// Se guarda como acción del FED en su agenda (realizada si la fecha ya pasó), vinculada al club.
export function RegistroEncuentro({ fed, tipo, clubId, onCancel, onSaved }: { fed: Fed, tipo: Trayecto, clubId?: string, onCancel: () => void, onSaved: (mensaje: string) => void }) {
  const marca = TRAYECTO_MARCA[tipo]
  const hoy = iso(new Date())
  const [clubes, setClubes] = useState<Club[] | null>(null)
  useEffect(() => { getClubes(fed.id).then(setClubes).catch(() => setClubes([])) }, [fed.id])
  // Activos (con inicio y sin finalizar); el club elegido desde su fila se incluye aunque esté por iniciar.
  const opciones = (clubes ?? []).filter(c => c.tipo === tipo && (c.id === clubId || (iniciado(c) && clubEstado(c, hoy) !== 'finalizado')))
    .sort((a, b) => az(etiqueta({ ...a, grupo: null }), etiqueta({ ...b, grupo: null })) || ordenGrupo(a.grupo, b.grupo))
  const [id, setId] = useState(clubId ?? '')
  const club = opciones.find(c => c.id === id) ?? null
  const [propuesta, setPropuesta] = useState(marca.propuesta)
  const [otraPropuesta, setOtraPropuesta] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [desde, setDesde] = useState('')
  // Sede del encuentro: la habitual del grupo o, cuando salen a territorio, la escuela donde se hace ese día.
  const [enOtraSede, setEnOtraSede] = useState(false)
  const [otraSede, setOtraSede] = useState<School | null>(null)
  const [hasta, setHasta] = useState('')
  // Otros grupos (grados) de la misma sede que se registran con los mismos datos, cada uno con su número de encuentro.
  const [otros, setOtros] = useState<string[]>([])
  const hermanos = club ? opciones.filter(c => c.id !== club.id && c.school_id && c.school_id === club.school_id) : []
  // Serie: mismos días de la semana hasta una fecha (salta feriados y recesos); las fechas futuras quedan planificadas.
  const [repetir, setRepetir] = useState(false)
  const [dias, setDias] = useState<number[]>([])
  const [serieHasta, setSerieHasta] = useState('')
  const diaFecha = new Date(`${fecha}T12:00`).getDay()
  const diasSerie = dias.length ? dias : diaFecha >= 1 && diaFecha <= 5 ? [diaFecha] : []
  const [previstos, setPrevistos] = useState('')
  const [jornada, setJornada] = useState<TipoJornada | ''>(tipo === 'CLUB DE TECNOLOGÍA' ? 'Taller' : 'Formación')
  const [modalidad, setModalidad] = useState<Modalidad>('Presencial')
  const [destinatarios, setDestinatarios] = useState('')
  const [inscriptos, setInscriptos] = useState('')
  const [asistentes, setAsistentes] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [errores, setErrores] = useState<{ club?: string, propuesta?: string, hora?: string, serie?: string }>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (club) setPrevistos(club.encuentros_previstos?.toString() ?? '') }, [club])
  useEffect(() => { setOtros([]) }, [id])
  const num = (v: string) => (v.trim() === '' ? null : Number(v))

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof errores = {}
    if (!club) errs.club = `Elegí ${marca.corto === 'club' ? 'el club' : 'la práctica'}.`
    if (propuesta === OTRA && !otraPropuesta.trim()) errs.propuesta = 'Escribí la propuesta dictada.'
    if (enOtraSede && !otraSede) errs.club = 'Elegí la escuela donde se hizo el encuentro.'
    if (desde && hasta && hasta <= desde) errs.hora = 'La hora de fin tiene que ser posterior a la de inicio.'
    if (repetir && (!diasSerie.length || !serieHasta || serieHasta <= fecha)) errs.serie = 'Elegí al menos un día y una fecha de fin posterior.'
    setErrores(errs)
    if (!club || Object.keys(errs).length) return
    setSaving(true); setError('')
    try {
      // Un registro por grupo (el elegido y los otros grados marcados); el número de encuentro lo asigna el servidor.
      const grupos = [club, ...hermanos.filter(c => otros.includes(c.id))]
      let creadas = 0
      for (const c of grupos) {
        const r = await saveItem({
          fed_id: fed.id, school_id: enOtraSede && otraSede ? otraSede.id : c.school_id, lugar: enOtraSede && otraSede ? null : c.school_id ? null : c.lugar, fecha, hora_inicio: desde || null, hora_fin: hasta || null, accion: tipo,
          estado: fecha <= hoy ? 'realizada' : 'planificada', sub_accion: null, detalle: null, cantidad: null, participantes: [],
          repeticion: repetir ? { dias: diasSerie, hasta: serieHasta } : null,
          encuentro: { propuesta: propuesta === OTRA ? otraPropuesta.trim() : propuesta, encuentro_n: null, modalidad, destinatarios, inscriptos: num(inscriptos), asistentes: num(asistentes),
            tipo_jornada: jornada || null, descripcion, club_id: c.id, nuevo_club: false, encuentros_previstos: c.id === club.id ? num(previstos) : c.encuentros_previstos },
        })
        creadas += r.creadas
      }
      onSaved(creadas > grupos.length ? `Se agendaron ${creadas} encuentros (${grupos.map(etiqueta).join(', ')})` : grupos.length > 1 ? `Encuentro registrado en ${grupos.length} grupos` : `Encuentro registrado en ${etiqueta(club)}`)
    } catch (err) { setError(errMsg(err)); setSaving(false) }
  }

  return <form onSubmit={guardar} className="flex flex-col gap-4">
    <div className={`-mx-4 -mt-2 flex items-center gap-3 px-4 py-2.5 sm:mx-0 sm:rounded-xl ${marca.degradado}`}><img src={marca.logo} alt={marca.nombre} className="h-10 w-auto" /><span className="text-xs font-semibold text-white/95">{marca.nota}</span></div>

    <Field id="campo-club" label="¿En qué lugar se realizó?" required error={errores.club} errorId="err-club">
      <select className={selectClass} value={id} onChange={e => { setId(e.target.value); setErrores(x => ({ ...x, club: undefined })) }} aria-invalid={!!errores.club} aria-describedby={errores.club ? 'err-club' : undefined}>
        <option value="">{!clubes ? 'Cargando…' : opciones.length ? `Elegí ${marca.corto === 'club' ? 'el club' : 'la práctica'}…` : `No tenés ${marca.corto === 'club' ? 'clubes activos' : 'prácticas activas'}`}</option>
        {opciones.map(c => <option key={c.id} value={c.id}>{etiqueta(c)}</option>)}
      </select>
    </Field>
    {club && <p className="-mt-2 text-xs text-dte-gris">Próximo encuentro: N° {Math.max(club.encuentros.reduce((m, e) => Math.max(m, e.encuentro_n ?? 0), 0), clubEncuentrosRealizados(club)) + 1} (se numera solo){club.encuentros_previstos ? ` de ${club.encuentros_previstos} previstos` : ''}{club.school?.distrito ? ` · ${club.school.distrito}` : ''}</p>}

    {hermanos.length > 0 && <fieldset><legend className="mb-1.5 text-sm font-semibold">Registrar también para <span className="font-normal text-dte-gris">(mismos datos, otros grupos de la escuela)</span></legend>
      <div className="flex flex-wrap gap-1.5">{hermanos.map(c => <Pill key={c.id} on={otros.includes(c.id)} onClick={() => setOtros(l => (l.includes(c.id) ? l.filter(x => x !== c.id) : [...l, c.id]))}>{c.grupo ?? etiqueta(c)}</Pill>)}</div>
    </fieldset>}

    {club && <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">Sede del encuentro</legend>
      <div className="grid gap-1.5 sm:grid-cols-2">
        <Pill conIcono={false} on={!enOtraSede} onClick={() => setEnOtraSede(false)} className="justify-center">Sede habitual</Pill>
        <Pill conIcono={false} on={enOtraSede} onClick={() => setEnOtraSede(true)} className="justify-center">Otra escuela (territorio)</Pill>
      </div>
      {enOtraSede ? <div className="mt-2"><SchoolPicker value={otraSede} onChange={setOtraSede} /></div>
        : <p className="mt-1.5 text-xs text-dte-gris">{club.school ? shortSchoolName(club.school) : club.lugar ?? 'Sin sede cargada'}</p>}
    </fieldset>}

    <Field label="Propuesta dictada" required error={errores.propuesta} errorId="err-propuesta">
      <select className={selectClass} value={propuesta} onChange={e => setPropuesta(e.target.value)}>
        <option value={marca.propuesta}>{marca.propuesta}</option>
        <option value={OTRA}>Otra propuesta…</option>
      </select>
    </Field>
    {propuesta === OTRA && <Input aria-label="Otra propuesta" placeholder="Ej.: Taller de robótica" value={otraPropuesta} onChange={e => setOtraPropuesta(e.target.value)} className="-mt-2" />}

    <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
      <Field label="Fecha" required><Input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} /></Field>
      <Field label="Cantidad de encuentros de la propuesta"><Input type="number" min={1} inputMode="numeric" placeholder={String(CLUB_MIN_ENCUENTROS)} value={previstos} onChange={e => setPrevistos(e.target.value)} /></Field>
      <Field label="Tipo de jornada"><select className={selectClass} value={jornada} onChange={e => setJornada(e.target.value as TipoJornada | '')}><option value="">Elegí…</option>{[...TIPOS_JORNADA].sort(az).map(t => <option key={t}>{t}</option>)}</select></Field>
      <Field label="Formato de participación"><select className={selectClass} value={modalidad} onChange={e => setModalidad(e.target.value as Modalidad)}>{[...MODALIDADES].sort(az).map(m => <option key={m}>{m}</option>)}</select></Field>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Desde" hint="(opcional)"><Input type="time" value={desde} onChange={e => setDesde(e.target.value)} /></Field>
      <Field label="Hasta" hint="(opcional)" error={errores.hora} errorId="err-hora"><Input type="time" value={hasta} onChange={e => setHasta(e.target.value)} /></Field>
    </div>
    <fieldset className="rounded-xl border border-dte-linea bg-dte-fondo/60 p-3">
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={repetir} onChange={e => setRepetir(e.target.checked)} className="size-5" style={{ accentColor: marca.acento }} />Se repite cada semana <span className="font-normal text-dte-gris">(agenda los próximos encuentros)</span></label>
      {repetir && <div className="mt-3 flex flex-col gap-3">
        <div><p className="mb-1.5 text-sm font-semibold">Días</p><div className="flex flex-wrap gap-1.5">{DIAS.map((d, k) => <Pill key={d} conIcono={false} on={diasSerie.includes(k + 1)} onClick={() => setDias(l => { const base = l.length ? l : diasSerie; return base.includes(k + 1) ? base.filter(x => x !== k + 1) : [...base, k + 1].sort() })}>{d}</Pill>)}</div></div>
        <Field label="Hasta el" error={errores.serie} errorId="err-serie"><Input type="date" min={fecha} value={serieHasta} onChange={e => setSerieHasta(e.target.value)} /></Field>
        <p className="text-xs text-dte-gris">Se saltean feriados y recesos. Las fechas futuras quedan planificadas en tu agenda: el día del encuentro abrilo y completá inscriptos, participantes y descripción.</p>
      </div>}
    </fieldset>
    <Field label="Destinatarios"><Input placeholder="Ej.: estudiantes de 5° y 6°, familias" value={destinatarios} onChange={e => setDestinatarios(e.target.value)} /></Field>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Cantidad de inscriptos"><Input type="number" min={0} inputMode="numeric" value={inscriptos} onChange={e => setInscriptos(e.target.value)} /></Field>
      <Field label="Cantidad de participantes reales"><Input type="number" min={0} inputMode="numeric" value={asistentes} onChange={e => setAsistentes(e.target.value)} /></Field>
    </div>
    <Field label="Breve descripción de lo realizado"><Textarea rows={3} placeholder="Qué se trabajó, con qué recursos, cómo participó el grupo…" value={descripcion} onChange={e => setDescripcion(e.target.value)} /></Field>
    {fecha > hoy && <p className="rounded-lg border border-aviso-borde bg-aviso-fondo px-3 py-2 text-sm text-aviso">La fecha todavía no llegó: el encuentro queda <b>planificado</b> en tu agenda.</p>}

    {error && <ErrorBox message={error} />}
    <div className="sticky -bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] -mx-4 -mb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex gap-2 border-t border-dte-linea bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 sm:-bottom-4 sm:-mb-4 sm:justify-end">
      <Button type="button" variant="outline" size="lg" onClick={onCancel} className="flex-1 sm:flex-none">Cancelar</Button>
      <Button type="submit" size="lg" disabled={saving} className="flex-1 bg-dte-petroleo px-4 font-semibold hover:bg-dte-petroleo-oscuro sm:flex-none">{saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}Registrar encuentro</Button>
    </div>
  </form>
}

const etiqueta = (c: Club) => `${c.school ? shortSchoolName(c.school) : c.lugar ?? 'Sin lugar'}${c.grupo ? ` · ${c.grupo}` : ''}`
