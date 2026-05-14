/** @type {import('next').NextConfig} */

// In Docker: API_URL=http://gateway:8080
// In local dev: falls back to http://localhost:8080
const API_URL = process.env.API_URL ?? 'http://localhost:8080'

const nextConfig = {
  output: 'standalone', // CRITICAL: Tells Next.js to create the standalone folder for Docker
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '8080' },
      { protocol: 'http', hostname: 'gateway', port: '8080' },
    ],
  },
}

export default nextConfig