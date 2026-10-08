// Contenido de la ayuda. Los valores que salen de reglas de la agenda (tipos de acción, mínimos, plazos, umbrales) se toman del código,
// así que si la regla cambia, la ayuda cambia con ella. El resto es texto: se actualiza en el mismo cambio que modifica la función.
import { RECLAMOS_PARA, RECLAMOS_PARA_CLARO, TEL_EDUCAR, TEL_MOVISTAR } from '@/lib/reclamos'
import { ACCIONES, ACCIONES_CED, CATEGORIA, CLUB_DIAS_SIN_ACTIVIDAD, CLUB_MAX_PARTICIPANTES, CLUB_MIN_ENCUENTROS, SOLO_CED, nombreAccion, type Accion } from '@/lib/agenda'
import { UMBRAL_DIAS_HABILES } from '@/lib/actividad'
import { DESTINATARIOS_BASE, PROPUESTAS_DE_CLUB } from '@/lib/encuentro'
import { TOLERANCIA } from '@/lib/horas'
import { DIA_HABIL_AVISO, DIA_HABIL_RECORDATORIO, DIA_HABIL_VENCIMIENTO } from '@/lib/pve-reglas'
import { CAMPOS_ESCUELA, DOMINIO_LABORAL } from '@/lib/escuelas-edicion'
import { MAX_TEXTO_COMUNICADO, MAX_TITULO_COMUNICADO } from '@/lib/comunicados'
import { DIAS_ATRAS, HORAS_CONTACTO_PBA, SIN_FED, VALIDEZ_DIAS, etiquetaTipo } from '@/lib/cronogramas'

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
## Cambiar la contraseña
Cuando quieras, desde el menú de las iniciales, **Cambiar contraseña**: te pide la contraseña **actual** (para confirmar que sos vos), la nueva y la nueva otra vez, con las mismas reglas de arriba y distinta de la actual. Con una contraseña temporal no se pide la actual: el cambio es obligatorio y se acaba de ingresar con ella.
## Instalarla en el celular
- **Android (Chrome):** menú de tres puntos › Agregar a pantalla de inicio o Instalar aplicación.
- **iPhone (Safari):** botón Compartir › Agregar a inicio.
Instalada, se abre como una aplicación, a pantalla completa.
## Sitio DTE Región 1
En el menú de las iniciales, **Sitio DTE Región 1** abre el sitio de la Dirección de Tecnología Educativa en una pestaña nueva. Necesitás haber iniciado sesión de Google con tu cuenta institucional (abc.gob.ar).
## Si aparece "La agenda se actualizó"
Cuando se publica una versión nueva y tenías la agenda abierta de antes, puede aparecer un aviso arriba (**La agenda se actualizó**) o un error al guardar o subir algo. Tocá **Actualizar** (o recargá la página) y seguí: no se pierde nada de lo ya guardado.
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
- **Horario, escuela y CUE.** Las escuelas se muestran con sigla (EP, EES, EEST, JI…). Los grupos de PEAT llevan como título solo el curso y el grupo (por ejemplo, "7° Informática - Grupo 1") y, debajo, la escuela donde es el encuentro con su localidad; el detalle también muestra su nombre completo y el CUE.
- **Etiquetas:** tipo de acción y estado.
- **Compartida:** acción de otro integrante en la que te incorporaron. **+1, +2…** es la cantidad de acompañantes.
- **Ícono de cámara:** la acción tiene fotos en Drive: las que quedaron asignadas a ella por horario o, si no tiene, fotos del día que no pertenecen a ninguna otra acción.
Los feriados, recesos y aniversarios distritales se marcan en el calendario; los eventos DTE, con una marca violeta.` },
  { id: 'buscador', titulo: 'Buscador de escuelas', para: ['fed', 'ced'], md: () => `
