# A Skill `coupling-map` (Mapa de acoplamento e raio de explosao)

> **Documento de design.** Registra as decisoes que a skill codifica, por que cada uma foi
> tomada e o que ela deliberadamente **nao** faz. O `SKILL.md` e a instrucao operacional;
> este documento e o porque.

---

**Data:** 2026-08-25
**Estado:** desenho aprovado, pendente de implementacao

## 1. Objetivo

Responder uma pergunta operacional: **quais arquivos precisam ser refatorados primeiro para
reduzir risco sistemico.**

O criterio e a conjuncao de duas condicoes:

1. o arquivo faz coisa demais (viola SRP);
2. muitos outros arquivos dependem dele — se ele quebrar, quebra varias partes do sistema.

O caso inverso — o arquivo depender de muitos outros, e portanto poder ser quebrado por
qualquer um deles — e igualmente real, mas **nao e um terceiro criterio de prioridade**. A
secao 4.2 demonstra por que: e o mesmo grafo lido no sentido oposto, e a alavancagem de uma
refatoracao esta no lado das causas, nao no das vitimas. Ele entra no desenho como medida de
**dificuldade** (`Ce*`), nao de risco.

A saida e um relatorio HTML autocontido com um grafico de dispersao, uma tabela ordenavel e
listas de detectores. A ferramenta e **diagnostica**, nao e gate: nao reprova build, nao
bloqueia commit.

## 2. Proveniencia e o que foi descartado

O desenho partiu de uma proposta que sugeria reproduzir o modelo de metricas de Robert Martin
(Ca, Ce, I, A, D, Main Sequence, zona de dor, zona de inutilidade) sobre o grafo do Madge,
mais uma heuristica de God Class por pontuacao ponderada e um historico de snapshots.

Metade disso nao funciona neste repositorio. As medicoes que sustentam cada descarte estao na
secao 9. Resumo do que **nao** deve ser reintroduzido no plano:

| Item | Motivo do descarte |
|---|---|
| `A` (abstracao) | 0 classes abstratas em 678 arquivos TS; os 1156 arquivos `.js` nao tem interface. `A` e bimodal no TS (arquivo e so interface ou so implementacao), entao quase tudo cai em `A = 0` |
| `D` e Main Sequence | com `A = 0`, `D = abs(A + I - 1)` colapsa em `D = 1 - I`. O eixo vertical nao acrescenta informacao ao horizontal |
| Zona de inutilidade | definida por `A ~ 1` e `I ~ 1`; matematicamente inalcancavel com `A = 0` |
| LCOM / coesao de metodos | degenera no backend: `dialer.model.js` tem 3 campos, todos handles de banco, e todo metodo toca `this.dbRead`. LCOM4 daria "coeso" para uma classe de 4402 linhas |
| God Score com pesos fixos | pesos arbitrarios produzem numero de precisao falsa. Substituido por grandezas medidas plotadas diretamente |
| Health score composto (ex.: 82/100) | nao acionavel; agrega grandezas incomensuraveis |
| Historico / serie temporal | fora de escopo por decisao explicita. O "antes x depois" e obtido rodando a ferramenta de novo |
| Parser de template Angular | desnecessario: 131 dos 132 templates que usam componentes proprios pertencem a componentes `standalone`, cujas dependencias sao imports TS reais |
| ts-morph | desnecessario para o nucleo. Nenhuma metrica do v1 exige AST |

## 3. Escopo

`apps/frontend` (TypeScript) e `apps/backend` (JavaScript). **959 nos no grafo** — 679 do
frontend, 280 do backend.

> Corrigido pela sonda (`superpowers/plans/2026-08-25-probe-findings.md`). O desenho dizia
> ~1834 arquivos, somando 678 do frontend com 1156 do backend. Os 1156 sao o diretorio
> `apps/backend` inteiro: **546 migrations, 317 testes e apenas 271 de `src`**. O codigo de
> aplicacao do backend sao 271 arquivos.

