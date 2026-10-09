// Extracto de cronogramas de conectividad: la lista de intervenciones que todavía no se hicieron, ordenada por fecha, para adjuntar en los mails
// a jefaturas y escuelas (PDF y Excel). Incluye el personal a cargo con su DNI o CUIL, porque quienes ingresan a los establecimientos son personas
// ajenas a ellos y se les piden esos datos. Todo es determinístico y se arma con lo que ya se ve en la pantalla de Cronogramas.
import { esEnlace, estadoDe, etiquetaTipo, personaDe, programaDe, esReprogramacion, type Cronograma } from '@/lib/cronogramas'
import { siglaNombre } from '@/lib/siglas'
import { titleCase } from '@/lib/format'
import { esc } from '@/lib/graficos'

export type FilaExtracto = {
  desde: string, hasta: string, establecimiento: string, cue: number, direccion: string, localidad: string, distrito: string,
  tarea: string, empresa: string, programa: string, personal: string[], enlaces: string[], observaciones: string,
}

const completa = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
export const fechasDe = (f: Pick<FilaExtracto, 'desde' | 'hasta'>) => (f.desde === f.hasta ? completa(f.desde) : `${completa(f.desde)} al ${completa(f.hasta)}`)

// Lo que ya se hizo (anotado como "Realizado") no va; el resto, ordenado por fecha de inicio, de fin y por CUE.
export function filasExtracto(lista: Cronograma[]): FilaExtracto[] {
  return lista.filter(c => estadoDe(c) !== 'realizado').map(c => {
    const lineas = (c.instaladores ?? '').split('\n').map(x => x.trim()).filter(Boolean)
    const programa = programaDe(c.semana)
    return {
      desde: c.fecha_inicio, hasta: c.fecha_fin,
      establecimiento: c.school?.nombre ? siglaNombre(titleCase(c.school.nombre)) : c.nombre_planilla ? titleCase(c.nombre_planilla) : `CUE ${c.cue}`,
      cue: c.cue, direccion: c.school?.direccion ? titleCase(c.school.direccion) : '', localidad: c.school?.ciudad ? titleCase(c.school.ciudad) : '', distrito: c.school?.distrito ? titleCase(c.school.distrito) : '',
      tarea: etiquetaTipo(c.tipo), empresa: c.proveedor ?? '', programa: programa === 'Educar' ? 'EDUCAR' : programa ?? '',
      personal: lineas.filter(l => !esEnlace(l)).map(personaDe).filter(Boolean), enlaces: lineas.filter(esEnlace),
      observaciones: esReprogramacion(c.semana) ? 'Reprogramación' : '',
    }
  }).sort((a, b) => a.desde.localeCompare(b.desde) || a.hasta.localeCompare(b.hasta) || a.cue - b.cue)
}

// Texto del período del extracto: el que se eligió o, si no, el que abarcan las filas.
export function periodoExtracto(filas: FilaExtracto[], desde: string, hasta: string): string {
  if (!filas.length) return ''
  const d = desde || filas[0].desde, h = hasta || filas.reduce((m, f) => (f.hasta > m ? f.hasta : m), filas[0].hasta)
  return d === h ? completa(d) : `${completa(d)} al ${completa(h)}`
}

export const tituloExtracto = (distrito: string) => `Cronograma de intervenciones de conectividad${distrito ? ` · ${titleCase(distrito)}` : ''}`

