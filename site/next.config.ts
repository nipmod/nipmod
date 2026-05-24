import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = dirname(projectRoot);
const tracingRoot = projectRoot.startsWith("/vercel/") ? projectRoot : workspaceRoot;
const isDevelopment = process.env.NODE_ENV === "development";
const scriptSrc = isDevelopment ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'";
const connectSrc = isDevelopment
  ? "connect-src 'self' https: ws: wss:"
  : "connect-src 'self' https://node.nipmod.com https://nipmod-witness.fly.dev";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  connectSrc
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
          {
            key: "Content-Security-Policy",
            value: csp
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          }
        ],
        source: "/(.*)"
      },
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          }
        ],
        source: "/releases/:path*"
      }
    ];
  },
  async rewrites() {
    return [
      {
        destination: "/install.sh",
        source: "/i"
      }
    ];
  },
  async redirects() {
    return [
      {
        destination: "/api-access",
        permanent: false,
        source: "/launch"
      },
      {
        destination: "/api-access",
        permanent: false,
        source: "/launch-kit"
      },
      {
        destination: "/examples",
        permanent: false,
        source: "/demo"
      },
      {
        destination: "/sources",
        permanent: false,
        source: "/platforms"
      },
      {
        destination: "/mcp",
        permanent: false,
        source: "/cursor"
      },
      {
        destination: "/status",
        permanent: false,
        source: "/proof"
      },
      {
        destination: "/packages",
        permanent: false,
        source: "/package"
      },
      {
        destination: "/agents/mcp-hosts",
        permanent: true,
        source: "/agents/codex-claude"
      }
    ];
  },
  outputFileTracingRoot: tracingRoot,
  reactStrictMode: true
};

export default nextConfig;
