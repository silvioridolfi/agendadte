import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Encode_Sans } from 'next/font/google'
import './globals.css'
import { RegistrarPWA } from '@/components/app/pwa'

const encodeSans = Encode_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-encode-sans' })

export const metadata: Metadata = {
  title: 'Agenda Territorial · Equipo FED',
  description: 'Agenda de trabajo territorial para Facilitadores de Educación Digital.',
  applicationName: 'Agenda FED',
  appleWebApp: { capable: true, title: 'Agenda FED', statusBarStyle: 'default' },
  // Favicon: app/icon.png (perfil de la Provincia). Íconos grandes para instalar la app.
  icons: {
    icon: [{ url: '/icon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#05476e',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={encodeSans.variable}>
      <body className="font-sans antialiased">
        {children}
        <RegistrarPWA />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