La **lupa** de la barra de arriba abre el buscador de escuelas. Reemplaza al buscador anterior (v0-buscadordte1), que se retiró: sus datos, el mapa y la edición están ahora en la agenda. Escribí el nombre, la sigla o el CUE (por ejemplo "EP 4" o "ees 31") y elegí la escuela.
## Qué devuelve
Con una sigla y un número trae solo ese tipo de escuela y ese número: "ees 1" no mezcla las técnicas ni las agrarias N° 1, y "eest 1" trae solo las técnicas. Sumá el distrito para afinar ("ep 4 berisso"). Las extensiones y anexos de la escuela pedida aparecen al final. Entienden siglas como EP, EES, EEST, EESA, JI, EEE, CFP, CENS, CEC, CEF, ISFD e ISFT; sin sigla se busca por palabras del nombre, la localidad o el distrito.
Cuando una escuela **comparte predio** con otras (por ejemplo un jardín, una primaria y una secundaria en el mismo edificio), el resultado lo indica debajo del CUE (**Predio N · comparte con…**, con el nombre y el CUE de las demás) para elegir la correcta. Si la escuela tiene un cronograma de conectividad que no terminó, el resultado lo indica también (**Cronograma próximo: Mantenimiento de piso · 14/10 al 21/10**). Lo mismo vale en el buscador de escuela al agendar o armar un reclamo.
## Busca igual en toda la agenda
Las reglas son las mismas en la lupa, el selector de escuela, **Mis escuelas**, **Mapa**, **Cronogramas**, **Reclamos** y el **Tablero**: sin importar tildes ni mayúsculas, con una sigla y un número trae solo ese tipo y ese número ("ees 31" no trae la 310), un número de CUE de 4 cifras o más busca por el principio, y si escribís varias palabras tienen que estar todas, en cualquier orden. En cada pantalla se suman sus propios datos (por ejemplo la empresa o el N° en Cronogramas). La búsqueda de la Ayuda funciona aparte.
## Cómo es la ficha
En la computadora se abre **ancha**, con dos columnas; en el celular, en una sola, en el mismo orden.
- **Cabecera:** el nombre, el CUE, la localidad, el FED a cargo y el predio, con los botones **Agendar acá**, **Reclamo de conectividad** y, si la escuela es tuya, **Editar datos** (ver Mis escuelas). Debajo, cuántas acciones se hicieron, cuántos FED las hicieron y la última visita.
- **Franja amarilla:** aparece solo si hay algo para mirar: reclamos abiertos (si la escuela es tuya) y el **cronograma de conectividad próximo**.
- **Contactos:** los de la escuela con algún dato (el principal primero), con botones para llamar o escribir; si hay correo institucional (de la escuela) y laboral (del directivo), se ven los dos. Los ve cualquiera; los edita solo el FED a cargo, el CED o la administración.
- **Ubicación:** la dirección con **Cómo llegar**, el ámbito y un mapa.
- **La escuela:** nivel, modalidad, turnos, matrícula, secciones, la jefatura distrital y las escuelas que **comparten predio** (con su nombre y CUE; tocando una se abre su ficha). El número de predio lo cambia solo el CED o la administración.
- **Conectividad:** plan y subplan de enlace, ancho de banda, proveedores, estado de la instalación PBA, piso tecnológico, ANI, recurso primario y Access ID. Solo aparece lo que está cargado.
Abajo hay bloques **desplegables**, cerrados y con su cantidad al lado: **Reclamos de conectividad** (solo si la escuela es tuya), **Cronogramas de conectividad**, **Próximas acciones**, **Clubes y prácticas** e **Historial de visitas**. Se abren con un toque cuando los necesitás y la agenda recuerda cuáles dejaste abiertos en ese dispositivo. Las listas largas muestran las primeras acciones y el botón **Ver más**.
## Qué ves de las acciones de otros
De las acciones de otros integrantes ves la fecha, el tipo, el estado y quién la hizo. El detalle (descripción, participantes, fotos) lo ves solo en las tuyas, en las que te etiquetaron y, si sos CED, en todas.
## Agendar desde la ficha
**Agendar acá** abre el formulario con la escuela ya elegida. No aparece cuando estás mirando la agenda de otra persona (solo lectura).` },
  { id: 'mis-escuelas', titulo: 'Mis escuelas', para: ['fed', 'ced'], md: () => `
