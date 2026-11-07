// Dev-only verification fixtures. Downloads real ability/minimap art into .work
// (ignored, never bundled). Missing art is served as synthetic SVG by Vite.
import { mkdir, writeFile, copyFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root = new URL('../.work/ui-fixtures/', import.meta.url);
const art = new URL('art/', root);
await mkdir(art, { recursive: true });
async function exists(p) { try { await access(p); return true; } catch { return false; } }
const cache = new URL('./download/', root); await mkdir(cache, { recursive: true });
async function extract(repo, ref, tarName, pick) {
  const tar = new URL(tarName, cache);
  if (!(await exists(tar))) {
    execFileSync('curl', ['-fsSL', `https://codeload.github.com/${repo}/tar.gz/refs/heads/${ref}`, '-o', tar.pathname]);
  }
  const dir = new URL(repo.split('/')[1] + '/', cache);
  await mkdir(dir, { recursive: true });
  execFileSync('tar', ['-xzf', tar.pathname, '-C', dir.pathname, '--strip-components=1']);
  await pick(dir);
}
try {
  await extract('leopengpong/valolineups', 'main', 'valolineups.tar.gz', async dir => {
    const src = new URL('public/agent-abilities/', dir);
    const { readdir } = await import('node:fs/promises');
    for (const f of await readdir(src)) if (f.endsWith('.png')) await copyFile(new URL(f, src), new URL(f, art));
  });
} catch (e) { console.warn('Ability fixture download failed; synthetic fallbacks will be used:', e.message); }
try {
  await extract('hahhen/hackathonvalorant', 'master', 'hackathonvalorant.tar.gz', async dir => {
    const p = new URL('public/assets/minimaps/abyss.png', dir);
    if (await exists(p)) await copyFile(p, new URL('abyss.png', art));
  });
} catch (e) { console.warn('Minimap fixture download failed; synthetic fallback will be used:', e.message); }
await writeFile(new URL('README.txt', root), 'Ignored dev verification art. Not part of the app bundle.\n');
console.log('UI fixtures ready at', root.pathname);
