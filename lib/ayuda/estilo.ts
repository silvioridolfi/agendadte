// Identidad visual de cada tema de la ayuda: familia de color e ícono (nombre de lucide-react). Cada familia usa los colores
// de la agenda (los de las etiquetas de acción), con texto de contraste AA sobre su fondo. Un tema sin entrada usa la familia azul.
import type { Rol } from '@/lib/ayuda/temas'

export type Familia = 'azul' | 'rosa' | 'violeta' | 'celeste' | 'amarillo' | 'lila'

// Clases completas (no se arman a pedazos) para que Tailwind las detecte.
export const FAMILIAS: Record<Familia, { fondo: string, texto: string, punto: string, borde: string, fondoSuave: string }> = {
  azul: { fondo: 'bg-accion-visita-tecnica', texto: 'text-accion-visita-tecnica-texto', punto: 'bg-accion-visita-tecnica-punto', borde: 'border-l-accion-visita-tecnica-punto', fondoSuave: 'bg-accion-visita-tecnica/40' },
  rosa: { fondo: 'bg-accion-practicas-profesionalizantes', texto: 'text-accion-practicas-profesionalizantes-texto', punto: 'bg-accion-practicas-profesionalizantes-punto', borde: 'border-l-accion-practicas-profesionalizantes-punto', fondoSuave: 'bg-accion-practicas-profesionalizantes/40' },
  violeta: { fondo: 'bg-club-violeta-fondo', texto: 'text-club-violeta', punto: 'bg-club-lila', borde: 'border-l-club-lila', fondoSuave: 'bg-club-violeta-fondo/50' },
  celeste: { fondo: 'bg-accion-asistencia-remota', texto: 'text-accion-asistencia-remota-texto', punto: 'bg-accion-asistencia-remota-punto', borde: 'border-l-accion-asistencia-remota-punto', fondoSuave: 'bg-accion-asistencia-remota/40' },
  amarillo: { fondo: 'bg-accion-reunion', texto: 'text-accion-reunion-texto', punto: 'bg-accion-reunion-punto', borde: 'border-l-accion-reunion-punto', fondoSuave: 'bg-accion-reunion/40' },
  lila: { fondo: 'bg-accion-visita-pedagogica', texto: 'text-accion-visita-pedagogica-texto', punto: 'bg-accion-visita-pedagogica-punto', borde: 'border-l-accion-visita-pedagogica-punto', fondoSuave: 'bg-accion-visita-pedagogica/40' },
}

export type Icono = 'llave' | 'usuario' | 'calendario' | 'nuevo' | 'estado' | 'licencia' | 'clubes' | 'fotos' | 'pve' | 'tablero' | 'campana' | 'pregunta' | 'rol' | 'indicadores' | 'equipo' | 'ausencias' | 'buscador' | 'conectividad'

export const ESTILO_TEMA: Record<string, { familia: Familia, icono: Icono }> = {
  intro: { familia: 'azul', icono: 'calendario' },
  ingreso: { familia: 'azul', icono: 'llave' },
  perfil: { familia: 'azul', icono: 'usuario' },
  agenda: { familia: 'azul', icono: 'calendario' },
  buscador: { familia: 'celeste', icono: 'buscador' },
  reclamos: { familia: 'violeta', icono: 'conectividad' },
  registro: { familia: 'rosa', icono: 'nuevo' },
  estado: { familia: 'rosa', icono: 'estado' },
  licencias: { familia: 'rosa', icono: 'licencia' },
  clubes: { familia: 'violeta', icono: 'clubes' },
  fotos: { familia: 'celeste', icono: 'fotos' },
  pve: { familia: 'celeste', icono: 'pve' },
  tablero: { familia: 'violeta', icono: 'tablero' },
  notificaciones: { familia: 'amarillo', icono: 'campana' },
  faq: { familia: 'lila', icono: 'pregunta' },
  'ced-rol': { familia: 'azul', icono: 'rol' },
  'ced-tablero': { familia: 'violeta', icono: 'tablero' },
  'ced-indicadores': { familia: 'rosa', icono: 'indicadores' },
  'ced-agenda': { familia: 'azul', icono: 'calendario' },
  'ced-fotos': { familia: 'celeste', icono: 'fotos' },
  'ced-pve': { familia: 'celeste', icono: 'pve' },
  'ced-ausencias': { familia: 'rosa', icono: 'ausencias' },
  'ced-notificaciones': { familia: 'amarillo', icono: 'campana' },
  'ced-faq': { familia: 'lila', icono: 'pregunta' },
}

// Accesos directos de la portada: lo más consultado de cada rol.
export const ATAJOS: Record<Rol, { id: string, texto: string }[]> = {
  fed: [
    { id: 'registro', texto: 'Registrar una acción' },
    { id: 'clubes', texto: 'Clubes y PEAT' },
    { id: 'fotos', texto: 'Fotos de las acciones' },
    { id: 'pve', texto: 'Planilla PVE' },
    { id: 'notificaciones', texto: 'Notificaciones' },
  ],
  ced: [
    { id: 'ced-tablero', texto: 'Tablero del equipo' },
    { id: 'ced-indicadores', texto: 'Indicadores' },
    { id: 'ced-pve', texto: 'PVE del equipo' },
    { id: 'ced-fotos', texto: 'Fotos del equipo' },
    { id: 'ced-notificaciones', texto: 'Avisos' },
  ],
}
