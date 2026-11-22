# Banco do FOMO (Supabase)

```
migrations/
  20261122000100_core_schema.sql   tabelas, constraints, índices
  20261122000200_functions.sql     helpers de visibilidade, triggers, XP, RPCs (mapa, feed, relato, post)
  20261122000300_rls.sql           RLS em todas as tabelas + privilégios por coluna
  20261122000400_storage.sql       buckets de fotos + políticas
seed.sql                           categorias, níveis, regras de XP, config ao vivo, conquistas
jobs.sql                           agendamentos (pg_cron) — rodar depois de habilitar a extensão
tests/run.mjs                      76 testes de segurança/regras (Postgres em memória)
```

## Testar localmente (sem conta)

```bash
cd supabase/tests && npm install && npm test
```

## Colocar no ar

**Opção A — automática:** conecte o conector Supabase no Claude e peça para aplicar. Ele cria o projeto, roda migrations + seed e preenche o `.env.local`.

**Opção B — manual (≈10 min):**
1. Crie um projeto em supabase.com (região São Paulo).
2. SQL Editor → cole e rode, na ordem, os 4 arquivos de `migrations/` e depois `seed.sql`.
3. Database → Extensions → habilite `pg_cron` → rode `jobs.sql`.
4. Authentication → Providers → Email: ligado. Em *Email Templates → Magic Link*, inclua o código: `Seu código FOMO: {{ .Token }}` (o app entra com código de 6 dígitos, sem senha).
5. Project Settings → API Keys → copie a **URL** e a **Publishable key** para `.env.local`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```
6. Reinicie o app (`INICIAR.bat`). Sem essas variáveis, o app segue em modo demonstração.

**Nunca** coloque a *secret key* (service_role) no app.

## Moderação
Para tornar alguém moderador (aprovar eventos, tratar denúncias): `update profiles set is_moderator = true where username = '...';` no SQL Editor.
