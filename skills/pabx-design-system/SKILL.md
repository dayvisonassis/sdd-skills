---
name: pabx-design-system
description: Ponteiro para a fonte-da-verdade do design system do DRCALL PABX (Angular Material M3, aesthetic compacto/profissional). Use ao criar ou revisar qualquer UI do frontend — páginas, tabelas, dashboards, formulários, diálogos — para seguir tipografia, espaçamento, tokens de cor, padrões de página/tabela/dashboard e os anti-padrões proibidos. É também a base do gate styles-frontend e da verificação visual.
---

# PABX Design System

A fonte-da-verdade canônica do design system e das regras de Angular Material do DRCALL PABX é o
documento **versionado** do projeto PABX (compartilhado com o time):

**`.cursor/rules/angular-material-20.mdc`**

> Esta skill é apenas um **atalho/ponteiro** para esse documento. O conteúdo **não** é copiado para
> cá (a pasta `.claude/skills/` costuma ser ignorada pelo git; e o doc é um ativo do projeto PABX,
> não da skill). Leia e edite direto no arquivo rastreado acima, para que a mudança chegue ao time.
> Se o projeto ainda não tiver esse arquivo, esta skill não tem o que apontar — a fonte precisa
> existir num caminho versionado do projeto.

## Quando usar

- Ao **criar ou reformular qualquer componente/tela** do `apps/frontend`: leia
  `.cursor/rules/angular-material-20.mdc` antes de escrever HTML/CSS e siga os padrões (page shell,
  `table-section`, `dash-card`, diálogos compactos, tokens `--mat-sys-*`/`--app-*`, convenção de
  botões `.btn-primary-green`/`.btn-secondary`, etc.).
- Ao **revisar UI**: confira o código contra a lista de anti-padrões do documento.
- Como **base do gate `styles-frontend`**: o subconjunto determinístico dessas regras (uso de
  `color=`, API `matButton`, `mat-paginator`, `.component.scss`, `!important` em tokens,
  `aria-label` em `mat-icon-button`, cor hardcoded) é verificado automaticamente sobre os arquivos
  alterados. As regras subjetivas/visuais (densidade, hierarquia, estética) **não** são gate —
  ficam como guia e são checadas via verificação visual (browser-MCP), conforme a seção
  "Visual Verification" do documento.
