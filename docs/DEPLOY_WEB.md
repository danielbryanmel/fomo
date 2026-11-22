# FOMO na Web (PWA) — publicação gratuita

Custo: **R$ 0**. Vercel (plano Hobby, domínio `*.vercel.app`) + Supabase (plano Free).
Nada aqui exige cartão, domínio próprio ou loja de apps.

## O que funciona na Web × o que depende do app nativo

| Recurso | Web (navegador / PWA) | Observação |
|---|---|---|
| Conta, perfil, seguir, solicitações, bloqueio | ✅ | Supabase real |
| Feed "Para você" / "Seguindo", curtir, salvar, comentar | ✅ | Supabase real |
| Publicar fotos (galeria ou câmera) | ✅ | iPhone/Android abrem o seletor do sistema |
| Rolês, avaliações, sugerir rolê, moderação | ✅ | Supabase real |
| Notificações dentro do app (tempo real) | ✅ | Realtime do Supabase |
| Mapa | ✅ mapa real | Leaflet + OpenStreetMap (gratuito, sem chave). Nativo usa Apple/Google Maps |
| "Tô aqui · informar" (relato ao vivo) | ✅ | Usa a localização do navegador UMA vez; exige HTTPS (a Vercel já dá) |
| Instalar na tela inicial | ✅ | Android: menu ⋮ → "Instalar app". iPhone: Safari → Compartilhar → "Adicionar à Tela de Início" |
| Vibração ao tocar (haptics) | ❌ | Só nativo; na Web é ignorado sem erro |
| Notificação push com o app fechado | ❌ | Não implementado em nenhuma plataforma ainda |
| Funcionar 100% offline | ⚠️ parcial | Abre a "casca" offline; dados precisam de internet |

## Limites do plano gratuito (o que observar)

- **Supabase Free**: projeto pausa após ~7 dias sem uso (reativar no painel, sem custo); 500 MB de banco e 1 GB de arquivos. As fotos demo vêm dentro do app e não gastam Storage. Fotos enviadas são comprimidas (~1080 px) antes do upload.
- **E-mail**: o SMTP embutido do Supabase **só entrega para e-mails do seu time** — por isso o beta usa **e-mail + senha com "Confirm email" desligado** (nenhum e-mail é enviado). Antes de abrir ao público: SMTP próprio (ex.: Brevo/Resend no plano grátis), religar a confirmação e trocar `EXPO_PUBLIC_AUTH_MODE` para `otp`.
- **Mapa (OpenStreetMap)**: uso leve é permitido com atribuição (já exibida). Para muitos usuários, trocar a URL de tiles por um provedor com cota grátis maior.
- **Vercel Hobby**: uso pessoal/não comercial. Se virar negócio, rever.

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Nome | Valor | Secreto? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Não (público) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | Não (público por design; a segurança é a RLS) |
| `EXPO_PUBLIC_AUTH_MODE` | `password` | Não |

**Nunca** use a `secret`/`service_role` key — o build recusa (`scripts/check-env.mjs`).

## Supabase — 2 ajustes no painel (uma vez)

1. **Authentication → Sign In / Providers → Email**: desligar **Confirm email** → Save.
2. **Authentication → URL Configuration → Site URL**: colar o link da Vercel.

## Conteúdo de demonstração

`supabase/demo.sql` (já aplicado no projeto): 8 perfis `*.demo`, 11 rolês em locais fictícios
(6 sempre "ao vivo", renovados a cada hora por `pg_cron`), 8 publicações e avaliações. Tudo aparece
com selo **DEMO**. Para remover antes de abrir ao público: `select public.demo_purge();`

## Publicar (GitHub → Vercel)

1. GitHub: criar repositório **privado** vazio `fomo` e enviar esta pasta (ver README).
2. vercel.com → **Sign up with GitHub** (plano Hobby) → **Add New… → Project** → importar `fomo`.
3. A Vercel lê `vercel.json` (build e pasta `dist`). Em **Environment Variables**, colar as 3 variáveis acima.
4. **Deploy**. O link fica como `https://fomo-<algo>.vercel.app`.
5. Cada `git push` na `main` publica uma nova versão automaticamente.