Excluidos: `node_modules`, `dist`, `__tests__`, `migrations`, todos os `*.spec.ts` (431
arquivos), os apps Python (`ia_tts`, `ia_whisper`) e os apps JS/TS menores (`agi`, `cloud`,
`dbevents`, `ia`, `ia_orchestrator`, `push_service`), que somam ~144 arquivos e quase nao se
importam entre si.

**Tambem excluidos `/docs/` e `*.json` no backend**, e nao por preferencia: apontado para
`apps/backend/src`, o madge segue imports para cima e traz arquivos de fora da raiz —
`loader.js`, `knexfile.js`, `database.js`, e tambem `docs/swagger.json` com **55.580 linhas**.
Um arquivo desse tamanho no eixo LOC destroi a escala. Pelo mesmo motivo o coletor precisa
**normalizar** os caminhos: `apps/backend/src/../database.js` e `apps/backend/database.js` sao
o mesmo no e nao podem virar duas chaves.

## 4. Metricas

Nenhum score composto com pesos inventados. Todas as grandezas sao medidas ou derivadas do
grafo por definicao fechada.

| Metrica | Definicao |
|---|---|
| `Ce` | numero de arestas de saida (modulos dos quais o arquivo depende), deduplicadas |
| `Ca` | numero de arestas de entrada (modulos que dependem do arquivo), deduplicadas |
| `Ca*` | **raio de explosao**: total de modulos alcancaveis por caminho reverso, ou seja, quantos quebram se este quebrar. Fecho transitivo reverso |
| `Ce*` | **fragilidade transitiva**: total de modulos que podem quebrar este. Fecho transitivo direto |
| `LOC` | linhas do arquivo |
| `I` | `Ce / (Ca + Ce)`. Mantida como coluna da tabela, **nao** como eixo. Quando `Ca + Ce = 0`, `I` e indefinida e o arquivo entra na lista de orfaos |

### 4.1 Calculo de `Ca*` e `Ce*`

Grafo com ciclos exige cuidado: sem tratamento, o fecho transitivo conta o mesmo no varias
vezes e nao termina.

1. Calcular os componentes fortemente conexos (Tarjan). O grafo de componentes e aciclico.
2. Propagar o fecho por ordenacao topologica com memoizacao, **no grafo reverso para `Ca*` e
   no grafo direto para `Ce*`**. E a mesma estrutura percorrida duas vezes; `Ce*` custa um
   segundo passe e nenhuma estrutura nova.
3. `Ca*` de um arquivo = tamanho do conjunto alcancavel no sentido reverso; `Ce*` = o mesmo
   no sentido direto. Ambos **excluindo o proprio arquivo** e **excluindo os demais membros
   do seu proprio ciclo** (que nao quebram por consequencia — ja estao acoplados de forma
   mutua e sao reportados pelo detector de ciclos).

### 4.2 Por que `Ca*` ordena a fila e `Ce*` nao

Com arestas no sentido "X importa Y", o dano flui contra a seta: se Y quebra, X quebra.
`Ca*(Y)` conta quantos quebram se Y quebrar; `Ce*(X)` conta quantos podem quebrar X.

Somados sobre o sistema inteiro, os dois dao o mesmo numero — cada par ordenado "X quebra por
causa de Y" e contado uma vez na conta de X e uma vez na de Y. **Sao o mesmo grafo lido em
sentidos opostos:** a fragilidade total e um numero so, `Ca*` a atribui as causas e `Ce*` as
vitimas.

A assimetria esta na alavancagem, nao na gravidade. Refatorar um arquivo de `Ce*` alto protege
**um** arquivo; refatorar um de `Ca*` alto protege **todos os N** que dependem dele de uma vez.
Por isso a prioridade segue `Ca*`.

`Ce*` entra com outro papel, que e onde ele e util de verdade:

- **`Ca*` = beneficio** de refatorar — quanto risco sistemico se elimina
- **`Ce*` = dificuldade** de refatorar — quanto pode quebrar o trabalho enquanto se mexe

A fila portanto ordena, **dentro dos arquivos detectados**, por `Ca*` decrescente com desempate
por **`Ce*` crescente**: maior retorno com menor chance de abrir uma frente que nao se consegue
fechar. Um arquivo de `Ca*` alto e `Ce*` alto continua sendo o alvo mais importante, mas entra na
fila sinalizado como empreitada, nao como ajuste.

