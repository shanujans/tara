import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const vitalsEndpoint = process.env.VITALS_ENDPOINT;
    if (!vitalsEndpoint) return [];
    return [
      { source: '/_sys/vitals', destination: vitalsEndpoint, basePath: false },
    ];
  },
  async headers() {
    return [
      {
        // Strict security on everything EXCEPT /widget
        // Negative lookahead excludes the widget iframe route
        source: '/((?!widget).*)',
        headers: [
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',       value: 'camera=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://api.aimlapi.com https://mcp.kapruka.com wss://generativelanguage.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "frame-src 'self' https://www.kapruka.com https://kapruka.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      {
        // /widget — embeddable from ANY origin (Chrome extension + /embed-demo iframe)
        source: '/widget',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          // NO X-Frame-Options here — its absence allows framing
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://tara-green.vercel.app https://api.aimlapi.com https://mcp.kapruka.com wss://generativelanguage.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "frame-ancestors *",
            ].join('; '),
          },
        ],
      },
      {
        // API routes — open CORS so Chrome extension on kapruka.com can call them
        source: '/api/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};

export default nextConfig;
