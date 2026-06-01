# AFP Web — Proposta de Wave 7 (Polimento de produto / UX)

_Criado em: 2026-06-01 — proposta de planejamento. Ainda **não** iniciada._

---

## 1. Proposta de Wave 7

Após as Waves 1–6 (que entregaram todo o fluxo funcional: cadastro, vínculos,
gestão de conta, admin operacional e de plataforma), a Wave 7 dedica-se
exclusivamente a **refinamento de UX e apresentação**, sem novas regras de
negócio.

**Objetivo:** elevar a percepção de qualidade das telas já existentes com
melhorias pequenas, visíveis e de baixo risco — textos, badges, resumos de
card, feedbacks de estado (vazio/carregando/erro), organização dos vínculos e
das telas administrativas.

**O que esta wave NÃO é:**

- Não é uma rodada completa de QA — bugs encontrados de passagem viram histórias
  próprias, fora desta wave.
- Não introduz coleções, índices, regras Firestore ou Cloud Functions novas.
- Não altera modelo de dados nem contratos de back-end.
- Não antecipa funcionalidades das evoluções futuras (notificações, relatórios,
  exportação, onboarding guiado).

**Princípios da wave (alinhados ao `CLAUDE.md`):**

| Princípio | Aplicação na Wave 7 |
|---|---|
| Uma história por vez | Cada H-xx é independente e fechável isoladamente |
| Escopo estrito | Mudança visual/copy; sem refator além do necessário |
| Sem decisão arquitetural silenciosa | Qualquer necessidade de nova regra/índice → parar e consultar |
| Sem tocar em regras Firestore | Nenhuma história desta wave exige alteração de `firestore.rules` |
| UI em pt-BR, código em inglês | Mantido |

**Critério de pronto comum a todas as histórias:**

- `npm run build` sem erros.
- Sem regressão visual nas demais telas (verificação manual rápida).
- Nenhuma alteração em `firestore.rules` / `firestore.indexes.json` / `functions/`.
- `roadmap.md` e `handoff.md` atualizados ao concluir.

---

## 2. Backlog priorizado

Prioridade considera **impacto visível × baixo risco × independência**.
Histórias de fundação (componentes de badge e estados) vêm primeiro porque as
demais reaproveitam o resultado.

| Prioridade | ID | Título | Risco | Esforço |
|---|---|---|---|---|
| 1 | H-26 | Componente único de badge de status (papel / status / atividade) | Baixo | P |
| 2 | H-27 | Estados vazios (empty states) consistentes nas listas | Baixo | P |
| 3 | H-28 | Estados de carregamento e erro padronizados nas listas | Baixo | M |
| 4 | H-29 | Resumo de card de atleta mais informativo em "Meus Atletas" | Baixo | P |
| 5 | H-30 | Organização dos vínculos: busca, ordenação e contagem | Baixo | M |
| 6 | H-31 | Revisão de microcopy (mensagens de sucesso / erro / confirmação) | Muito baixo | P |
| 7 | H-32 | Feedback de ações administrativas via banner padronizado | Baixo | M |
| 8 | H-33 | Indicador de uso de plano mais legível no topo da conta | Baixo | P |

> P = pequeno (poucas horas), M = médio (meia diária a uma diária).

---

## 3. Descrição curta de cada história

### H-26 — Componente único de badge de status

Hoje os badges (papel `trainer`/`coach`, status `convidado`/`ativo`/`inativo`,
atividade `aberta`/`concluída`) são reimplementados inline em
`AccountAdminPage`, `TrainerAthletesPage`, `AdminAccountsPage`, etc., com cores
levemente divergentes. Criar um único componente `StatusBadge` (variantes por
tipo) e trocar as ocorrências existentes — **sem inventar variantes novas**, só
consolidando as que já existem.

### H-27 — Estados vazios consistentes

Listas que podem vir vazias (Meus Atletas, Atividades, Treinadores e Coaches,
Admin de contas, Admin de planos, vínculos inativos) mostram hoje "nada" ou um
texto solto. Padronizar um bloco de **empty state** reusando o
`EmptyStateCard` já existente (frase explicativa + CTA quando fizer sentido,
ex.: "+ Convidar"). Sem ícone nesta wave.

### H-28 — Estados de carregamento e erro padronizados

