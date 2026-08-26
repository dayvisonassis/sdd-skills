# Sonda do Madge — resultado

**Data:** 2026-08-25
**Alvo:** monorepo PABX, `C:\angular\drcall\pabx`, branch `Acoplamento-skill`
**Ferramenta:** `madge` 8.0.0, Node v22.15.0, `typescript` 5.9.3 (resolve a partir da raiz)

Tarefa 1 do plano `2026-08-25-coupling-map.md`. Executada antes de qualquer codigo, porque as
respostas podiam mudar o desenho — e mudaram, em cinco pontos.

---

## As quatro perguntas

### 1. Qual o percentual de arestas nao resolvidas?

**Zero — e a pergunta estava mal formulada.**

O madge **descarta** o que nao consegue resolver, em vez de deixar a aresta pendurada. Medindo
"alvo de aresta que nao esta no conjunto de arquivos", o resultado e 0,00% **com ou sem**
`tsConfig` — inclusive no cenario em que 43% do grafo desapareceu. O guarda desenhado na secao
11 da spec mediria zero exatamente no modo de falha que existe para detectar.

**Guarda substituto, medido e validado:** comparar **arestas resolvidas contra imports internos
declarados no codigo-fonte**.

| | arestas | imports declarados | cobertura |
|---|---|---|---|
| frontend **com** `tsConfig` | 2468 | 2413 | **102,3%** |
| frontend **sem** `tsConfig` | 1394 | 2413 | **57,8%** |
| backend | 674 | 613 | 110,0% |

Discrimina com folga. Fica acima de 100% porque a contagem por regex subestima os imports
declarados (import multilinha, `export * from`, import por efeito colateral), entao o guarda e
um **piso de cobertura**, nunca uma igualdade. **Piso adotado: 85%.**

### 2. Os `import()` dinamicos do lazy routing viram arestas?

**Sim.** `app/app-routing.ts` -> 59 arestas, `app/app-routing.module.ts` -> 55, e mais 56
arquivos de rota. Nenhuma lacuna de cobertura; a spec nao precisa de ressalva.

### 3. Os imports nao-relativos resolvem com `tsConfig`?

**Sim, e o efeito e maior do que a spec estimava.** 2468 arestas com `tsConfig` contra 1394 sem
— o `tsConfig` recupera **1074 arestas, 43,5% do grafo do frontend**, nao os ~38% estimados.
Sem ele o relatorio ainda renderiza e ainda parece plausivel.

### 4. Quanto tempo leva?

Frontend ~20s, backend ~3s. Nao precisa de cache.

---

## Cinco correcoes que a sonda forcou

### 1. O escopo real e ~960 arquivos, nao ~1834

A spec somava 678 do frontend com 1156 do backend. Os 1156 sao o diretorio `apps/backend`
inteiro:

| | |
|---|---|
| `migrations` | 546 |
| `__tests__` | 317 |
| **`src`** | **271** |
| outros | 22 |

O codigo de aplicacao do backend sao **271 arquivos**. Grafo final: **959 nos** (679 frontend +
280 backend), depois das exclusoes abaixo.

### 2. O madge alcanca arquivos fora da raiz configurada

Apontado para `apps/backend/src`, ele seguiu imports para cima e trouxe `apps/backend/loader.js`,
`knexfile.js`, `database.js` — e tambem **`apps/backend/docs/swagger.json`, com 55.580 linhas**,
mais `swagger.public.json` com 15.681. Um arquivo de 55 mil linhas no eixo LOC destroi a escala.

Duas consequencias:

- O coletor precisa **normalizar** os caminhos (`apps/backend/src/../database.js` ->
  `apps/backend/database.js`), senao a mesma chave aparece de duas formas.
- A config do backend ganha `'/docs/'` e `'\\.json$'` nas exclusoes. Depois disso o maior
  arquivo do grafo passa a ser `dialer.model.js` com 4403 linhas, que e codigo de verdade.

### 3. O detector "refem" nao sobrevive — sai do v1