// Documento para imprimir o guardar como PDF (apaisado). `origen`: dirección de la app, para el logo y la tipografía.
export function htmlExtracto({ titulo, periodo, filas, emitido, origen }: { titulo: string, periodo: string, filas: FilaExtracto[], emitido: string, origen: string }): string {
  const personal = (f: FilaExtracto) => [...f.personal.map(p => `<div>${esc(p)}</div>`), ...f.enlaces.map(e => `<div><a href="${esc(e)}">Datos del personal</a></div>`)].join('') || '<span class="vacio">A confirmar</span>'
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${esc(titulo)}</title>
<style>
@font-face { font-family: 'Encode Sans'; font-weight: 100 900; src: url(${esc(origen)}/fonts/EncodeSans-Variable.woff2) format('woff2'); }
@page { size: A4 landscape; margin: 12mm 12mm 18mm; }
* { box-sizing: border-box; } html { -webkit-print-color-adjust: exact; print-color-adjust: exact; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { font-family: 'Encode Sans', sans-serif; color: #1f2a3a; font-size: 9pt; margin: 0; }
.banda { background: linear-gradient(135deg, #04364f, #05476e 45%, #683a74 80%, #d41c6c); color: #fff; border-radius: 3mm; padding: 5mm 6mm; }
.banda small { letter-spacing: .2em; text-transform: uppercase; font-weight: 700; color: #8fd6e5; font-size: 7.5pt; }
.banda h1 { margin: 1mm 0 0; font-size: 16pt; font-weight: 800; }
.datos { display: flex; flex-wrap: wrap; gap: 2mm 8mm; margin: 4mm 0; font-size: 9pt; }
.datos b { text-transform: uppercase; letter-spacing: .08em; font-size: 7pt; color: #5b6474; margin-right: 1.5mm; }
table { width: 100%; border-collapse: collapse; }
th { background: #05476e; color: #fff; text-align: left; padding: 1.6mm 2mm; font-size: 8pt; }
td { padding: 1.5mm 2mm; border-bottom: 1px solid #e3e1ea; vertical-align: top; }
tr:nth-child(even) td { background: #f6f5f9; } tr { break-inside: avoid; } thead { display: table-header-group; }
td small { display: block; color: #5b6474; font-size: 7.5pt; }
.vacio { color: #5b6474; font-style: italic; }
a { color: #05476e; }
.nota { margin: 3mm 0 0; font-size: 8pt; color: #5b6474; }
.pie { margin-top: 6mm; border-top: 1px solid #e3e1ea; padding-top: 2mm; font-size: 7.5pt; color: #5b6474; }
.barra { position: sticky; top: 0; z-index: 1; display: flex; gap: 8px; padding: 8px 0; background: #fff; }
.barra button { font: 600 15px 'Encode Sans', sans-serif; min-height: 44px; padding: 0 16px; border-radius: 10px; border: 1px solid #05476e; background: #fff; color: #05476e; }
.barra button.pri { background: #05476e; color: #fff; }
.aviso { font-family: sans-serif; background: #fdf6e3; color: #6b5210; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; }
@media print { .aviso, .barra { display: none; } }
@media screen { body { padding: 0 16px 24px; } .tabla { overflow-x: auto; } table { min-width: 820px; } }
</style></head><body>
<div class="barra"><button type="button" onclick="volver()">‹ Volver a la agenda</button><button type="button" class="pri" onclick="print()">Guardar PDF</button></div>
<p class="aviso">Para guardarlo, elegí <b>Guardar como PDF</b> en la ventana de impresión (en el celular: Compartir › Imprimir).</p>
<div class="banda"><small>Dirección de Tecnología Educativa · Región 1</small><h1>${esc(titulo)}</h1></div>
<div class="datos"><div><b>Período</b>${esc(periodo)}</div><div><b>Intervenciones</b>${filas.length}</div><div><b>Emitido</b>${esc(emitido)}</div></div>
<div class="tabla"><table><thead><tr><th>Fecha</th><th>Establecimiento</th><th>Localidad</th><th>Tarea</th><th>Empresa</th><th>Personal a cargo</th></tr></thead><tbody>
${filas.map(f => `<tr><td>${esc(fechasDe(f))}</td><td><b>${esc(f.establecimiento)}</b><small>CUE ${f.cue}${f.direccion ? ` · ${esc(f.direccion)}` : ''}</small></td><td>${esc([f.localidad, f.distrito].filter((x, i, a) => x && a.indexOf(x) === i).join(', '))}</td><td>${esc(f.tarea)}${f.observaciones ? `<small>${esc(f.observaciones)}</small>` : ''}</td><td>${esc(f.empresa)}${f.programa ? `<small>${esc(f.programa)}</small>` : ''}</td><td>${personal(f)}</td></tr>`).join('\n')}
</tbody></table></div>
<p class="nota">Las fechas y el personal pueden modificarse: se informa a las instituciones para que estén al tanto y faciliten el ingreso y el acceso a los espacios correspondientes.</p>
<div class="pie">Agenda Territorial · Dirección de Tecnología Educativa · Región 1</div>
<script>
// En la app instalada (iPhone) la ventana no tiene botón de cerrar: si no se puede cerrar, vuelve a la agenda.
function volver() { window.close(); setTimeout(() => { location.href = '${esc(origen)}/' }, 300) }
document.fonts.ready.then(() => setTimeout(() => print(), 250))</script>
</body></html>`
}
