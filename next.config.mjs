/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuraciones experimentales para Server Actions
  experimental: {
    // Aumenta el límite de cuerpo para Server Actions (subida de fotos, etc.)
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  // Configuración de imágenes, permite carga desde dominios externos si es necesario
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
