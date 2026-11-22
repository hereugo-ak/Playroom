import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The storefront keeps its photos, audio and video in /assets and addresses them
// at runtime from JS template strings. Vite cannot see those URLs, so the build
// copies the folder verbatim into dist/assets. In dev, Vite serves the repo root
// directly, so the same relative paths resolve without any extra configuration.
function copyRuntimeAssets() {
  return {
    name: 'playrooom-copy-runtime-assets',
    apply: 'build',
    closeBundle() {
      const folders = [
        ['./assets', './dist/assets'],
        // GSAP / ScrollTrigger / Lenis are classic global scripts, not ES modules,
        // so Vite intentionally leaves their tags untouched. Ship them as-is.
        ['./js/vendor', './dist/js/vendor'],
      ];
      for (const [fromPath, toPath] of folders) {
        const from = fileURLToPath(new URL(fromPath, import.meta.url));
        const to = fileURLToPath(new URL(toPath, import.meta.url));
        if (existsSync(from)) cpSync(from, to, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  // Everything is served from the project root; there is no separate public dir.
  publicDir: false,
  plugins: [copyRuntimeAssets()],
  server: {
    port: 5173,
    // Hash routing needs no SPA fallback, but this keeps a direct /index.html
    // visit working in every browser.
    open: false,
  },
  preview: { port: 4173 },
  build: {
    outDir: 'dist',
    assetsDir: 'build',
    emptyOutDir: true,
  },
});