Es el listado de las escuelas que tenés a cargo, con lo que pasa en cada una. Se abre desde el menú de las iniciales (**Mis escuelas**) o desde el acceso del Tablero; en el celular, **Volver** (arriba) te lleva a la pantalla de la que venías. El FED a cargo de cada escuela sale de la base de establecimientos: si falta una tuya o sobra una, avisale al CED.
## Qué ves
En las tarjetas, una por escuela, con su sigla, CUE, localidad y distrito, y de un vistazo: el **próximo cronograma**, los **reclamos de conectividad abiertos**, la **próxima acción** planificada y la **última visita**. Arriba se cuentan las escuelas, las que tienen cronograma y las que tienen un reclamo abierto.
## Buscar y filtrar
El **buscador** está arriba y es lo primero que ves. Escribí el nombre, la sigla, el CUE, la dirección o el nombre de un contacto (por ejemplo "EP 4", "ees 31" o "calle 12") y la lista se acorta mientras escribís; la **✕** del costado borra la búsqueda. Debajo podés filtrar por distrito y nivel, y quedarte con las que tienen cronograma o reclamo abierto (**Quitar filtros** los limpia, sin borrar lo que escribiste).
## Predio compartido
Las escuelas que comparten edificio con otras llevan la etiqueta **Comparte predio con N** (al apoyar el mouse o mantener apretado se ven sus nombres y CUE); en la ficha se listan y se abren con un toque.
## Lista o tarjetas
Con **Lista** ves una fila por escuela con la escuela, el **CUE**, la **dirección**, la **localidad**, el **distrito** y el **contacto** (nombre y cargo, teléfono y correo para llamar o escribir, y cuántos contactos más hay). En la computadora es una tabla y tocando el título de cada columna se **ordena**; en el celular cada escuela es una fila compacta. **Tarjetas** muestra el resumen de cada una (próximo cronograma, reclamos abiertos, próxima acción y última visita). La vista que elegís queda guardada en tu navegador.
## Excel
**Excel** descarga la lista tal como la estás viendo (con tu búsqueda, tus filtros y el orden), con las columnas Escuela, CUE, Dirección, Localidad, Distrito, Contacto, Cargo, Teléfono, Correo, Otros contactos, **Próximos cronogramas** (uno por renglón, con la ventana de fechas y el tipo), **Predio** y **Comparte predio con** (las demás escuelas del edificio, con su CUE): sirve para comparar con tu registro propio y ponerlo al día.
## La ficha completa
Al tocar una escuela se abre su ficha (ver **Buscador de escuelas**). Si la escuela es tuya, los bloques desplegables suman los **Reclamos** de esa escuela (con su estado y número) y, en **Cronogramas de conectividad**, el estado que anotó el equipo.
Desde la ficha también podés **agendar** una acción o **armar un reclamo** con la escuela ya elegida.
## Editar los datos de una escuela
Si la escuela es tuya (o sos del CED o de la administración), la ficha tiene el botón **Editar datos**, tanto en el buscador como en Mis escuelas. Se abre con tres solapas:
- **Datos:** ${CAMPOS_ESCUELA.filter(c => !c.avanzado).map(c => c.label.toLowerCase()).join(', ')}. Varones y mujeres no pueden sumar más que la matrícula. Latitud y longitud ubican la escuela en el mapa (ver **Mapa de la región**). Solo se guardan los datos que cambiaste. ${CAMPOS_ESCUELA.filter(c => c.avanzado).map(c => c.label.toLowerCase()).join(', ')} los cambian solo el CED y la administración.
- **Conectividad** (solo CED y administración): enlace, PNCE, PBA, piso tecnológico y ANI. El plan de enlace, el subplan y el plan de piso se eligen de una lista (de ahí sale el enlace que se usa al armar un reclamo); las fechas se eligen con el calendario y el ancho de banda lleva solo números.
- **Contactos:** agregar, editar, eliminar y marcar el **principal** (el que se muestra primero en las listas). Cada contacto tiene dos correos: el **institucional** (el de la escuela) y el **laboral** (el del directivo), que tiene que terminar en ${DOMINIO_LABORAL}.
- **Historial:** quién cambió cada dato, cuándo, y qué había antes, por si hay que volver atrás.
Los cambios se guardan al instante y no se avisa a nadie. Las escuelas sin FED asignado las edita solo el CED o la administración; las de otro FED las ves pero no las editás.
## Quién ve qué
Cada FED ve sus escuelas y, de ellas, todo el detalle. El CED y la administración ven todas las escuelas, con un filtro por FED a cargo (las que no tienen figuran como **${SIN_FED}**); la administración puede quedarse solo con las suyas. De una escuela de otro FED, el buscador (la lupa) muestra los datos y el historial, pero no los reclamos. La conectividad, los contactos y los próximos cronogramas de cualquier escuela los ven todos.` },
  { id: 'mapa', titulo: 'Mapa de la región', para: ['fed', 'ced'], md: () => `
