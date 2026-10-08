import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import { type Fed } from '@/lib/agenda'
import { borrarSesion, guardarSesion, requerirUsuario, usuarioActual, usuarioDeSesion, validarPassword } from '@/lib/sesion'
import { audit } from '@/lib/servidor/comun'

// Ingreso, salida y cambio de contraseña. Las acciones públicas están en app/actions.ts.
// ---- Sesión: ingreso, salida y cambio de contraseña.
export type Sesion = { fed: Fed, email: string, esAdmin: boolean, debeCambiar: boolean }
export async function miSesion(): Promise<Sesion | null> {
  const u = await usuarioActual()
  return u ? { fed: u.fed, email: u.email, esAdmin: u.esAdmin, debeCambiar: u.debeCambiar } : null
}
export async function ingresar(email: string, password: string): Promise<Sesion> {
  const correo = email.trim().toLowerCase()
  const invalido = 'Correo o contraseña incorrectos.'
  if (!correo || !password) throw new Error(invalido)
  const { data: fed } = await supabaseServer().from('feds').select('id').eq('email', correo).maybeSingle()
  if (!fed) throw new Error(invalido)
  // Cliente propio para el ingreso: no reutiliza el de servicio (quedaría con la sesión del usuario).
  const { data, error } = await supabaseServer().auth.signInWithPassword({ email: correo, password })
  if (error || !data.session) throw new Error(error?.status === 429 ? 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' : invalido)
  await guardarSesion(data.session)
  const u = await usuarioDeSesion(data.session.access_token)
  if (!u) { await borrarSesion(); throw new Error(invalido) }
  return { fed: u.fed, email: u.email, esAdmin: u.esAdmin, debeCambiar: u.debeCambiar }
}
export async function salir(): Promise<void> { await borrarSesion() }
// Desde el menú hay que confirmar la contraseña actual. Con una temporal (primer ingreso o reseteo) el cambio es obligatorio y no se la vuelve a pedir: se acaba de ingresar con ella.
export async function cambiarPassword(nueva: string, actual = '') {
  const yo = await requerirUsuario({ permitirTemporal: true })
  const err = validarPassword(nueva, yo.email)
  if (err) throw new Error(err)
  if (!yo.debeCambiar) {
    if (!actual) throw new Error('Escribí tu contraseña actual.')
    if (actual === nueva) throw new Error('La nueva contraseña tiene que ser distinta de la actual.')
    const { data, error } = await supabaseServer().auth.signInWithPassword({ email: yo.email, password: actual })
    if (error || !data.session) throw new Error(error?.status === 429 ? 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' : 'La contraseña actual no es correcta.')
  }
  const db = supabaseServer()
  const { error } = await db.auth.admin.updateUserById(yo.userId, { password: nueva })
  if (error) throw new Error(error.message.includes('same') ? 'La nueva contraseña tiene que ser distinta de la anterior.' : error.message)
  await db.from('feds').update({ debe_cambiar_password: false }).eq('id', yo.fed.id)
  await audit('feds', yo.fed.id, 'modificacion', yo.fed.id, { cambio_password: true })
}
