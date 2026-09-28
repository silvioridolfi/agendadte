'use client'

import { useEffect, useState } from 'react'
import { Camera, Check, Copy, ExternalLink, FolderSync, Loader2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { EstadoFotos } from '@/app/actions'
import { errMsg, estadoFotos, guardarCarpetaFotos, ordenarMisFotos, ErrorBox } from '@/components/app/comun'

// Mi perfil → Fotos de las acciones: enlace a la carpeta de Drive del FED, verificación de acceso y orden por día.
export function SeccionFotos() {
  const [estado, setEstado] = useState<EstadoFotos | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [copiado, setCopiado] = useState(false)
  const cargar = () => estadoFotos().then(e => { setEstado(e); setUrl(e.url ?? '') }).catch(e => setError(errMsg(e)))
  useEffect(() => { cargar() }, [])

  async function guardar() {
    setBusy('guardar'); setError(''); setAviso('')
    try { await guardarCarpetaFotos(url); await cargar(); setAviso(url.trim() ? 'Enlace guardado.' : 'Se quitó la carpeta.') } catch (e) { setError(errMsg(e)) } finally { setBusy('') }
  }
  async function ordenar() {
    setBusy('ordenar'); setError(''); setAviso('')
    try {
      const r = await ordenarMisFotos()
      const total = r.ordenadas + r.atajos
      const rescate = r.rescatadas ? `Se reacomodaron ${r.rescatadas} ${r.rescatadas === 1 ? 'foto' : 'fotos'}. ` : ''
      setAviso(rescate + (total ? `Se ordenaron ${total} ${total === 1 ? 'archivo' : 'archivos'}${r.porAccion ? ` (${r.porAccion} en la carpeta de su acción según la hora)` : ' por día'}${r.sinFecha ? ` (${r.sinFecha} sin fecha de captura, en “Sin fecha”)` : ''}${r.pendientes ? `. Quedan ${r.pendientes}: tocá de nuevo para seguir.` : '.'}` : 'No había fotos sueltas para ordenar.'))
    } catch (e) { setError(errMsg(e)) } finally { setBusy('') }
  }
  const copiar = async () => { if (!estado) return; try { await navigator.clipboard.writeText(estado.cuentaTecnica); setCopiado(true) } catch { setCopiado(false) } }

  const listo = !!estado?.url && !!estado.nombre && estado.puedeEditar
  return <section className="rounded-card border border-dte-linea bg-white p-4 shadow-e1 sm:p-5" aria-labelledby="t-fotos">
    <h3 id="t-fotos" className="flex items-center gap-1.5 font-bold"><Camera className="size-4 text-dte-petroleo" />Fotos de las acciones</h3>
    <p className="mb-3 text-sm text-dte-gris">Subí las fotos sueltas a tu carpeta de Drive: la agenda las <b>mueve a una carpeta por día</b> y, según la hora en que las sacaste, a una subcarpeta por acción. Si la acción la cargás después, en la próxima pasada la foto pasa sola a su carpeta. <b>No borres las carpetas que crea la agenda</b>: si pasa, las fotos vuelven a tu carpeta principal y se ordenan de nuevo. El CED las ve desde la agenda.</p>

    {!estado ? <Loader2 className="size-5 animate-spin text-dte-gris" /> : !estado.configurado ? <p className="text-sm text-dte-gris">La conexión con Drive todavía no está configurada.</p> : <>
      <ol className="mb-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm">
        <li>Creá una carpeta en tu Drive (por ejemplo, “Fotos Agenda DTE”).</li>
        <li>Compartila como <b>Editor</b> con la cuenta de la agenda:
          <span className="mt-1 flex flex-wrap items-center gap-2"><code className="break-all rounded bg-dte-fondo px-2 py-1 text-xs">{estado.cuentaTecnica}</code><Button variant="outline" size="sm" onClick={copiar}>{copiado ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiado ? 'Copiado' : 'Copiar'}</Button></span>
          <span className="mt-1 block text-xs text-dte-gris">También podés compartirla con el correo del CED para que la vea directamente en Drive.</span></li>
        <li>Pegá acá el enlace de la carpeta y guardá.</li>
      </ol>
      <div className="mb-3 rounded-control border border-dte-linea bg-dte-fondo px-3 py-2 text-xs text-dte-tinta">
        <p className="font-semibold">Cómo subir las fotos para que se ordenen bien</p>
        <ul className="mt-1 list-disc pl-4">
          <li>Subilas <b>directo desde la galería del celular a la carpeta de Drive</b> (app de Drive: <b>+ → Subir</b>, o desde Fotos: <b>Compartir → Drive</b>).</li>
          <li><b>No las pases por WhatsApp ni Telegram:</b> borran la fecha y hora en que se sacaron y quedan en “Sin fecha”.</li>
          <li>Cargá el <b>horario</b> de tus acciones en la agenda: así cada foto va a la carpeta de su acción.</li>
          <li>Los videos se ordenan por el día en que los subís: conviene subirlos el mismo día que los grabaste.</li>
        </ul>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" aria-label="Enlace de la carpeta de Drive" className="min-w-0 sm:flex-1" />
        <Button onClick={guardar} disabled={!!busy} className="bg-dte-petroleo hover:bg-dte-petroleo-oscuro">{busy === 'guardar' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}Guardar y verificar</Button>
      </div>

      {estado.url && <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-tile border p-3 text-sm ${listo ? 'border-exito/30 bg-exito-fondo text-exito' : 'border-aviso-borde bg-aviso-fondo text-aviso'}`}>
        <span className="flex items-start gap-1.5">{listo ? <Check className="mt-0.5 size-4 shrink-0" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" />}
          {listo ? <>Conectada: <b>{estado.nombre}</b>. Las fotos se ordenan cada noche.</> : estado.error ?? (estado.nombre ? 'La cuenta de la agenda puede ver la carpeta pero no editarla: compartila como Editor.' : 'Verificando…')}</span>
        <span className="flex flex-wrap gap-2">
          <a href={estado.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-control border border-dte-linea bg-white px-3 text-xs font-semibold text-dte-petroleo hover:bg-dte-tinte md:min-h-8"><ExternalLink className="size-3.5" />Abrir carpeta</a>
          {listo && <Button variant="outline" size="sm" onClick={ordenar} disabled={!!busy} className="bg-white">{busy === 'ordenar' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <FolderSync data-icon="inline-start" />}Ordenar ahora</Button>}
        </span>
      </div>}
      {aviso && <p role="status" className="mt-2 text-sm text-dte-petroleo">{aviso}</p>}
      <p className="mt-3 rounded-control border border-aviso-borde bg-aviso-fondo px-3 py-2 text-xs text-aviso"><b>Recordatorio:</b> subí sólo fotos con autorización de uso de imagen de la escuela o de las familias, en especial si aparecen estudiantes.</p>
    </>}
    {error && <div className="mt-2"><ErrorBox message={error} /></div>}
  </section>
}