Muestra en un mapa las escuelas y las jefaturas de Región 1. Se abre desde el menú de las iniciales (**Mapa**) o con **Ver en el mapa** en Mis escuelas; en el celular, **Volver** (arriba) te lleva a la pantalla de la que venías.
## Qué ves
Cada escuela es un punto (las tuyas, en magenta) y cada jefatura, un rombo violeta. Los círculos con un número son lugares muy cercanos agrupados: tocalos para acercar y se separan. Se arrastra con el dedo o el mouse y se acerca con el pellizco, la rueda, el doble toque o los botones **+** y **−**.
## Buscar y filtrar
El buscador de arriba encuentra una escuela por nombre, sigla, CUE o dirección y el mapa se queda solo con esas. Debajo podés filtrar por distrito y por FED a cargo (el FED entra viendo **Mis escuelas**; para ver las demás elegí **Todas las escuelas** o el nombre de otro FED, o **${SIN_FED}**) y mostrar u ocultar escuelas y jefaturas. **Quitar filtros** vuelve a como entraste.
## Un lugar elegido
Al tocar un punto aparece su tarjeta con el nombre, el CUE, la dirección, el FED a cargo y las escuelas que comparten su predio (tocá una para abrir su ficha), con **Ver ficha** (la ficha completa de la escuela o de la jefatura) y **Cómo llegar**, que abre el mapa del teléfono.
## Escuelas sin ubicación
Las escuelas que todavía no tienen ubicación en el mapa se listan debajo (**Sin ubicación en el mapa**). Abrí su ficha y, desde **Editar datos**, cargá la latitud y la longitud: el FED a cargo, el CED y la administración pueden. Podés pegar el par que da Google Maps (por ejemplo -34.92145, -57.95500) en la casilla de latitud y se completan las dos. Si el punto cae fuera de la región, la agenda no lo guarda.
## Jefaturas
La ficha de una jefatura muestra su domicilio, el contacto, el teléfono y el correo (para llamar o escribir) y su ubicación. La del distrito de cada escuela aparece también en la ficha de la escuela, en **Institución**. Las jefaturas las edita solo el CED o la administración.` },
  { id: 'reclamos', titulo: 'Reclamos de conectividad', para: ['fed', 'ced'], md: () => `
Arma el asunto y el cuerpo del mail de un reclamo de conectividad, con la lista de lo que hay que adjuntar, según la guía de la DTE. Se abre desde el menú de las iniciales (**Reclamo de conectividad**), desde la ficha de una escuela y desde una acción de **Conectividad** (con la escuela ya elegida).
## Cómo se arma
1. **Escuela:** la agenda muestra su enlace (PNCE o PBA y su grupo) y su piso tecnológico, que salen de la base de conectividad de la región.
2. **Tipo de reclamo:** los 15 de la guía, con su asunto (Sin Conectividad, Problemas con UTM o Switch, Mudanza, etc.). Cada uno pide solo los datos que corresponden.
3. **Contacto del directivo:** nombre, cargo (director/a, secretario/a…), teléfono y horario. Es obligatorio en "Sin Conectividad" y en los reclamos de enlaces PBA.
4. **Armar reclamo:** sale el asunto con el formato 06-01-DDMMAAAAHHMM - CUE XXXXXXXX - Asunto (con la fecha y la hora de ese momento), el cuerpo y los adjuntos. El mensaje va dirigido al CED, con el saludo según la hora y los datos del contacto uno por renglón. Podés copiar cada parte o abrir tu correo con todo cargado. Con **Cancelar** descartás el reclamo.
## Qué adjuntar según la infraestructura
| Caso | Qué se adjunta |
| PBA Grupo 2 o 2019, sin piso | Fotos del módem (o de la antena, si el problema es ahí) y contacto. |
| PBA Grupo 2 o 2019, con piso de PBA | Lo anterior y el checklist USAP. Con piso de PNCE alcanza con las fotos. |
| PBA Grupo 1 con Claro | Fotos del módem y contacto, por mail a ${RECLAMOS_PARA_CLARO}. |
| PBA Grupo 1 con Movistar | No es un mail: el establecimiento llama al ${TEL_MOVISTAR} con el ANI y el recurso primario, que la agenda muestra. |
| PNCE, sin piso | Checklist de Z3 (predio pequeño) y contacto. También puede llamar la escuela al ${TEL_EDUCAR} (Mesa de Ayuda Educar). |
| PNCE, con piso | Checklist USAP. |
Los demás tipos piden lo que indica la guía: formulario y plano (mudanza, solicitudes), medición y checklist (ancho de banda), denuncia e imágenes (daños o robo), etc.
[i] El mail va a ${RECLAMOS_PARA}: lo recibe el CED, que lo reenvía a la DTE (ella lo deriva a PBA o a Educar). Un mail por escuela y con el CUE de 8 dígitos. El botón abre Gmail con tu cuenta institucional; en el celular lo abre directo en la app de Gmail (con la cuenta que tengas activa ahí) y, si no la tenés instalada, en el navegador. Los archivos los adjuntás vos, la agenda no los envía.
[!] Si la escuela ya tiene un reclamo abierto, no abras una cadena nueva: respondé en la original, sin el "Fwd" antes del código. Si lo enviás más tarde, volvé a armar el reclamo para que el asunto lleve la hora correcta.` },
  { id: 'registro-reclamos', titulo: 'Registro de reclamos de conectividad', para: ['fed', 'ced'], md: () => `
