// Novedades de la agenda, de la más reciente a la más antigua. Cada cambio visible para el equipo suma una entrada acá,
// en el mismo cambio que lo introduce (junto con su sección de la ayuda). La más nueva enciende el puntito del menú de Ayuda.
import type { Rol } from '@/lib/ayuda/temas'

export type Novedad = { fecha: string, titulo: string, texto: string, para?: Rol[] }

export const NOVEDADES: Novedad[] = [
  { fecha: '2026-10-02', titulo: 'Acciones acompañadas en tu informe', texto: 'Tu informe del período muestra aparte las acciones de otros integrantes en las que te etiquetaron y que se realizaron. No se suman a tus totales, no cuentan las que rechazaste y también salen en el Excel y el PDF.' },
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
