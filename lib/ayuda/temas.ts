// Contenido de la ayuda. Los valores que salen de reglas de la agenda (tipos de acción, mínimos, plazos, umbrales) se toman del código,
// así que si la regla cambia, la ayuda cambia con ella. El resto es texto: se actualiza en el mismo cambio que modifica la función.
import { ACCIONES, ACCIONES_CED, CATEGORIA, CLUB_DIAS_SIN_ACTIVIDAD, CLUB_MAX_PARTICIPANTES, CLUB_MIN_ENCUENTROS, SOLO_CED, nombreAccion, type Accion } from '@/lib/agenda'
import { UMBRAL_DIAS_HABILES } from '@/lib/actividad'
import { DESTINATARIOS_BASE, PROPUESTAS_DE_CLUB } from '@/lib/encuentro'
import { TOLERANCIA } from '@/lib/horas'
import { DIA_HABIL_AVISO, DIA_HABIL_RECORDATORIO, DIA_HABIL_VENCIMIENTO } from '@/lib/pve-reglas'

export type Rol = 'fed' | 'ced'
export type Tema = { id: string, titulo: string, para: Rol[], md: () => string }

const ord = (n: number) => `${n}.º`
const CATS = [['tecnica', 'Técnicas'], ['pedagogica', 'Pedagógicas'], ['institucional', 'Institucionales']] as const
const tiposPorCategoria = (lista: readonly Accion[]) => CATS.map(([c, n]) => `| ${n} | ${lista.filter(a => CATEGORIA[a] === c).map(nombreAccion).join(', ')} |`).join('\n')