Com os cortes provisorios ele pegava 37 arquivos (3,8%). **Todos `.module.ts`.** Um NgModule com
`Ce` 4 e `Ce*` 120 nao e um refem: e o que um modulo Angular *e*. Excluindo `.module.ts`,
**sobram zero**.

Um detector que so dispara em estrutura normal do framework e ruido. **Removido.** `Ce*`
permanece como coluna e como desempate da fila — que era seu papel principal desde a discussao
que o originou (beneficio contra dificuldade). O detector era o acessorio, nao a metrica.

### 4. `component` sai de `leafLayers` — a regra so vale para controller de backend

Com `component` incluido, o detector acusava:

| Ca | LOC | arquivo |
|---|---|---|
| 69 | 72 | `breadcrumbs.component.ts` |
| 42 | 12 | `loading.component.ts` |
| 41 | 63 | `pagination.component.ts` |
| 40 | 195 | `confirm-dialog.component.ts` |

Sao componentes compartilhados, corretamente reusados. Acusa-los e precisamente o erro de
"refatore a fundacao do sistema" que o desenho existe para evitar. A premissa "camada folha nao
deve ser dependencia" vale para **controller de backend** — que deveria ser chamado por rota,
nao importado — e **nao** para componente de frontend, onde reuso e o objetivo.

Com `leafLayers: ['controllers']`, sobram tres, todos legitimos:

| Ca | LOC | arquivo |
|---|---|---|
| 32 | 192 | `permission.controller.js` |
| 19 | 1605 | `sip.controller.js` |
| 10 | 1089 | `queues.controller.js` |

### 5. Corte da zona de dor: `Ca* >= 15`, nao 20

Sensibilidade medida:

| | LOC>=300 | LOC>=400 | LOC>=600 |
|---|---|---|---|
| **Ca*>=15** | 18 | **12** | 6 |
| Ca*>=20 | 14 | 9 | 3 |
| Ca*>=30 | 10 | 7 | 3 |
| Ca*>=50 | 9 | 6 | 2 |

Em 20 a fila tem 9 arquivos e deixa de fora `reports.controller.js` (2027 linhas),
`reports-agent.model.js` (2254) e `agents.model.js` (1794), que intuitivamente pertencem. Em 15
a fila tem 12 de 959 (1,25%) e os inclui.

---

## Cortes calibrados e congelados

| Detector | Corte | Pega | % |
|---|---|---|---|
| zona de dor | `Ca* >= 15` e `LOC >= 400` | 12 | 1,25% |
| amplificador | `LOC <= 150` e `Ce >= 15` e `Ca >= 30` | 1 | 0,10% |
| folha como dependencia | camada `controllers` e `Ca >= 10` | 3 | 0,31% |
| orfaos | `Ca == 0` e `Ce == 0` | 24 | 2,50% |
| cobertura minima | 85% | — | — |

Distribuicoes que os sustentam:

| | p50 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|
| `Ca*` | 6 | 25 | 72 | 242 | 425 |
| `Ce*` | 9 | 32 | 70 | 109 | 638 |
| `LOC` | 57 | 296 | 538 | 1650 | 4403 |
| `Ce` | 2 | 8 | 11 | 22 | 91 |
| `Ca` | 2 | 5 | 7 | 42 | 128 |

---

## O que a sonda confirmou do desenho

**A invariante ja fecha:** soma de `Ca*` = soma de `Ce*` = 15996 com BFS ingenuo, e **15987 com
o `transitiveCounts` final**, que exclui os membros do proprio ciclo. E o teste que a Tarefa 3
usa para validar a travessia com SCC.

**O achado numero 1 estava certo, quase no numero.** A aproximacao por basename dizia
`authorization.middleware.js` com 93 dependentes e 1415 linhas. Real: **96 dependentes, 1416
linhas, `Ca*` 100** — o topo da fila.

**O criterio de aceitacao 5 passa nos dois lados.** `authorization.middleware.js` esta na zona
de dor; `toast.service.ts` **nao** esta, apesar de ter o quarto maior `Ca*` do repositorio
(409), porque tem 44 linhas. O eixo LOC fez exatamente o trabalho de separar fundacao de perigo,
que e a razao de o grafico ser bidimensional.

