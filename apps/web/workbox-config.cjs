// Workbox generates dist/sw.js after `astro build` (REQ-WEB-077).
module.exports = {
  globDirectory: process.env.OUT_DIR || "dist/",
  // bundle.json is precached: data changes only with a deploy (REQ-WEB-078).
  globPatterns: ["**/*.{html,js,css,svg,png,ico,webmanifest,json}"],
  swDest: `${process.env.OUT_DIR || "dist"}/sw.js`,
  // Day/week/search pages are called with ?date=… and filter params.
  ignoreURLParametersMatching: [/.*/],
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
      handler: "StaleWhileRevalidate",
      options: { cacheName: "fonts" },
    },
  ],
};
