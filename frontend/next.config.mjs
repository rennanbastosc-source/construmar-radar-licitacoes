/** @type {import('next').NextConfig} */
const rawBackend = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').trim().replace(/\/+$/, '');
const backendUrl = rawBackend.startsWith('http') ? rawBackend : `https://${rawBackend}`;

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/licitacoes/:path*',
        destination: `${backendUrl}/api/licitacoes/:path*`,
      },
      {
        source: '/health',
        destination: `${backendUrl}/health`,
      },
    ];
  },
};

export default nextConfig;
