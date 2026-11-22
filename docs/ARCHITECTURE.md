# FOMO — Arquitetura

> Status: **Fases 1, 2, 3 e 5 concluídas** + publicação de fotos. Banco testado localmente (76 testes); falta aplicar num projeto Supabase real. Próxima: Fase 6 (cadastro de eventos com moderação, comentários, reputação completa) e Fase 4 restante (edição de perfil, privacidade).

## 1. Inspeção inicial

| Item | Resultado |
|---|---|
| Projeto existente | Nenhum — criado do zero com `create-expo-app` (template `blank-typescript`) |
| SDK Expo | **58** (`expo ~58.0.26`, React Native 0.88.1, React 19.3, TypeScript 6.0) |
| Roteamento | Expo Router 58 (React Navigation vem embutido no `expo-router`: importar `Stack`, `Tabs`, `ThemeProvider`, `DarkTheme` de `expo-router`) |
| Imagem oficial da marca | Recebida (Identidade V4 — prancha 04). Geometria medida e aplicada em `FomoMark`; referência em `assets/brand/` |

## 2. Estrutura de pastas

```
src/
  app/                    # SOMENTE rotas (Expo Router). Telas finas, sem regra de negócio.
    _layout.tsx           # Stack raiz, tema escuro, safe area
    (tabs)/_layout.tsx    # 5 abas: Explorar, Feed, Publicar, Salvos, Perfil
    (tabs)/index.tsx      # Explorar
    (tabs)/feed.tsx | publish.tsx | saved.tsx | profile.tsx
    design-system.tsx     # vitrine de tokens (apenas __DEV__)
    +not-found.tsx
  components/
    brand/                # FomoMark (único ponto de entrada do símbolo)
    ui/                   # Text, Button, Card, Chip, Screen, ScreenHeader, Skeleton, StateView, ProgressBar
    <feature>/            # (fases seguintes) map/, feed/, profile/, post/
  features/               # (fase 3+) hooks + services por domínio: explore, feed, profile, posts, reputation
  repositories/           # (fase 5) acesso ao Supabase; mapeia snake_case ⇄ camelCase
  lib/                    # (fase 5) supabase client, validação (zod), erros
  config/                 # env.ts, levels.ts (cópia de exibição; fonte = backend)
  theme/                  # tokens.ts — fonte única de design
  types/                  # domain.ts — tipos de domínio
supabase/migrations/      # (fase 5) migrations SQL versionadas
docs/                     # ARCHITECTURE, DATA_MODEL, DECISIONS
```

Fluxo de dados: `Tela → hook (features/*, hooks/*) → repositories (interface) → mock | Supabase`. Telas nunca chamam o Supabase direto.

Fase 2 — o que existe:
- `src/repositories/types.ts`: contratos (EventsRepository, PostsRepository, ProfilesRepository).
- `src/repositories/mock/`: implementação mock que **espelha as regras de RLS** (perfil privado, visibilidade `followers`, eventos pendentes/encerrados ocultos). Troca para Supabase em `src/repositories/index.ts`.
- `src/mocks/data.ts`: dados fictícios (usuários, eventos, posts, check-ins declarados e confirmados).
- `src/hooks/useAsync.ts`, `usePaginated.ts`: loading, erro, refresh e paginação por cursor.
- Componentes de domínio: `PostCard`, `PresenceBadge` (none/declared/verified), `EventCard`, `CoverArt`, `ProfileHeader` (3 sinais separados), `LevelBadge`.
- UI: `ActionSheet` (menus/confirmação sem `window.confirm`), `Toast`, `SegmentedTabs`, `Avatar`, `IconButton`.
- Onboarding de 4 passos com flag em AsyncStorage.

Fase 3 — o que existe:
- `components/map/ExploreMap.tsx` (nativo, react-native-maps: Apple Maps escuro no iOS, Google Maps com estilo escuro no Android) e `ExploreMap.web.tsx` (mapa esquemático com coordenadas reais, sem tiles externos). Metro escolhe o arquivo por plataforma; o bundle Web não contém react-native-maps.
- `features/explore/`: `useExploreMap` (região visível → consulta por bounding box com debounce), `FilterSheet` (quando, distância, preço), `PlacePicker` (perto de mim ou bairro).
- `features/location/useLocation`: permissão só sob demanda, leitura pontual, bairro como fallback persistido.
- Termômetro ao vivo: `components/live/*` (HeatMeter, CrowdPill, LiveEventRow, LiveStatusCard, NightChart, StatTile), `config/live.ts`, `repositories/mock/live.ts`, tela `app/report/[id].tsx`.
- Navegação: `FloatingTabBar` (pílula com blur + botão central), via `expo-router/js-tabs`.
- Bottom sheet: `@gorhom/bottom-sheet` 5.2.14 sobre gesture-handler 3.3 (interop com a API legada; validar em aparelho).