> **"Dentro dos detectados" nao e detalhe — a primeira versao desta frase o omitia e a
> consequencia atravessou o projeto inteiro ate a tela.** Ordenar por `Ca*` sobre *tudo* poe no
> topo `environment.ts` (`Ca*` 425, 11 linhas), `toast.model.ts` e `session-modal.service.ts` —
> exatamente os arquivos que a propria barra lateral rotula "fundacao saudavel: nao tocar". Os 12
> da zona de dor ficavam abaixo deles. Quem abrisse o relatorio e lesse a tabela de cima para
> baixo receberia a fundacao do sistema como fila de refatoracao, que e o erro que este desenho
> inteiro existe para evitar.
>
> O grafico ja os separava, pelo eixo LOC. A tabela nao, porque tinha uma chave so. A ordenacao
> padrao e portanto **em camadas**: detectados primeiro (`pain`, depois `amplifier`, depois
> `leafAsDependency`), e so entao a regra acima. Clicar num cabecalho continua sobrescrevendo com
> aquela coluna unica.

`Ce` **direto** nao e um criterio de risco: ele e o sinal de responsabilidade do criterio 1 da
secao 1. Uma classe que precisa de 45 colaboradores para funcionar quase certamente faz varias
coisas — e o perfil "orquestrador".

## 5. Taxonomia

Dominio e camada derivados do caminho e do nome do arquivo. Sem arquivo de mapeamento manual.

Sao **tres decisoes independentes** por app, declaradas em `arch.config.json`:

| Campo | Valores | Decide |
|---|---|---|
| `domainFrom` | `firstFolderUnder` \| `basename` | o dominio |
| `layerFrom` | `suffix` \| `folder` | a camada |
| `requireLayerForDomain` | booleano, padrao `false` | se um arquivo sem camada reconhecida perde tambem o dominio |

A independencia entre as duas primeiras **nao e teorica**. A primeira versao ramificava so em
`domainFrom` e a estrategia de camada pegava carona nele — `firstFolderUnder` implicava sufixo,
`basename` implicava pasta. Como este repositorio usa exatamente os dois pareamentos canonicos,
nem o codigo nem os testes expunham o defeito. Mas a secao 10 faz a IA **gerar a config em
qualquer projeto**, e uma arvore no formato `src/<dominio>/services/x.js` e comum: a config
gerada a descreveria corretamente, `layerFrom` seria ignorado, e **toda camada voltaria `null`**
— desabilitando em silencio o detector de violacao de direcao e esvaziando o eixo de cor do
relatorio. Achado por revisao independente durante a implementacao.

**Frontend** — `firstFolderUnder` sob `app`, `suffix`, `requireLayerForDomain: false`

- dominio = primeira pasta sob `apps/frontend/src/app/` (76 delas)
- camada = sufixo do arquivo: `component`, `service`, `model`, `module`, `guard`,
  `interceptor`, `directive`, `pipe`, `resolver`, `helpers`
- sufixo desconhecido mantem o dominio: `app/reports/reports.routes.ts` -> dominio `reports`,
  camada `null`

**Backend** — `basename`, `folder`, `requireLayerForDomain: **true**`

- dominio = basename sem sufixo (`dialer.model.js` -> `dialer`). 52 dos 59 models tem um
  controller homonimo, entao a chave e estavel
- camada = pasta sob `apps/backend/src/`: `routes`, `controllers`, `models`, `services`,
  `middleware`, `functions`, `utils`, `config`, `jobs`, `socket`
- `requireLayerForDomain` e `true` **de proposito**: manda para o balde os 17 arquivos (6,1%)
  que ficam fora de qualquer pasta de camada — `ami.js`, `database.js`, `knexfile.js`,
  `api/v2/index.js`, helpers. Sao infraestrutura, nao dominio. Promove-los pelo basename
  fabricaria 17 dominios de um arquivo so e colocaria `index` e `database` no grafico como se
  fossem features. O balde e a resposta certa aqui, e agora e uma **opcao declarada** em vez de
  um efeito colateral da ordem dos ramos.

