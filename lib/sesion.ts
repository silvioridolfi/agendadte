import 'server-only'
import { cookies } from 'next/headers'
import type { Session } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabase-server'
import type { Fed } from '@/lib/agenda'

// Sesión de la agenda: tokens de Supabase Auth en una cookie httpOnly (no accesible desde el navegador).
// El perfil (FED o coordinación) se resuelve siempre en el servidor a partir del correo de la cuenta.
const COOKIE = 'agenda_sesion'
export const SESION_VENCIDA = 'SESION_VENCIDA'
export type Usuario = { fed: Fed, userId: string, email: string, esAdmin: boolean, debeCambiar: boolean }

export async function guardarSesion(s: Session) {
  const c = await cookies()
  c.set(COOKIE, JSON.stringify({ a: s.access_token, r: s.refresh_token }), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  })
}

export async function borrarSesion() { (await cookies()).delete(COOKIE) }

// Usuario de la sesión actual o null. Si el token venció, lo renueva con el refresh token.
export async function usuarioActual(): Promise<Usuario | null> {
  const raw = (await cookies()).get(COOKIE)?.value
  if (!raw) return null
  let tokens: { a?: string, r?: string }
  try { tokens = JSON.parse(raw) } catch { return null }
  if (!tokens.a || !tokens.r) return null
  const db = supabaseServer()
  let { data: { user } } = await db.auth.getUser(tokens.a)
  if (!user) {
    const { data, error } = await db.auth.refreshSession({ refresh_token: tokens.r })
    if (error || !data.session || !data.user) return null
    try { await guardarSesion(data.session) } catch { /* fuera de una acción no se puede reescribir la cookie */ }
    user = data.user
  }
  return perfilDe(user.id, user.email)
}

// Perfil de la agenda vinculado a una cuenta (por correo). Sin perfil, la cuenta no tiene acceso a la agenda.
async function perfilDe(userId: string, email: string | undefined): Promise<Usuario | null> {
  if (!email) return null
  const { data: fed } = await supabaseServer().from('feds').select('id, nombre_completo, distritos_a_cargo, carga_horaria, ddjj, rol, es_admin, debe_cambiar_password').eq('email', email.toLowerCase()).maybeSingle()
  if (!fed) return null
  const { es_admin, debe_cambiar_password, ...perfil } = fed
  return { fed: perfil as Fed, userId, email, esAdmin: !!es_admin, debeCambiar: !!debe_cambiar_password }
}

export async function usuarioDeSesion(accessToken: string) {
  const { data: { user } } = await supabaseServer().auth.getUser(accessToken)
  return user ? perfilDe(user.id, user.email) : null
}

// Exige sesión válida (y contraseña definitiva, salvo que se indique lo contrario).
export async function requerirUsuario(opts: { permitirTemporal?: boolean } = {}): Promise<Usuario> {
  const u = await usuarioActual()
  if (!u) throw new Error(SESION_VENCIDA)
  if (u.debeCambiar && !opts.permitirTemporal) throw new Error('Tenés que cambiar la contraseña temporal antes de continuar.')
  return u
}

// Contraseña temporal legible (sin caracteres ambiguos), para el alta y el reseteo desde Usuarios.
export function passwordTemporal() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ', nums = '23456789'
  const r = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length]
  const bloque = () => Array.from({ length: 4 }, () => r(letras)).join('')
  return `${bloque()}-${bloque()}-${r(nums)}${r(nums)}`
}

// Reglas para la contraseña definitiva. Devuelve el error o '' si es válida.
export function validarPassword(p: string, email: string) {
  if (p.length < 10) return 'La contraseña tiene que tener al menos 10 caracteres.'
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Combiná letras y números.'
  const usuario = email.split('@')[0].toLowerCase()
  if (usuario.length >= 4 && p.toLowerCase().includes(usuario)) return 'No uses tu usuario de correo dentro de la contraseña.'
  if (/^(.)\1+$/.test(p) || ['1234567890', 'abcdefghij', 'contraseña', 'password12'].some(x => p.toLowerCase().includes(x))) return 'Elegí una contraseña menos predecible.'
  return ''
}
