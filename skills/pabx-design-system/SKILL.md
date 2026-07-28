---
name: pabx-design-system
description: Fonte-da-verdade do design system do DRCALL PABX (Angular Material M3, aesthetic compacto/profissional). Use ao criar ou revisar qualquer UI do frontend — páginas, tabelas, dashboards, formulários, diálogos — para seguir tipografia, espaçamento, tokens de cor, padrões de página/tabela/dashboard e os anti-padrões proibidos. É também a base do gate styles-frontend e da verificação visual.
---

# PABX Design System

A fonte-da-verdade canônica do design system e das regras de Angular Material do DRCALL PABX
vive **dentro desta skill**, em:

**`references/angular-material.md`**

O documento viaja junto com a skill: ao (re)instalar a skill num projeto/branch, a pasta
`references/` é copiada junto, então a referência está sempre disponível — sem depender de
nenhum arquivo externo (IDE, `.cursor`, etc.). **Leia e edite direto em `references/angular-material.md`.**

## Quando usar

- Ao **criar ou reformular qualquer componente/tela** do `apps/frontend`: leia
  `references/angular-material.md` antes de escrever HTML/CSS e siga os padrões (page shell,
  `table-section`, `dash-card`, diálogos compactos, tokens `--mat-sys-*`/`--app-*`, convenção de
  botões `.btn-primary-green`/`.btn-secondary`, etc.).
- Ao **revisar UI**: confira o código contra a lista de anti-padrões do documento.
- Como **base do gate `styles-frontend`**: o subconjunto determinístico dessas regras (uso de
  `color=`, API `matButton`, `mat-paginator`, `.component.scss`, `!important` em tokens,
  `aria-label` em `mat-icon-button`, cor hardcoded) é verificado automaticamente sobre os arquivos
  alterados. As regras subjetivas/visuais (densidade, hierarquia, estética) **não** são gate —
  ficam como guia e são checadas via verificação visual (browser-MCP), conforme a seção
  "Visual Verification" do documento.
