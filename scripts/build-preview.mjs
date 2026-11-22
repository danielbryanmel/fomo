#!/usr/bin/env node
/**
 * Gera dist-preview/index.html: build Web do FOMO em UM arquivo HTML auto-contido
 * (JS inline, sem requisições externas) para visualização como artifact.
 *   npm run preview:build
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const out = '.preview-export';
rmSync(out, { recursive: true, force: true });
execSync(`npx expo export --platform web --output-dir ${out} --clear`, {
  stdio: 'inherit',
  // prévia pública SEMPRE em modo demonstração: ignora .env.local (sem dados reais)
  env: { ...process.env, FOMO_PREVIEW: '1', CI: '1', EXPO_NO_DOTENV: '1', EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', EXPO_PUBLIC_SUPABASE_ANON_KEY: '' },
});

let html = readFileSync(join(out, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)];
if (scripts.length === 0) throw new Error('Nenhum script encontrado no export.');

let inline = '';
for (const [, src] of scripts) {
  const code = readFileSync(join(out, src), 'utf8')
    .replace(/<\/script/gi, '<\\/script')
    // assets (ícones de navegação) embutidos como data URI — a prévia não faz requisições
    .replace(/"(\/assets\/[^"]+\.(png|jpg|jpeg|gif))"/g, (m, path, ext) => {
      if (!existsSync(join(out, path))) return m;
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      return JSON.stringify(`data:image/${mime};base64,${readFileSync(join(out, path)).toString('base64')}`);
    });
  inline += `<script>${code}</script>`;
}
html = html.replace(/<script src="[^"]+" defer><\/script>/g, '');
html = html.replace(/<link rel="icon"[^>]*\/>/, '');
// O router lê location.pathname: começa sempre na raiz dentro da prévia.
const boot = `<script>try{if(location.pathname!=='/')history.replaceState(null,'','/')}catch(e){}</script>`;
html = html.replace('</head>', `<style>html,body{background:#0A0A0C}@media (min-width:600px){#root{max-width:430px;margin:0 auto;border-left:1px solid #2C2C2E;border-right:1px solid #2C2C2E}}</style>${boot}</head>`);
html = html.replace('</body>', () => `${inline}</body>`); // função: evita interpretar $& $' do bundle
html = html.replace('<html lang="en">', '<html lang="pt-BR">');

mkdirSync('dist-preview', { recursive: true });
writeFileSync('dist-preview/index.html', html);
rmSync(out, { recursive: true, force: true });
console.log(`dist-preview/index.html — ${(html.length / 1024 / 1024).toFixed(2)} MB`);
