'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, LogIn, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { UsuarioEquipo } from '@/app/actions'
import { cambiarPassword, errMsg, eyebrow, generarPasswordTemporal, ingresar, listarUsuarios, ErrorBox, PieInstitucional, Skeleton } from '@/components/app/comun'

function Marco({ titulo, texto, children }: { titulo: string, texto: string, children: React.ReactNode }) {
  return <main className="bg-dte-degradado relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 pt-[calc(3rem+env(safe-area-inset-top,0px))] text-white">
    <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-44 rotate-45 rounded-[2.5rem] border-[22px] border-dte-rosa" />
    <span aria-hidden className="pointer-events-none absolute right-40 top-4 size-10 rounded-full bg-dte-celeste" />
    <span aria-hidden className="pointer-events-none absolute right-8 top-40 size-8 rounded-full bg-dte-lila" />
    <div className="relative my-auto w-full max-w-md">
      <div className="mb-8 flex items-center gap-3"><img src="/brand/dte1-160.png" alt="DTE Región 1" width={56} height={56} className="size-14 shrink-0 drop-shadow-lg" /><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-dte-celeste">Equipo FED</p><h1 className="text-xl font-bold">Agenda Territorial</h1></div></div>
      <h2 className="text-3xl font-bold tracking-tight">{titulo}</h2>
      <p className="mt-2 text-white/85">{texto}</p>
      <div className="mt-6 rounded-2xl bg-white p-5 text-dte-tinta shadow-xl">{children}</div>
    </div>
    <div className="relative mt-12 w-full"><PieInstitucional oscuro /></div>
  </main>
}

