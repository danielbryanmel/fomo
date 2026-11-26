# FOMO · guia do redesign das telas

O redesign mexe só no visual. A lógica, as rotas e as chamadas de dados continuam como estão.

**O que tem neste pacote**

- `telas/` tem 50 PNGs em 2x, numerados na ordem do app.
- `tema/fomo-tema.css` serve para web ou PWA.
- `tema/fomo-tema.ts` serve para React Native, Expo ou CSS-in-JS.
- O canvas com todas as telas lado a lado: https://claude.ai/artifact/WepAWD7s27MSpjtuGJ6V7L

## As 8 regras que mudam tudo

1. **Uma fonte só: Archivo.** Sai a fonte mono e saem os rótulos em CAIXA ALTA E ESPAÇADA ("FESTAS · GALPÃO 33"). Todo texto de apoio vira frase normal: "Festa · Galpão 33".
2. **Sem degradê.** O botão principal é magenta chapado `#E0338F` com **texto preto**. Saem também o brilho roxo de fundo e a lua 3D.
3. **Título de marca só em momentos de marca.** Caixa alta, larga e pesada (`.fomo-brand-title`) aparece no onboarding, no login, na tela 404 e no Minha noite. No resto do app, o título é frase normal em 900 (Feed, Quero ir, Mensagens).
4. **Termômetro com cor fixa.** Vazio `#4A4552`, Tranquilo `#8A3FFC`, Cheio `#E0338F`, Lotado `#D9FF42`. Use a mesma etiqueta (`.fomo-status--*`) no mapa, na lista, no feed, no story e nos grupos.
5. **Verde-limão significa "verdadeiro agora".** Vale para ao vivo, presença confirmada, "Você tá no local", credibilidade e "Cheguei bem em casa".
6. **Curtir é a meia-lua.** Ela fica vazada antes de curtir e magenta cheia depois. A nota (estrelas) também é magenta, não amarela.
7. **Selecionado é branco.** Chip ou opção marcada fica com fundo `#F4F1F6` e texto preto, no lugar da borda roxa. A exceção é a lotação marcada, que fica na cor do termômetro.
8. **Fotos reais.** Rolê, post, story e item salvo usam a foto do lugar. Não usar bolinhas ou degradê como imagem.

## Componentes

| Componente | Como fica |
|---|---|
| Botão principal | 54 px de altura, pílula, magenta, texto preto 800 |
| Botão secundário | Fundo `#1E1D22`, texto claro |
| Botão desabilitado | Fundo `#1E1D22`, texto `#6E6877` (nada de degradê apagado) |
| Campo | 54 px, fundo `#151417`, borda `#2A2930`. Com foco, a borda fica magenta. O rótulo vai **acima** em 15/800 e o contador à direita em 13 cinza |
| Card | Fundo `#151417`, raio 16, sem borda colorida |
| Lista (notificações, mensagens, configurações) | Linhas sem card individual. Quando agrupadas, ficam num card com divisórias |
| Barra inferior | Fixa, encostada embaixo, fundo do app e linha no topo. O "+" é um círculo magenta com ícone preto |
| Abas (Para você/Seguindo, perfil) | Texto com sublinhado branco de 2 px, no lugar de chips |
| Selo de nível | "Nv 5" em 11/700, cinza, com borda fina (no lugar do roxo) |

## O que mudou de conteúdo, para conferir

- **Lotação no "Contar como tá":** a escala passou a ser Vazio, Tranquilo, Cheio e Lotado, igual ao mapa. No app estava "Tranquilo, Animado, Cheio, Lotado".
- **Menu do +:** ganhou "Contar como tá agora" como primeira opção. Se não quiser, é só tirar.
- **Rolê futuro:** card novo de "amigos querem ir".
- **Avaliar:** chips novos de "O que pesou?".
- **Grupo confirmado:** a localização e o "Cheguei bem em casa" ficaram juntos na seção "Volta pra casa".
- **Perfil, aba Rolês:** passou a listar os lugares onde a pessoa foi.
- **Quero ir:** os convites ficam em cima. Embaixo vêm as abas "Rolês salvos" e "Publicações", com foto e status.

## Ordem sugerida para aplicar

1. Trocar as cores e a fonte globais pelo tema. Isso já resolve boa parte das telas.
2. Trocar os componentes base: botão, chip, campo, card, barra inferior e etiqueta de lotação.
3. Remover todos os rótulos em caixa alta espaçada e a fonte mono.
4. Ajustar tela por tela, comparando com os PNGs.
