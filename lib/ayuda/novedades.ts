// Novedades de la agenda, de la más reciente a la más antigua. Cada cambio visible para el equipo suma una entrada acá,
// en el mismo cambio que lo introduce (junto con su sección de la ayuda). La más nueva enciende el puntito del menú de Ayuda.
import type { Rol } from '@/lib/ayuda/temas'

export type Novedad = { fecha: string, titulo: string, texto: string, para?: Rol[] }

export const NOVEDADES: Novedad[] = [
  { fecha: '2026-10-02', titulo: 'PEAT en la agenda: solo curso y grupo', texto: 'Las tarjetas de los grupos de prácticas muestran solo el curso y el grupo (por ejemplo, 7° Informática - Grupo 1), sin la escuela del encuentro. El detalle de la acción sigue indicando dónde fue.', para: ['fed'] },
  { fecha: '2026-10-02', titulo: 'Los grupos de PEAT se identifican por su escuela de origen', texto: 'Un grupo de prácticas ya no queda atado a una sede: se muestra con la escuela de origen de los estudiantes y cada encuentro lleva el lugar donde se hizo. Al crear un grupo nuevo, la escuela de origen es obligatoria.', para: ['fed'] },
  { fecha: '2026-10-02', titulo: 'Informe del período más compacto', texto: 'Los indicadores del informe ocupan menos lugar y el panel se puede plegar con la flecha del título: queda una línea con lo principal y los botones de Excel y PDF a la vista. La app recuerda cómo lo dejaste.' },
  { fecha: '2026-10-02', titulo: 'La cámara solo marca las acciones con fotos', texto: 'Si todas las fotos del día ya quedaron asignadas a otras acciones por horario, las acciones sin fotos dejan de mostrar la cámara. Solo la muestran si quedaron fotos del día sin asignar.', para: ['fed'] },
  { fecha: '2026-10-02', titulo: 'Acceso al sitio DTE Región 1', texto: 'En el menú de las iniciales sumamos Sitio DTE Región 1: abre el sitio de la Dirección en una pestaña nueva, con tu cuenta institucional.' },
  { fecha: '2026-10-01', titulo: 'Buscador de escuelas', texto: 'Con la lupa de arriba buscás cualquier escuela por nombre, sigla o CUE y ves su ficha: datos en tarjetas de color, próximas acciones, clubes y prácticas, y el historial de lo que se hizo ahí. Desde la ficha podés agendar una acción con la escuela ya elegida.' },
  { fecha: '2026-10-01', titulo: 'Más movimiento, siempre suave', texto: 'Los números del tablero suben hasta su valor, las barras crecen, el banner de avisos se desliza al aparecer, la campanita se sacude una vez cuando llega algo nuevo y las pantallas que cargan muestran un brillo suave. Con "reducir movimiento" activado en tu dispositivo, todo aparece quieto.' },
  { fecha: '2026-10-01', titulo: 'Acciones acompañadas en tu informe', texto: 'Tu informe del período muestra aparte las acciones de otros integrantes en las que te etiquetaron y que se realizaron. No se suman a tus totales, no cuentan las que rechazaste y también salen en el Excel y el PDF.' },
  { fecha: '2026-10-01', titulo: 'Los paros se registran como realizados', texto: 'Al agendar un día como Paro queda directamente como realizado, aunque la fecha todavía no haya llegado. Igual podés editarlo. Además, el banner de avisos ahora ocupa menos lugar en el celular.' },
  { fecha: '2026-10-01', titulo: 'Una agenda que se mueve con suavidad', texto: 'Las pantallas y las listas entran con un fundido corto, al marcar una acción como realizada se dibuja una tilde, lo que acabás de guardar se destaca un instante y los desplegables abren y cierran sin saltos. Si tenés activado "reducir movimiento" en tu dispositivo, no se anima nada.' },
  { fecha: '2026-10-01', titulo: 'Ayuda dentro de la agenda', texto: 'Desde el menú de las iniciales › Ayuda encontrás el manual completo, con buscador, siempre al día con la versión de la agenda. Acá mismo vas a ver cada novedad.' },
  { fecha: '2026-10-01', titulo: 'Avisos con color y banner', texto: 'Las notificaciones se distinguen por color (rojo: urgente, amarillo: aviso, verde: confirmación). Lo que pide una acción tuya, como la PVE, aparece además como banner arriba de la pantalla.' },
  { fecha: '2026-10-01', titulo: 'Cargar acciones pasadas no avisa a tus compañeros', texto: 'Al etiquetar o modificar acciones de fechas anteriores a hoy ya no se envía notificación: podés cargar todo junto a fin de mes sin molestar.' },
  { fecha: '2026-10-01', titulo: 'Clubes y talleres más ágiles', texto: 'Propuesta y destinatarios se eligen de una lista, los inscriptos se precargan con los del primer encuentro, el número de encuentro se calcula con los realizados y, al completar los datos de un encuentro, ya no se pregunta por "este y los siguientes".' },
  { fecha: '2026-10-01', titulo: 'Prácticas por curso', texto: 'Si un curso se dividió en grupos, cargá cada grupo en el campo Grupo: en las métricas de prácticas cuenta como un solo curso.', para: ['fed'] },
  { fecha: '2026-10-01', titulo: 'Agenda del equipo: "En territorio"', texto: 'La oficina R1 y las reuniones presenciales dentro de una escuela ahora cuentan como en territorio.', para: ['ced'] },
]

export const ultimaNovedad = (rol: Rol): string | null => NOVEDADES.find(n => !n.para || n.para.includes(rol))?.fecha ?? null
