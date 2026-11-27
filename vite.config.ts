import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
      // Produces a 100% self-contained single-file dist/index.html (HTML5 + CSS3 + JS)
      // ready for local offline use and GitHub Pages without external JS/CSS chunk requests.
      {
        name: 'inline-single-file-html',
        apply: 'build',
        enforce: 'post',
        closeBundle(error?: Error): void {
          if (error) return;
          const distDir = path.resolve(__dirname, 'dist');
          const htmlPath = path.join(distDir, 'index.html');
          if (!fs.existsSync(htmlPath)) return;

          let html = fs.readFileSync(htmlPath, 'utf8');
          const filesToDelete: string[] = [];

          // Inline <link rel="stylesheet" ... href="...">
          html = html.replace(
            /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi,
            (fullTag, href: string) => {
              if (/^https?:\/\//i.test(href)) return fullTag;
              const relPath = href.replace(/^\.?\//, '');
              const absPath = path.join(distDir, relPath);
              if (!fs.existsSync(absPath)) return fullTag;
              const css = fs.readFileSync(absPath, 'utf8');
              filesToDelete.push(absPath);
              return `<style>${css}</style>`;
            }
          );

          // Inline <script type="module" ... src="..."></script>
          html = html.replace(
            /<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*><\/script>/gi,
            (fullTag, src: string) => {
              if (/^https?:\/\//i.test(src)) return fullTag;
              const relPath = src.replace(/^\.?\//, '');
              const absPath = path.join(distDir, relPath);
              if (!fs.existsSync(absPath)) return fullTag;
              const js = fs
                .readFileSync(absPath, 'utf8')
                .replace(/<\/script>/gi, '<\\/script>');
              filesToDelete.push(absPath);
              return `<script type="module">${js}</script>`;
            }
          );

          fs.writeFileSync(htmlPath, html, 'utf8');

          // Clean up inlined bundle files so dist/index.html is truly standalone
          for (const f of filesToDelete) {
            if (fs.existsSync(f)) {
              fs.unlinkSync(f);
            }
          }
        },
      },
    ],
    build: {
      cssCodeSplit: false,
      assetsInlineLimit: 100_000_000,
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
