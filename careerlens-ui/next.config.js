/** @type {import('next').NextConfig} */
const API_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:8000';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
