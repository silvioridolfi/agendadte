import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ingreso, cambio de contraseña y alta de cuentas: reglas y mensajes, con la base de usuarios simulada.
type Op = { m: string, args: unknown[] }
type Llamada = { tabla: string, ops: Op[] }
type Respuesta = { data?: unknown, error?: { message: string, status?: number } | null }
const estado = vi.hoisted(() => ({
  responder: (_l: Llamada): Respuesta => ({}), llamadas: [] as Llamada[],
  signIn: vi.fn(async (_c: unknown) => ({ data: { session: { access_token: 't' } } as unknown, error: null as { message: string, status?: number } | null })),
  updateUser: vi.fn(async (_id: string, _a: unknown) => ({ error: null as { message: string } | null })),
  createUser: vi.fn(async (_a: unknown) => ({ error: null as { message: string } | null })),
  listUsers: vi.fn(async () => ({ data: { users: [] as { id: string, email: string, last_sign_in_at?: string }[] }, error: null })),
  usuario: null as unknown,
  guardarSesion: vi.fn(async (_s: unknown) => {}),
  borrarSesion: vi.fn(async () => {}),
  usuarioDeSesion: vi.fn(async (_t: string) => null as unknown),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    auth: { signInWithPassword: estado.signIn, admin: { updateUserById: estado.updateUser, createUser: estado.createUser, listUsers: estado.listUsers } },
    from: (tabla: string) => {
      const l: Llamada = { tabla, ops: [] }
      estado.llamadas.push(l)
      const cadena: unknown = new Proxy({}, {
        get: (_, m: string) => {
          if (m === 'then') return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(estado.responder(l)).then(r => ({ data: r.data ?? null, error: r.error ?? null })).then(ok, ko)
          return (...args: unknown[]) => { l.ops.push({ m, args }); return cadena }
        },
      })
      return cadena
    },
  }),
}))
vi.mock('@/lib/sesion', async () => {
  const real = await vi.importActual<typeof import('@/lib/sesion')>('@/lib/sesion').catch(() => ({}) as Record<string, unknown>)
  return { ...real, requerirUsuario: async () => estado.usuario, usuarioActual: async () => estado.usuario, guardarSesion: estado.guardarSesion, borrarSesion: estado.borrarSesion, usuarioDeSesion: estado.usuarioDeSesion }
})

import * as sesion from '@/lib/servidor/sesion'
import * as usuarios from '@/lib/servidor/usuarios'

const yoFed = { fed: { id: 'f1', nombre_completo: 'Ana Pérez', rol: 'fed' }, userId: 'u1', email: 'ana@abc.gob.ar', esAdmin: false, debeCambiar: false }
const yoAdmin = { ...yoFed, fed: { ...yoFed.fed, id: 'a1' }, userId: 'ua', email: 'silvio@abc.gob.ar', esAdmin: true }
const de = (tabla: string, m: string) => estado.llamadas.filter(l => l.tabla === tabla && l.ops.some(o => o.m === m))
beforeEach(() => {
  estado.llamadas = []; estado.responder = () => ({}); estado.usuario = yoFed
  estado.signIn.mockClear(); estado.updateUser.mockClear(); estado.createUser.mockClear(); estado.listUsers.mockClear(); estado.guardarSesion.mockClear(); estado.borrarSesion.mockClear(); estado.usuarioDeSesion.mockClear()
  estado.signIn.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null }); estado.updateUser.mockResolvedValue({ error: null })
})

describe('ingreso', () => {
  it('no distingue entre correo inexistente y contraseña mala', async () => {
    await expect(sesion.ingresar('', 'x')).rejects.toThrow('Correo o contraseña incorrectos.')
    estado.responder = () => ({ data: null })
    await expect(sesion.ingresar('nadie@abc.gob.ar', 'x')).rejects.toThrow('Correo o contraseña incorrectos.')
    estado.responder = () => ({ data: { id: 'f1' } })
    estado.signIn.mockResolvedValue({ data: { session: null }, error: { message: 'mala', status: 400 } })
    await expect(sesion.ingresar('ana@abc.gob.ar', 'mala')).rejects.toThrow('Correo o contraseña incorrectos.')
    expect(estado.guardarSesion).not.toHaveBeenCalled()
  })
  it('avisa cuando hay demasiados intentos', async () => {
    estado.responder = () => ({ data: { id: 'f1' } })
    estado.signIn.mockResolvedValue({ data: { session: null }, error: { message: 'rate', status: 429 } })
    await expect(sesion.ingresar('ana@abc.gob.ar', 'x')).rejects.toThrow(/Demasiados intentos/)
  })
  it('con la contraseña correcta guarda la sesión y devuelve el perfil', async () => {
    estado.responder = () => ({ data: { id: 'f1' } })
    estado.usuarioDeSesion.mockResolvedValue(yoFed)
    expect(await sesion.ingresar(' ANA@abc.gob.ar ', 'bien')).toEqual({ fed: yoFed.fed, email: yoFed.email, esAdmin: false, debeCambiar: false })
    expect(estado.signIn).toHaveBeenCalledWith({ email: 'ana@abc.gob.ar', password: 'bien' })
    expect(estado.guardarSesion).toHaveBeenCalled()
  })
  it('una cuenta sin perfil en la agenda no entra y no deja sesión', async () => {
    estado.responder = () => ({ data: { id: 'f1' } })
    estado.usuarioDeSesion.mockResolvedValue(null)
    await expect(sesion.ingresar('ana@abc.gob.ar', 'bien')).rejects.toThrow('Correo o contraseña incorrectos.')
    expect(estado.borrarSesion).toHaveBeenCalled()
  })
})

