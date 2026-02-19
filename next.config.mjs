/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove console.log in production builds (keep error/warn)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
  // Optimize images from Firebase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  // Tree-shake large packages — only import what's used
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default nextConfig;