**Cruzamento full-stack:** 27 dominios existem nos dois lados com o mesmo nome (`dialer`,
`queues`, `reports`, `permissions`, `sip-group`, `cost-center`, `dashboard`, `csp`,
`forwarding`, `security`, entre outros). A visao por dominio agrega os dois.

O cruzamento e **apenas de nome, nunca de aresta**. Frontend e backend sao deployaveis
separados e nao se importam mutuamente; nao existe aresta entre eles e nenhuma deve ser
inventada. `Ca*` de um arquivo do frontend jamais alcanca arquivos do backend. O que a visao
por dominio agrega sao as metricas dos dois lados sob o mesmo rotulo, lado a lado.

**Regra obrigatoria:** arquivo que nao se encaixa em nenhum dominio vai para um balde
`(sem dominio)` **visivel no relatorio**, com contagem. Nunca descartado em silencio — e
assim que um numero passa a mentir sem ninguem notar.

## 6. Ordem das camadas

Usada pelo detector de violacao de direcao. Uma aresta que sobe e violacao.

```
BACKEND                      FRONTEND
routes      (92 arquivos)    component  (273)
  v                            v
controllers (71)             service    (135)
  v                            v
models      (59)             model      (115)

transversais (sem direcao imposta):
  middleware, services, functions, utils, config
  module, guard, interceptor, directive, pipe
```

## 7. Detectores

Listas proprias, porque sao coisas que o grafico de dispersao nao mostra.

| Detector | Regra | Pega hoje |
|---|---|---|
| **Zona de dor** | `Ca*` acima do corte **e** `LOC` acima do corte | **12** — topo: `authorization.middleware.js`, 1416 linhas, `Ca*` 101 |
| **Amplificador** | `LOC` baixo mas `Ce` e `Ca` altos: repassa raio sem parecer grande | **1** — `shared.module.ts`, 90 linhas, `Ce` 23, `Ca` 58 |
| **Controller usado como dependencia** | arquivo em `controllers` com `Ca` acima do corte | **3** — `permission.controller.js` (32), `sip.controller.js` (19), `queues.controller.js` (10) |
| **Violacao de direcao** | aresta subindo na ordem da secao 6 | a medir na implementacao |
| **Ciclos** | componentes fortemente conexos com mais de um membro | a medir na implementacao |
| **Orfaos** | `Ca == 0` e `Ce == 0` | **23** |

Ciclos e orfaos saem da nossa propria travessia. **Nao chamar `madge.circular()` nem
`madge.orphans()`** — um grafo, uma fonte de verdade, e duas superficies de API a menos.

> **Dois detectores mudaram depois da sonda.**
>
> **"Refem" (`Ce` baixo, `Ce*` alto) foi removido.** Pegava 37 arquivos, **todos `.module.ts`**.
> Um NgModule com `Ce` 4 e `Ce*` 120 nao e um refem — e o que um modulo Angular e. Excluindo
> `.module.ts`, sobravam **zero**. Um detector que so dispara em estrutura normal do framework
> e ruido. `Ce*` permanece como coluna e como desempate da fila (secao 4.2), que sempre foi seu
> papel principal; o detector era o acessorio.
>
> **`component` saiu de `leafLayers`.** Incluido, o detector acusava `breadcrumbs.component.ts`
> (`Ca` 69), `loading.component.ts` (42), `pagination.component.ts` (41) — componentes
> compartilhados, corretamente reusados. Acusa-los e exatamente o erro de "refatore a fundacao"
> que este desenho existe para evitar. A premissa vale para **controller de backend**, que
> deveria ser chamado por rota e nao importado, e nao para componente de frontend, onde reuso
> e o objetivo.

### 7.1 Cortes

**Calibrados pela sonda contra a distribuicao real e congelados** em `arch.config.json`:

| Corte | Valor | Pega | % de 959 |
|---|---|---|---|
| zona de dor | `Ca* >= 15` e `LOC >= 400` | 12 | 1,25% |
| amplificador | `LOC <= 150` e `Ce >= 15` e `Ca >= 30` | 1 | 0,10% |
| controller como dependencia | `Ca >= 10` | 3 | 0,31% |
| cobertura minima do coletor | 85% | — | — |

