import { describe, expect, it } from 'vitest'
import { avisaPorFecha, bannerDe, clasePve, esBanner, nivelDe, type NotifBase } from '@/lib/avisos'

const n = (o: Partial<NotifBase>): NotifBase => ({ id: 'x', tipo: 'etiqueta', detalle: null, leida: false, created_at: '2026-10-01T10:00:00Z', autor_id: null, ...o })

describe('nivel de cada notificación', () => {
  it('rojo: cancelaciones, PVE devuelta y "no puede participar"', () => {
    expect(nivelDe(n({ tipo: 'cancelacion' }))).toBe('urgente')
    expect(nivelDe(n({ tipo: 'pve', autor_id: 'ced', detalle: 'Devolvió tu PVE de septiembre 2026 para corregir: falta la firma' }))).toBe('urgente')
    expect(nivelDe(n({ tipo: 'respuesta', detalle: 'Avisó que no puede participar' }))).toBe('urgente')
  })
  it('amarillo: aviso y recordatorio de PVE, FED sin actividad', () => {
    expect(nivelDe(n({ tipo: 'pve', detalle: 'Ya podés subir tu PVE de septiembre 2026: vence el 07/10' }))).toBe('aviso')
    expect(nivelDe(n({ tipo: 'inactividad', autor_id: 'f' }))).toBe('aviso')
    expect(nivelDe(n({ tipo: 'reclamo', detalle: 'Se resolvió el reclamo de CUE 60304400 · Sin Conectividad' }))).toBe('ok')
    expect(nivelDe(n({ tipo: 'reclamo', detalle: 'Llegó el número del reclamo de CUE 60304400 · Sin Conectividad: ticket 1' }))).toBe('info')
  })
  it('verde: confirmaciones y PVE entregada; el resto, informativo', () => {
    expect(nivelDe(n({ tipo: 'respuesta', detalle: 'Confirmó que participa' }))).toBe('ok')
    expect(nivelDe(n({ tipo: 'pve', autor_id: 'f', detalle: 'Entregó su PVE de septiembre 2026' }))).toBe('ok')
    for (const t of ['etiqueta', 'modificacion', 'evento']) expect(nivelDe(n({ tipo: t }))).toBe('info')
  })
  it('clase de PVE', () => {
    expect(clasePve({ autor_id: 'c', detalle: 'Devolvió tu PVE' })).toBe('devuelta')
    expect(clasePve({ autor_id: 'f', detalle: 'Reentregó corregida su PVE' })).toBe('entrega')
    expect(clasePve({ autor_id: null, detalle: 'Mañana vence tu PVE' })).toBe('aviso')
  })
})

describe('banner', () => {
  it('sólo lo que pide una acción y no se leyó', () => {
    expect(esBanner(n({ tipo: 'pve' }))).toBe(true)
    expect(esBanner(n({ tipo: 'pve', leida: true }))).toBe(false)
    expect(esBanner(n({ tipo: 'pve', autor_id: 'f', detalle: 'Entregó su PVE' }))).toBe(false)
    expect(esBanner(n({ tipo: 'inactividad', autor_id: 'f' }))).toBe(true)
    for (const t of ['etiqueta', 'modificacion', 'cancelacion', 'respuesta', 'evento']) expect(esBanner(n({ tipo: t }))).toBe(false)
  })
  it('muestra el más urgente, luego el más nuevo, y cuenta los demás', () => {
    const aviso = n({ id: 'a', tipo: 'pve', detalle: 'Ya podés subir tu PVE', created_at: '2026-10-01T06:00:00Z' })
    const dev = n({ id: 'd', tipo: 'pve', autor_id: 'c', detalle: 'Devolvió tu PVE', created_at: '2026-09-30T06:00:00Z' })
    const inact = n({ id: 'i', tipo: 'inactividad', autor_id: 'f', created_at: '2026-10-01T08:00:00Z' })
    expect(bannerDe([aviso, dev, inact])).toMatchObject({ principal: { id: 'd' }, otros: 2 })
    expect(bannerDe([aviso, inact])).toMatchObject({ principal: { id: 'i' }, otros: 1 })
    expect(bannerDe([n({ tipo: 'etiqueta' })])).toBeNull()
  })
})

describe('aviso a compañeros por fecha', () => {
  it('no avisa de acciones anteriores a hoy; sí de hoy y futuras', () => {
    expect(avisaPorFecha('2026-09-15', '2026-10-01')).toBe(false)
    expect(avisaPorFecha('2026-10-01', '2026-10-01')).toBe(true)
    expect(avisaPorFecha('2026-10-05', '2026-10-01')).toBe(true)
  })
})
