// Workbox generates dist/sw.js after `astro build` (REQ-WEB-077).
module.exports = {
  globDirectory: process.env.OUT_DIR || "dist/",
  globPatterns: ["**/*.{html,js,css,svg,png,ico,webmanifest}"],
  swDest: `${process.env.OUT_DIR || "dist"}/sw.js`,
  // Day/week/search pages are called with ?date=… and filter params.
  ignoreURLParametersMatching: [/.*/],
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      // REQ-WEB-078: fresh data when online, cached copy when offline.
      urlPattern: ({ url }) => url.pathname.endsWith("/bundle.json"),
      handler: "NetworkFirst",
      options: { cacheName: "bundle", networkTimeoutSeconds: 4 },
    },
    {
      urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
      handler: "StaleWhileRevalidate",
      options: { cacheName: "fonts" },
    },
  ],
};
