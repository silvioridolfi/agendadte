'use client'

import { useEffect, useRef, useState } from 'react'
import { Briefcase, Camera, CalendarOff, CircleHelp, CalendarClock, ClipboardList, ExternalLink, EyeOff, Globe, Wifi, FileText, KeyRound, LayoutDashboard, LogOut, Check, ChevronDown, Clock, Copy, Loader2, Plus, Trash2, UserRound, Users, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/segmented'
import { SITIO_DTE_URL, type Fed } from '@/lib/agenda'
import { horasSemanales, textoCarga, armarDdjj, cargosDe, franjasDte, validarDdjj, type Cargo, type Franja } from '@/lib/ddjj'
import { titleCase } from '@/lib/format'
import { eyebrow, errMsg, fedColor, initials, storage, updateMiPerfil, ErrorBox } from '@/components/app/comun'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']

// Menú del avatar: Mi perfil (sólo FED) y cambio de perfil. Se cierra con Escape o tocando afuera.
const CLAVE_PRESENTACION = 'agenda-territorial:presentacion'

export function MenuPerfil({ profile, feds, esAdmin, hayNovedades = false, onAyuda, onReclamo, onRegistroReclamos, onCronogramas, onPerfil, onFotos, onMisPve, onUsuarios, onFeriados, onPve, onEquipo, onPassword, onSalir }: { profile: Fed, feds: Fed[], esAdmin: boolean, hayNovedades?: boolean, onAyuda: () => void, onReclamo: () => void, onRegistroReclamos: () => void, onCronogramas: () => void, onPerfil: () => void, onFotos: () => void, onMisPve: () => void, onUsuarios: () => void, onFeriados: () => void, onPve: () => void, onEquipo: () => void, onPassword: () => void, onSalir: () => void }) {
  const [open, setOpen] = useState(false)
  // Modo presentación (sólo administración): oculta las opciones de administración en este navegador.
  // Se vuelve a mostrar entrando con #admin en la dirección.
  const [oculto, setOculto] = useState(false)
  useEffect(() => {
    const revisar = () => {
      if (location.hash === '#admin') { storage(() => localStorage.removeItem(CLAVE_PRESENTACION)); history.replaceState(null, '', location.pathname + location.search); setOculto(false) }
      else setOculto(storage(() => localStorage.getItem(CLAVE_PRESENTACION)) === '1')
    }
    revisar(); addEventListener('hashchange', revisar)
    return () => removeEventListener('hashchange', revisar)
  }, [])
  const admin = esAdmin && !oculto
  const ocultar = () => { storage(() => localStorage.setItem(CLAVE_PRESENTACION, '1')); setOculto(true); setOpen(false) }
  const ref = useRef<HTMLDivElement>(null), btnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() } }
    ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])
  const item = 'flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-sm font-medium transition hover:bg-dte-tinte focus-visible:bg-dte-tinte md:min-h-10'
  return <div ref={ref} className="relative">
    <button ref={btnRef} onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`Perfil: ${profile.nombre_completo}`} className="flex min-h-11 min-w-11 items-center gap-2 rounded-full py-1 pl-1 pr-1 text-left transition hover:bg-dte-fondo md:pr-2">
      <Avatar className="size-9"><AvatarFallback className={`${fedColor(feds, profile.id)} text-xs font-bold text-dte-petroleo-oscuro`}>{initials(profile.nombre_completo)}</AvatarFallback></Avatar>
      <span className="hidden md:block"><span className="block text-sm font-semibold leading-tight">{profile.nombre_completo}</span><span className="block text-xs text-dte-gris">{profile.rol === 'coordinacion' ? 'Coordinación' : 'FED'}</span></span>
      <ChevronDown className={`hidden size-4 text-dte-gris transition md:block ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div role="menu" aria-label="Opciones de perfil" className="animate-in fade-in-0 slide-in-from-top-1 duration-150 absolute right-0 top-12 z-modal w-60 overflow-hidden rounded-card border border-dte-linea bg-white py-1 shadow-e3">
      <button role="menuitem" onClick={() => { setOpen(false); onPerfil() }} className={item}><UserRound className="size-4 text-dte-petroleo" />Mi perfil y DD.JJ.</button>
      <button role="menuitem" onClick={() => { setOpen(false); onFotos() }} className={item}><Camera className="size-4 text-dte-petroleo" />Fotos de las acciones</button>
      {profile.rol === 'fed' && <button role="menuitem" onClick={() => { setOpen(false); onMisPve() }} className={item}><FileText className="size-4 text-dte-petroleo" />Planillas de Visita (PVE)</button>}
      <div role="separator" className="my-1 border-t border-dte-linea" />
      <button role="menuitem" onClick={() => { setOpen(false); onReclamo() }} className={item}><Wifi className="size-4 text-dte-petroleo" />Armar reclamo de conectividad</button>
      <button role="menuitem" onClick={() => { setOpen(false); onRegistroReclamos() }} className={item}><ClipboardList className="size-4 text-dte-petroleo" />Registro de reclamos</button>
      {(admin || profile.rol === 'coordinacion') && <button role="menuitem" onClick={() => { setOpen(false); onCronogramas() }} className={item}><CalendarClock className="size-4 text-dte-petroleo" />Cronogramas</button>}
      {(admin || profile.rol === 'coordinacion') && <div role="separator" className="my-1 border-t border-dte-linea" />}
      {admin && <button role="menuitem" onClick={() => { setOpen(false); onEquipo() }} className={item}><LayoutDashboard className="size-4 text-dte-petroleo" />Vista de coordinación</button>}
      {admin && <button role="menuitem" onClick={() => { setOpen(false); onUsuarios() }} className={item}><Users className="size-4 text-dte-petroleo" />Usuarios</button>}
      {(admin || profile.rol === 'coordinacion') && <button role="menuitem" onClick={() => { setOpen(false); onPve() }} className={item}><FileText className="size-4 text-dte-petroleo" />PVE del equipo</button>}
      {admin && <button role="menuitem" onClick={() => { setOpen(false); onFeriados() }} className={item}><CalendarOff className="size-4 text-dte-petroleo" />Feriados y eventos</button>}
      {admin && <button role="menuitem" onClick={ocultar} className={item}><EyeOff className="size-4 text-dte-petroleo" />Ocultar opciones de administración</button>}
      <div role="separator" className="my-1 border-t border-dte-linea" />
      <a role="menuitem" href={SITIO_DTE_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={item}><Globe className="size-4 text-dte-petroleo" />Sitio DTE Región 1<ExternalLink className="ml-auto size-3.5 text-dte-gris-claro" aria-hidden /><span className="sr-only"> (se abre en una pestaña nueva)</span></a>
      <button role="menuitem" onClick={() => { setOpen(false); onAyuda() }} className={item}><CircleHelp className="size-4 text-dte-petroleo" />Ayuda{hayNovedades && <span className="ml-auto rounded-full bg-dte-magenta px-1.5 text-xs font-bold text-white" aria-label="Hay novedades">nuevo</span>}</button>
      <button role="menuitem" onClick={() => { setOpen(false); onPassword() }} className={item}><KeyRound className="size-4 text-dte-petroleo" />Cambiar contraseña</button>
      <button role="menuitem" onClick={() => { setOpen(false); onSalir() }} className={`${item} border-t border-dte-linea text-peligro`}><LogOut className="size-4" />Cerrar sesión</button>
    </div>}
  </div>
}

type CargoForm = Cargo & { key: number }

// Mi perfil: datos del FED y DD.JJ. de horarios (franjas DTE por día y otros cargos).
export function MiPerfilView({ fed, feds, onSaved }: { fed: Fed, feds: Fed[], onSaved: (fed: Fed) => void }) {
  const inicial = {
    franjas: () => Object.fromEntries([1, 2, 3, 4, 5].map(d => { const f = franjasDte(fed.ddjj?.find(x => x.dia === d)); return [d, f.length ? f : [{ desde: '', hasta: '' }]] })) as Record<number, Franja[]>,
    cargos: () => cargosDe(fed.ddjj).map((c, i) => ({ ...c, key: i })) as CargoForm[],
    notas: () => Object.fromEntries((fed.ddjj ?? []).filter(d => d.externo).map(d => [d.dia, d.externo!])) as Record<number, string>,
  }
  const distritos = fed.distritos_a_cargo
  const [franjas, setFranjas] = useState<Record<number, Franja[]>>(inicial.franjas)
  const [cargos, setCargos] = useState<CargoForm[]>(inicial.cargos)
  const [notas, setNotas] = useState<Record<number, string>>(inicial.notas)
  // Descartar: vuelve a lo guardado.
  const descartar = () => { setFranjas(inicial.franjas()); setCargos(inicial.cargos()); setNotas(inicial.notas()); setErrores([]); setError('') }
  const [errores, setErrores] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const erroresRef = useRef<HTMLDivElement>(null)
  // El botón Guardar aparece sólo si algo cambió respecto de lo guardado.
  const firma = () => JSON.stringify([[...distritos].sort(), franjas, cargos.map(({ key: _, ...c }) => c), notas])
  const [base, setBase] = useState(firma)
  const cambios = firma() !== base

  const setFranja = (dia: number, i: number, patch: Partial<Franja>) => setFranjas(f => ({ ...f, [dia]: f[dia].map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
  const copiarLunes = () => setFranjas(f => ({ ...f, 2: f[1].map(x => ({ ...x })), 3: f[1].map(x => ({ ...x })), 4: f[1].map(x => ({ ...x })), 5: f[1].map(x => ({ ...x })) }))
  const setCargo = (key: number, patch: Partial<Cargo>) => setCargos(l => l.map(c => (c.key === key ? { ...c, ...patch } : c)))

  async function guardar() {
    const errs = validarDdjj(franjas, cargos)
    setErrores(errs); setError('')
    if (errs.length) { requestAnimationFrame(() => erroresRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
    const datos = { distritos_a_cargo: distritos, carga_horaria: textoCarga(horasSemanales(franjas)), ddjj: armarDdjj(franjas, cargos, notas) }
    setBusy(true)
    try { await updateMiPerfil(fed.id, datos); setBase(firma()); onSaved({ ...fed, ...datos }) } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  const panel = 'rounded-card border border-dte-linea bg-white p-4 shadow-e1 sm:p-5'
  const time = 'h-11 min-w-0 px-2 tabular-nums md:h-9'
  return <main className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-32 pt-6 lg:px-10">
    <header className="mb-5 flex items-center gap-3">
      <Avatar className="size-12"><AvatarFallback className={`${fedColor(feds, fed.id)} font-bold text-dte-petroleo-oscuro`}>{initials(fed.nombre_completo)}</AvatarFallback></Avatar>
      <div className="min-w-0"><p className={eyebrow}>Mi perfil</p><h2 className="truncate text-2xl font-bold tracking-tight" title={fed.nombre_completo}>{fed.nombre_completo}</h2></div>
    </header>

    <div className="flex flex-col gap-4">
      <section className={panel} aria-labelledby="t-datos">
        <h3 id="t-datos" className="mb-3 font-bold">Datos</h3>
        {/* Los distritos los asigna la administración: acá sólo se informan. */}
        <div className="mb-4"><p className="mb-1.5 text-sm font-semibold">Distritos a cargo</p>
          <div className="flex flex-wrap gap-1.5">{distritos.length ? [...distritos].sort().map(d => <span key={d} className="rounded-full bg-dte-tinte px-3 py-1 text-sm font-medium text-dte-petroleo">{titleCase(d)}</span>) : <span className="text-sm text-dte-gris">Sin distritos asignados</span>}</div>
        </div>
        <div className="text-sm"><p className="font-semibold">Carga horaria</p><p className="mt-1"><b className="text-base tabular-nums">{textoCarga(horasSemanales(franjas)) ?? 'Sin horario DTE cargado'}</b></p><p className="text-xs text-dte-gris">Se calcula sola con tu horario DTE de abajo.</p></div>
      </section>

      <section className={panel} aria-labelledby="t-dte">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div><h3 id="t-dte" className="flex items-center gap-1.5 font-bold"><Clock className="size-4 text-dte-petroleo" />Horario DTE (DD.JJ.)</h3><p className="text-sm text-dte-gris">Hasta dos franjas por día. Dejá vacío el día que no trabajás en DTE.</p></div>
          <Button variant="outline" size="sm" onClick={copiarLunes}><Copy data-icon="inline-start" />Copiar lunes a toda la semana</Button>
        </div>
        <ul className="divide-y divide-dte-linea">{DIAS.map((nombre, i) => {
          const dia = i + 1, f = franjas[dia]
          return <li key={dia} className="grid gap-2 py-3 sm:grid-cols-[6.5rem_1fr] sm:items-start">
            <div className="flex items-center justify-between gap-2 sm:pt-2"><span className="text-sm font-semibold">{nombre}</span>
              {f.length === 1
                ? <button type="button" onClick={() => setFranjas(s => ({ ...s, [dia]: [...s[dia], { desde: '', hasta: '' }] }))} className="-my-2 inline-flex min-h-11 md:min-h-10 items-center gap-1 px-1 text-xs font-semibold text-dte-petroleo hover:opacity-80 sm:hidden"><Plus className="size-3.5" />Segunda franja</button>
                : <button type="button" onClick={() => setFranjas(s => ({ ...s, [dia]: s[dia].slice(0, 1) }))} className="-my-2 inline-flex min-h-11 md:min-h-10 items-center gap-1 px-1 text-xs font-semibold text-dte-gris hover:text-peligro sm:hidden"><X className="size-3.5" />Quitar segunda franja</button>}
            </div>
            <div className="flex flex-col gap-2">{f.map((x, j) => <div key={j} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
              <Input type="time" aria-label={`${nombre}, franja ${j + 1}, desde`} value={x.desde} onChange={e => setFranja(dia, j, { desde: e.target.value })} className={time} />
              <span className="text-sm text-dte-gris">a</span>
              <Input type="time" aria-label={`${nombre}, franja ${j + 1}, hasta`} value={x.hasta} onChange={e => setFranja(dia, j, { hasta: e.target.value })} className={time} />
              <span className="hidden sm:block">{j === 0 && f.length === 1
                ? <Button variant="ghost" size="icon-sm" onClick={() => setFranjas(s => ({ ...s, [dia]: [...s[dia], { desde: '', hasta: '' }] }))} aria-label={`Agregar segunda franja el ${nombre.toLowerCase()}`} title="Agregar segunda franja"><Plus /></Button>
                : <Button variant="ghost" size="icon-sm" onClick={() => setFranjas(s => ({ ...s, [dia]: s[dia].length > 1 ? s[dia].filter((_, k) => k !== j) : [{ desde: '', hasta: '' }] }))} aria-label={`Quitar franja ${j + 1} del ${nombre.toLowerCase()}`} title="Quitar franja" className="text-dte-gris hover:text-peligro"><X /></Button>}</span>
            </div>)}</div>
          </li>
        })}</ul>
      </section>

      <section className={panel} aria-labelledby="t-cargos">
        <h3 id="t-cargos" className="flex items-center gap-1.5 font-bold"><Briefcase className="size-4 text-dte-petroleo" />Otros cargos</h3>
        <p className="mb-3 text-sm text-dte-gris">Si tenés horas en otra institución, cargalas para que la agenda te avise si una acción se superpone.</p>
        {cargos.length > 0 && <ul className="mb-3 flex flex-col gap-3">{cargos.map((c, i) => <li key={c.key} className="flex flex-col gap-3 rounded-tile border border-dte-linea bg-dte-fondo/60 p-3">
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">Institución o cargo<Input value={c.nombre} onChange={e => setCargo(c.key, { nombre: e.target.value })} placeholder="Ej.: EP N° 5 · Maestra de grado" maxLength={80} /></label>
            <Button variant="ghost" size="icon" onClick={() => setCargos(l => l.filter(x => x.key !== c.key))} aria-label={`Quitar ${c.nombre || `cargo ${i + 1}`}`} className="text-dte-gris hover:bg-peligro-fondo hover:text-peligro"><Trash2 /></Button>
          </div>
          <fieldset><legend className="mb-1.5 text-sm font-semibold">Días</legend>
            <div className="flex flex-wrap gap-1.5">{DIAS_CORTOS.map((d, k) => <Pill key={d} conIcono={false} on={c.dias.includes(k + 1)} onClick={() => setCargo(c.key, { dias: c.dias.includes(k + 1) ? c.dias.filter(x => x !== k + 1) : [...c.dias, k + 1].sort() })}>{d}</Pill>)}</div>
          </fieldset>
          <div className="grid max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Input type="time" aria-label="Desde" value={c.desde} onChange={e => setCargo(c.key, { desde: e.target.value })} className={time} />
            <span className="text-sm text-dte-gris">a</span>
            <Input type="time" aria-label="Hasta" value={c.hasta} onChange={e => setCargo(c.key, { hasta: e.target.value })} className={time} />
          </div>
        </li>)}</ul>}
        <Button variant="outline" onClick={() => setCargos(l => [...l, { key: Date.now(), nombre: '', dias: [], desde: '', hasta: '' }])}><Plus data-icon="inline-start" />Agregar cargo</Button>

        {Object.keys(notas).length > 0 && <div className="mt-4 rounded-tile border border-aviso-borde bg-aviso-fondo p-3 text-sm text-aviso">
          <p className="mb-1.5 font-semibold">Notas de la planilla anterior</p>
          <p className="mb-2">Pasalas a “Otros cargos” y después quitalas.</p>
          <ul className="flex flex-col gap-1.5">{Object.entries(notas).map(([dia, t]) => <li key={dia} className="flex items-center justify-between gap-2 rounded-control bg-white/70 px-2.5 py-1.5 text-dte-tinta">
            <span className="min-w-0"><b>{DIAS[Number(dia) - 1]}:</b> {t}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setNotas(n => { const c = { ...n }; delete c[Number(dia)]; return c })} aria-label={`Quitar nota del ${DIAS[Number(dia) - 1].toLowerCase()}`}><X /></Button>
          </li>)}</ul>
        </div>}
      </section>


      {errores.length > 0 && <div ref={erroresRef} role="alert" className="rounded-tile border border-peligro-borde bg-peligro-fondo p-4 text-sm text-peligro"><p className="mb-1 font-semibold">Revisá estos datos:</p><ul className="list-disc pl-5">{errores.map(e => <li key={e}>{e}</li>)}</ul></div>}
      {error && <ErrorBox message={error} />}
    </div>

    {cambios && <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-fab border-t border-dte-linea bg-white/95 px-4 py-3 backdrop-blur md:bottom-0">
      <div className="mx-auto flex max-w-3xl justify-end gap-2"><Button size="lg" variant="outline" disabled={busy} onClick={descartar} className="min-w-0 flex-1 sm:flex-none"><X data-icon="inline-start" />Descartar<span className="hidden sm:inline">&nbsp;cambios</span></Button><Button size="lg" disabled={busy} onClick={guardar} className="min-w-0 flex-1 bg-dte-petroleo font-semibold hover:bg-dte-petroleo-oscuro sm:flex-none">{busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}Guardar<span className="hidden sm:inline">&nbsp;cambios</span></Button></div>
    </div>}
  </main>
}