Padronizar o feedback de **carregando** (spinner/skeleton simples e
consistente) e de **erro com botão "Tentar novamente"** nas mesmas listas.
Aproveitar os retries que já existem (ex.: `ActivitiesListPage`) e dar a eles
uma apresentação uniforme.

### H-29 — Resumo de card de atleta mais informativo

Estender o resumo introduzido na H-20 em "Meus Atletas": além da última
atividade + badge, exibir de forma compacta a **data do último check-in** e um
rótulo de inatividade quando aplicável (ex.: "Sem atividade há 14 dias"). Sem
novas queries pesadas — reutiliza o que `listActivitiesByAthlete({ limit: 1 })`
já traz.

### H-30 — Organização dos vínculos

Na tabela de vínculos (`AthleteLinksTable` / aba Ativos e Inativos): adicionar
**campo de busca por nome/e-mail**, **ordenação** (nome A–Z, mais recente) e
**contagem visível** ("Mostrando X de Y"). Filtragem client-side sobre os dados
já carregados — sem query adicional.

### H-31 — Revisão de microcopy

Varredura de **textos pt-BR** das mensagens de sucesso, erro e confirmação nas
telas operacionais e administrativas: padronizar tom (impessoal, direto),
corrigir inconsistências e tornar mensagens de erro acionáveis ("O e-mail já
está em uso. Use 'Reenviar convite'."). Apenas strings — sem mudança de lógica.

### H-32 — Feedback de ações administrativas via banner padronizado

Padronizar o feedback pós-ação (convidar, desativar/reativar, transferir,
editar conta) num **banner de feedback reutilizável** (sucesso/erro), eliminando
divergências entre telas. Mantém o uso de `confirm()` nativo onde já existe —
**não** introduz biblioteca de toast nem modal customizado nesta wave.

### H-33 — Indicador de uso de plano mais legível

Refinar a apresentação do `AccountSummaryCard`: deixar o **"X de Y atletas
ativos"** e o estado de limite mais legíveis no topo da tela de conta (hierarquia
visual, cor da barra já existente, microcopy do limite). Sem mudança de cálculo
nem de dados.

---

## 4. Critérios de aceite

### H-26 — Componente único de badge de status

- [ ] Existe `src/components/ui/StatusBadge.jsx` (ou equivalente) com variantes
      para os tipos já em uso: papel (`trainer`/`coach`), status de usuário
      (`invited`/`active`/`inactive`) e status de atividade (`open`/`completed`).
- [ ] `AccountAdminPage`, `TrainerAthletesPage`, `AdminAccountsPage`,
      `AdminPlansPage` e `AthleteLinksTable` usam o componente — sem badges
      inline duplicados.
- [ ] Cores/labels finais são consistentes entre todas as telas.
- [ ] Nenhuma variante nova de status foi inventada; só consolidação.
- [ ] `npm run build` sem erros; sem regressão visual.

### H-27 — Estados vazios consistentes

- [ ] Reusar o `EmptyStateCard` existente (sem componente novo; sem ícone nesta wave).
- [ ] Aplicado em: Meus Atletas (ativos e inativos), Treinadores e Coaches,
      Admin de contas (vazio + sem match de filtro), Admin de planos,
      `AthleteLinksTable` (ativos e inativos). _(Atividades/Detalhe/Dashboard já usam.)_
- [ ] Cada empty state tem frase explicativa em pt-BR; CTA presente onde a ação
      existe na tela (Convidar / Nova conta / Novo plano / Limpar filtros).
