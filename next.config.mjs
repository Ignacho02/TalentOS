/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuraciones experimentales para Server Actions
  experimental: {
    // Aumenta el límite de cuerpo para Server Actions (subida de fotos, etc.)
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  // Límite del body parser para cualquier API route (incluido el endpoint que guarda la foto)
  api: {
    bodyParser: {
      sizeLimit: '50mb', // permite hasta 50 MB por solicitud
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
