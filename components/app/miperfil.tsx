'use client'

import { useEffect, useRef, useState } from 'react'
import { Briefcase, KeyRound, LogOut, Check, ChevronDown, Clock, Copy, Loader2, Plus, Trash2, UserRound, Users, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/segmented'
import { DISTRITOS_REGION, type Fed } from '@/lib/agenda'
import { armarDdjj, cargosDe, franjasDte, validarDdjj, type Cargo, type Franja } from '@/lib/ddjj'
import { titleCase } from '@/lib/format'
import { eyebrow, errMsg, fedColor, initials, updateMiPerfil, ErrorBox } from '@/components/app/comun'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']

// Menú del avatar: Mi perfil (sólo FED) y cambio de perfil. Se cierra con Escape o tocando afuera.
export function MenuPerfil({ profile, feds, esAdmin, onPerfil, onUsuarios, onPassword, onSalir }: { profile: Fed, feds: Fed[], esAdmin: boolean, onPerfil: () => void, onUsuarios: () => void, onPassword: () => void, onSalir: () => void }) {
  const [open, setOpen] = useState(false)
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
    {open && <div role="menu" aria-label="Opciones de perfil" className="absolute right-0 top-12 z-modal w-60 overflow-hidden rounded-2xl border border-dte-linea bg-white py-1 shadow-xl">
      {profile.rol === 'fed' && <button role="menuitem" onClick={() => { setOpen(false); onPerfil() }} className={item}><UserRound className="size-4 text-dte-petroleo" />Mi perfil y DD.JJ.</button>}
      {esAdmin && <button role="menuitem" onClick={() => { setOpen(false); onUsuarios() }} className={item}><Users className="size-4 text-dte-petroleo" />Usuarios</button>}
      <button role="menuitem" onClick={() => { setOpen(false); onPassword() }} className={item}><KeyRound className="size-4 text-dte-petroleo" />Cambiar contraseña</button>
      <button role="menuitem" onClick={() => { setOpen(false); onSalir() }} className={`${item} border-t border-dte-linea text-peligro`}><LogOut className="size-4" />Cerrar sesión</button>
    </div>}
  </div>
}

type CargoForm = Cargo & { key: number }

// Mi perfil: datos del FED y DD.JJ. de horarios (franjas DTE por día y otros cargos).
export function MiPerfilView({ fed, feds, onSaved }: { fed: Fed, feds: Fed[], onSaved: (fed: Fed) => void }) {
  const [distritos, setDistritos] = useState(fed.distritos_a_cargo)
  const [carga, setCarga] = useState(fed.carga_horaria ?? '')
  const [franjas, setFranjas] = useState<Record<number, Franja[]>>(() => Object.fromEntries([1, 2, 3, 4, 5].map(d => {
    const f = franjasDte(fed.ddjj?.find(x => x.dia === d))
    return [d, f.length ? f : [{ desde: '', hasta: '' }]]
  })))
  const [cargos, setCargos] = useState<CargoForm[]>(() => cargosDe(fed.ddjj).map((c, i) => ({ ...c, key: i })))
  const [notas, setNotas] = useState<Record<number, string>>(() => Object.fromEntries((fed.ddjj ?? []).filter(d => d.externo).map(d => [d.dia, d.externo!])))
  const [errores, setErrores] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const erroresRef = useRef<HTMLDivElement>(null)

  const setFranja = (dia: number, i: number, patch: Partial<Franja>) => setFranjas(f => ({ ...f, [dia]: f[dia].map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
  const copiarLunes = () => setFranjas(f => ({ ...f, 2: f[1].map(x => ({ ...x })), 3: f[1].map(x => ({ ...x })), 4: f[1].map(x => ({ ...x })), 5: f[1].map(x => ({ ...x })) }))
  const setCargo = (key: number, patch: Partial<Cargo>) => setCargos(l => l.map(c => (c.key === key ? { ...c, ...patch } : c)))

  async function guardar() {
    const errs = validarDdjj(franjas, cargos)
    setErrores(errs); setError('')
    if (errs.length) { requestAnimationFrame(() => erroresRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
    const datos = { distritos_a_cargo: distritos, carga_horaria: carga.trim() || null, ddjj: armarDdjj(franjas, cargos, notas) }
    setBusy(true)
    try { await updateMiPerfil(fed.id, datos); onSaved({ ...fed, ...datos }) } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  const panel = 'rounded-2xl border border-dte-linea bg-white p-4 shadow-xs sm:p-5'
  const time = 'h-11 min-w-0 px-2 tabular-nums md:h-9'
  return <main className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-32 pt-6 lg:px-10">
    <header className="mb-5 flex items-center gap-3">
      <Avatar className="size-12"><AvatarFallback className={`${fedColor(feds, fed.id)} font-bold text-dte-petroleo-oscuro`}>{initials(fed.nombre_completo)}</AvatarFallback></Avatar>
      <div className="min-w-0"><p className={eyebrow}>Mi perfil</p><h2 className="truncate text-2xl font-bold tracking-tight">{fed.nombre_completo}</h2></div>
    </header>

    <div className="flex flex-col gap-4">
      <section className={panel} aria-labelledby="t-datos">
        <h3 id="t-datos" className="mb-3 font-bold">Datos</h3>
        <fieldset className="mb-4"><legend className="mb-1.5 text-sm font-semibold">Distritos a cargo</legend>
          <div className="flex flex-wrap gap-1.5">{DISTRITOS_REGION.map(d => <Pill key={d} on={distritos.includes(d)} onClick={() => setDistritos(l => (l.includes(d) ? l.filter(x => x !== d) : [...l, d]))}>{titleCase(d)}</Pill>)}</div>
        </fieldset>
        <label className="flex max-w-xs flex-col gap-1 text-sm font-semibold">Carga horaria<Input value={carga} onChange={e => setCarga(e.target.value)} placeholder="Ej.: 20 hs" maxLength={40} /></label>
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
                ? <button type="button" onClick={() => setFranjas(s => ({ ...s, [dia]: [...s[dia], { desde: '', hasta: '' }] }))} className="-my-2 inline-flex min-h-10 items-center gap-1 px-1 text-xs font-semibold text-dte-petroleo hover:opacity-80 sm:hidden"><Plus className="size-3.5" />Segunda franja</button>
                : <button type="button" onClick={() => setFranjas(s => ({ ...s, [dia]: s[dia].slice(0, 1) }))} className="-my-2 inline-flex min-h-10 items-center gap-1 px-1 text-xs font-semibold text-dte-gris hover:text-peligro sm:hidden"><X className="size-3.5" />Quitar segunda franja</button>}
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
        {cargos.length > 0 && <ul className="mb-3 flex flex-col gap-3">{cargos.map((c, i) => <li key={c.key} className="flex flex-col gap-3 rounded-xl border border-dte-linea bg-dte-fondo/60 p-3">
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

        {Object.keys(notas).length > 0 && <div className="mt-4 rounded-xl border border-aviso-borde bg-aviso-fondo p-3 text-sm text-aviso">
          <p className="mb-1.5 font-semibold">Notas de la planilla anterior</p>
          <p className="mb-2">Pasalas a "Otros cargos" y después quitalas.</p>
          <ul className="flex flex-col gap-1.5">{Object.entries(notas).map(([dia, t]) => <li key={dia} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-dte-tinta">
            <span className="min-w-0"><b>{DIAS[Number(dia) - 1]}:</b> {t}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setNotas(n => { const c = { ...n }; delete c[Number(dia)]; return c })} aria-label={`Quitar nota del ${DIAS[Number(dia) - 1].toLowerCase()}`}><X /></Button>
          </li>)}</ul>
        </div>}
      </section>

      {errores.length > 0 && <div ref={erroresRef} role="alert" className="rounded-xl border border-peligro-borde bg-peligro-fondo p-4 text-sm text-peligro"><p className="mb-1 font-semibold">Revisá estos datos:</p><ul className="list-disc pl-5">{errores.map(e => <li key={e}>{e}</li>)}</ul></div>}
      {error && <ErrorBox message={error} />}
    </div>

    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-fab border-t border-dte-linea bg-white/95 px-4 py-3 backdrop-blur md:bottom-0">
      <div className="mx-auto flex max-w-3xl justify-end"><Button size="lg" disabled={busy} onClick={guardar} className="w-full bg-dte-petroleo font-semibold hover:bg-dte-petroleo-oscuro sm:w-auto">{busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}Guardar cambios</Button></div>
    </div>
  </main>
}