O corte de `Ca*` desceu de 20 para 15. Em 20 a fila tinha 9 arquivos e deixava de fora
`reports.controller.js` (2027 linhas), `reports-agent.model.js` (2254) e `agents.model.js`
(1794), que pertencem a ela. Em 15 sao 12 de 959.

**Os cortes sao absolutos, nunca percentis.** Um corte por percentil nao pode melhorar: se
tudo for corrigido, o "top 5%" continua sendo 5%. Como a ferramenta existe para comparar
antes e depois de uma refatoracao, percentil invalidaria a comparacao.

## 8. Relatorio HTML

Arquivo unico `architecture-report/index.html`, autocontido: **nenhuma requisicao externa**,
tudo embutido. O repo tem CSP e o arquivo e aberto direto no navegador.

Ao lado, `architecture-report/architecture.json` — a fonte de dados, e o unico arquivo que a
IA le nas execucoes seguintes.

### 8.1 Conteudo do `architecture.json`

E o contrato entre o script e os dois consumidores: o HTML e a skill. Precisa ser suficiente
para ambos, porque nas execucoes seguintes a IA le **so este arquivo** — nunca o codigo-fonte.

- **cabecalho**: versao do script, `git rev-parse HEAD`, e os cortes vigentes da secao 7.1
  (para que uma comparacao entre duas execucoes saiba se os cortes mudaram entre elas).
  **Sem data e sem timestamp** — qualquer carimbo de tempo faz duas execucoes diferirem e
  quebra a comparacao byte a byte do criterio de aceitacao 8
- **totais**: arquivos analisados, arestas resolvidas, **imports declarados e a cobertura
  resultante** (ver secao 11), arquivos no balde `(sem dominio)`
- **por arquivo**: caminho, dominio, camada, `LOC`, `Ce`, `Ca`, `Ca*`, `Ce*`, `I`, lista de
  dependencias diretas, lista de dependentes diretos, e quais detectores dispararam
- **por dominio**: os mesmos agregados
- **detectores**: as listas da secao 7, cada uma com os arquivos que caíram nela
- **ciclos**: cada ciclo com seus membros

A ordenacao de todo array e deterministica (alfabetica por caminho), sem o que o criterio de
aceitacao 8 nao pode ser verificado por comparacao de arquivos.

### 8.2 Grafico

- eixo X = `Ca*` (raio de explosao), escala logaritmica
- eixo Y = `LOC`, escala logaritmica
- tamanho do ponto = `Ce`
- cor = camada
- anel escuro = arquivo que caiu em algum detector
- linhas de corte dos quadrantes, **arrastaveis**, com os valores da secao 7.1 como padrao

Sem formula normalizada: sao tres grandezas medidas plotadas diretamente. O quadrante superior
direito e a fila de refatoracao.

Quadrantes e leitura:

```
 LOC                      ZONA DE DOR
  ^        divida contida  |  refatorar primeiro
  |        (gordo, pouco   |  (gordo e muito
  |         dependido)     |   dependido)
  |------------------------+------------------------
  |        irrelevante     |  FUNDACAO SAUDAVEL
  |                        |  (pequeno e muito
  |                        |   dependido) - nao tocar
  +------------------------------------------> Ca*
```

O quadrante inferior direito e a razao de o grafico ser bidimensional: um ranking por `Ca*`
puro colocaria `toast.service` (43 linhas, 131 dependentes) em primeiro lugar e mandaria
refatorar a fundacao do sistema.

### 8.3 Interacao

Herdada do prototipo de referencia fornecido pelo usuario, com os eixos trocados:

- **Toggle Por arquivo / Por dominio.** Padrao: por dominio.
- **Ordenacao padrao da tabela = a fila de refatoracao:** detectados primeiro (`pain`,
  `amplifier`, `leafAsDependency`), e dentro de cada camada `Ca*` decrescente com desempate por
  `Ce*` crescente, e por caminho para ser total e estavel (secao 4.2). A coluna `Ce*` mostra
  junto um rotulo de dificuldade, para que um alvo caro nao seja confundido com um ajuste
  rapido. Sem a camada de detectados, a tabela abre listando as fundacoes saudaveis do sistema.
