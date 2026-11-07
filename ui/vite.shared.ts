import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const fixtureRoot = fileURLToPath(new URL('../.work/ui-fixtures/art', import.meta.url));
function esc(s: string) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)); }
function fixtureSvg(kind: string, slug: string) {
  const label = esc(slug.replace(/-/g, ' ').toUpperCase());
  const hue = [...slug].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  if (kind === 'minimap') return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#10131b"/><g stroke="#2a2f3d" stroke-width="2">${Array.from({ length: 16 }, (_, i) => `<path d="M${i * 64} 0V1024M0 ${i * 64}H1024"/>`).join('')}</g><g fill="#1d212c" stroke="#3a4152" stroke-width="3"><path d="M180 160h260v220H180z"/><path d="M600 120h250v260H600z"/><path d="M340 520h330v300H340z"/><path d="M120 600h160v220H120z"/><path d="M720 560h180v260H720z"/></g><g fill="#8b91a3" font-family="sans-serif" font-size="42" font-weight="700"><text x="280" y="285">A</text><text x="705" y="270">B</text><text x="480" y="690">MID</text></g><text x="40" y="980" fill="#5b6272" font-family="sans-serif" font-size="28">${label} · synthetic fixture</text></svg>`;
  if (kind === 'media') return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="hsl(${hue} 35% 18%)"/><stop offset="1" stop-color="#0e1015"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><path d="M0 650L400 420l420 140 420-260 360 180v420H0z" fill="#0e1015" opacity=".55"/><circle cx="1180" cy="270" r="46" fill="#ece8e1" opacity=".75"/><rect x="760" y="410" width="80" height="80" fill="none" stroke="#3ddc97" stroke-width="4"/><text x="60" y="110" fill="#ece8e1" font-family="sans-serif" font-size="64" font-weight="700">${label}</text><text x="60" y="170" fill="#8b91a3" font-family="sans-serif" font-size="28">Synthetic capture fixture — not Riot art</text></svg>`;
  if (kind === 'agent') return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="hsl(${hue} 30% 16%)"/><circle cx="128" cy="92" r="46" fill="hsl(${hue} 40% 42%)"/><path d="M48 236c10-62 42-92 80-92s70 30 80 92z" fill="hsl(${hue} 40% 34%)"/><text x="128" y="222" text-anchor="middle" fill="#ece8e1" font-family="sans-serif" font-size="28" font-weight="700">${label.slice(0, 2)}</text></svg>`;
  if (kind === 'ability' || kind === 'role') return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="8" fill="#1d212c"/><path d="M64 18l46 46-46 46-46-46z" fill="none" stroke="hsl(${hue} 65% 60%)" stroke-width="6"/><text x="64" y="76" text-anchor="middle" fill="#ece8e1" font-family="sans-serif" font-size="34" font-weight="700">${label.slice(0, 1)}</text></svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="288" viewBox="0 0 512 288"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="hsl(${hue} 40% 22%)"/><stop offset="1" stop-color="#0e1015"/></linearGradient></defs><rect width="512" height="288" fill="url(#g)"/><path d="M0 220l140-90 120 50 150-100 102 60v148H0z" fill="#0e1015" opacity=".5"/><text x="24" y="52" fill="#ece8e1" font-family="sans-serif" font-size="34" font-weight="700">${label}</text></svg>`;
}
function fixtureArtPlugin() {
  return {
    name: 'lineuplab-fixture-art',
    configureServer(server: { middlewares: { use(fn: (req: { url?: string }, res: { setHeader(k: string, v: string): void; end(b: string | Buffer): void }, next: () => void) => void): void } }) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (url.startsWith('/fixture-art/')) {
          const [, , kind, rawSlug] = url.split('/');
          const slug = decodeURIComponent(rawSlug ?? '').split('?')[0];
          for (const ext of ['png', 'webp', 'jpg']) {
            const file = path.join(fixtureRoot, `${slug}.${ext}`);
            if (existsSync(file)) { res.setHeader('Content-Type', `image/${ext === 'jpg' ? 'jpeg' : ext}`); res.setHeader('Cache-Control', 'public, max-age=3600'); res.end(readFileSync(file)); return; }
          }
          res.setHeader('Content-Type', 'image/svg+xml'); res.end(fixtureSvg(kind, slug)); return;
        }
        if (url.startsWith('/fixture-media/')) {
          const slug = decodeURIComponent(url.split('/')[2] ?? 'capture').split('?')[0];
          res.setHeader('Content-Type', 'image/svg+xml'); res.end(fixtureSvg('media', slug)); return;
        }
        next();
      });
    },
  };
}
export const sharedConfig = {
  plugins: [react(), tailwindcss(), fixtureArtPlugin()],
  resolve: { alias: { '@ui': fileURLToPath(new URL('./src', import.meta.url)), '@data': fileURLToPath(new URL('../core/data', import.meta.url)) } },
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'], proxy: { '/api': 'http://127.0.0.1:8765', '/media': 'http://127.0.0.1:8765', '/art': 'http://127.0.0.1:8765' } },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 900 },
};
