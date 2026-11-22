// Roda antes do build na Vercel: sem as variáveis, o app cairia no modo demonstração
// local sem avisar — preferimos falhar o deploy com uma mensagem clara.
const need = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`\n✘ Faltam variáveis de ambiente: ${missing.join(', ')}\n  Vercel → Project → Settings → Environment Variables (veja docs/DEPLOY_WEB.md).\n`);
  process.exit(1);
}
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (/^sb_secret_/.test(key) || /service_role/.test(Buffer.from((key.split('.')[1] ?? ''), 'base64').toString())) {
  console.error('\n✘ A chave configurada é SECRETA (service_role/sb_secret). Use a chave publicável (sb_publishable_…).\n');
  process.exit(1);
}
console.log('✔ Variáveis de ambiente ok');
