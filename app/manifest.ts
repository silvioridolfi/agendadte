import type { MetadataRoute } from 'next'

// App instalable en el celular (pantalla de inicio) con uso básico sin conexión.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Agenda Territorial · Equipo FED',
    short_name: 'Agenda FED',
    description: 'Agenda de trabajo territorial para Facilitadores de Educación Digital (DTE · Región 1).',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f4f5f9',
    theme_color: '#05476e',
    lang: 'es-AR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