Es el seguimiento de todos los reclamos de conectividad del equipo. Reemplaza la planilla manual. Se abre desde el menú de las iniciales (**Registro de reclamos**) o desde el acceso del Tablero; en el celular, **Volver** (arriba) te lleva a la pantalla de la que venías.
## Cómo se carga
1. Armás el reclamo (**Armar reclamo de conectividad**) y lo mandás por mail al CED.
2. Tocás **Reclamo enviado**: queda registrado con tu nombre, la escuela, el tipo de reclamo, el asunto y el tipo de conexión de la escuela. Al CED le llega una notificación de reclamo nuevo.
3. Cuando Nivel Central responde, el CED anota el **número de ticket (PBA) o de incidencia (Educar)** y, más tarde, marca el reclamo como **Resuelto**. Cada vez, el FED que lo envió recibe una notificación (al tocarla se abre el registro). Estos avisos, y el del reclamo nuevo para el CED, aparecen también como **banner** arriba de la pantalla, con **Ver registro** y **Entendido**; si llegan varios, se juntan en un solo banner.
## Estados
| Estado | Qué significa |
| Reclamo enviado | Lo mandaste al CED; todavía no llegó un número. |
| En proceso | Ya tiene número de ticket o de incidencia. |
| Resuelto | Se solucionó. |
| Anulado | Se registró por error o se dejó sin efecto. |
## Cronogramas de la misma escuela
En cada reclamo abierto, la agenda cruza la escuela con sus cronogramas de conectividad (ver **Cronogramas de conectividad**):
- **Cronograma próximo en la escuela:** si hay uno que todavía no terminó, se muestra con el tipo, las fechas y la empresa (y cuántos más hay). Puede ser lo que atienda el reclamo.
- **Hubo un cronograma posterior al reclamo:** si ya pasó uno que empezó después de enviado el reclamo, la agenda te pregunta si se resolvió, para que lo marques como **Resuelto** si ya funciona. No se cierra solo: el cronograma no dice a qué reclamo atendió.
El filtro **Cronogramas** deja solo los reclamos con cronograma próximo o con uno posterior. Solo se cruzan los cronogramas de tus escuelas (el CED ve todos) y los que no se hicieron o se reprogramaron no cuentan.
## Quién ve y quién edita
Todo el equipo ve los reclamos (por defecto, los tuyos), con filtros por estado, FED, tipo de conexión y búsqueda por CUE, escuela, número o nombre. Solo el CED los actualiza (números, estados y notas); la administración los ve en modo lectura. Una excepción: el **FED a cargo de la escuela** (o quien registró el reclamo) puede tocar **Marcar resuelto** en un reclamo abierto, con una nota opcional, porque muchas veces la escuela le avisa a él y no al CED. No cambia otros datos ni envía ningún aviso; en la tarjeta queda "lo marcó" con su nombre. Por defecto el filtro **Solo los míos y de mis escuelas** deja a la vista los reclamos que podés cerrar. El botón **Excel** descarga la lista tal como la estás viendo, con las mismas columnas de la planilla del CED.
[i] Al armar un reclamo de una escuela que ya tiene uno abierto, la agenda te avisa para que sigas esa cadena en lugar de abrir otra.` },

  { id: 'comunicados', titulo: 'Comunicados del CED', para: ['fed', 'ced'], md: () => `
