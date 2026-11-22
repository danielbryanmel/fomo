# FOMO — Decisões

## Decisões oficiais de produto — Social V2 (definitivas)

| Tema | Decisão | Onde é garantida |
|---|---|---|
| Feed | Misto: **Para você** (relevância, atualidade, interesses, localização autorizada, qualidade) e **Seguindo**. Popularidade ≠ credibilidade. Sem algoritmo opaco nem só curtidas. | RPC de feed com pesos configuráveis e documentados (DATA_MODEL.md) |
| Privacidade | Perfis **públicos por padrão**; opção privada com aprovação de seguidores. Conteúdo, histórico e dados pessoais respeitam a configuração. Nunca expor localização em tempo real ou histórico privado. | `follows.status`, helpers `can_view_*` nas políticas RLS |
| Check-in | Opcional. Três estados: sem declaração / **declarada** / **confirmada**. Declarada nunca aparece como comprovada. Sem GPS contínuo. Visibilidade por check-in. | `check_ins.status` só vira `verified` via RPC do servidor |
| Reputação | Indicadores separados: **popularidade**, **experiência**, **credibilidade**. Credibilidade calculada no backend por regras documentadas. | Colunas sem permissão de escrita para o cliente; `credibility_snapshots` |
| Gamificação | 7 níveis (Novato → Lenda do FOMO), XP e conquistas por contribuição legítima, anti-farming, configurável. | `xp_rules`, `level_definitions`, unique no ledger |
| Regra geral | Toda visibilidade/autorização aplicada no backend (RLS), não só na UI. | Testes de RLS na Fase 5 |

## Contratos de tipo definidos pelo produto
- `UserProfile` e `CheckIn` adotados **literalmente** em `src/types/domain.ts`.
- Acréscimos (sem alterar os contratos): `ViewerRelationship` (relação calculada pelo backend), `PresenceState` (`none | declared | verified`), `CredibilityBreakdown`.

## Decisões técnicas (Fase 1)

1. **Expo SDK 58 + Expo Router com `src/app`** — padrão atual do template; React Navigation vem embutido no `expo-router`.
2. **Símbolo oficial (Identidade V4)** — "O olhar que escapa": círculo r=50 com recorte de centro (70.4, 29.4) e r=27.3 (viewBox 100). Medido na prancha com erro < 3% (só antialias). Variantes: `gradient` (plano), `glass` (com brilho, para ícone/hero), `white`, `black`. Se existir o vetor original, substituir o path por ele.
3. **Cores da marca** amostradas da prancha: rosa `#E8368C`, magenta `#B93AC6`, roxo `#8A36E8`, brilho `#FBE6F5`. Gradiente do símbolo é aproximação do raster.
4. **Gradiente só em 3 lugares**: símbolo, botão primário e barra de progresso de nível.
5. **Tipografia nativa** (SF/Roboto/system-ui) — sem fontes customizadas.
6. **Reanimated adiado para a Fase 3**, junto do bottom sheet e mapa; skeleton usa `Animated` nativo.
7. **Perfil privado continua descobrível** (nome, @, avatar, nível e contadores visíveis); conteúdo e histórico ficam fechados. ✅ Aprovado pelo produto.
8. **Visibilidade padrão de check-in = `followers`**. ✅ Aprovado pelo produto.

## Decisões técnicas (Fase 2)

9. **Repositórios com interface + mock que espelha a RLS** — a UI já é construída contra as regras reais de visibilidade.
10. **Capas geradas (CoverArt)** em vez de fotos no mock — nenhuma foto de lugar real é inventada; foto real entra via `coverUrl`.
11. **Presença nunca confundida**: `PresenceBadge` mostra "Presença confirmada" (selo) ou "Disse que esteve" (neutro); sem check-in, nada.
12. **Menus e confirmações próprios (`ActionSheet`)** — mesmo comportamento em iOS, Android e Web.
13. **"Para você" mock** = 0,5·recência + 0,35·credibilidade do autor + 0,15·engajamento (log, limitado). Pesos irão para tabela de configuração.
14. **Instalação de pacotes**: no ambiente de build sem acesso à API da Expo, versões vêm de `expo/bundledNativeModules.json`. No PC, `INICIAR.bat` roda `npx expo install --check` para confirmar.

## Fase 3 — redesign v2 e mapa

15. **Tese "termômetro da noite"** (do vídeo de conceito): o Explorar passa a responder "onde tá bom agora" com lotação/vibe/fila relatadas por quem está lá, válidas por 90 min, exibidas só com ≥ 3 relatos.
16. **Relato em 3 toques** (lotação, vibe, fila; música opcional). Exige leitura **única** de localização ≤ 200 m — coerente com a decisão V2 (sem rastreamento). Coordenadas não são armazenadas. Relatos são anônimos no agregado.
17. **Escala de calor dentro da marca** (roxo → magenta → rosa → rosa incandescente) e sempre com segmentos + texto. O verde-limão do vídeo ficou restrito a "AO VIVO" e "+XP".
18. **Micro-rótulos mono** (fonte mono do sistema) com mínimo de 11 pt — no vídeo estavam ilegíveis.
19. **5 destinos mantidos** em tab bar flutuante com + central (o vídeo tinha 3, mas Feed e Salvos são escopo).
20. **"94% precisão" do vídeo = credibilidade**; "Embaixador" não vira nível novo — mantidos os 7 níveis oficiais.
21. **Wordmark "fomo"** do vídeo reproduzido com fonte do sistema até chegar o vetor oficial (`FomoLockup`).
22. **Patrocinado não sobe na ordenação do mapa** — só é rotulado (monetização sem manipular descoberta).
23. **Mapa Web esquemático** (sem tiles): a prévia/artifact não pode carregar imagens externas e o requisito pede fallback sem módulos nativos.
24. **iOS usa Apple Maps** (sem chave). Google Maps no Android; chaves só via env em `app.config.js`.

## Fase 5 — backend + fotos

25. **Login por código de 6 dígitos no e-mail** (sem senha, sem link que abre navegador). Social login (Apple/Google) fica para depois — Apple exige conta de desenvolvedor.
26. **Sessão em `expo-sqlite/localStorage`** (recomendação atual do guia Expo + Supabase) e chave **publicável**.
27. **Fotos privadas por padrão no Storage** (bucket `post-media` privado + URLs assinadas de 1 h), porque posts podem ser "só seguidores".
28. **Fotos reduzidas no aparelho** (lado maior 1440 px, JPEG 80%) e **sem EXIF** — evita vazar localização embutida na foto.
29. **Até 10 fotos por post**; carrossel com proporção entre 4:5 e 1.91:1; toque duplo curte.
30. **XP de post só com foto ou texto ≥ 40 caracteres**, com cooldown de 10 min e teto diário — impede farming com posts vazios.
31. **Modo demonstração automático** sem `.env` (prévia, testes de UI); com `.env`, o app exige login e @username.