Fase 5 + fotos — o que existe:
- `supabase/` — migrations, seed, jobs, testes (ver `supabase/README.md`).
- `lib/supabase/client.ts` — cliente com sessão em `expo-sqlite/localStorage` (nativo) / `localStorage` (Web).
- `features/auth/AuthProvider` + `app/(auth)/login` (código por e-mail) e `app/(auth)/username`.
- `repositories/supabase/` — implementação real; `repositories/index.ts` escolhe Supabase quando o `.env` existe, senão mock.
- Fotos: `features/compose/photos.ts` (galeria/câmera, redução para 1440 px, JPEG 80%, sem EXIF/GPS), `app/compose.tsx`, `PhotoCarousel` (toque duplo curte), `PostGrid` (perfil em grade 3 colunas). Upload: `post-media/{user}/{post}/…` → RPC `create_post` atômica; se falhar, remove as fotos enviadas.

Prévia Web em arquivo único: `npm run preview:build` → `dist-preview/index.html` (usa `FOMO_PREVIEW=1` em `app.config.js` para desligar rotas assíncronas).

Arquivos por plataforma: componentes com módulo nativo terão par `X.native.tsx` / `X.web.tsx` (ex.: `ExploreMap.native.tsx` com `react-native-maps`, `ExploreMap.web.tsx` com lista + mapa estático/fallback). A Web nunca importa módulo nativo.

## 3. Mapa de telas

| Rota | Tela | Fase |
|---|---|---|
| `/(tabs)/` | Explorar — mapa, filtros (categoria/data/distância/preço), busca, bottom sheet do evento | 3 |
| `/(tabs)/feed` | Feed — abas Para você / Seguindo, paginação | 4 |
| `/(tabs)/publish` | Escolha: **Rolê vivido** vs **Evento futuro** | 6 |
| `/(tabs)/saved` | Eventos e posts salvos (privado) | 4 |
| `/(tabs)/profile` | Meu perfil — abas Publicações / Rolês / Avaliações, sinais separados | 4 |
| `/event/[id]` | Detalhe do evento — fotos, organizador, preço, ingresso, rota externa, avaliações, posts | 3–4 |
| `/post/[id]` | Detalhe do post + comentários | 4 |
| `/u/[username]` | Perfil público de outro usuário (seguir, solicitar, bloquear, denunciar) | 4 |
| `/profile/edit`, `/settings/privacy` | Edição e privacidade (perfil privado, visibilidade padrão de check-ins) | 4–5 |
| `/reputation` | "Como calculamos sua credibilidade" + níveis e conquistas | 6 |
| `/follow-requests` | Aprovar/recusar seguidores (perfil privado) | 5 |
| `/notifications` | Notificações | 5 |
| `/(auth)/*` | Login, cadastro, escolha de @username | 5 |
| `/onboarding` | 4 passos: descoberta, feed, perfil, localização (pedido contextual) | 2/5 |

## 4. Dependências

| Pacote | Versão (SDK 58) | Status |
|---|---|---|
| expo-router, react-native-screens, react-native-safe-area-context, expo-linking, expo-constants | 58.x / 4.30 / 5.11 | ✅ instalado |
| react-native-web, react-dom | 0.21.4 / 19.3.0 | ✅ |
| react-native-svg | 15.16.0 | ✅ (símbolo, gradientes) |
| lucide-react-native | 1.77 | ✅ |
| expo-image, expo-blur | 58.0.x | ✅ (uso a partir da fase 3) |
| react-native-reanimated + react-native-worklets | 4.7.1 / 0.13.0 | ✅ |
| react-native-gesture-handler, @gorhom/bottom-sheet | ~3.3.0 / 5.2.14 | ✅ (validar gestos em aparelho) |
| react-native-maps, expo-location, expo-haptics | 1.29.11 / ~58.0.22 / ~58.0.8 | ✅ — funcionam no Expo Go; chaves Google só em build de loja |
| @supabase/supabase-js, expo-sqlite, async-storage | 2.119.2 / ~58.0.18 / 2.2.0 | ✅ |
| expo-image-picker, expo-image-manipulator, expo-crypto | ~58.0.10 / ~58.0.16 / ~58.0.8 | ✅ |
| zod | — | Fase 5 (validação compartilhada) |

> As versões nativas vêm de `expo/bundledNativeModules.json` (mesma tabela que o `npx expo install` usa). No seu ambiente, prefira `npx expo install <pkg>`.

## 5. Plano de execução

| Fase | Entrega | Critério de pronto |
|---|---|---|
| 1. Fundação e identidade ✅ | Projeto, Expo Router, tokens, componentes base, 5 abas, tipos, docs | `tsc` limpo; bundles Web/iOS/Android exportam |
| 2. Navegação e telas ✅ | Rotas de detalhe, onboarding, estados de loading/erro/vazio em todas as telas | Navegação completa com dados estáticos |
| 3. Mapa com mock ✅ | `ExploreMap.native/.web`, pins, filtros, bottom sheet, permissão contextual, consulta por bounding box (mock) | Dev build iOS/Android rodando; Web com fallback |
| 4. Feed e perfis (mock) | Cards de post, abas do feed/perfil, sinais separados, privacidade na UI | Paginação mock; skeletons |
| 5. Backend e auth ✅ (aguardando projeto Supabase) | Migrations, RLS em todas as tabelas, Storage, auth, repositories | Testes de RLS (pgTAP) passando |
| 6. Publicação e reputação | Fluxos de post/evento/check-in, XP e credibilidade em funções SQL, moderação | Regras validadas só no servidor |
| 7. Testes e produção | Jest/RNTL, E2E (Maestro), EAS build, revisão de segurança | Builds verificados — só então discutir "production-ready" |
