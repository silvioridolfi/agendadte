import { describe, expect, it } from 'vitest'
import { esVersionVieja } from '@/lib/version'

describe('esVersionVieja', () => {
  it('reconoce el error de Next cuando la acción ya no existe', () => {
    expect(esVersionVieja('Server Action "40037e93bbdb54a0da3c8ed65073cc2d8bfa158cad" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action')).toBe(true)
    expect(esVersionVieja('Failed to find Server Action "abc"')).toBe(true)
  })
  it('no confunde otros errores', () => {
    expect(esVersionVieja('No se pudo completar la operación.')).toBe(false)
    expect(esVersionVieja('Tu sesión venció. Ingresá de nuevo.')).toBe(false)
  })
})
