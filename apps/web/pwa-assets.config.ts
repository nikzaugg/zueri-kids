import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Icons for the PWA (REQ-WEB-077). Maskable and Apple icons get the app blue
// as background so the platform's mask never shows white edges.
const blue = { background: "#1f56cc" };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: blue },
    apple: { ...minimal2023Preset.apple, resizeOptions: blue },
  },
  images: ["public/icon.svg"],
});
