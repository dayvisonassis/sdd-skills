# Output skeletons

Loaded on demand by `qa-preflight` in phase 4. Three artifacts, fixed shape.

The **file contents are written in Portuguese** — the reader is the QA team, not the agent.
Headings, column names and status values are copied from here verbatim; renaming a column
breaks the CSV import and the team's habit at the same time.

---

## 1. The plan — `docs/qa/QA-<FEATURE>.md`

Section order is fixed. A section with nothing to say is written with one line saying so,
never dropped — its absence would read as "not considered".

```markdown
# QA — <Feature>

> **Público:** QA. Nenhum conhecimento de código é necessário.
> **Gerado por:** qa-preflight em <data> · feature <ID> · branch <branch>

## 1. Escopo e não-escopo

O que esta validação cobre, e — explicitamente — o que ela não cobre e por quê.

## 2. Pré-requisitos

| Item | Valor |
|---|---|
| Tela | <nome + caminho> |
| Perfil de acesso | <conta e papel> |
| Permissão exigida | <permissão> |
| Dados necessários | <o que precisa existir no ambiente> |

⚠️ **Valide sempre no TEMA ESCURO primeiro, e só depois no claro.** Não é preferência
estética: há pessoa com fotossensibilidade acompanhando as sessões. Ao terminar o tema
claro, volte a tela para o escuro.

## 3. Vocabulário da feature

Termo → o que significa. Só os termos que o QA não tem como adivinhar.

## 4. Ordem de execução por risco

Os blocos na ordem em que devem ser atacados, com uma linha dizendo por que cada um está
onde está.

## 5. Limites conhecidos — não reportar como defeito

O que é comportamento decidido e vai parecer defeito. Cada item com o motivo.

## 6. O que a skill já verificou

O que foi exercitado automaticamente e com que resultado, para revisão em vez de repetição.
O que a skill **não conseguiu** exercitar aparece aqui nomeado — e na matriz com
`Verificado por = ninguém`.

## 7. Matriz de casos

<a matriz, um bloco por área>
```

---

## 2. The matrix

Ten columns, this exact order:

```markdown
| ID | Prioridade | Funcionalidade | Cenário | Resultado Esperado | Resultado Obtido | Status | Severidade | Verificado por | Observações |
|---|---|---|---|---|---|---|---|---|---|
```

**Who fills what:**

| Filled by `qa-preflight` | Left empty for the QA |
|---|---|
| ID, Prioridade, Funcionalidade, Cenário, Resultado Esperado, Verificado por | Status, Severidade, Observações |
| Resultado Obtido **only when the skill executed the case** | Resultado Obtido when it did not |

**`Status` stays empty even for cases the skill executed.** The verdict belongs to the QA; a
pre-filled status invites rubber-stamping. The filled `Resultado Obtido` is what lets them
review instead of repeat.

**Values:**

- `Prioridade`: `Crítica` · `Alta` · `Média` · `Baixa` — by risk (probability × impact)
- `Status` (QA): `Passou` · `Falhou` · `Bloqueado` · `Não executado`
- `Severidade` (QA): `Crítica` · `Alta` · `Média` · `Baixa` · `Cosmética`
- `Verificado por`: `gate` · `teste automatizado` · `browser` · `ninguém`
- `Observações`: mandatory when `Status = Bloqueado` — the blocking reason

**IDs:** `CT-<AREA>-<NNN>` with the area as a full word. Functional blocks take the
feature's own area names (`CT-AGENTES`, `CT-DATAS`, `CT-FILA`…). The four cross-cutting axes
always use the reserved names: `CT-ACESSIBILIDADE`, `CT-PERMISSOES`, `CT-FALHA`,
`CT-FRONTEIRA`.

**Two example rows** — the first executed by the skill, the second left for the human:

```markdown
| CT-AGENTES-001 | Alta | Agentes | Abrir a janela de seleção com 2 agentes na fila TESTE | As duas listas aparecem, "não inseridos" com os 2 agentes | As duas listas apareceram com os 2 agentes | | | browser | |
| CT-PERMISSOES-003 | Crítica | Permissões | Entrar como usuário de um tenant só e abrir o painel | O botão "Resolver" aparece desabilitado, com o motivo no tooltip | | | | ninguém | |
```

---

## 3. The CSV — `docs/qa/QA-<FEATURE>.csv`

Same ten columns, same order, comma-separated, every field quoted. This is the file that
imports as a database; a pasted markdown table loses the column types.

```csv
"ID","Prioridade","Funcionalidade","Cenário","Resultado Esperado","Resultado Obtido","Status","Severidade","Verificado por","Observações"
"CT-AGENTES-001","Alta","Agentes","Abrir a janela de seleção com 2 agentes na fila TESTE","As duas listas aparecem, ""não inseridos"" com os 2 agentes","As duas listas apareceram com os 2 agentes","","","browser",""
```

Escape a quote inside a field by doubling it, as above. Never emit a raw line break inside a
field — rewrite the sentence instead.

---

## 4. The findings — `docs/qa/ACHADOS-<FEATURE>.md`

```markdown
# Achados — <Feature>

> **Gerado por:** qa-preflight em <data> · feature <ID>
> **Resumo:** <N> corrigidos · <N> escalados · <N> guardas propostas

## 1. Corrigidos

| Caso | O que estava errado | Correção | Commit |
|---|---|---|---|
| CT-ACESSIBILIDADE-002 | Badge "Ativo" a 4.15:1 no tema claro (piso 4.5) | Token de texto trocado e re-medido: 4.68:1 | `abc1234` |

Cada linha corrigida foi **re-executada** depois da correção — o valor na coluna "Correção"
é o medido depois, não o esperado.

## 2. Escalados

| Caso | O que foi observado | Por que precisa de humano |
|---|---|---|
| CT-FRONTEIRA-004 | Data inicial maior que a final gera relatório vazio, sem mensagem | A spec não diz se deve bloquear ou avisar — decisão de produto |

## 3. Guardas permanentes propostas

Uma por achado, para o defeito não voltar sem ninguém perceber.

### CT-ACESSIBILIDADE-002 — asserção de contraste

<a asserção pronta para colar na suíte visual, ou a regra de gate, ou o teste que faltava>

**Onde entra:** <suíte visual | regra do gate de estilos | teste unitário/integração>
**Estado:** proposta — só é escrita automaticamente quando o gate visual está ligado.
```

---

## Refusals

Phase 4 refuses its own output — and does not write the files — when any of these is true:

- an acceptance criterion of the feature has **no case**
- a case has **more than one** expected result
- a case **depends** on a previous one
- an expected result requires **judgement** instead of observation
- any case was left with an **empty `Verificado por`**
- a case the skill did not execute carries a filled `Resultado Obtido`
