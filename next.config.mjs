// Cabeceras de seguridad para todas las rutas. No se define una política de contenido completa (script-src) porque exigiría páginas dinámicas con nonce;
// estas directivas no necesitan nonce y cierran el embebido en otros sitios, los formularios hacia otros dominios y los objetos incrustados.
const cabeceras = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: cabeceras }]
  },
}

export default nextConfig
