/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permitir body grande para uploads de archivos
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
