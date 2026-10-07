// Una pestaña abierta con una versión vieja de la agenda, después de publicar una nueva, pide acciones del servidor que ya no existen.
export const esVersionVieja = (mensaje: string) => /Server Action .*was not found|Failed to find Server Action/i.test(mensaje)
