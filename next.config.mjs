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
  // plyship.in only redirects here. Its home goes to plyship.com; any other path (old marketplace links,
  // e.g. plyship.in/lead/12) goes to the same page in the marketplace.
  async redirects() {
    return ['plyship.in', 'www.plyship.in'].flatMap((host) => {
      const has = [{ type: 'host', value: host }];
      return [
        { source: '/', has, destination: 'https://plyship.com/', permanent: true },
        { source: '/marketplace/:path*', has, destination: 'https://plyship.com/marketplace/:path*', permanent: true },
        { source: '/:path+', has, destination: 'https://plyship.com/marketplace/:path+', permanent: true },
      ];
    });
  },
  // Serve the investor pitch deck at /pitch (file lives in public/pitch.pdf)
  async rewrites() {
    return [{ source: '/pitch', destination: '/pitch.pdf' }];
  },
  // Keep the deck out of search results — it is for people we share the link with
  async headers() {
    const noIndex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
    return [
      { source: '/pitch', headers: noIndex },
      { source: '/pitch.pdf', headers: noIndex },
    ];
  },
};

export default nextConfig;