function CampoPassword({ label, value, onChange, autoComplete, id }: { label: string, value: string, onChange: (v: string) => void, autoComplete: string, id: string }) {
  const [ver, setVer] = useState(false)
  return <label htmlFor={id} className="flex flex-col gap-1.5 text-sm font-semibold">{label}
    <span className="relative"><Input id={id} type={ver ? 'text' : 'password'} autoComplete={autoComplete} required value={value} onChange={e => onChange(e.target.value)} className="pr-12" />
      <button type="button" onClick={() => setVer(v => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-0 top-0 flex size-11 items-center justify-center text-dte-gris hover:text-dte-tinta md:size-9">{ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span>
  </label>
}

// Ingreso con el correo institucional (abc) y la contraseña.
export function Ingreso({ onIngreso }: { onIngreso: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { await ingresar(email, password); onIngreso() } catch (err) { setError(errMsg(err)); setBusy(false) }
  }
  return <Marco titulo="Ingresá a la agenda" texto="Usá tu correo institucional (abc.gob.ar) y tu contraseña.">
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <label htmlFor="email" className="flex flex-col gap-1.5 text-sm font-semibold">Correo<Input id="email" type="email" autoComplete="username" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@abc.gob.ar" /></label>
      <CampoPassword id="password" label="Contraseña" value={password} onChange={setPassword} autoComplete="current-password" />
      {error && <p role="alert" className="rounded-lg bg-peligro-fondo px-3 py-2 text-sm font-medium text-peligro">{error}</p>}
      <Button type="submit" size="lg" disabled={busy} className="bg-dte-petroleo font-semibold hover:bg-dte-petroleo-oscuro">{busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <LogIn data-icon="inline-start" />}Ingresar</Button>
      <p className="text-xs text-dte-gris">¿Olvidaste la contraseña? Pedile a administración que te genere una temporal.</p>
    </form>
  </Marco>
}

// Cambio de contraseña: obligatorio con una temporal; también disponible desde el menú.
export function CambiarPassword({ obligatorio, onListo, onCancelar }: { obligatorio: boolean, onListo: () => void, onCancelar?: () => void }) {
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (nueva !== repetir) { setError('Las contraseñas no coinciden.'); return }
    setBusy(true)
    try { await cambiarPassword(nueva); onListo() } catch (err) { setError(errMsg(err)); setBusy(false) }
  }
  const form = <form onSubmit={enviar} className="flex flex-col gap-4">
    <CampoPassword id="nueva" label="Nueva contraseña" value={nueva} onChange={setNueva} autoComplete="new-password" />
    <CampoPassword id="repetir" label="Repetila" value={repetir} onChange={setRepetir} autoComplete="new-password" />
    <ul className="text-xs text-dte-gris"><li>Al menos 10 caracteres, con letras y números.</li><li>Sin tu usuario de correo ni secuencias obvias.</li></ul>
    {error && <p role="alert" className="rounded-lg bg-peligro-fondo px-3 py-2 text-sm font-medium text-peligro">{error}</p>}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {onCancelar && <Button type="button" variant="outline" size="lg" onClick={onCancelar}>Cancelar</Button>}
      <Button type="submit" size="lg" disabled={busy} className="bg-dte-petroleo font-semibold hover:bg-dte-petroleo-oscuro">{busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <KeyRound data-icon="inline-start" />}Guardar contraseña</Button>
    </div>
  </form>
  if (!obligatorio) return form
  return <Marco titulo="Elegí tu contraseña" texto="Estás usando una contraseña temporal. Para continuar, definí una propia que sólo vos conozcas.">{form}</Marco>
}

const ESTADO: Record<UsuarioEquipo['estado'], { label: string, clase: string }> = {
  sin_cuenta: { label: 'Sin cuenta', clase: 'bg-dte-fondo text-dte-gris' },
  pendiente: { label: 'Pendiente de primer ingreso', clase: 'bg-aviso-fondo text-aviso-fuerte' },
  activo: { label: 'Activo', clase: 'bg-exito-fondo text-exito' },
}

// Usuarios (administración): alta de cuentas y contraseñas temporales para todo el equipo.
export function UsuariosView({ miEmail, onVer }: { miEmail: string, onVer: (fedId: string) => void }) {
  const [lista, setLista] = useState<UsuarioEquipo[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [confirmar, setConfirmar] = useState<UsuarioEquipo | null>(null)
  const [temporal, setTemporal] = useState<{ nombre: string, email: string, password: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const cargar = () => { setError(''); listarUsuarios().then(setLista).catch(e => { setLista([]); setError(errMsg(e)) }) }
  useEffect(cargar, [])

  async function generar(u: UsuarioEquipo) {
    setConfirmar(null); setBusy(u.fedId); setError('')
    try { const r = await generarPasswordTemporal(u.fedId); setTemporal({ nombre: u.nombre, ...r }); setCopiado(false); cargar() } catch (e) { setError(errMsg(e)) } finally { setBusy('') }
  }
  const copiar = async () => {
    if (!temporal) return
    try { await navigator.clipboard.writeText(`Agenda Territorial\nUsuario: ${temporal.email}\nContraseña temporal: ${temporal.password}\nAl ingresar te va a pedir que la cambies.`); setCopiado(true) } catch { setCopiado(false) }
  }

  return <main className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-24 pt-6 lg:px-10">
    <p className={eyebrow}>Administración</p>
    <h2 className="mt-1 text-2xl font-bold tracking-tight">Usuarios</h2>
    <p className="mt-1.5 text-sm text-dte-gris">Creá la cuenta de cada integrante o generale una contraseña temporal nueva. La temporal se muestra una sola vez: pasásela por un canal privado.</p>
    {error && <div className="mt-4"><ErrorBox message={error} onRetry={cargar} /></div>}
    {!lista ? <div className="mt-5 flex flex-col gap-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      : <ul className="mt-5 divide-y divide-dte-linea overflow-hidden rounded-2xl border border-dte-linea bg-white">{lista.map(u => {
        const yo = u.email?.toLowerCase() === miEmail.toLowerCase()
        return <li key={u.fedId} className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold">{u.nombre}{u.esAdmin && <span className="inline-flex items-center gap-1 rounded-full bg-dte-tinte px-2 py-0.5 text-xs text-dte-petroleo"><ShieldCheck className="size-3" />Admin</span>}{u.rol === 'coordinacion' && <span className="rounded-full bg-dte-fondo px-2 py-0.5 text-xs text-dte-gris">Coordinación</span>}</p>
            <p className="truncate text-sm text-dte-gris">{u.email ?? 'Sin correo cargado'}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-2 py-0.5 font-semibold ${ESTADO[u.estado].clase}`}>{ESTADO[u.estado].label}</span>{u.ultimoIngreso && <span className="text-dte-gris">Último ingreso: {new Date(u.ultimoIngreso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          {!yo && <Button variant="ghost" size="sm" onClick={() => onVer(u.fedId)} className="text-dte-petroleo"><Eye data-icon="inline-start" />Ver su agenda</Button>}
          {yo ? <span className="text-xs text-dte-gris sm:text-right">Tu cuenta: cambiala desde<br className="hidden sm:block" /> el menú del avatar</span>
            : u.email && <Button variant="outline" size="sm" disabled={busy === u.fedId} onClick={() => (u.estado === 'sin_cuenta' ? generar(u) : setConfirmar(u))} className="shrink-0">
              {busy === u.fedId ? <Loader2 className="animate-spin" data-icon="inline-start" /> : u.estado === 'sin_cuenta' ? <UserPlus data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}{u.estado === 'sin_cuenta' ? 'Crear cuenta' : 'Resetear contraseña'}</Button>}
          </div>
        </li>
      })}</ul>}

    <Dialog open={!!confirmar} onOpenChange={o => !o && setConfirmar(null)}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader><DialogTitle className="text-lg">¿Resetear la contraseña?</DialogTitle><DialogDescription>{confirmar?.nombre} va a tener que ingresar con una contraseña temporal nueva y elegir una propia. La actual deja de funcionar.</DialogDescription></DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setConfirmar(null)}>Cancelar</Button><Button onClick={() => confirmar && generar(confirmar)} className="bg-peligro text-white hover:bg-peligro/90">Resetear</Button></div>
      </DialogContent>
    </Dialog>

    <Dialog open={!!temporal} onOpenChange={o => !o && setTemporal(null)}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader><DialogTitle className="text-lg">Contraseña temporal de {temporal?.nombre}</DialogTitle><DialogDescription>Se muestra una sola vez. Al ingresar le vamos a pedir que la cambie.</DialogDescription></DialogHeader>
        <dl className="rounded-xl border border-dte-linea bg-dte-fondo p-3 text-sm"><dt className="text-xs text-dte-gris">Usuario</dt><dd className="mb-2 font-semibold">{temporal?.email}</dd><dt className="text-xs text-dte-gris">Contraseña temporal</dt><dd className="select-all font-mono text-lg font-bold tracking-wide">{temporal?.password}</dd></dl>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setTemporal(null)}>Listo</Button><Button onClick={copiar} className="bg-dte-petroleo hover:bg-dte-petroleo-oscuro">{copiado ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado ? 'Copiado' : 'Copiar mensaje'}</Button></div>
      </DialogContent>
    </Dialog>
  </main>
}