- **As linhas por dominio carregam a uniao dos detectores dos seus arquivos.** Sem isso a visao
  que o relatorio abre — a de dominio — pintava os 196 pontos de azul, com a legenda ao lado
  prometendo vermelho, e a fila de refatoracao ficava invisivel na unica tela que o leitor ve
  primeiro.
- **Select Top 10 / 20 / 30 / 50 / Todos.** Padrao: **Top 20**. O Top N segue a **coluna de
  ordenacao ativa da tabela** — clicar em `Ca*` mostra os N maiores em raio de explosao,
  clicar em `LOC` mostra os N maiores em tamanho. Nenhum criterio de ranking novo e inventado.
- **Hover:** realca as arestas. Continua = `Ce` (sai do modulo), tracejada = `Ca` (entra).
  **O hover revela vizinhos mesmo que estejam filtrados pelo Top N**, desenhados esmaecidos —
  sem isso o filtro mata o recurso justamente quando ele e mais necessario.
- **Card ao clicar:** metricas, prosa interpretativa gerada por template a partir do
  quadrante (nao por IA), lista `depende de:` e lista `dependem dele:`.
- **Controle de profundidade no card: 1 / 2 / tudo.** Profundidade 1 = so as ligacoes diretas.
  Profundidade "tudo" = o raio de explosao inteiro acende. E um parametro, nao dois recursos.
  No modo foco o scatter permanece: cada vizinho mantem suas coordenadas, entao ve-se nao so
  quem depende, mas que tipo de modulo depende.
- **Barra lateral** com "Como ler" e "As metricas".

### 8.4 Restricoes de implementacao

- **`desenhar(conjuntoDeNos)`, nunca `desenhar(tudo)`.** Todo filtro — Top N, dominio, camada,
  modo foco — e uma chamada diferente da mesma funcao. Esta e a restricao de arquitetura mais
  importante do relatorio: decidida agora custa zero, retrofitada depois custa retrabalho.
- **SVG desenhado a mao**, sem biblioteca de grafico. Sem CDN, embutir D3 ou Chart.js incharia
  o arquivo. Com o padrao em Top 20, SVG e folgado; "Todos" com ~1800 pontos e a excecao.
- **Tema escuro por padrao.** Regra de acessibilidade do projeto (`CLAUDE.md`), nao preferencia
  estetica. O tema claro fica disponivel no alternador.

## 9. Medicoes que sustentam o desenho

Levantadas em 2026-08-25 no branch `Acoplamento-skill`.

**Volume**

| | |
|---|---|
| `apps/frontend` | 678 `.ts` (sem spec) + 431 `.spec.ts` |
| `apps/backend` | 1156 `.js`, zero TypeScript |
| pastas sob `src/app/` | 76 |
| prefixo de seletor Angular | `tails` |

**Abstracao (motivo do descarte de `A`)**

| | |
|---|---|
| `export abstract class` | **0** |
| arquivos com `export interface` | 182 (todas DTO/model) |
| arquivos com `export class` | 542 |
| `export type` / `enum` | 2 / 1 |

**Resolucao de imports (risco ativo)**

| | |
|---|---|
| imports relativos no frontend | 2103 |
| imports nao-relativos (`baseUrl: "src"`) | **1282** — exigem `tsConfig` no Madge |
| barris `index.ts` | 0 |
| `loadChildren` / `import()` dinamico | 112 / 126 — **medido: viram arestas** (`app-routing.ts` com 59) |
| `@NgModule` / `standalone: true` | 125 / 278 |
| backend: `import ... from` / `require(` | 823 / 103 |
| backend: `require()` dinamico | **0** — grafo totalmente estatico |
| backend: executado via | `babel-node` (`babel.config.js` presente) |

**Medido pela sonda: sem `tsConfig` o grafo do frontend cai de 2468 para 1394 arestas — perde
1074, ou 43,5%.** A estimativa de ~38% era conservadora. E a perda e silenciosa: o relatorio
renderiza e continua plausivel.