export const TEMAS: Tema[] = [
  // ---------------------------------------------------------------- FED y comunes
  { id: 'intro', titulo: 'Para qué sirve la agenda', para: ['fed'], md: () => `
La Agenda Territorial reemplaza las planillas de seguimiento. Cada registro cumple tres funciones a la vez:
- **Planificación personal:** organiza la semana y los meses de trabajo.
- **Registro de lo realizado:** las acciones marcadas como **Realizada** alimentan las métricas, los informes y las planillas del equipo.
- **Información para la coordinación:** el CED consulta el tablero del equipo sin necesidad de pedir datos por otras vías.
Por eso es importante registrar cada acción y mantener su estado actualizado.` },

  { id: 'ingreso', titulo: 'Ingreso y cuenta', para: ['fed', 'ced'], md: () => `
## Primer ingreso
1. Ingresá con el correo institucional (abc.gob.ar) y la contraseña temporal que te asignaron.
2. La agenda te pide una contraseña nueva: al menos 10 caracteres, con letras y números, sin incluir el usuario del correo.
3. Una vez cambiada, accedés a tu agenda.
## Instalarla en el celular
- **Android (Chrome):** menú de tres puntos › Agregar a pantalla de inicio o Instalar aplicación.
- **iPhone (Safari):** botón Compartir › Agregar a inicio.
Instalada, se abre como una aplicación, a pantalla completa.
## Si olvidás la contraseña
El administrador de la agenda genera una contraseña temporal nueva. En equipos compartidos conviene usar **Cerrar sesión** desde el menú de las iniciales.
## Uso sin conexión
Si no hay señal, la agenda muestra la última copia guardada en el dispositivo con el aviso **Sin conexión**. Las acciones que registres quedan en espera y se envían solas al recuperar la conexión.
[i] Algunas operaciones, como editar una visita con varias acciones, requieren conexión.` },

  { id: 'perfil', titulo: 'Mi perfil y declaración jurada', para: ['fed', 'ced'], md: () => `
Se accede desde las iniciales, arriba a la derecha › **Mi perfil y DD.JJ.**
- **Datos:** distritos a cargo y carga horaria, que se calcula a partir del horario DTE.
- **Horario DTE:** de lunes a viernes, con hasta dos franjas por día (por ejemplo, 8 a 12 y 13 a 17). **Copiar lunes a toda la semana** agiliza la carga cuando el horario se repite.
- **Otros cargos:** horas en otras instituciones (nombre, días y horario). La agenda las usa para advertir superposiciones al registrar acciones y al consultar la disponibilidad del equipo.
El botón **Guardar** se habilita al modificar algún dato; **Descartar** revierte los cambios.` },

  { id: 'agenda', titulo: 'La agenda: vistas y tarjetas', para: ['fed', 'ced'], md: () => `
## Vistas
| Vista | Uso recomendado |
| Día | Detalle de la jornada. |
| Semana | Organización cotidiana (vista principal). |
| Mes | Planificación mensual. En el celular, al tocar un día se abre su detalle. |
| 6 meses | Panorama del semestre, con la cantidad de acciones por día. |
| Lista | Acciones del año en orden cronológico, desde hoy en adelante; las anteriores se despliegan a pedido. |
## Cómo leer una tarjeta
- **Franja de color:** tipo de acción.
- **Horario, escuela y CUE.** Las escuelas se muestran con sigla (EP, EES, EEST, JI…).
- **Etiquetas:** tipo de acción y estado.
- **Compartida:** acción de otro integrante en la que te incorporaron. **+1, +2…** es la cantidad de acompañantes.
- **Ícono de cámara:** la acción tiene fotos en Drive.
Los feriados, recesos y aniversarios distritales se marcan en el calendario; los eventos DTE, con una marca violeta.` },

  { id: 'registro', titulo: 'Registrar una acción', para: ['fed'], md: () => `
## Paso a paso
1. **Establecimiento:** búsqueda por nombre, localidad o CUE (incluye jefaturas y organismos). Para otros lugares se completa el campo libre.
2. **Fecha y horario:** se muestra tu horario DTE declarado para ese día y se advierte si la acción queda fuera de él.
3. **Tipo de acción:** arriba figuran las más usadas; el buscador encuentra cualquier tipo.
4. **Sub-acción y detalle** (opcionales), con sugerencias según el tipo.
5. **Acompañado por:** integrantes que participan; se informa su disponibilidad.
6. Confirmá con **Agregar a mi agenda**.
## Tipos de acción
| Categoría | Tipos |
${tiposPorCategoria(ACCIONES.filter(a => !SOLO_CED.includes(a)))}
Las sugerencias de sub-acción reflejan las líneas de trabajo de la DTE.
## Reuniones virtuales
En **Reunión** podés elegir la modalidad (presencial, virtual o híbrida). Si es virtual o híbrida, se carga el enlace y desde la tarjeta se puede entrar con un toque.
## Visitas con varias acciones
Si en una misma visita hiciste varias acciones (por ejemplo, visita técnica y conectividad), marcá todos los tipos en el mismo formulario. Se guarda un registro por tipo, con la misma escuela, fecha, horario y acompañantes, y se muestran en una única tarjeta. Los cambios de estado y la eliminación se aplican a toda la visita.
[!] No se combinan con otros tipos: Club de Tecnología, PEAT, Paro, Licencia, Evento DTE y Formación interna.
## Solo días hábiles
La agenda admite fechas de lunes a viernes. No se pueden registrar acciones en fines de semana, feriados, días no laborables ni recesos escolares (enero incluido). Los aniversarios distritales solo cuentan para los distritos a cargo.
## Acciones que se repiten
Al pie del formulario, marcá **Se repite cada semana**, elegí los días y la fecha de finalización. La agenda crea una acción por cada fecha, salteando feriados y recesos. Los acompañantes reciben un solo aviso. Al editar una acción de la serie, la agenda pregunta si el cambio aplica a esa fecha o a esa y las siguientes: solo lo pregunta cuando cambiás fecha, horario, lugar o tipo.
## Acompañantes y disponibilidad
Al incorporar integrantes, la acción se agrega a sus agendas y reciben una notificación. El recuadro **Disponibilidad** indica si cada uno está disponible (verde), fuera de horario, en otro cargo o con otra acción (amarillo), o de licencia o paro (rojo). Es un aviso: no impide guardar.
[i] Las acciones de fechas anteriores a hoy no avisan a los compañeros etiquetados: sirve para cargar todo junto a fin de mes sin molestar. La acción igual aparece en su agenda.
[i] Si te etiquetaron en una acción, la ves en tu agenda como **Compartida**, pero cuenta en las métricas de quien la creó. Solo quien la creó puede editarla o marcarla como realizada.` },

  { id: 'estado', titulo: 'Estados y cierre de acciones', para: ['fed', 'ced'], md: () => `
| Estado | Cuándo usarlo |
| Planificada | Acción prevista que todavía no se realizó. |
| Realizada | Acción concretada. Es el único estado que se computa en métricas e informes. |
| Reprogramada | Acción suspendida que queda pendiente de nueva fecha. Al asignarle la fecha nueva vuelve sola a Planificada. Si ya conocés la nueva fecha, alcanza con editarla. |
| Cancelada | Acción que no se realizará. Se muestra tachada. |
## Marcado rápido
La tilde de cada tarjeta marca la acción como realizada. Aparece en tus acciones, del día o anteriores, planificadas o reprogramadas (en la computadora, al pasar el cursor). Durante unos segundos podés **Deshacer**. En clubes, PEAT y talleres se recuerda completar los asistentes (**Completar**).
## Pendientes de cerrar
Un aviso reúne las acciones de los últimos 7 días sin cerrar: **Revisar** la lista o **Marcar todas** como realizadas, con confirmación.
## Cambios en bloque
**Seleccionar** permite marcar varias acciones (o **Todo el día**) y cambiar su estado o eliminarlas de una vez.
## Edición e historial
Desde el detalle: **Editar**, **Eliminar** (con confirmación) y **Ver historial de cambios**. Solo quien creó la acción puede modificarla.` },

  { id: 'licencias', titulo: 'Licencias y paros', para: ['fed'], md: () => `
## Licencia por período
1. Nueva acción › tipo **Licencia**.
2. Indicá **Desde** y, si corresponde, **Hasta**. No lleva horario: abarca la jornada completa.
3. Revisá el resumen de días hábiles y confirmá.
Se registra un día por cada día hábil del período. Las acciones planificadas en esas fechas pueden pasar a reprogramadas automáticamente. La coordinación recibe un único aviso con el período. El campo **Motivo** es optativo y no debe incluir datos sensibles.
## Paros
Se registran con el tipo **Paro**, sin establecimiento ni horario. Quedan registrados directamente como **realizados**, aunque la fecha todavía no haya llegado; si hace falta, se pueden editar o cambiar de estado.
[!!] Licencias y paros no se computan en métricas, informes ni planillas. La constancia de justificación debe enviarse dentro de las 48 horas.` },

  { id: 'clubes', titulo: 'Clubes de Tecnología y PEAT', para: ['fed'], md: () => `
Se gestionan desde **Tablero › Mis clubes** y **Mis prácticas**.
## Alta
Cada grado o grupo es un club o una práctica. **Nuevo club / Nueva práctica:** escuela, grado o curso y primer encuentro. Con **Fecha a definir** queda "por iniciar" y no se agrega a la agenda hasta programar el primer encuentro.
Si un curso se dividió en grupos (por ejemplo, 7.º Informática en Grupo 1 y Grupo 2), cargá cada grupo en el campo **Grupo**: en las métricas de prácticas cuentan como un solo curso, con los inscriptos sumados.
## Registrar un encuentro
- El **número de encuentro** se asigna solo, a partir de los encuentros ya realizados del grupo; podés corregirlo.
- **Propuesta dictada:** en clubes viene "Club de Tecnología" y hay una lista corta para elegir otra (${PROPUESTAS_DE_CLUB.slice(1, 5).join(', ')}, entre otras) o escribir una propia. En PEAT es siempre "Prácticas Educativas en Ambientes de Trabajo".
- **Destinatarios:** se tilda entre el grado del club, ${DESTINATARIOS_BASE.join(', ')}, y se pueden sumar otros.
- **Inscriptos:** se cargan al iniciar y se mantienen hasta el cierre; el formulario los trae del primer encuentro. En cada encuentro cargás solo los **participantes reales** y una breve descripción de lo realizado.
- Si el encuentro fue en otra sede, se puede indicar.
## Completar un encuentro desde la agenda
En una acción propia de club o PEAT, de hoy o anterior, el botón **Completar encuentro** abre el formulario con los datos del encuentro. Al guardar con participantes reales, descripción o cierre cargados, la acción se marca como realizada. Cargar o editar datos del encuentro no pregunta "este o este y los siguientes": solo pregunta si cambiás fecha, horario, lugar o tipo.
La breve descripción se ve en el detalle de la acción realizada y en el Excel.
## Estados
- **Activo.**
- **Sin actividad** tras ${CLUB_DIAS_SIN_ACTIVIDAD} días hábiles sin encuentros (sin contar el receso invernal).
- **Finalizado** al registrar el cierre.
[i] Línea prioritaria DTE: los clubes tienen un mínimo de **${CLUB_MIN_ENCUENTROS} encuentros** y hasta **${CLUB_MAX_PARTICIPANTES} participantes**. El mínimo es informativo y solo de los clubes: después no importa si hacen más. Las prácticas se cumplen por horas y no tienen mínimo. Solo se computan los encuentros realizados.
## Talleres y capacitaciones
En **Taller/Capacitación** la propuesta se elige entre los temas habituales (una sola) o se escribe uno propio, y los destinatarios usan el mismo selector. Inscriptos, asistentes y breve descripción aparecen cuando la acción es de hoy o anterior.` },

  { id: 'fotos', titulo: 'Fotos de las acciones', para: ['fed'], md: () => `
La agenda organiza en tu Google Drive las fotos de cada acción. Su uso es **optativo**, pero facilita la documentación y los informes.
## Cómo funciona
1. **Captura:** la foto se toma con el celular; el archivo guarda fecha y hora.
2. **Subida:** la subís a tu carpeta personal de Drive, sin ordenar.
3. **Orden nocturno:** a las 3 a. m. la agenda la mueve a la carpeta del día.
4. **Acción:** si la hora coincide con una acción, pasa a su subcarpeta.
## Configuración inicial (una sola vez)
1. Creá una carpeta en Google Drive, por ejemplo "Fotos Agenda DTE".
2. En **Fotos de las acciones** (menú de las iniciales), copiá la cuenta de la agenda con el botón **Copiar**.
3. En Drive, compartí la carpeta con esa cuenta como **Editor** (sin notificar).
4. Copiá el enlace de la carpeta, pegalo en **Fotos de las acciones** y **Guardar**. La agenda verifica el acceso y muestra el nombre de la carpeta.
[i] Opcionalmente podés compartir la carpeta también con el correo del CED. La coordinación accede de todos modos desde la agenda.
## Cómo subirlas
| Dispositivo | Procedimiento |
| Android | App de Drive › + › Subir › elegir las fotos de la galería. O desde la galería: Compartir › Drive › elegir la carpeta. |
| iPhone | App de Drive › + › Subir › Fotos y videos. O desde Fotos: Compartir › Drive. |
| Computadora | Arrastrar los archivos originales a la carpeta en drive.google.com. |
Subí las fotos sueltas a la carpeta personal: no hace falta crear subcarpetas ni renombrar archivos.
## Cómo se ordenan
- **Por día:** según la fecha de captura registrada en la foto. La carpeta del día se nombra con la fecha y las escuelas de las acciones de esa jornada.
- **Por acción:** si la hora de captura cae dentro del horario de una acción (o hasta ${TOLERANCIA} minutos antes o después), la foto pasa a la subcarpeta de esa acción.
- Si no se puede determinar la acción (por ejemplo, dos acciones en el mismo horario), la foto queda en la carpeta del día.
- Si la acción se registra después, en la siguiente pasada la foto se mueve a su carpeta.
[!] La fecha y la hora de captura son clave. Las fotos reenviadas por WhatsApp o Telegram, las capturas de pantalla y algunos archivos editados pierden ese dato y quedan en **Sin fecha (ordenar a mano)**. Subí siempre el archivo original desde la galería.
## Casos especiales
- **Videos:** se ordenan por el día en que se suben, sin subcarpeta de acción. Conviene subirlos el mismo día de la grabación.
- **Acciones sin horario:** sus fotos pueden quedar en la carpeta del día.
- **Carpeta eliminada por error:** las fotos que contenía vuelven a la carpeta personal y se ordenan de nuevo en la siguiente pasada.
- **Eliminar fotos:** se eliminan las fotos desde su carpeta, no las carpetas de la agenda. Luego **Ordenar ahora** actualiza la agenda y el ícono de cámara desaparece si la acción ya no tiene fotos.
## Ordenar ahora
El orden es automático cada noche. Para ordenar en el momento: **Fotos de las acciones › Ordenar ahora**. El resultado informa cuántos archivos se ordenaron, cuántos pasaron a la carpeta de su acción y cuántos quedaron sin fecha.
[!] Uso de imagen: subí solo fotos que cuenten con autorización de la escuela o de las familias, especialmente cuando aparecen estudiantes.
## Si algo no funciona
- **"La carpeta no se verifica":** revisá que la compartiste como Editor con la cuenta de la agenda (no con otra) y que el enlace sea de una carpeta, no de un archivo.
- **"Las fotos no se ordenan":** el orden se hace de noche; para verlo en el momento usá **Ordenar ahora**. Verificá que las fotos estén en la carpeta principal y no dentro de otra subcarpeta propia.
- **"Borré una carpeta y el ícono de cámara sigue":** usá **Ordenar ahora**. Para quitar fotos definitivamente, eliminá las fotos (no las carpetas) y volvé a ordenar.
- **"Quedaron en Sin fecha":** el archivo no conserva la fecha de captura. Subí el original desde la galería o movelas a mano.
- **"Quedaron en el día y no en la acción":** revisá que la acción tenga horario y que la hora de la foto esté dentro de ese horario (o a menos de ${TOLERANCIA} minutos).` },

  { id: 'pve', titulo: 'Planilla de Visita a Escuelas (PVE)', para: ['fed'], md: () => `
La PVE se completa en papel, con la firma de cada escuela. La agenda gestiona su entrega: la guarda en Drive con el nombre correcto y la pone a disposición de la coordinación.
## Circuito
1. **Escaneo:** todas las hojas del mes en un único PDF.
2. **Subida:** "Subir" abre la carpeta del mes en Drive.
3. **Detección:** la agenda la renombra y la comparte con la coordinación.
4. **Revisión:** el CED la revisa, la devuelve si hace falta y la envía.
## Requisitos
- Carpeta de Drive configurada en **Fotos de las acciones**: es la misma del registro fotográfico. La agenda crea allí la subcarpeta PVE.
- Un único PDF por mes, con todas las hojas firmadas.
- Escaneo recomendado: con el celular, app de Drive › + › Escanear (Android) o Notas/Archivos › Escanear documentos (iPhone). Todas las hojas en orden, en una sola sesión; que se lean firmas, sellos y fechas.
## Entrega, paso a paso
1. Ingresá a **Planillas de Visita (PVE)**, desde el menú de las iniciales.
2. En el mes que corresponde, tocá **Subir**: la agenda crea la carpeta "PVE MM-AAAA" y la abre en Drive.
3. Subí el PDF a esa carpeta.
4. La agenda detecta el archivo, lo renombra según el instructivo y le da acceso de lectura a la coordinación.
La revisión es automática cada noche. Para verla en el momento: **Revisar ahora**. Si subís más de una versión, se considera la última.
## Vencimiento y avisos
La PVE de cada mes vence el **${ord(DIA_HABIL_VENCIMIENTO)} día hábil del mes siguiente**, sin contar fines de semana, feriados ni recesos. Ejemplo: la PVE de septiembre vence el ${ord(DIA_HABIL_VENCIMIENTO)} día hábil de octubre.
Recibís un aviso el ${ord(DIA_HABIL_AVISO)} día hábil del mes y un recordatorio el ${ord(DIA_HABIL_RECORDATORIO)} (el día anterior al vencimiento). Mientras no la entregues, el aviso se ve también como banner arriba de la pantalla.
## Estados
| Estado | Significado | Qué hacer |
| Pendiente | Todavía no se subió el PDF. | Subirlo antes del vencimiento. |
| Entregada | La coordinación dispone de la planilla. | Nada; aguardar la revisión. |
| Devuelta para corregir | La coordinación la observó e indicó el motivo. | Corregir y usar **Subir corregida**. |
| Reentregada | Se recibió la versión corregida. | Nada. |
| Enviada | La coordinación la envió a Nivel Central. | Ya no puede reemplazarse. |
## Devolución y corrección
Te llega un aviso con el motivo y el mes figura como **Devuelta para corregir**. **Ver** abre la planilla entregada; **Subir corregida** abre la misma carpeta del mes. Subí el nuevo PDF: la versión anterior se conserva con la leyenda "(VERSIÓN ANTERIOR)" y la coordinación recibe el aviso.
## Si algo no funciona
- **"Subí la planilla y sigue Pendiente":** usá **Revisar ahora**. Verificá que el archivo sea PDF y que esté dentro de la carpeta del mes correcto.
- **"La subí en el mes equivocado":** movela en Drive a la carpeta del mes correcto y usá **Revisar ahora**.
- **"No aparece el botón Subir":** falta configurar la carpeta de Drive en **Fotos de las acciones**.
- **"Necesito cambiar una planilla ya enviada":** pedíselo a la coordinación: al devolverla, el mes vuelve a quedar abierto.` },

  { id: 'tablero', titulo: 'Tablero e informes', para: ['fed'], md: () => `
El **Tablero** presenta tu información del período elegido (día, semana, mes o año):
- **Resumen y métricas:** acciones realizadas por categoría, escuelas alcanzadas, equipos intervenidos y encuentros.
- **Mis clubes** y **Mis prácticas (PEAT).**
- **Mis acciones:** listado con búsqueda y filtros.
## Qué se computa
Solo las acciones **realizadas**. No se computan las planificadas, reprogramadas o canceladas, ni las licencias y paros. Cada número del resumen permite ver las acciones que lo componen.
[i] Las acciones de las que solo participás como acompañante no cuentan en tus métricas: cuentan para quien las creó.
## Mi informe del período
- **Acciones acompañadas:** el informe suma un indicador aparte con las acciones realizadas de otros integrantes en las que te etiquetaron. No se suma al total ni a las categorías, y no cuentan las que rechazaste.
- **Excel:** hoja Informe (indicadores del período), hoja Acciones (detalle de las realizadas) y, si hay, hoja Acompañadas.
- **PDF:** se abre el informe con el logo institucional; **Guardar PDF** lo descarga (en el celular: Compartir › Imprimir). Al final lista las acciones acompañadas.
Además, **Exportar Excel** (en la agenda y en el tablero) descarga la planilla completa del período, con las hojas Resumen, Acciones, Capacitaciones, Clubes y Prácticas.
[i] Enero es receso: los informes no cuentan enero (los de clubes arrancan en marzo).` },

  { id: 'notificaciones', titulo: 'Notificaciones y avisos', para: ['fed'], md: () => `
La **campanita** reúne tus notificaciones y se actualiza sola cada pocos segundos. Al tocar una, se abre la acción correspondiente. Cada una lleva un color:
| Color | Qué indica |
| Rojo | Cancelaciones, PVE devuelta, alguien que avisó que no puede participar. |
| Amarillo | Avisos y recordatorios (por ejemplo, de la PVE). |
| Verde | Confirmaciones de participación y entregas. |
| Neutro | Informativas: te sumaron a una acción o la modificaron. |
Lo que pide una acción tuya (aviso y recordatorio de PVE, PVE devuelta) aparece además como **banner** arriba de la pantalla, con **Ir a mis PVE** y **Entendido**, hasta que lo resolvés o lo cerrás.
## Tipos de aviso
| Aviso | Origen |
| Te sumó a… | Otro integrante te incorporó a una acción. Podés responder **Participo** o **No puedo** desde el detalle. |
| Modificó / canceló… | Cambios en una acción compartida (fecha, horario, lugar, estado). |
| Respondió sobre… | Respuesta de un integrante a una acción tuya. |
| Evento DTE | Se cargó una jornada DTE; podés registrar tu participación. |
| PVE | Recordatorios de vencimiento y devoluciones. |` },

  { id: 'faq', titulo: 'Preguntas frecuentes y glosario', para: ['fed'], md: () => `
## ¿Por qué no aparece la tilde de realizada?
Solo se muestra en acciones propias, del día o anteriores, planificadas o reprogramadas. No aparece en fechas futuras, en acciones compartidas ni en licencias y paros.
## ¿Qué pasa si marqué una acción como realizada por error?
Se revierte con **Deshacer** o desde el detalle, en **Cambiar estado**.
## ¿Se pueden cargar acciones en feriados?
No. Solo de lunes a viernes en días hábiles.
## ¿Quién ve mis acciones?
Vos, los integrantes incorporados a cada acción y la coordinación. Al consultar disponibilidad, tus compañeros solo ven el tipo de acción y el horario.
## ¿Puedo registrar acciones en escuelas de otros distritos?
Sí. El buscador incluye todas las escuelas de la región, sin importar tus distritos a cargo.
## ¿Las fotos son obligatorias?
No, su uso es optativo.
## ¿Puedo usar otra carpeta de Drive para la PVE?
No. La PVE usa la misma carpeta configurada para las fotos.
## ¿Se pierde algo si cargo sin conexión?
No. El registro queda en el dispositivo y se envía al recuperar la señal.
## Glosario
| Sigla | Significado |
| CED | Coordinador de Educación Digital. |
| DD.JJ. | Declaración jurada de horarios (horario DTE y otros cargos). |
| EMATP | Encargado de Medios de Apoyo Técnico-Pedagógico. |
| PEAT | Prácticas Educativas en Ambientes de Trabajo. |
| PVE | Planilla de Visita a Escuelas. |
| Serie | Conjunto de acciones que se repiten semanalmente. |
| Visita | Varias acciones registradas juntas en una misma escuela, fecha y horario. |
[i] Las dificultades técnicas y las propuestas de mejora se comunican al administrador de la agenda, preferentemente con una captura de pantalla.` },

  // ---------------------------------------------------------------- Coordinación (CED)
  { id: 'ced-rol', titulo: 'El rol del CED en la agenda', para: ['ced'], md: () => `
La agenda concentra en un solo lugar la información que el equipo registra a diario. Para la coordinación, esto implica:
- **Seguimiento sin planillas adicionales:** lo planificado y lo realizado por cada FED, por período.
- **Indicadores automáticos** de la planificación del CED, con acceso al detalle de cada valor.
- **Gestión de la PVE mensual:** recepción, revisión, devolución y envío a Nivel Central.
- **Agenda propia,** con tipos de acción específicos de la coordinación.
[i] El tablero es de solo lectura: consultarlo no modifica los datos del equipo. Cada FED gestiona sus acciones y su perfil.
Al ingresar se presenta el **Tablero del equipo**; tu agenda propia está en **Mi agenda**.
## Menú de usuario
Desde las iniciales: **Mi perfil y DD.JJ.** (horario DTE y otros cargos), **Fotos de las acciones**, **PVE del equipo**, **Cambiar contraseña** y **Cerrar sesión**. Tu horario DTE se usa, como en los FED, para informar tu disponibilidad cuando te incorporan a una acción.` },

  { id: 'ced-tablero', titulo: 'Tablero del equipo', para: ['ced'], md: () => `
## Período y filtros
- **Período:** Día, Semana, Mes o Año, con flechas para avanzar o retroceder y **Hoy**.
- **Filtros:** búsqueda por escuela, localidad, CUE o FED; distrito; FED; tipo de acción. Se aplican a todas las pestañas.
- Cuando hay un FED filtrado, un aviso arriba lo indica y permite **Ver todo el equipo**.
- **Exportar Excel:** descarga la planilla del período con los filtros aplicados.
## Pestañas
| Pestaña | Contenido |
| Resumen y métricas | Acciones realizadas por categoría, FED y distrito; escuelas alcanzadas; encuentros; indicadores de coordinación. |
| Agenda del equipo | Actividad diaria o semanal de cada FED. |
| Mi equipo | Tarjeta de cada integrante: resumen, horarios, informe y fotos. |
| Clubes de Tecnología y Prácticas (PEAT) | Registro del ciclo lectivo y trayectoria de cada grupo. Un curso dividido en grupos cuenta como una sola práctica. |
| Acciones del equipo | Listado completo, agrupado por FED. |
## Resumen y métricas
- Las acciones reprogramadas son las suspendidas que esperan nueva fecha: permiten detectar visitas pendientes de reubicar.
- Solo se computan acciones realizadas. No cuentan las planificadas, reprogramadas o canceladas, ni las licencias y paros.
- Cada tarjeta y cada fila permiten consultar las acciones que componen el valor.
- **Escuelas con clubes activos** considera únicamente los clubes en curso; los finalizados o sin actividad no se incluyen.
- Las acciones del CED no se suman a las métricas del equipo: se presentan en los indicadores de coordinación.
## Agenda del equipo
Vistas **Día** (franja horaria por FED), **Semana** y **Próximas**. **En territorio** muestra las acciones en escuelas: incluye la oficina R1 y las reuniones presenciales que se hacen dentro de una escuela; no incluye las reuniones virtuales, con Jefatura o en la sede DTE, ni el resto de lo institucional. **Todas las acciones** incluye las institucionales. Las ausencias figuran como **Lic.** o **Paro**.
## Mi equipo
Cada tarjeta presenta las acciones realizadas y planificadas del período, clubes y prácticas, la fecha de la última acción realizada y los horarios de la DD.JJ. Incluye tres accesos:
- **Informe:** el mismo informe que el FED ve en su tablero (con sus acciones acompañadas aparte), descargable en Excel o PDF.
- **Ver acciones del FED:** abre el listado filtrado por ese integrante.
- **Carpeta de fotos:** acceso a su carpeta de Drive (si la configuró).
## Exportar Excel
| Hoja | Contenido |
| Resumen | Totales por FED: categorías, planificadas, escuelas, equipos y encuentros. |
| Acciones | Todas las acciones del período, con FED, escuela, estado y detalle. |
| Capacitaciones | Encuentros de clubes, talleres y prácticas, con inscriptos, asistentes y breve descripción. |
| Clubes / Prácticas | Un grupo por fila, con estado y encuentros. |
| Una hoja por FED | Las acciones de cada integrante (solo si hay más de uno). |` },

  { id: 'ced-indicadores', titulo: 'Indicadores de coordinación', para: ['ced'], md: () => `
Se calculan automáticamente a partir de las acciones realizadas en el período y responden a la planificación 2026.
| Indicador | Cómo se calcula |
| Reuniones de coordinación | Acciones "Reunión" del CED. |
| Seguimientos territoriales | Seguimiento del equipo y Acompañamiento a FED. |
| Instituciones acompañadas | Escuelas distintas en acciones del CED. |
| Clubes implementados o fortalecidos | Clubes distintos con encuentros del equipo. |
| Estudiantes en PEAT | Inscriptos en los encuentros de prácticas (los grupos de un mismo curso suman). |
| Instancias de formación | Talleres y formaciones internas dictadas. |
| Jornadas de Educación Digital y eventos DTE | Participaciones registradas. |
| Informes técnicos | Acciones "Informe técnico" del CED. |
| Articulaciones con Jefaturas e Inspección | Reuniones con Jefatura e Inspección del CED. |
| Reuniones con Nivel Central | Acciones "Reunión con Nivel Central". |
| Articulaciones municipales | Acciones "Articulación municipal". |
Cada valor abre el listado de acciones que lo componen. El conjunto se descarga en Excel o PDF, con los datos del CED y el logo institucional, como insumo para los informes mensuales y semestrales.
[i] Para que un indicador refleje la tarea, la acción debe registrarse con el tipo correcto y marcarse como **Realizada**.` },

  { id: 'ced-agenda', titulo: 'Mi agenda de coordinación', para: ['ced'], md: () => `
La agenda del CED ofrece las mismas herramientas que la de los FED (vistas, series, visitas con varias acciones, marcado rápido, pendientes de cerrar y licencias). El formulario presenta primero el bloque **Coordinación**:
| Tipo | Alcance |
${ACCIONES_CED.map(a => `| ${nombreAccion(a)} | ${ALCANCE_CED[a] ?? ''} |`).join('\n')}
Las acciones territoriales habituales están en **Acciones territoriales** (como FED). Las reuniones pueden ser presenciales, virtuales o híbridas, con enlace.
## Acciones compartidas
Los FED pueden incorporarte en sus acciones: figuran en tu agenda como **Compartida**, con la opción de confirmar la participación. Solo quien creó la acción puede modificarla.
## Nueva reunión de equipo
Desde el Tablero, **Nueva reunión de equipo**: el formulario incorpora a todo el equipo.
1. Al indicar fecha y horario, el recuadro **Disponibilidad** informa la situación de cada integrante: disponible, fuera de horario DTE, en otro cargo, con otra acción (tipo, horario y escuela) o de licencia.
2. Ajustá el horario si hace falta y confirmá.
3. Cada integrante recibe la notificación y puede responder **Participo** o **No puedo**.` },

  { id: 'ced-fotos', titulo: 'Fotos del equipo', para: ['ced'], md: () => `
Cada FED puede vincular una carpeta de Google Drive. La agenda organiza allí las fotos por día y por acción. Conocer el funcionamiento permite orientar al equipo.
## Funcionamiento
1. **Subida:** el FED sube las fotos originales, sueltas, a su carpeta.
2. **Orden nocturno:** a las 3 a. m. se mueven a una carpeta por día, según la fecha de captura.
3. **Acción:** si la hora coincide con una acción (±${TOLERANCIA} min), pasan a su subcarpeta.
## Acceso de la coordinación
Desde **Mi equipo**, cada tarjeta incluye el acceso a la carpeta de fotos del integrante (si la configuró). Las acciones con fotos muestran un ícono de cámara en la agenda y en los listados. El FED puede además compartir la carpeta con tu correo.
## Pautas para transmitir al equipo
- Subir el archivo original desde la galería; no reenviar por WhatsApp o Telegram (se pierde la fecha y la foto queda en "Sin fecha").
- Cargar el horario de las acciones, para que cada foto se ubique en su carpeta.
- No eliminar las carpetas generadas por la agenda: para quitar una foto, se elimina la foto.
- Subir solo fotos con autorización de uso de imagen, en especial si aparecen estudiantes.
[i] Si un FED no tiene la carpeta configurada, su tarjeta de Mi equipo no muestra el acceso, y tampoco puede entregar la PVE.` },

  { id: 'ced-pve', titulo: 'PVE del equipo', para: ['ced'], md: () => `
Circuito completo de la Planilla de Visita a Escuelas, desde la entrega de cada FED hasta el envío a Nivel Central.
1. **FED:** sube el PDF firmado a la carpeta del mes.
2. **Agenda:** lo renombra y te da acceso de lectura.
3. **CED:** revisa y, si corresponde, devuelve con motivo.
4. **CED:** descarga el ZIP, envía y marca como enviadas.
## Pantalla PVE del equipo
Desde el menú › **PVE del equipo**. Tras elegir el mes, se presenta cada FED con su estado, las fechas de entrega, devolución y reentrega, y las acciones disponibles.
| Estado | Significado |
| Pendiente | El FED aún no subió la planilla. |
| Entregada | Disponible para revisión. |
| Devuelta para corregir | Observada; se aguarda la corrección. |
| Reentregada corregida | El FED subió la versión corregida. |
| Enviada | Incluida en el envío a Nivel Central. |
## Revisión
**Ver** abre cada planilla. Conviene controlar: firmas y sellos de cada escuela, correspondencia de los días con las visitas registradas, legibilidad y orden de las hojas.
## Devolución
En la fila del FED, **Devolver** y consignar un motivo concreto (por ejemplo, "Falta la firma del 14/09"). El FED recibe el aviso con el motivo y sube la corregida en la misma carpeta; la anterior se conserva como "(VERSIÓN ANTERIOR)". Vos recibís el aviso de reentrega. Si la planilla ya estaba enviada, al devolverla el mes vuelve a quedar abierto para ese FED.
## Descarga y envío
1. **Descargar todas** genera un ZIP con los PDF nombrados según el instructivo: R01 - PVE (MES AÑO) - NOMBRE.
2. Enviá el ZIP a Nivel Central con el asunto indicado en pantalla: R01 - PVE - MES AÑO.
3. Registrá **Marcar como enviadas**. Las planillas enviadas ya no pueden reemplazarse; las faltantes o en corrección pueden seguir subiéndose.
## Corregidas y entregas fuera de término
Las planillas devueltas quedan fuera del envío del mes. Una vez reentregadas, **Descargar corregidas** genera un ZIP solo con ellas, para un envío complementario, que luego se marca como enviado.
## Vencimientos y avisos
- Vencimiento: ${ord(DIA_HABIL_VENCIMIENTO)} día hábil del mes siguiente (sin fines de semana, feriados ni recesos).
- Cada FED recibe un aviso el ${ord(DIA_HABIL_AVISO)} día hábil del mes y un recordatorio el ${ord(DIA_HABIL_RECORDATORIO)}.
- Vos recibís un aviso con cada entrega y reentrega.
## Casos frecuentes
- **Un FED no entregó:** figura como pendiente. Las restantes pueden descargarse y enviarse; la faltante se incorpora al subirse y se envía por separado.
- **Un FED subió en el mes equivocado:** debe mover el archivo en Drive a la carpeta del mes correcto y usar **Revisar ahora**.
- **Corrección de una planilla ya enviada:** devolverla con el motivo; al reentregarse, usar **Descargar corregidas** para el envío complementario.` },

  { id: 'ced-ausencias', titulo: 'Licencias y ausencias del equipo', para: ['ced'], md: () => `
- Cada FED registra la licencia por período (Desde y Hasta); se crea un registro por día hábil.
- Recibís un único aviso: "cargó una Licencia · Del … al … · N días hábiles".
- En **Agenda del equipo**, el integrante figura como **Lic.** esos días; los paros, como **Paro**.
- Al consultar disponibilidad para una reunión, los integrantes de licencia se indican en rojo.
[!!] Licencias y paros no se computan en métricas, informes ni planillas.` },

  { id: 'ced-notificaciones', titulo: 'Notificaciones y avisos de coordinación', para: ['ced'], md: () => `
Las notificaciones llevan un color (rojo: urgente; amarillo: aviso; verde: confirmación; neutro: informativa). Lo que pide una acción tuya aparece además como banner arriba de la pantalla, hasta que lo cerrás con **Entendido**.
| Aviso | Origen |
| Entregó su PVE | Entrega o reentrega de una planilla. |
| Cargó una Licencia | Licencia registrada por un FED, con el período. |
| Te sumó a… | Un FED te incorporó en una acción. |
| Respondió sobre… | Confirmación o ausencia en una reunión convocada. |
| Modificó / canceló… | Cambios en acciones compartidas. |
| Sin actividad reciente | Un FED lleva ${UMBRAL_DIAS_HABILES} días hábiles o más sin registrar actividad en la agenda. |
[i] El aviso de inactividad cuenta solo días hábiles: no cuenta fines de semana, feriados, recesos, enero ni los días de licencia o paro del propio FED. No mide ingresos a la agenda, sino lo que se carga o cambia.` },

  { id: 'ced-faq', titulo: 'Preguntas frecuentes de coordinación', para: ['ced'], md: () => `
## ¿Es posible modificar acciones de un FED?
No. El tablero y los informes son de solo lectura; cada FED gestiona sus acciones.
## ¿Por qué un número del tablero no coincide con lo esperado?
Verificá el período y los filtros activos, y que las acciones estén marcadas como realizadas con el tipo correcto.
## ¿Las acciones del CED se suman a las métricas del equipo?
No. Se presentan en los indicadores de coordinación.
## ¿Un FED puede registrar acciones en escuelas de otros distritos?
Sí. Las métricas por distrito se calculan según el distrito de la escuela de cada acción.
## ¿Qué ocurre si un FED no entregó la PVE?
Figura como pendiente; las restantes se envían y la faltante se incorpora al subirse.
## ¿Las fotos son obligatorias?
No. Su uso es optativo; la carpeta de cada FED es accesible desde Mi equipo.
## Glosario
| Sigla | Significado |
| DD.JJ. | Declaración jurada de horarios. |
| EMATP | Encargado de Medios de Apoyo Técnico-Pedagógico. |
| FED | Facilitador de Educación Digital. |
| JED | Jornadas de Educación Digital. |
| PEAT | Prácticas Educativas en Ambientes de Trabajo. |
| PVE | Planilla de Visita a Escuelas. |
[i] Los tipos de tareas y los indicadores responden a la planificación 2026. Las propuestas de ajuste se canalizan a través del administrador de la agenda.` },
]

// Alcance de cada tipo propio de la coordinación (se muestra en la tabla de "Mi agenda"). Un tipo nuevo debe sumarse acá.
export const ALCANCE_CED: Partial<Record<Accion, string>> = {
  'REUNIÓN': 'Reuniones de equipo.',
  'REUNIÓN CON JEFATURA': 'Jefatura regional y distritales (también disponible para los FED).',
  'REUNIÓN CON INSPECCIÓN': 'Niveles y modalidades.',
  'REUNIÓN CON NIVEL CENTRAL': 'Dirección de Tecnología Educativa.',
  'ARTICULACIÓN MUNICIPAL': 'Municipios de la región.',
  'ACOMPAÑAMIENTO A FED': 'Acompañamiento en territorio.',
  'SEGUIMIENTO DEL EQUIPO': 'Seguimiento semanal o quincenal.',
  'GESTIÓN INSTITUCIONAL': 'Conectividad, Continuemos Estudiando, JED, entre otras.',
  'INFORME TÉCNICO': 'Informes mensuales y evaluaciones.',
}
