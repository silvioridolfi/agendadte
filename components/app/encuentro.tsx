'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/app/formulario'
import { CLUB_MIN_ENCUENTROS, MODALIDADES, TIPOS_JORNADA, TRAYECTO_MARCA, clubEncuentrosRealizados, clubEstado, iniciado, type Club, type Fed, type Modalidad, type TipoJornada, type Trayecto } from '@/lib/agenda'
import { az, errMsg, getClubes, iso, saveItem, selectClass, shortSchoolName, ErrorBox } from '@/components/app/comun'

const OTRA = '__otra'

// Registro de un encuentro de un club o práctica activo, con los campos de la planilla de seguimiento.
// Se guarda como acción del FED en su agenda (realizada si la fecha ya pasó), vinculada al club.
export function RegistroEncuentro({ fed, tipo, clubId, onCancel, onSaved }: { fed: Fed, tipo: Trayecto, clubId?: string, onCancel: () => void, onSaved: (mensaje: string) => void }) {
  const marca = TRAYECTO_MARCA[tipo]
  const hoy = iso(new Date())
  const [clubes, setClubes] = useState<Club[] | null>(null)
  useEffect(() => { getClubes(fed.id).then(setClubes).catch(() => setClubes([])) }, [fed.id])
  // Activos (con inicio y sin finalizar); el club elegido desde su fila se incluye aunque esté por iniciar.
  const opciones = (clubes ?? []).filter(c => c.tipo === tipo && (c.id === clubId || (iniciado(c) && clubEstado(c, hoy) !== 'finalizado')))
    .sort((a, b) => az(etiqueta(a), etiqueta(b)))
  const [id, setId] = useState(clubId ?? '')
  const club = opciones.find(c => c.id === id) ?? null
  const [propuesta, setPropuesta] = useState(marca.propuesta)
  const [otraPropuesta, setOtraPropuesta] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [previstos, setPrevistos] = useState('')
  const [jornada, setJornada] = useState<TipoJornada | ''>(tipo === 'CLUB DE TECNOLOGÍA' ? 'Taller' : 'Formación')
  const [modalidad, setModalidad] = useState<Modalidad>('Presencial')
  const [destinatarios, setDestinatarios] = useState('')
  const [inscriptos, setInscriptos] = useState('')
  const [asistentes, setAsistentes] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [errores, setErrores] = useState<{ club?: string, propuesta?: string }>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (club) setPrevistos(club.encuentros_previstos?.toString() ?? '') }, [club])
  const num = (v: string) => (v.trim() === '' ? null : Number(v))

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof errores = {}
    if (!club) errs.club = `Elegí ${marca.corto === 'club' ? 'el club' : 'la práctica'}.`
    if (propuesta === OTRA && !otraPropuesta.trim()) errs.propuesta = 'Escribí la propuesta dictada.'
    setErrores(errs)
    if (!club || Object.keys(errs).length) return
    setSaving(true); setError('')
    try {
      await saveItem({
        fed_id: fed.id, school_id: club.school_id, lugar: club.school_id ? null : club.lugar, fecha, hora_inicio: null, hora_fin: null, accion: tipo,
        estado: fecha <= hoy ? 'realizada' : 'planificada', sub_accion: null, detalle: null, cantidad: null, participantes: [],
        encuentro: { propuesta: propuesta === OTRA ? otraPropuesta.trim() : propuesta, encuentro_n: clubEncuentrosRealizados(club) + 1, modalidad, destinatarios, inscriptos: num(inscriptos), asistentes: num(asistentes),
          tipo_jornada: jornada || null, descripcion, club_id: club.id, nuevo_club: false, encuentros_previstos: num(previstos) },
      })
      onSaved(`Encuentro registrado en ${etiqueta(club)}`)
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
    {club && <p className="-mt-2 text-xs text-dte-gris">Encuentro N° {clubEncuentrosRealizados(club) + 1}{club.encuentros_previstos ? ` de ${club.encuentros_previstos} previstos` : ''}{club.school?.distrito ? ` · ${club.school.distrito}` : ''}</p>}

    <Field label="Propuesta dictada" required error={errores.propuesta} errorId="err-propuesta">
      <select className={selectClass} value={propuesta} onChange={e => setPropuesta(e.target.value)}>
        <option value={marca.propuesta}>{marca.propuesta}</option>
        <option value={OTRA}>Otra propuesta…</option>
      </select>
    </Field>
    {propuesta === OTRA && <Input aria-label="Otra propuesta" placeholder="Ej.: Taller de robótica" value={otraPropuesta} onChange={e => setOtraPropuesta(e.target.value)} className="-mt-2" />}

    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Fecha" required><Input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} /></Field>
      <Field label="Cantidad de encuentros de la propuesta"><Input type="number" min={1} inputMode="numeric" placeholder={String(CLUB_MIN_ENCUENTROS)} value={previstos} onChange={e => setPrevistos(e.target.value)} /></Field>
      <Field label="Tipo de jornada"><select className={selectClass} value={jornada} onChange={e => setJornada(e.target.value as TipoJornada | '')}><option value="">Elegí…</option>{[...TIPOS_JORNADA].sort(az).map(t => <option key={t}>{t}</option>)}</select></Field>
      <Field label="Formato de participación"><select className={selectClass} value={modalidad} onChange={e => setModalidad(e.target.value as Modalidad)}>{[...MODALIDADES].sort(az).map(m => <option key={m}>{m}</option>)}</select></Field>
    </div>
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