**Ponto cego de template (medido e descartado)**

466 usos de `<tails-*>` em templates, 93 seletores distintos de 270 declarados. Dos 132
templates que usam componentes proprios, **131 pertencem a componentes `standalone`** — as
dependencias sao imports TS reais e o Madge as enxerga. Nenhum e declarado por NgModule.

**Fan-in aproximado** (por basename, nao pela resolucao do Madge — a ordem de grandeza vale,
os valores exatos serao recalculados)

| Arquivo | LOC | `Ce` | fan-in | leitura |
|---|---|---|---|---|
| `authorization.middleware.js` | 1415 | 0 | 93 | zona de dor |
| `sip.controller.js` | 1604 | 7 | 19 | grande e exposto |
| `shared.module.ts` | 89 | 28 | 59 | amplificador |
| `utils.ts` | 336 | 1 | 70 | grab-bag |
| `permission.controller.js` | 191 | 2 | 33 | camada folha como dependencia |
| `toast.service.ts` | 43 | 4 | 131 | fundacao saudavel |
| `app.error-handle.ts` | 81 | 6 | 130 | fundacao saudavel |
| `socket.service.ts` | 103 | 5 | 95 | fundacao saudavel |
| `agents.model.ts` | 40 | 0 | 45 | fundacao saudavel |
| `dialer.model.js` | 4402 | ~6 | 2 | divida contida |
| `agent-dashboard.component.ts` | 1050 | 45 | baixo | orquestrador |

O contraste entre `authorization.middleware.js` e `dialer.model.js` valida o desenho: o maior
arquivo do repositorio tem 2 dependentes e e de baixa prioridade, enquanto um arquivo tres
vezes menor tem 93 e e o alvo numero 1. Nenhuma metrica da proposta original o encontraria —
LCOM o daria como coeso, `A` o daria como 0 igual a todo o resto, `Ce` o daria como excelente.

## 10. Arquitetura da skill

Objetivo declarado pelo usuario: **nao gastar IA relendo o codigo-fonte a cada execucao.**

Divisao de responsabilidade:

| Artefato | Quem produz | Onde vive |
|---|---|---|
| `scripts/arch-report.mjs` | **vem pronto e testado dentro da skill**, apenas copiado | commitado no repo |
| `arch.config.json` | **a IA gera na primeira execucao**, descobrindo a estrutura do projeto | commitado no repo |

A IA descobre o que varia por projeto (onde estao os apps, onde esta o `tsconfig`, qual o
prefixo de seletor, qual a taxonomia de dominio e camada) e escreve num arquivo declarativo
curto. Ela **nao** reescreve a logica de metricas a cada projeto — script gerado por IA
produziria N variantes divergentes, nenhuma revisada, impossiveis de corrigir centralmente.
Isso tambem contraria a regra do projeto de que skill nasce no repositorio `sdd-skills` e e
distribuida ao time.

Mesma forma da infraestrutura de gate ja existente: `runGate.mjs` versionado, parte variavel
resolvida dinamicamente.

**Fluxo**

```
PRIMEIRA INVOCACAO                    INVOCACOES SEGUINTES
------------------                    --------------------
verifica pre-requisitos               verifica pre-requisitos -> ok
  madge instalado?          nao         |
  scripts/arch-report.mjs?  nao         roda o script
  arch.config.json?         nao         (sem IA no codigo-fonte)
  |                                     |
  PEDE PERMISSAO AO USUARIO             le architecture.json (1 arquivo)
  |                                     |
  npm i -D madge (na RAIZ)              compara com a execucao anterior
  copia o script da skill               |
  IA varre a estrutura ->               responde o que mudou nas zonas
    gera arch.config.json
  roda -> valida -> abre o HTML
```

Depois da primeira vez, `node scripts/arch-report.mjs` funciona sozinho, sem skill e sem IA,
inclusive para o resto do time.

**Instalacao — duas armadilhas registradas**

- O Madge so exige **Graphviz** para gerar imagem (`--image`). Nao usamos: lemos `obj()` e
  desenhamos o HTML. Isso elimina a instalacao de binario de sistema, que e a parte que
  costuma falhar no Windows.