Son avisos importantes que el CED (o la administración) manda al equipo. Aparecen como un **banner arriba de la agenda**, en cualquier pantalla, hasta que los marcás como leídos.
## Si sos FED
- El banner es **rojo** si el comunicado es **Importante** y **celeste** si es **Informativo**. Muestra el título y las primeras líneas; con **Ver completo** se lee entero (los enlaces se abren con un toque).
- No se cierra con una cruz: se cierra con **Leído**, y ahí queda anotado que lo leíste y a qué hora. Si hay más de uno sin leer, ves primero los importantes y el título indica cuántos más hay.
- Te llegan los dirigidos a **todos los FED** y los que se mandan solo a vos.
- Si el CED corrige el mensaje, el título o el nivel, el banner vuelve a aparecer para que lo leas de nuevo.
## Si sos CED o administración
Desde el menú de las iniciales, **Comunicados**:
- **Nuevo comunicado:** título (hasta ${MAX_TITULO_COMUNICADO} caracteres), mensaje (hasta ${MAX_TEXTO_COMUNICADO}, con enlaces si hace falta), nivel, **para quién** (todos los FED o los que elijas) y, si querés, una fecha de vencimiento: pasada esa fecha deja de mostrarse.
- **Quién lo leyó y cuándo:** cada comunicado indica cuántos lo leyeron (por ejemplo "5 de 7") y, al abrirlo, la lista de FED con la fecha y la hora de lectura o **Sin leer**.
- **Editar** y **Retirar:** editar el título, el mensaje o el nivel borra las lecturas (se pide leerlo de nuevo); cambiar solo los destinatarios o el vencimiento no. Al retirarlo deja de mostrarse, pero queda en la lista con sus lecturas.
- La coordinación no recibe los comunicados que se mandan a todos los FED.` },

  { id: 'cronogramas', titulo: 'Cronogramas de conectividad', para: ['fed', 'ced'], md: () => `