**O amplificador pegou exatamente o arquivo previsto:** `shared.module.ts`, 90 linhas, `Ce` 23,
`Ca` 58 — o unico do repositorio.

**A fila corrobora uma medicao independente.** `auth.guard.ts` e `permissions.helpers.ts` entram
na zona de dor, e eram o 2o e o 6o lugar da lista de churn do git medida por outro caminho, na
fase de desenho.

---

## A fila de refatoracao que sai hoje

| `Ca*` | LOC | arquivo |
|---|---|---|
| 100 | 519 | `apps/backend/src/api/v2/models/audit.model.js` |
| 100 | 1416 | `apps/backend/src/middleware/authorization.middleware.js` |
| 99 | 418 | `apps/backend/src/api/v2/models/user.model.js` |
| 77 | 675 | `apps/frontend/src/app/agent-dashboard/agent-dashboard.service.ts` |
| 70 | 537 | `apps/frontend/src/app/pdf-csv-generator/pdf-generator/pdf-generator.component.ts` |
| 65 | 538 | `apps/frontend/src/app/agent-dashboard/webphone/webphone.component.ts` |
| 36 | 1605 | `apps/backend/src/api/v2/controllers/sip.controller.js` |
| 21 | 452 | `apps/frontend/src/app/guards/auth.guard.ts` |
| 20 | 592 | `apps/frontend/src/app/permissions/permissions.helpers.ts` |
| 18 | 1794 | `apps/backend/src/api/v2/models/agents.model.js` |
| 17 | 2027 | `apps/backend/src/api/v2/controllers/reports.controller.js` |
| 16 | 2254 | `apps/backend/src/api/v2/models/reports-agent.model.js` |

Doze arquivos de 959. `dialer.model.js`, o maior do repositorio com 4403 linhas, **nao** esta na
lista: `Ca*` 9. Gordo e contido, baixa prioridade — que e o veredito que o desenho previu para
ele desde o inicio.

---

## Correcoes a esta sonda, medidas na implementacao (2026-08-25)

Dois numeros acima foram medidos com um script de sondagem que difere do pipeline final. Ambos
foram reconferidos rodando `classify` -> `computeMetrics` -> `detect` de verdade sobre os 959
nos, e o pipeline esta certo nos dois casos.

**Orfaos: 24, nao 23.** `apps/backend/src/instrumentation.js` tem exatamente um import interno,
`require('../package.json')`. A exclusao `\.json$` — que e a correcao numero 2 desta propria
sonda — apaga essa aresta e transforma o arquivo em orfao. Os 23 foram medidos **antes** da
exclusao existir. O total de nos segue 959, porque `package.json` so aparecia como alvo, nunca
como chave.

**Arestas do backend: 671, nao 674.** Mesma causa: a tabela de cobertura la em cima foi medida
antes da exclusao `\.json$` que esta propria sonda introduziu. A cobertura do backend passa de
110,0% para 109,5%, bem acima do piso de 85% nos dois casos.

**`Ca*` de `audit.model.js` e `authorization.middleware.js`: 100, nao 101.** Os dois se importam
mutuamente — sao um dos dois ciclos do repositorio. O `transitiveCounts` exclui de proposito os
demais membros do proprio componente (secao 4.1 do documento de design: quem ja esta acoplado
mutuamente nao "quebra por consequencia", e o ciclo e reportado pelo detector proprio). A sonda
usava BFS ingenuo, que os conta. A diferenca de 1 e exatamente o outro membro do ciclo.

Tudo o mais fecha exatamente: **pain 12, amplificador 1, controller como dependencia 3**, mesmas
listas de arquivos, invariante `Σ Ca* = Σ Ce* = 15987`, e o criterio de aceitacao 5 passando dos
dois lados (`authorization.middleware.js` na zona de dor, `toast.service.ts` fora dela).

Numeros que a sonda nao tinha: **2 ciclos** (ambos de 2 nos, nenhum self-loop), **14 violacoes de
direcao** (13 delas `models -> controllers` no backend) e **196 dominios**.