- `npm i -D madge` vai na **raiz**, nao em `apps/frontend`, onde exigiria `--legacy-peer-deps`
  por conflito pre-existente entre jest30 e build-angular.

**Nome:** `coupling-map`. Precisa ser distinto de `architecture-analyzer` e `deep-analyzer`,
que ja existem instaladas no projeto e produzem documento, nao metrica.

## 11. O guarda do coletor

**Executada em 2026-08-25.** Resultado completo em
`superpowers/plans/2026-08-25-probe-findings.md`; o que ela mudou esta marcado ao longo deste
documento.

O achado que mais importa e que **a pergunta original estava mal formulada**. Ela era "qual o
percentual de arestas nao resolvidas?", com um guarda que abortaria acima de um limiar. Mas o
madge **descarta** o que nao resolve, em vez de deixar a aresta pendurada: medindo "alvo que
nao esta no conjunto de arquivos", o resultado e **0,00% com ou sem `tsConfig`** — inclusive no
cenario em que 43,5% do grafo desapareceu. O guarda mediria zero exatamente no modo de falha
que existe para detectar.

**O guarda e por cobertura**, comparando arestas resolvidas contra imports internos declarados
no codigo-fonte:

| | arestas | imports declarados | cobertura |
|---|---|---|---|
| frontend **com** `tsConfig` | 2468 | 2413 | **102,3%** |
| frontend **sem** `tsConfig` | 1394 | 2413 | **57,8%** |
| backend | 674 | 613 | 110,0% |

Discrimina com folga. Fica acima de 100% porque a contagem por regex subestima os imports
declarados (import multilinha, `export * from`, import por efeito colateral), entao **e um piso,
nunca uma igualdade**. Piso adotado: **85%**. Abaixo dele o coletor aborta, porque um relatorio
silenciosamente incompleto e pior do que nenhum relatorio.

Tempo de execucao: frontend ~20s, backend ~3s. Nao precisa de cache.

## 12. Criterios de aceitacao

1. O coletor resolve ambos os apps e reporta a cobertura (arestas resolvidas sobre imports
   declarados); **aborta abaixo de 85%**. Verificavel: remover o `tsConfig` da config do
   frontend tem de derrubar a execucao, nao produzir um relatorio menor.
2. `Ca*` e `Ce*` sao calculados com ciclos colapsados por SCC, sem contagem duplicada e sem
   laco infinito. A soma de `Ca*` sobre todos os arquivos e igual a soma de `Ce*` — as duas
   contam o mesmo conjunto de pares e a divergencia entre elas denuncia erro na travessia.
3. Todo arquivo do escopo recebe dominio e camada, ou aparece no balde `(sem dominio)` com
   contagem visivel.
4. O relatorio abre no navegador sem servidor e sem nenhuma requisicao externa.
5. `authorization.middleware.js` aparece na zona de dor (`Ca*` 101, 1416 linhas);
   `toast.service.ts` **nao** aparece, apesar do quarto maior `Ca*` do repositorio (409),
   porque tem 44 linhas. E o par que prova que o grafico precisa ser bidimensional: um ranking
   por `Ca*` puro mandaria refatorar a fundacao do sistema.
6. O select Top N reordena conforme a coluna ativa da tabela; o hover revela vizinhos
   filtrados; o card oferece profundidade 1 / 2 / tudo.
7. O tema escuro e o padrao.
8. Executar `node scripts/arch-report.mjs` duas vezes seguidas produz o mesmo resultado.
9. A skill detecta os pre-requisitos e nao reinstala o que ja existe.

## 13. Fora de escopo

- Serie temporal, snapshots persistidos, health score agregado.
- `A`, `D`, Main Sequence, zonas de dor/inutilidade no sentido de Martin.
- LCOM, contagem de metodos e campos, qualquer AST (`ts-morph`, `@babel/parser`).
- Churn do git.
- Os apps Python e os apps JS/TS menores.
- Gate de CI. Um gate "nenhum ciclo novo" pode nascer depois, e entao entra em `GATES.md`.
