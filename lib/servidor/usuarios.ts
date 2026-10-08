import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import { type Fed } from '@/lib/agenda'
import { passwordTemporal, requerirUsuario } from '@/lib/sesion'
import { audit } from '@/lib/servidor/comun'

// Usuarios (solo administración): alta de cuentas y reseteo de contraseñas. Las acciones públicas están en app/actions.ts.
// ---- Usuarios (sólo administración): alta de cuentas y reseteo de contraseñas.
export type UsuarioEquipo = { fedId: string, nombre: string, rol: Fed['rol'], email: string | null, esAdmin: boolean, estado: 'sin_cuenta' | 'pendiente' | 'activo', ultimoIngreso: string | null }
async function cuentasPorEmail() {
  const db = supabaseServer(), m = new Map<string, { id: string, last_sign_in_at?: string | null }>()
  for (let page = 1; page < 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    for (const u of data.users) if (u.email) m.set(u.email.toLowerCase(), { id: u.id, last_sign_in_at: u.last_sign_in_at })
    if (data.users.length < 200) break
  }
  return m
}
async function soloAdmin() { const yo = await requerirUsuario(); if (!yo.esAdmin) throw new Error('Sólo administración puede gestionar usuarios'); return yo }
export async function listarUsuarios(): Promise<UsuarioEquipo[]> {
  await soloAdmin()
  const [{ data, error }, cuentas] = await Promise.all([supabaseServer().from('feds').select('id, nombre_completo, rol, email, es_admin, debe_cambiar_password').order('nombre_completo'), cuentasPorEmail()])
  if (error) throw new Error(error.message)
  return (data ?? []).map(f => {
    const c = f.email ? cuentas.get(f.email.toLowerCase()) : undefined
    return { fedId: f.id, nombre: f.nombre_completo, rol: f.rol, email: f.email, esAdmin: f.es_admin, estado: !c ? 'sin_cuenta' : f.debe_cambiar_password ? 'pendiente' : 'activo', ultimoIngreso: c?.last_sign_in_at ?? null }
  })
}
// Crea la cuenta (si no existe) o le asigna una contraseña temporal nueva. Devuelve la temporal para entregarla.
export async function generarPasswordTemporal(fedId: string): Promise<{ email: string, password: string }> {
  const yo = await soloAdmin()
  const db = supabaseServer()
  const { data: fed } = await db.from('feds').select('id, nombre_completo, email').eq('id', fedId).maybeSingle()
  if (!fed?.email) throw new Error('Ese perfil no tiene correo cargado')
  if (fed.id === yo.fed.id) throw new Error('Tu propia contraseña se cambia desde "Cambiar contraseña"')
  const password = passwordTemporal()
  const existente = (await cuentasPorEmail()).get(fed.email.toLowerCase())
  const res = existente
    ? await db.auth.admin.updateUserById(existente.id, { password })
    : await db.auth.admin.createUser({ email: fed.email.toLowerCase(), password, email_confirm: true, user_metadata: { apellido_nombre: fed.nombre_completo } })
  if (res.error) throw new Error(res.error.message)
  await db.from('feds').update({ debe_cambiar_password: true }).eq('id', fed.id)
  await audit('feds', fed.id, 'modificacion', yo.fed.id, { password_temporal: existente ? 'reseteo' : 'alta' })
  return { email: fed.email, password }
}
