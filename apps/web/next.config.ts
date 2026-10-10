import type { NextConfig } from "next";
import path from "node:path";
import withPWA from "@ducanh2912/next-pwa";
import {
  isCacheableInternalApi,
  isCacheableUpstreamApi,
  isUserScopedRequest,
} from "./worker/routing";

const baseConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@sorolens/ui", "@sorolens/xdr"],
};

export default withPWA({
  dest: "public",
  // Disable in development unless explicitly opted in; always on in production
  disable:
    process.env.NEXT_PUBLIC_PWA_ENABLED !== "true" &&
    process.env.NODE_ENV !== "production",
  // Automatically inject and activate the service worker
  register: true,
  reloadOnOnline: true,
  workboxOptions: {
    runtimeCaching: [
      {
        // Issue #615: User-scoped routes or requests with identity headers must NEVER
        // be cached across users in the shared browser Cache Storage.
        urlPattern: isUserScopedRequest,
        handler: "NetworkOnly",
      },
      {
        // Stale-while-revalidate for public Next.js API routes (/api/*)
        urlPattern: isCacheableInternalApi,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "sorolens-api-cache",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 5 * 60, // 5 minutes
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // Stale-while-revalidate for public upstream Go API (NEXT_PUBLIC_API_URL)
        urlPattern: isCacheableUpstreamApi,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "sorolens-upstream-api-cache",
          expiration: {
            maxEntries: 400,
            maxAgeSeconds: 5 * 60,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
})(baseConfig);
