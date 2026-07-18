const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: false,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "firebase-firestore",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    {
      urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "firebase-auth",
        expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: "StaleWhileRevalidate",
      options: { cacheName: "google-fonts-stylesheets" },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-webfonts",
        expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: /\.(?:js|css)$/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "static-resources",
        expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
      },
    },
  ],
});

module.exports = withPWA({
  reactStrictMode: true,
  turbopack: {},
});
