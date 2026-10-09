// Campos del formulario "Registro de Acciones Pedagógicas" de Nivel Central, en su orden (clave interna, pregunta del formulario).
export const ordenCampos: [string, string][] = [
  ['region', 'Región Educativa en que se realiza la acción'], ['distrito', 'Distritos de Región 1'], ['lugar', 'En qué lugar se realizó la acción'], ['propuesta', 'Propuesta dictada'],
  ['fechaFin', 'Fecha de finalización de la propuesta dictada'], ['encuentros', 'Cantidad de encuentros de la propuesta dictada'], ['tipoJornada', 'Tipo de jornada'],
  ['formato', 'Formato de participación'], ['destinatarios', 'Destinatarios'], ['cues', 'CUE/s impactado/s'], ['inscriptos', 'Cantidad de inscriptos'],
  ['participantes', 'Cantidad de participantes reales'], ['fed', 'CED / FED a cargo de la jornada'], ['observaciones', 'Observaciones'],
]

// Formulario de Nivel Central donde se carga cada encuentro.
export const FORMULARIO_NC = 'https://docs.google.com/forms/d/e/1FAIpQLSe60hbFKYK47H9puFs9b2Ka08ZRGkg14K_D_G4R8nJ92sUoyg/viewform'