describe('cambio de contraseña', () => {
  const buena = 'ClaveNueva2026'
  it('pide la actual y que sea distinta, salvo con una temporal', async () => {
    await expect(sesion.cambiarPassword(buena, '')).rejects.toThrow(/contraseña actual/)
    await expect(sesion.cambiarPassword(buena, buena)).rejects.toThrow(/distinta de la actual/)
    expect(estado.updateUser).not.toHaveBeenCalled()
  })
  it('rechaza una nueva débil', async () => {
    await expect(sesion.cambiarPassword('corta1', 'Actual12345')).rejects.toThrow(/al menos 10 caracteres/)
  })
  it('verifica la actual antes de cambiar', async () => {
    estado.signIn.mockResolvedValue({ data: { session: null }, error: { message: 'x', status: 400 } })
    await expect(sesion.cambiarPassword(buena, 'Equivocada123')).rejects.toThrow('La contraseña actual no es correcta.')
    expect(estado.updateUser).not.toHaveBeenCalled()
  })
  it('con la actual correcta cambia y limpia la marca de temporal', async () => {
    await sesion.cambiarPassword(buena, 'Actual12345')
    expect(estado.updateUser).toHaveBeenCalledWith('u1', { password: buena })
    expect(de('feds', 'update')[0].ops.find(o => o.m === 'update')!.args[0]).toEqual({ debe_cambiar_password: false })
    expect(de('auditoria', 'insert')).toHaveLength(1)
  })
  it('con una temporal no vuelve a pedir la actual', async () => {
    estado.usuario = { ...yoFed, debeCambiar: true }
    await sesion.cambiarPassword(buena)
    expect(estado.signIn).not.toHaveBeenCalled()
    expect(estado.updateUser).toHaveBeenCalled()
  })
})

describe('usuarios (solo administración)', () => {
  it('un FED no lista ni crea cuentas', async () => {
    await expect(usuarios.listarUsuarios()).rejects.toThrow('Sólo administración puede gestionar usuarios')
    await expect(usuarios.generarPasswordTemporal('f2')).rejects.toThrow('Sólo administración puede gestionar usuarios')
    expect(estado.createUser).not.toHaveBeenCalled(); expect(estado.llamadas).toHaveLength(0)
  })
  it('lista el estado de cada cuenta', async () => {
    estado.usuario = yoAdmin
    estado.listUsers.mockResolvedValue({ data: { users: [{ id: 'u1', email: 'ANA@abc.gob.ar', last_sign_in_at: '2026-10-01T10:00:00Z' }] }, error: null })
    estado.responder = () => ({ data: [
      { id: 'f1', nombre_completo: 'Ana', rol: 'fed', email: 'ana@abc.gob.ar', es_admin: false, debe_cambiar_password: false },
      { id: 'f2', nombre_completo: 'Luis', rol: 'fed', email: 'luis@abc.gob.ar', es_admin: false, debe_cambiar_password: true },
    ] })
    const l = await usuarios.listarUsuarios()
    expect(l.map(u => [u.nombre, u.estado])).toEqual([['Ana', 'activo'], ['Luis', 'sin_cuenta']])
    expect(l[0].ultimoIngreso).toBe('2026-10-01T10:00:00Z')
  })
  it('crea la cuenta si no existe, con una temporal que obliga a cambiarla', async () => {
    estado.usuario = yoAdmin
    estado.responder = l => (l.tabla === 'feds' && l.ops.some(o => o.m === 'maybeSingle') ? { data: { id: 'f2', nombre_completo: 'Luis', email: 'Luis@abc.gob.ar' } } : {})
    const r = await usuarios.generarPasswordTemporal('f2')
    expect(r.email).toBe('Luis@abc.gob.ar'); expect(r.password.length).toBeGreaterThan(8)
    expect(estado.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'luis@abc.gob.ar', password: r.password, email_confirm: true }))
    expect(de('feds', 'update').some(l => (l.ops.find(o => o.m === 'update')!.args[0] as Record<string, unknown>).debe_cambiar_password === true)).toBe(true)
    expect(de('auditoria', 'insert')).toHaveLength(1)
  })
  it('si la cuenta existe, solo resetea la contraseña', async () => {
    estado.usuario = yoAdmin
    estado.listUsers.mockResolvedValue({ data: { users: [{ id: 'u2', email: 'luis@abc.gob.ar' }] }, error: null })
    estado.responder = l => (l.tabla === 'feds' && l.ops.some(o => o.m === 'maybeSingle') ? { data: { id: 'f2', nombre_completo: 'Luis', email: 'luis@abc.gob.ar' } } : {})
    await usuarios.generarPasswordTemporal('f2')
    expect(estado.updateUser).toHaveBeenCalledWith('u2', { password: expect.any(String) })
    expect(estado.createUser).not.toHaveBeenCalled()
  })
  it('no genera para un perfil sin correo ni para la propia cuenta', async () => {
    estado.usuario = yoAdmin
    estado.responder = () => ({ data: { id: 'f2', nombre_completo: 'Luis', email: null } })
    await expect(usuarios.generarPasswordTemporal('f2')).rejects.toThrow(/no tiene correo/)
    estado.responder = () => ({ data: { id: 'a1', nombre_completo: 'Silvio', email: 'silvio@abc.gob.ar' } })
    await expect(usuarios.generarPasswordTemporal('a1')).rejects.toThrow(/Tu propia contraseña/)
    expect(estado.createUser).not.toHaveBeenCalled(); expect(estado.updateUser).not.toHaveBeenCalled()
  })
})
