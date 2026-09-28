// Hora oficial de la app: Argentina (America/Argentina/Buenos_Aires), sin importar la zona del dispositivo ni del servidor.
export const ZONA = 'America/Argentina/Buenos_Aires'

// Fecha de hoy en Argentina como AAAA-MM-DD.
export const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA })
// Hora actual en Argentina como HH:MM.
export const horaAR = () => new Date().toLocaleTimeString('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
// Hoy en Argentina como Date al mediodía local (para el calendario: evita corrimientos de día).
export const fechaHoyAR = () => { const [y, m, d] = hoyAR().split('-').map(Number); return new Date(y, m - 1, d, 12) }
export const anioAR = () => Number(hoyAR().slice(0, 4))
