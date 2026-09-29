'use client'

import { useState } from 'react'
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DrillDialog, type DrillRow } from '@/components/metrics'
import { titleCase } from '@/lib/format'
import { cuentaHecha, type AgendaItem, type Fed } from '@/lib/agenda'
import type { Indicador } from '@/lib/informes'
import type { Persona } from '@/lib/exportar'
import { cap, errMsg, fmt, parse, itemCorto, ErrorBox } from '@/components/app/comun'
import { ZONA } from '@/lib/hora'

const fechaAR = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
export const personaDe = (f: Fed): Persona => ({ nombre: f.nombre_completo, rol: f.rol === 'coordinacion' ? 'Coordinador de Educación Digital (CED)' : 'Facilitador de Educación Digital (FED)', distritos: f.distritos_a_cargo, carga: f.carga_horaria })

// PDF: una página de informe con la identidad DTE que se guarda con "Imprimir → Guardar como PDF" del navegador.
function imprimirInforme({ titulo, persona, desde, hasta, indicadores, items, feds }: { titulo: string, persona: Persona, desde: string, hasta: string, indicadores: Indicador[], items: AgendaItem[], feds: Fed[] }) {
  const w = window.open('', '_blank')
  if (!w) throw new Error('El navegador bloqueó la ventana del informe: permití ventanas emergentes para este sitio.')
  const fedName = (id: string) => feds.find(f => f.id === id)?.nombre_completo ?? ''
  const hechas = [...items].filter(cuentaHecha).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
  const variosResponsables = new Set(hechas.map(i => i.fed_id)).size > 1
  const logo = `${location.origin}/brand/oficial-color.png`
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${esc(titulo)} · ${esc(persona.nombre)}</title>
<style>
@font-face { font-family: 'Encode Sans'; font-weight: 100 900; src: url(${location.origin}/fonts/EncodeSans-Variable.woff2) format('woff2'); }
@page { size: A4; margin: 16mm 14mm 22mm; }
* { box-sizing: border-box; } html { -webkit-print-color-adjust: exact; print-color-adjust: exact; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { font-family: 'Encode Sans', sans-serif; color: #1f2a3a; font-size: 10pt; margin: 0; }
.banda { background: linear-gradient(135deg, #04364f, #05476e 45%, #683a74 80%, #d41c6c); color: #fff; border-radius: 4mm; padding: 6mm 7mm; }
.banda small { letter-spacing: .2em; text-transform: uppercase; font-weight: 700; color: #8fd6e5; font-size: 8pt; }
.banda h1 { margin: 1.5mm 0 0; font-size: 19pt; font-weight: 800; }
.datos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5mm 8mm; margin: 5mm 0; padding: 4mm 5mm; border: 1px solid #e3e1ea; border-radius: 3mm; }
.datos b { display: block; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .08em; color: #5b6474; }
h2 { color: #05476e; font-size: 12.5pt; margin: 6mm 0 2mm; }
.ind { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm; }
.ind div { border: 1px solid #e3e1ea; border-radius: 3mm; padding: 3mm; break-inside: avoid; }
.ind span { display: block; font-size: 8pt; color: #5b6474; line-height: 1.3; }
.ind strong { display: block; font-size: 17pt; color: #05476e; margin-top: 1mm; }
.ind em { font-style: normal; font-size: 7.5pt; color: #5b6474; }
table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
th { background: #05476e; color: #fff; text-align: left; padding: 1.8mm 2mm; }
td { padding: 1.6mm 2mm; border-bottom: 1px solid #e3e1ea; vertical-align: top; }
tr:nth-child(even) td { background: #f6f5f9; } tr { break-inside: avoid; }
.pie { margin-top: 8mm; border-top: 1px solid #e3e1ea; padding-top: 3mm; display: flex; align-items: center; justify-content: space-between; gap: 6mm; font-size: 7.5pt; color: #5b6474; }
.pie img { height: 11mm; }
.barra { position: sticky; top: 0; z-index: 1; display: flex; gap: 8px; padding: calc(8px + env(safe-area-inset-top, 0px)) 0 8px; background: #fff; }
.barra button { font: 600 15px 'Encode Sans', sans-serif; min-height: 44px; padding: 0 16px; border-radius: 10px; border: 1px solid #05476e; background: #fff; color: #05476e; }
.barra button.pri { background: #05476e; color: #fff; }
.aviso { font-family: sans-serif; background: #fdf6e3; color: #6b5210; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; }
@media print { .aviso, .barra { display: none; } }
/* En pantalla angosta (celular): márgenes, datos en una columna, indicadores de a dos y tabla con desplazamiento propio. */
@media screen { body { padding: 0 16px 24px; } .tabla { overflow-x: auto; } }
@media screen and (max-width: 640px) {
  .barra button { flex: 1; }
  .datos { grid-template-columns: 1fr; }
  .ind { grid-template-columns: repeat(2, 1fr); }
  .tabla table { min-width: 560px; }
  .pie { flex-direction: column; align-items: flex-start; }
}
</style></head><body>
<div class="barra"><button type="button" onclick="volver()">‹ Volver a la agenda</button><button type="button" class="pri" onclick="print()">Guardar PDF</button></div>
<p class="aviso">Para guardarlo, elegí <b>Guardar como PDF</b> en la ventana de impresión (en el celular: Compartir › Imprimir).</p>
<div class="banda"><small>Dirección de Tecnología Educativa · Región 1</small><h1>${esc(titulo)}</h1></div>
<div class="datos">
  <div><b>Nombre</b>${esc(persona.nombre)}</div><div><b>Rol</b>${esc(persona.rol)}</div>
  <div><b>Distritos a cargo</b>${esc(persona.distritos.map(titleCase).join(', ') || '—')}</div><div><b>Carga horaria</b>${esc(persona.carga ?? '—')}</div>
  <div><b>Período</b>${fechaAR(desde)} al ${fechaAR(hasta)}</div><div><b>Emitido</b>${new Date().toLocaleDateString('es-AR', { timeZone: ZONA })}</div>
</div>
<h2>Indicadores del período</h2>
<div class="ind">${indicadores.map(x => `<div><span>${esc(x.label)}</span><strong>${x.valor}</strong>${x.detalle ? `<em>${esc(x.detalle)}</em>` : ''}</div>`).join('')}</div>
<h2>Detalle de acciones realizadas (${hechas.length})</h2>
${hechas.length ? `<div class="tabla"><table><thead><tr><th>Fecha</th>${variosResponsables ? '<th>Responsable</th>' : ''}<th>Acción</th><th>Escuela / lugar</th><th>Tema / detalle</th></tr></thead><tbody>
${hechas.map(i => `<tr><td>${fechaAR(i.fecha)}</td>${variosResponsables ? `<td>${esc(fedName(i.fed_id))}</td>` : ''}<td>${esc(titleCase(i.accion))}</td><td>${esc(i.school?.nombre ? `${titleCase(i.school.nombre)}${i.school.cue ? ` (CUE ${i.school.cue})` : ''}` : i.lugar ?? '')}</td><td>${esc(i.sub_accion ?? '')}</td></tr>`).join('')}
</tbody></table></div>` : '<p>No hay acciones realizadas en el período.</p>'}
<div class="pie"><img src="${logo}" alt="Dirección de Tecnología Educativa · DGCyE · Gobierno de la Provincia de Buenos Aires"><span>Agenda Territorial · ${esc(persona.nombre)} · ${fechaAR(desde)} al ${fechaAR(hasta)}</span></div>
<script>
// En la app instalada (iPhone) la ventana no tiene botón de cerrar: si no se puede cerrar, vuelve a la agenda.
function volver() { window.close(); setTimeout(() => { location.href = '${location.origin}/' }, 300) }
Promise.all([document.fonts.ready, new Promise(r => { const i = document.querySelector('.pie img'); if (i.complete) r(); else { i.onload = r; i.onerror = r } })]).then(() => setTimeout(() => print(), 250))</script>
</body></html>`)
  w.document.close()
}

// Bloque con los indicadores del período, el detalle de cada uno y la descarga en Excel o PDF.
export function InformeBloque({ titulo, subtitulo, persona, desde, hasta, indicadores, items, feds, onSelect }: { titulo: string, subtitulo: string, persona: Persona, desde: string, hasta: string, indicadores: Indicador[], items: AgendaItem[], feds: Fed[], onSelect?: (i: AgendaItem) => void }) {
  const [drill, setDrill] = useState<{ title: string, subtitle?: string, rows: DrillRow[] } | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const fedName = (id: string) => feds.find(f => f.id === id)?.nombre_completo ?? ''
  const ver = (x: Indicador) => setDrill({ title: x.label, subtitle: `${x.items.length} ${x.items.length === 1 ? 'acción' : 'acciones'}`, rows: [...x.items].sort((a, b) => b.fecha.localeCompare(a.fecha)).map(i => ({
    key: i.id, title: itemCorto(i), sub: [titleCase(i.accion), fedName(i.fed_id)].filter(Boolean).join(' · '), right: cap(fmt(parse(i.fecha), { day: 'numeric', month: 'short' }).replace(/\./g, '')), onClick: onSelect ? () => { setDrill(null); onSelect(i) } : undefined,
  })) })
  async function excel() {
    setBusy('xlsx'); setError('')
    try { const { exportarInforme } = await import('@/lib/exportar'); await exportarInforme({ titulo, persona, desde, hasta, indicadores, items, feds }) } catch (e) { setError(errMsg(e)) } finally { setBusy('') }
  }
  function pdf() { setError(''); try { imprimirInforme({ titulo, persona, desde, hasta, indicadores, items, feds }) } catch (e) { setError(errMsg(e)) } }
  return <section className="mt-4 rounded-card border border-dte-linea bg-white p-4 shadow-e1 sm:p-5" aria-label={titulo}>
    <DrillDialog drill={drill} onClose={() => setDrill(null)} />
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0"><h3 className="font-bold">{titulo}</h3><p className="text-sm text-dte-gris">{subtitulo}</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={!!busy} onClick={excel}>{busy === 'xlsx' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <FileSpreadsheet data-icon="inline-start" />}Excel</Button>
        <Button variant="outline" size="sm" onClick={pdf}><FileDown data-icon="inline-start" />PDF</Button>
      </div>
    </div>
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">{indicadores.map(x => <li key={x.clave}>
      <button type="button" onClick={() => ver(x)} disabled={!x.items.length} className="flex h-full w-full flex-col rounded-tile border border-dte-linea p-3 text-left transition hover:border-dte-petroleo hover:bg-dte-tinte disabled:hover:border-dte-linea disabled:hover:bg-transparent">
        <span className="text-xs leading-snug text-dte-gris">{x.label}</span>
        <span className="mt-1 text-2xl font-bold tabular-nums text-dte-petroleo">{x.valor}</span>
        {x.detalle && <span className="text-xs text-dte-gris">{x.detalle}</span>}
      </button>
    </li>)}</ul>
    {error && <div className="mt-3"><ErrorBox message={error} /></div>}
  </section>
}
