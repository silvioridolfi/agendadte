import 'server-only'
import { crc32 } from 'node:zlib'

// ZIP mínimo sin compresión (los PDF ya vienen comprimidos): evita sumar una dependencia para esto.
export function armarZip(archivos: { nombre: string, datos: Buffer }[]): Buffer {
  const partes: Buffer[] = [], central: Buffer[] = []
  let offset = 0
  for (const a of archivos) {
    const nombre = Buffer.from(a.nombre, 'utf8'), crc = crc32(a.datos) >>> 0, n = a.datos.length
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6) // UTF-8
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(n, 18); local.writeUInt32LE(n, 22); local.writeUInt16LE(nombre.length, 26)
    partes.push(local, nombre, a.datos)
    const cab = Buffer.alloc(46)
    cab.writeUInt32LE(0x02014b50, 0); cab.writeUInt16LE(20, 4); cab.writeUInt16LE(20, 6); cab.writeUInt16LE(0x0800, 8)
    cab.writeUInt32LE(crc, 16); cab.writeUInt32LE(n, 20); cab.writeUInt32LE(n, 24); cab.writeUInt16LE(nombre.length, 28); cab.writeUInt32LE(offset, 42)
    central.push(cab, nombre)
    offset += 30 + nombre.length + n
  }
  const tam = central.reduce((s, b) => s + b.length, 0), fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10); fin.writeUInt32LE(tam, 12); fin.writeUInt32LE(offset, 16)
  return Buffer.concat([...partes, ...central, fin])
}