Son los cronogramas de conectividad (reparaciones e instalaciones de piso tecnológico y de enlace, certificaciones…), tanto de Educar como de PBA, que ya vienen establecidos por otro organismo, con su fecha y su empresa. La agenda no los programa ni puede cambiarles la fecha: los lee de la pestaña **Cronogramas** del consolidado de conectividad para que el equipo los tenga a mano, avise a las escuelas y anote cómo salieron. Se abre desde el menú de las iniciales (**Cronogramas**) o desde el acceso del Tablero; en el celular, **Volver** (arriba) te lleva a la pantalla de la que venías.
## Qué ves
Una tarjeta por cronograma y escuela (las marcas llevan color: **Escuela avisada** en celeste, **Jefatura avisada** en violeta y **Realizado**, **No se realizó** y **Reprogramado** en verde, rojo y amarillo): la ventana de fechas, el tipo, el proveedor, el N° del cronograma o de la incidencia, el FED a cargo de la escuela y el estado que figura en la planilla (sólo de referencia). Al tocarla se ven los instaladores (nombre y DNI o CUIL, o el enlace que figura en la planilla), la descripción y las observaciones de territorio. Cada FED ve los cronogramas de **sus escuelas**; el CED y la administración ven todos.
## Colores por tipo
Cada tipo de cronograma tiene su color, para reconocerlo de un vistazo (arriba de la lista hay una referencia): **Mantenimiento de piso** en azul petróleo, **Instalación** (de piso, SDWAN, de enlace y certificación) en turquesa, **Reparación de piso** en naranja, **Enlace** y **Certificación** en índigo, y **Asistencia técnica**, **Reubicación** u otros en gris. El mismo color se ve en la ficha de la escuela, en Mis escuelas y en el registro de reclamos. No tiene que ver con los colores de los estados (verde, rojo, amarillo) ni de los avisos.
## Reclamos de la escuela
Si la escuela tiene reclamos de conectividad abiertos, la tarjeta lo indica y, al abrirla, los lista con el tipo, el estado y el número. El filtro **Con reclamo abierto** deja solo esos cronogramas.
## Predio compartido
Si la escuela comparte predio con otras, la tarjeta lo dice debajo del nombre (**Comparte predio con…**, con su CUE), así ubicás más fácil de qué edificio se trata aunque la escuela no sea de las que visitás. El buscador de la sección también encuentra por el nombre o el CUE de esas escuelas.
## Cómo salió
Dentro de la tarjeta, **Cómo salió** permite anotar **Realizado**, **No se realizó** o **Reprogramado**. Lo anota el FED a cargo de la escuela o el CED. Para No se realizó y Reprogramado hay que escribir el motivo, y el CED recibe una notificación. El último estado anotado es el que cuenta (queda el historial) y no se modifica la planilla.
## Avisar a la escuela y a la jefatura
Cada visita tiene dos avisos, que se anotan dentro de la tarjeta (**Avisos**):
- **Jefatura distrital:** la avisa el CED (**Marcar avisada**). Cuando lo hace, el FED a cargo recibe una notificación: le falta avisar a la escuela.
- **Escuela:** la avisa el FED a cargo (o el CED). **Armar mensaje** prepara un texto informativo para el directivo, redactado como un mensaje de WhatsApp: abre con *Desde la Dirección de Tecnología Educativa informamos que…*, dice según qué cronograma (EDUCAR o PBA), cuándo (un día o entre dos fechas), qué empresa y qué tarea se hace en la escuela, y dice quién estará a cargo de la intervención (nombre con DNI o CUIL, o el enlace que figura en la planilla; el nombre se ordena y el DNI va sin puntos). Cierra pidiendo a la institución que esté al tanto y facilite el ingreso y el acceso a los espacios correspondientes. Si elegís un contacto con nombre, el saludo lo nombra; si no, es un saludo general. En las instalaciones de enlace o de equipo SD-WAN pide además tener accesible el rack, y aparece **Copiar recomendaciones**: un texto aparte con las aclaraciones de Conectividad (WAN 2 del UTM, filtrado, SD-WAN, conformidad del servicio) para mandarle a la escuela. Los cronogramas ya vienen establecidos por otro organismo, por eso el mensaje solo informa: no pide cambiar fechas. También muestra los **contactos de la escuela** (de la base de contactos) con teléfono para llamar y correo para elegir a quién escribirle. Se **copia** o se **abre en tu correo** (Gmail, con tu cuenta institucional). Cuando lo mandaste, tocá **Ya avisé a la escuela** (o **Marcar avisada** si avisaste por teléfono).
Cada aviso queda con quién y cuándo lo anotó. El filtro **Todo aviso** deja ver las visitas con la escuela sin avisar (y, para el CED, con la jefatura sin avisar), y arriba se cuentan las que faltan. Los datos de contacto los ven solo el FED a cargo de la escuela, el CED y la administración.
## Avisos automáticos
- Cuando aparecen cronogramas nuevos en la planilla, cada FED recibe **un solo aviso** con los de sus escuelas; el CED recibe un resumen (con cuántos quedaron sin FED asignado).
- El **día hábil anterior** al comienzo hay un recordatorio, también agrupado por FED y con resumen para el CED.
- Los avisos llegan a las notificaciones y, al tocarlos, abren esta sección.
## Programa, vigencia y puntos a tener en cuenta
Cada tarjeta indica si el cronograma es de **Educar** o de **PBA** (según cómo lo informa la planilla) y si es una **Reprogramación**. Al abrirla, **Para tener en cuenta** muestra la vigencia (la guía toma de ${VALIDEZ_DIAS[0]} a ${VALIDEZ_DIAS[1]} días desde las fechas indicadas), si la escuela funciona en **turno vespertino** (hace falta un contacto alternativo de 8 a 16 h) y si **comparte predio** con otra escuela (hay que avisar a los directivos de ambas).
## Guía para el CED
Quien cumple el rol de CED (y la administración) ve además, en cada tarjeta, los pasos de la guía como referencia: en PBA, informar los datos de contacto de los directivos al menos ${HORAS_CONTACTO_PBA} hs antes (se muestra la fecha límite); en Educar, el contacto es el CED; verificar el domicilio de la escuela; avisar al establecimiento; y completar el Estado en la planilla. La agenda **no gestiona** estos pasos ni modifica la planilla: es solo una referencia y una vista.
## Pestañas y filtros
**Próximos** (los que todavía no terminaron), **Pasados** y **Todos**. Se filtra por distrito, estado, tipo y proveedor, y se busca por CUE, escuela o número; el CED y la administración también filtran por FED a cargo. Si una escuela no tiene FED asignado, figura como **${SIN_FED}**. Arriba se cuentan los **pasados sin marcar**, para no dejar cronogramas sin cerrar.
## Cómo se actualiza
Se lee sola cada madrugada y se guardan los cronogramas que terminaron hasta ${DIAS_ATRAS} días atrás. La administración puede tocar **Sincronizar ahora**. Si un cronograma desaparece de la planilla, deja de mostrarse.
[i] Los tipos LAC_M, LAC y LAC_R se muestran como ${etiquetaTipo('LAC_M')}, ${etiquetaTipo('LAC')} y ${etiquetaTipo('LAC_R')}.` },

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
En **Reunión** podés elegir la modalidad (presencial, virtual o híbrida). Si es virtual o híbrida, se carga el enlace y desde la tarjeta se puede entrar con un toque. Podés pegar la dirección sola (con o sin https://) o todo el texto de la invitación: la agenda se queda con el enlace de la videollamada.
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
**En las prácticas (PEAT),** el grupo se identifica por la **escuela de origen** de los estudiantes, que es obligatoria: no lleva una sede propia, porque las prácticas se hacen en varios lugares. En cada encuentro elegís el lugar donde se hizo (el establecimiento del formulario).
## Registrar un encuentro
- El **número de encuentro** se asigna solo, a partir de los encuentros ya realizados del grupo (también cuentan los que marcaste como realizados sin completar sus datos); podés corregirlo. Si marcás como realizada una fecha en la que no hubo encuentro, el número de los siguientes se corre: pasala a cancelada.
- **Propuesta dictada:** en clubes viene "Club de Tecnología" y hay una lista corta para elegir otra (${PROPUESTAS_DE_CLUB.slice(1, 5).join(', ')}, entre otras) o escribir una propia. En PEAT es siempre "Prácticas Educativas en Ambientes de Trabajo".
- **Destinatarios:** se tilda entre el grado del club, ${DESTINATARIOS_BASE.join(', ')}, y se pueden sumar otros.
- **Inscriptos:** se cargan al iniciar y se mantienen hasta el cierre; el formulario los trae del primer encuentro. En cada encuentro cargás solo los **participantes reales** y una breve descripción de lo realizado.
- Si el encuentro fue en otra sede, se puede indicar. En un grupo de PEAT, que no tiene sede propia, siempre se elige el lugar del encuentro.
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
- **Por día:** según la fecha de captura registrada en la foto. La carpeta del día se nombra con la fecha y las escuelas de las acciones de esa jornada; los grupos de PEAT figuran solo con el curso y el grupo (por ejemplo, "7° Informática - Grupo 1"), igual que su subcarpeta.
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
## Accesos rápidos
Arriba del Tablero hay tres tarjetas con un número, para ver de un vistazo qué hay pendiente y entrar directo (siguen estando también en el menú de las iniciales):
- **Mis escuelas:** cuántas escuelas tenés a cargo y cuántas tienen un reclamo abierto.
- **Mis reclamos:** los reclamos abiertos de tus escuelas; abre el registro ya filtrado en **Solo los míos y de mis escuelas**.
- **Cronogramas:** los cronogramas próximos en tus escuelas.
El CED ve las mismas tarjetas con los números de todo el equipo. No dependen del período que elijas.
## Qué se computa
Solo las acciones **realizadas**. No se computan las planificadas, reprogramadas o canceladas, ni las licencias y paros. Cada número del resumen permite ver las acciones que lo componen.
[i] Las acciones de las que solo participás como acompañante no cuentan en tus métricas: cuentan para quien las creó.
## Mi informe del período
- **Panel plegable:** la flecha del título pliega el informe a una sola línea con lo principal (acciones realizadas, escuelas y encuentros); Excel y PDF quedan a la vista. La app recuerda cómo lo dejaste.
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
Lo que pide una acción tuya (aviso y recordatorio de PVE, PVE devuelta) aparece además como **banner** arriba de la pantalla, con **Ir a mis PVE** y **Entendido**, hasta que lo resolvés o lo cerrás. Lo mismo pasa con los avisos de reclamos de conectividad.
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
Vistas **Día** (franja horaria por FED), **Semana** y **Próximas**. **En territorio** muestra las acciones en escuelas: incluye siempre la oficina R1 (funciona en la EES 31, aunque la acción se cargue con la DTE como sede) y las reuniones presenciales que se hacen dentro de una escuela; no incluye la asistencia remota (siempre es virtual), las reuniones virtuales, con Jefatura o en la sede DTE, ni el resto de lo institucional. En una visita con varias etiquetas alcanza con que una cuente. **Todas las acciones** incluye las institucionales. Las ausencias figuran como **Lic.** o **Paro**.
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
Las novedades importantes se anuncian además con un banner celeste, con **Ver cómo**, que te lleva al tema de la ayuda; se va cuando lo cerrás con **Entendido** (en ese dispositivo) o a los pocos días. Las notificaciones llevan un color (rojo: urgente; amarillo: aviso; verde: confirmación; neutro: informativa). Lo que pide una acción tuya y los avisos de reclamos de conectividad (varios juntos, en un solo banner) aparecen además como banner arriba de la pantalla, hasta que los cerrás con **Entendido**.
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