- [ ] Listas sem ação na própria tela (Meus Atletas do trainer) ficam só com mensagem.
- [ ] Mensagens de validação dentro de formulários (ex.: "Nenhum atleta
      disponível para vincular") **não** são alteradas — não são empty state de lista.
- [ ] Listas com dados continuam renderizando normalmente.

### H-28 — Estados de carregamento e erro padronizados

- [ ] Indicador de carregamento consistente nas listas citadas.
- [ ] Estado de erro mostra mensagem + botão "Tentar novamente" que re-executa o
      carregamento.
- [ ] Reaproveita os caminhos de retry existentes (ex.: `ActivitiesListPage`)
      sem duplicar lógica.
- [ ] Transições carregando → vazio → conteúdo → erro funcionam sem flicker
      perceptível.

### H-29 — Resumo de card de atleta mais informativo

- [ ] Card de atleta ativo exibe última atividade + badge (H-20) **e** data do
      último check-in.
- [ ] Rótulo de inatividade aparece quando não há atividade recente
      (regra de corte definida no código, ex.: 14 dias).
- [ ] Sem novas queries além das já feitas no `load()` (limit 1).
- [ ] Comportamento idêntico para trainer e coach; cards inativos sem resumo.

### H-30 — Organização dos vínculos

- [ ] Campo de busca filtra por nome e e-mail (client-side, sobre dados já
      carregados).
- [ ] Ordenação disponível (mínimo: nome A–Z e mais recente).
- [ ] Contagem "Mostrando X de Y" visível e correta com filtro ativo.
- [ ] Abas Ativos/Inativos mantêm comportamento atual; nenhuma query Firestore
      adicional.

### H-31 — Revisão de microcopy

- [ ] Mensagens de sucesso/erro/confirmação das telas operacionais e admin
      revisadas e consistentes em tom.
- [ ] Mensagens de erro acionáveis quando há ação de saída (ex.: e-mail já em
      uso → orienta reenviar convite).
- [ ] Apenas strings alteradas — nenhuma mudança de fluxo ou condição.
- [ ] Sem texto em inglês exposto na UII; código permanece em inglês.

### H-32 — Feedback de ações administrativas via banner padronizado

- [ ] Banner de feedback reutilizável (sucesso/erro) aplicado às ações de
      convidar, desativar/reativar, transferir e editar conta.
- [ ] Apresentação uniforme entre telas (posição, cor, dismiss).
- [ ] `confirm()` nativo mantido onde já existe; nenhuma lib nova adicionada.
- [ ] Sem mudança nas chamadas de serviço subjacentes.

### H-33 — Indicador de uso de plano mais legível

- [ ] Topo da tela de conta destaca "X de Y atletas ativos" com hierarquia
      visual clara.
- [ ] Estado de limite atingido permanece evidente (reusa cores/CTA existentes).
- [ ] Nenhuma mudança em `canAddAthlete`, `AccountSummaryCard` lógica de cálculo,
      ou dados do plano.
- [ ] `npm run build` sem erros.

---

## 5. Ordem sugerida de execução

A ordem segue a prioridade do backlog, com as **histórias de fundação primeiro**
para que as demais reaproveitem os componentes:

```
1. H-26  Componente de badge          (base visual — reusado por H-27, H-29, H-30)
2. H-27  Empty states                 (base de feedback — pareia com H-28)
3. H-28  Loading / erro padronizados  (fecha o trio de estados das listas)
4. H-29  Resumo de card de atleta     (usa badge de H-26)
5. H-30  Organização dos vínculos     (usa badge/estados das anteriores)
6. H-31  Microcopy                     (independente; baixo risco; pode entrar a qualquer momento)
7. H-32  Banner de feedback admin      (consolida feedback das telas admin)
8. H-33  Indicador de uso de plano     (refinamento isolado; bom encerramento)
```

**Notas de sequenciamento:**

- H-26 → H-27 → H-28 formam a base de UI; concluí-las primeiro evita retrabalho
  visual nas seguintes.
- H-31 (microcopy) é totalmente independente e pode ser intercalada se houver
  janela curta entre histórias maiores.
- Nenhuma história depende de back-end; todas são fecháveis com `npm run build` +
  verificação manual.

---

## Recorte final fechado — H-26 (2026-06-01)

Decisões confirmadas com o usuário:

| Tópico | Decisão |
|---|---|
| Abstração vs inline | **Abstração mínima** — componente `StatusBadge` (reuso real já existente) |
| API | **Semântica por domínio** — `<StatusBadge kind="..." value="..." />`; label pt-BR + cor vivem no componente |
| 1ª leva | **Conta + Meus Atletas** — `AccountAdminPage` e `TrainerAthletesPage` |

**Componente:** `src/components/ui/StatusBadge.jsx`
- Tons: `success` / `neutral` / `info` / `warning` / `accent`
- Domínios (`kind` → `value` → label/tone):
  - `userStatus`: invited→Convidado (warning), active→Ativo (success), inactive→Inativo (neutral)
  - `role`: trainer→Trainer (info), coach→Coach (accent)
  - `activity`: open→Em andamento (info), completed→Concluída (success)
- Pill padronizado: `3px 10px` / `12px` / `weight 600` / `radius 999px` (uniformiza divergências de tamanho/peso e remove o uppercase do badge de inativo)
- Fallback: valor desconhecido renderiza o `value` cru com tom neutro

**Aplicado (1ª leva — feito):**
- `AccountAdminPage`: badge de papel (trainer/coach) e badge de status de usuário → `StatusBadge`; helpers `trainerStatusLabel`/`trainerStatusStyle` e estilos `badgeTrainer`/`badgeCoach` removidos
- `TrainerAthletesPage`: badge de atividade (open/completed) e badge de atleta inativo → `StatusBadge`; estilos `badgeOpen`/`badgeDone`/`inactiveBadge` removidos
- `npm run build` ✅ (106 módulos, 0 erros)

**Ajuste de escopo registrado:**
- `AthleteLinksTable` **não tem badge hoje** (só nome + e-mail + botões; `status === 'invited'` apenas controla o botão "Reenviar convite"). Adicionar um badge "Convidado" ali seria comportamento **novo**, não consolidação — movido para a **H-30** (Organização dos vínculos), onde a tabela já será mexida.

**2ª leva (telas admin — feito):**
- Decisão: reusar `kind="userStatus"` (sem `kind` novo), mantendo os labels "Ativo/Inativo" já existentes.
- `AdminAccountsPage`: badge de status → `StatusBadge`; helpers `statusStyle`/`statusLabel` removidos. Preservado o default defensivo (status ausente → "Ativo") via `value={acc.status === 'inactive' ? 'inactive' : 'active'}`.
- `AdminPlansPage`: badge `isActive` → `StatusBadge value={plan.isActive ? 'active' : 'inactive'}`; estilos `badgeActive`/`badgeInactive` removidos.
- `npm run build` ✅ (106 módulos, 0 erros).

**H-26 concluída** — todos os badges inline das 4 telas migrados para `StatusBadge`; nenhuma duplicação remanescente. Commit `b4fc9bb`.

---

## Recorte final fechado — H-27 (2026-06-01)

Decisões confirmadas com o usuário:

| Tópico | Decisão |
|---|---|
| Componente | **Reusar `src/components/feedback/EmptyStateCard.jsx`** (já usado em Atividades/Detalhe/Dashboard); não criar nada novo |
| Ícone | **Sem ícone nesta wave** — mantém título/mensagem/hint/CTA |
| CTA | **Onde a ação já existe na tela**; reaproveita o botão existente. Sem ação própria → só mensagem |

**Telas/listas a migrar (de `<p>` solto para `EmptyStateCard`):**

| Local | Mensagem atual | CTA a fiar |
|---|---|---|
| `TrainerAthletesPage` — ativos | "Nenhum atleta vinculado a você no momento." | — (trainer não convida) |
| `TrainerAthletesPage` — inativos | "Nenhum vínculo inativo encontrado." | — |
| `AccountAdminPage` — Treinadores e Coaches | "Nenhum trainer ou coach nesta conta…" | "+ Convidar" (handler já existe) |
| `AdminAccountsPage` — sem contas | "Nenhuma conta criada ainda." | "+ Nova conta" |
| `AdminAccountsPage` — sem match de filtro | "Nenhuma conta corresponde aos filtros." | "Limpar filtros" |
| `AdminPlansPage` — sem planos | "Nenhum plano criado ainda." | "+ Novo plano" |
| `AthleteLinksTable` — ativos/inativos | `styles.empty` próprio | — (botões já no header acima) |

**Fora de escopo:** mensagens de validação em formulários da `AccountAdminPage`
("Nenhum atleta/treinador disponível para vincular") — não são empty state de lista.

**Sem mudanças em:** serviços, `firestore.rules`, `firestore.indexes.json`, `functions/`.

## Recorte final fechado — H-28 (2026-06-01)

Decisões confirmadas com o usuário:

| Tópico | Decisão |
|---|---|
| Loading | **Reusar `EmptyStateCard`** para o estado de carregamento (igual a Atividades/Dashboard); sem spinner/skeleton novo |
| Erro | **Reusar `ErrorStateCard`** com `onAction` → botão "Tentar novamente" |
| Abrangência | **Carga principal** de cada tela; retry chama o `load()` existente |

**Componentes reaproveitados:** `EmptyStateCard.jsx` (loading) e `ErrorStateCard.jsx` (erro+retry) — ambos já em uso na `ActivitiesListPage`/`DashboardPage`. Nenhum componente novo.

**Telas a padronizar (de `<p>` solto → cards):**

| Tela | Loading | Erro + retry | load() acessível? |
|---|---|---|---|
| `AdminAccountsPage` | `EmptyStateCard` | `ErrorStateCard` → `load()` | ✅ `useCallback` |
| `AdminPlansPage` | `EmptyStateCard` | `ErrorStateCard` → `load()` | ✅ `useCallback` |
| `AccountAdminPage` | `EmptyStateCard` | `ErrorStateCard` → `load()` | ✅ `useCallback` |
| `TrainerAthletesPage` | `EmptyStateCard` | `ErrorStateCard` → `load()` | ⚠️ `load` está dentro do `useEffect` |

**Ajuste estrutural necessário (TrainerAthletesPage):** elevar o `load()` de dentro do `useEffect` para um `useCallback` no escopo do componente (espelhando as outras três telas), de modo que o botão de retry possa reexecutá-lo. Mudança preservadora de comportamento.

**Notas de implementação:**
- O `error` das 4 telas é uma string → `ErrorStateCard message={error}` (sem `.message`, diferente da `ActivitiesListPage` que guarda um `Error`).
- Loading principal substitui o `<p style={styles.hint}>Carregando...</p>`; o `styles.hint`/`errorText` que sobrar sem uso é removido.

**Fora de escopo:** sub-cargas (ex.: toggle "mostrar inativos" do Meus Atletas) e erros de formulário (`inviteError`, `transferError`, `linkError`, `reactivateError`, `infoError`) — não são carregamento de lista.

**Sem mudanças previstas em:** serviços, `firestore.rules`, `firestore.indexes.json`, `functions/`.

## Recorte final fechado — H-29 (2026-06-01)

Decisões confirmadas com o usuário:

| Tópico | Decisão |
|---|---|
| Corte de inatividade | **14 dias** desde o último check-in |
| Apresentação da data | **"Último check-in: DD/MM/AAAA"** (data absoluta) + rótulo de inatividade quando estoura o corte |
| Escopo | **Somente cards ativos** (trainer e coach); cards inativos seguem sem resumo (igual H-20) |

**Comportamento do resumo no card ativo (`TrainerAthletesPage`):**
- Com `lastActivity`: linha "Último check-in: DD/MM/AAAA" + badge de status (`StatusBadge kind="activity"`, já existente).
- Se `daysSince(activityDate) > 14`: rótulo âmbar "Sem atividade há X dias" (X = dias inteiros desde o último check-in).
- Sem `lastActivity`: mantém "Sem atividades registradas" (texto cinza atual).

**Implementação prevista:**
- Novo helper local `daysSince(ts)` (mesmo tratamento de Timestamp do `formatDate`: `ts.toDate()` ou `ts.seconds`); retorna dias inteiros (`Math.floor((Date.now() - d) / 86400000)`).
- Reusa o `lastActivity` já carregado por `listActivitiesByAthlete({ limit: 1 })` — **sem nova query**.
- Novo estilo para o rótulo de inatividade (âmbar, ex.: `#92400e` sobre `#fef3c7`), seguindo a paleta já usada na wave.

**Sem mudanças previstas em:** serviços, `firestore.rules`, `firestore.indexes.json`, `functions/`, modelo de dados.

## Recorte final fechado — H-30 (2026-06-01)

Decisões confirmadas com o usuário:

| Tópico | Decisão |
|---|---|
| Local dos controles | **Dentro da `AthleteLinksTable`** (estado local); serve as duas abas; `AccountAdminPage` praticamente intocada |
| Badge | **Só "Convidado"** (quando `athlete.status === 'invited'`) — inclui o badge deslocado da H-26 |
| Ordenação | **"Mais recente" (padrão)** + "Nome (A–Z)" |
| Busca | Campo único por **nome e e-mail** (client-side, sobre os dados já carregados) |
| Contagem | **"Mostrando X de Y"** (filtrados de total, dentro da aba) |

**Comportamento previsto (`AthleteLinksTable`):**
- Barra acima da tabela: input de busca + select de ordenação + texto "Mostrando X de Y".
- Filtro: `displayName`/`email` por `includes` case-insensitive.
- Ordenação: `recent` → por `linkedAt` (aba Ativos) ou `unlinkedAt` (aba Inativos), desc, via `.seconds ?? 0`; `name` → `displayName`/`email` com `localeCompare('pt-BR')`.
- Badge "Convidado": `StatusBadge kind="userStatus" value="invited"` ao lado do nome quando `athlete.status === 'invited'` (precisa importar `StatusBadge` na tabela).
- Lista vazia de verdade → `EmptyStateCard` atual (inalterado). Busca sem resultado (lista não-vazia, filtro zera) → mensagem "Nenhum atleta corresponde à busca." (nova, dentro da tabela).

**Mudança de natureza do componente:** `AthleteLinksTable` passa a ter estado local (`search`, `sortBy`) — deixa de ser 100% apresentacional. Contido e justificado pelo reuso nas duas abas.

**Sem mudanças previstas em:** serviços, `firestore.rules`, `firestore.indexes.json`, `functions/`, modelo de dados (busca/ordenação 100% client-side).

**H-30 concluída (2026-06-01):** controles client-side na `AthleteLinksTable`.
- Estado local `search` + `sortBy` (default `recent`); lista derivada via `useMemo`.
- Toolbar acima da tabela: input de busca (nome/e-mail, `includes` case-insensitive) + select de ordenação + "Mostrando X de Y".
- Ordenação `recent`: `linkedAt` (Ativos) / `unlinkedAt` (Inativos), desc via `.seconds`; `name`: `localeCompare('pt-BR')`.
- Badge "Convidado" (`StatusBadge kind="userStatus" value="invited"`) ao lado do nome quando `athlete.status === 'invited'` — fecha o item deslocado da H-26.
- Empty real → `EmptyStateCard` (inalterado); busca sem resultado → "Nenhum atleta corresponde à busca."
- `AccountAdminPage` intocada. `npm run build` ✅ (106 módulos, 0 erros).

---

**H-29 concluída (2026-06-01):** resumo de card enriquecido na `TrainerAthletesPage`.
- Card ativo: "Último check-in: DD/MM/AAAA" + badge de status; rótulo âmbar "Sem atividade há X dias" quando `daysSince(activityDate) > 14`.
- Sem atividade → mantém "Sem atividades registradas". Cards inativos seguem sem resumo.
- Helper `daysSince(ts)` + constante `INACTIVITY_DAYS = 14`; estilo `inactivityLabel` (âmbar `#92400e`/`#fef3c7`); `activitySummary` ganhou `flexWrap`.
- Reusa o `lastActivity` já carregado — sem nova query, sem backend, sem mudança de modelo.
- `npm run build` ✅ (106 módulos, 0 erros).

---

**H-28 concluída (2026-06-01):** as 4 telas padronizadas.
- `AdminAccountsPage`, `AdminPlansPage`, `AccountAdminPage`: loading → `EmptyStateCard`; erro → `ErrorStateCard` com retry no `load()` (já `useCallback`).
- `TrainerAthletesPage`: `load()` elevado de dentro do `useEffect` para `useCallback` (comportamento preservado — guard `!user?.uid` mantido, deps `[user?.uid, isCoach]` idênticas); loading/erro padronizados com retry.
- Estilos órfãos removidos: `errorText` (TrainerAthletes); `hint`+`errorText` (AdminAccounts, AdminPlans). `styles.hint` mantido no TrainerAthletes para a sub-carga "Carregando histórico…".
- `npm run build` ✅ (106 módulos, 0 erros).

---

**H-27 concluída (2026-06-01):** todas as 7 listas migradas para `EmptyStateCard`.
- `TrainerAthletesPage`: ativos e inativos → message-only (trainer não convida).
- `AccountAdminPage` (Treinadores e Coaches): CTA "+ Convidar" reaproveitando o handler existente.
- `AdminAccountsPage`: vazio → CTA "+ Nova conta"; sem match de filtro → CTA "Limpar filtros".
- `AdminPlansPage`: CTA "+ Novo plano".
- `AthleteLinksTable`: ativos e inativos → message-only; estilo `empty` removido.
- `styles.hint` mantido onde ainda serve ao estado de carregamento.
- `npm run build` ✅ (106 módulos, 0 erros).

---

## Próximo passo

Esta é uma **proposta**. Para iniciar a Wave 7:

1. Aprovar o backlog e a ordem acima.
2. Registrar as histórias H-26…H-33 em `docs/roadmap.md` (novo EPIC-9 —
   Polimento de UX / Wave 7), com status `todo`.
3. Marcar H-26 como `doing` e implementar seguindo as regras do `CLAUDE.md`
   (uma história por vez, escopo estrito).
