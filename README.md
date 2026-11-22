# FOMO

Rede social de descoberta de eventos, experiências e nightlife. iOS, Android e Web com Expo (SDK 58) + Expo Router + TypeScript estrito.

## Rodando

**Windows:** dê dois cliques em `INICIAR.bat`. Ele instala o Node.js se faltar (via winget), instala as dependências na primeira vez e abre o app no navegador. O QR code no terminal abre no celular pelo app **Expo Go**.

Manual:
```bash
npm install
npx expo start               # i = iOS, a = Android, w = Web
```

Scripts: `npm run typecheck`, `npm run export:web`.

A partir da Fase 3 (mapa) o app precisa de **development build** (`npx expo run:ios|android` ou `eas build --profile development`) — Expo Go não basta para `react-native-maps` configurado com Google Maps.

## Documentação
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — estrutura, mapa de telas, dependências, plano por fases
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — tabelas, relacionamentos, RLS, Storage
- [docs/DECISIONS.md](docs/DECISIONS.md) — decisões de produto V2 e decisões técnicas

## Marca
Símbolo oficial (Identidade V4) em `src/components/brand/FomoMark.tsx`; ícones em `assets/`.

## Dados
- Sem `.env.local`: **modo demonstração** (dados fictícios em `src/mocks/data.ts`).
- Com `.env.local` (URL + publishable key do Supabase): dados reais, login por código no e-mail. Ver `supabase/README.md`.

## Design system
Em dev, Perfil → "Ver design system" abre a vitrine de tokens e componentes.

## Versão Web / PWA (beta gratuito)

Guia completo, limites do plano grátis e o que funciona na Web × nativo: [`docs/DEPLOY_WEB.md`](docs/DEPLOY_WEB.md).

```bash
npm run build:web   # confere variáveis e gera dist/ (o mesmo que a Vercel roda)
```

