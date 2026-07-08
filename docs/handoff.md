# AFP Web — Handoff de sessão

_Atualizado em: 2026-07-07 (H-34 — trainer convida athlete diretamente, Wave 8)_

---

## H-34 — trainer convida athlete e vincula a si mesmo (Wave 8 — concluída)

**Problema relatado pelo usuário:** "um treinador não consegue convidar um atleta". Investigação confirmou que isso era comportamento por design (H-27: "trainer não convida" — só `account_admin` convidava, via `AccountAdminPage`). O usuário decidiu abrir esta história para dar ao trainer a capacidade de convidar diretamente.

**Decisão arquitetural (parada e consultada antes de implementar, conforme CLAUDE.md §3):** toda criação de usuário passa por `createUserCallable` (`functions/index.js`), que antes só aceitava `callerRole === 'platform_admin' || 'account_admin'`. Opções levantadas ao usuário: (1) trainer convida com vínculo automático a si mesmo, (2) trainer convida sem vínculo automático, (3) manter como está. **Escolhida: opção 1.**

**Arquivos alterados:**
- `functions/index.js` — `createUserCallable` aceita `callerRole === 'trainer' || 'coach'`. Para esses papéis, `papel`/`accountId`/`treinador_id` são **forçados no servidor** (`papel = 'athlete'`, `accountId = callerAccountId`, `treinador_id = callerUid`), ignorando qualquer valor enviado pelo cliente — impede que um trainer crie outro papel ou se vincule a uma conta diferente da sua.
- `src/pages/trainer/TrainerAthletesPage.jsx` — botão "+ Convidar atleta" (oculto para `coach` — fora de escopo, modelo de dados do coach é multi-trainer e não se encaixa no mesmo fluxo) + formulário inline (E-mail, Nome). Reusa `createUser` (`userService.js`) e `canAddAthlete`/`linkAthleteChecked` (`accountService.js`) — **nenhum serviço novo criado**.

**Fluxo:** `handleInviteAthlete` → checa `canAddAthlete(profile.accountId)` → `createUser({ papel: 'athlete', ... })` (Cloud Function cria o Auth user + doc Firestore já com `treinador_id` correto) → `linkAthleteChecked(newUid, user.uid, profile.accountId, user.uid)` cria o `athlete_links` (permitido pela regra existente `isTrainer() && trainerId == request.auth.uid`) e tenta o dual-write de `treinador_id` (no-op seguro, pois o valor já foi gravado pela Cloud Function — o `updateDoc` client-side para esse campo falharia silenciosamente para um trainer não-dono/não-admin, mas não importa porque o valor já está correto).

**Sem mudanças em:** `firestore.rules`, `firestore.indexes.json` (a regra de criação de `athlete_links` por trainer já existia; nenhuma nova permissão de Firestore foi necessária — só a Cloud Function, que usa Admin SDK).

**Validado:** `npm run build` ✅ 108 módulos, 0 erros; `test:rules:emulator` ✅ 21/21; `test:coach-flow:emulator` ✅ 26/26 (nenhuma dessas suítes exercita `createUserCallable` diretamente — não há Functions Emulator no harness atual).

**Smoke test manual:** confirmado pelo usuário ("teste está ok").

**Deploy:** `firebase deploy --only functions,hosting` executado em 2026-07-07, aprovado explicitamente pelo usuário. `createUserCallable`, `athleteDashboardStats`, `trainerDashboardStats`, `trainerActivities`, `coachAthletes` atualizadas; hosting publicado.

**Próximo passo:** nenhuma pendência para H-34.

---

## Bugfix — Data de nascimento não digitável em mobile (2026-07-02)

**Problema relatado:** no cadastro de usuário (`UserForm.jsx`), o campo "Data de nascimento" usava `<input type="date">` nativo. Em mobile (Android/iOS) isso renderiza um wheel picker (iOS) ou dialog nativo (Android) — nenhum dos dois é bom para digitação, e rolar o wheel até uma data de nascimento antiga é lento.

**Correção — `src/components/users/UserForm.jsx` e `src/pages/profile/ProfileCompletionPage.jsx`:**
- Campo trocado de `type="date"` para `input type="text" inputMode="numeric"` com máscara `dd/mm/aaaa` aplicada durante a digitação (insere `/` automaticamente, limite de 8 dígitos).
- Dispara teclado numérico em Android e iOS de forma consistente (não depende do picker nativo de cada SO).
- Validação: data incompleta não gera erro; data completa mas inválida (ex: 31/02) mostra "Data inválida" em tempo real e no submit.
- Armazenamento inalterado: o valor continua persistido em ISO (`yyyy-mm-dd`) internamente — conversão feita no componente, sem impacto em `userService.js`, `functions/index.js` ou dados existentes.

**Sem mudanças em:** `firestore.rules`, `firestore.indexes.json`, `functions/`, modelo de dados.

**Investigação paralela (sem alteração de código):** durante a sessão, foi levantada a dúvida se um usuário pode acumular papel de coach e atleta simultaneamente. Achados (não implementados, aguardando decisão do usuário):
- `users.papel` é campo único (string); regras Firestore (`isTrainer()`, Cloud Function `coachAthletes`) e a Cloud Function `createUserCallable` dependem dele.
- Existe um campo paralelo `users.userTypes` (array), populado hoje só com `[papel]`, com lógica de resolução de prioridade já escrita em `sessionService.js:resolveCanonicalRole` para múltiplos valores.
- `DashboardPage.jsx`/`CheckInPage.jsx`/`CheckOutPage.jsx` calculam `includeSelfAthlete = userTypes.includes('athlete')` e passam para `listTrainerAthleteOptions`, mas essa função nunca usa o parâmetro — feature incompleta/código morto.
- Verificado ao vivo (Admin SDK, somente leitura) que `cathlete@dev.local` tem `papel: "athlete"` e `userTypes: ["athlete"]` — não é dual-role hoje.
- Achado à parte: `cathlete@dev.local` tem `treinador_id: null` em produção, mas o seed script espera `treinador_id: coachUid` — possível drift entre seed e dado real, não investigado a fundo.
- Novo script de diagnóstico somente-leitura: `scripts/diagnose-cathlete.mjs`.

**Validado:** `npm run build` ✅ (108 módulos, 0 erros); `test:rules:emulator` ✅ 21/21; `test:coach-flow:emulator` ✅ 26/26. Smoke test manual confirmado pelo usuário.

**Deploy:** aprovado explicitamente pelo usuário nesta sessão.

---

## Bugfix — Check-out não encontrava sessão aberta para trainer/coach (2026-06-02)

**Commit:** `205f48d` `fix(checkout): load open activity by trainer scope for coach/trainer users`

**Bug (pré-existente, anterior à Wave 7; impacta o fluxo principal de Check-in/Check-out):**
- Após o Check-in de um atleta, o Check-out (mesmo atleta selecionado) dizia "nenhuma sessão em aberto".
- Causa: `CheckOutPage` buscava a sessão via `listActivitiesByAthlete(athleteId, { status:'open' })` — query filtrada **só** por `athleteUserId`. A regra Firestore de `activities` (list) exige `athleteUserId == auth.uid || trainerUserId == auth.uid`; como a query de um trainer não restringe `trainerUserId`, o Firestore **nega a query** (`permission-denied`) → `openActivity` zerado.
- O Check-in já usava o caminho correto (`listActivitiesByTrainer`, que restringe `trainerUserId == auth.uid`) — daí as duas telas se contradiziam.

**Correção (`src/pages/CheckOutPage.jsx`, 2 pontos de lookup — `onAuthStateChanged` e `syncOpenActivity`):**
- trainer/coach → `listActivitiesByTrainer(actorUid, { athleteUserId, status:'open', limit:1, includeLinkedAthletes:false })` (mesmo shape do Check-in / `resolveEligibility`).
- atleta (self) → mantém `listActivitiesByAthlete(uid, { status:'open' })`.

**Sem mudanças em:** `firestore.rules`, `firestore.indexes.json`, `functions/`, modelo. Reusa query já exercida pelo Check-in (nenhum índice novo).

**Validado:** `npm run build` ✅ (107 módulos); `test:rules:emulator` ✅ 21/21; `test:coach-flow:emulator` ✅ 26/26. Verificação manual definitiva = repro do trainer (Check-in → Check-out acha a sessão).

**Deploy:** ainda **não** publicado — aguardando smoke test manual + aprovação explícita do usuário.

---

## H-33 — Indicador de uso de plano mais legível (Wave 7 — concluída)

**Recorte fechado com o usuário:** presentation-only · promover o uso a um bloco de destaque no topo do card · tirar "Atletas ativos" do grid · remover a duplicação do "X de Y" · grid fica Nome/Tipo/Plano · near-limit ganha pista textual âmbar · sem mudar cálculo/dados/regras/comportamento.

**Arquivo:** `src/components/account/AccountSummaryCard.jsx`

**O que foi feito:**
- Novo `usageBlock` no topo do card: label "Atletas ativos" + número destacado `count / limit` (28px; `/limit` em cinza menor) + a barra existente + uma linha de status única.
- Removido o `Field` "Atletas ativos" do grid; grid agora com Nome/Tipo/Plano. Eliminada a duplicação do "X de Y" (antes no grid e no rótulo da barra).
- Linha de status (substitui o antigo `barLabel`): `atLimit` → "Limite atingido." (vermelho `#dc2626`); `nearLimit` → "Faltam X vaga(s)." (âmbar `#92400e`); normal → "X vaga(s) restante(s)." (neutro `#64748b`). Pluralização preservada.
- Estilos: adicionados `usageBlock`/`usageNumber`/`usageLimit`/`statusLine`; removidos órfãos `limitTag` e `barLabel`; `barTrack.marginBottom` removido (espaçamento agora via `gap` do bloco).
- `limitBanner` (CTA de upgrade) e lista de `features` **inalterados**.

**Limites respeitados:** reusa as variáveis já calculadas (`count`/`limit`/`pct`/`atLimit`/`nearLimit`) — nenhuma lógica nova; sem mudança de comportamento/regras/dados.

**Sem mudanças em:** `canAddAthlete`, serviços, `firestore.rules`, `firestore.indexes.json`, `functions/`, modelo de dados.

**Validado:** `npm run build` ✅ 107 módulos, 0 erros.

**Estado da Wave 7:** **completa** — H-26 a H-33 todas done. Possível pendência cosmética opcional registrada: reindentação do sub-bloco da `<table>` na `AthleteLinksTable` (deixada para um commit de style separado, se desejado).

---

## H-32 — Feedback de ações administrativas via banner padronizado (Wave 7 — concluída)

**Recorte fechado com o usuário:** criar `FeedbackBanner` (success/error) · substituir só os 4 `alert()` nativos · dispensável (✕), sem auto-hide · banner contextual de página (não modal) · `confirm()` mantido · sem expandir para outros fluxos.

**Componente novo:** `src/components/feedback/FeedbackBanner.jsx`
- Props `{ kind, message, onClose }`; variantes success (verde) / error (vermelho); botão ✕ sem timer.
- Acessibilidade: `role="alert"` para erro, `role="status"` para sucesso; `aria-label="Fechar mensagem"` no botão.

**Telas alteradas:**
- `src/pages/account/AccountAdminPage.jsx` — estado `actionFeedback`; alerts de desvincular e atualizar status → banner (após o `AccountSummaryCard`).
- `src/pages/admin/AdminPlansPage.jsx` — estado `actionFeedback`; alert de atualizar plano → banner (após o header).
- `src/pages/admin/AdminUsersPage.jsx` — estado `actionFeedback`; alert de atualizar status → banner (após o header).

**Decisões/limites respeitados:**
- Substituído **só o meio de exibição** (`alert` → `state + FeedbackBanner`); lógica de erro inalterada.
- Os 4 casos são erros; os sucessos de toggle continuam silenciosos (não faziam parte dos alerts).
- Feedbacks inline já existentes (`inviteSuccess`, `resendFeedback`, etc.) não foram tocados.
- `confirm()` mantido nativo; sem auto-hide; sem sistema global de notificações.
- Zero `alert()` restante no projeto.

**Sem mudanças em:** serviços, `firestore.rules`, `firestore.indexes.json`, `functions/`, modelo de dados.

**Validado:** `npm run build` ✅ 107 módulos (+1 do componente novo), 0 erros.

**Próximo passo:** H-33 — Indicador de uso de plano mais legível no topo da conta.

---

## H-31 — Revisão de microcopy (Wave 7 — concluída)

**Recorte fechado com o usuário:** escopo só conta+admin · copy-only (sem mudar mecanismo/layout/fluxo) · nunca vazar `err.message` na UI · erro técnico → copy fixa genérica; regra de negócio conhecida → copy fixa específica nossa · tom impessoal, curto, sentence case, ponto final, sem exclamação, nome/e-mail entre aspas.

**Arquivos (6):** `AccountAdminPage.jsx`, `AdminAccountsPage.jsx`, `AdminPlansPage.jsx`, `AdminUsersPage.jsx`, `AdminAccountFormPage.jsx`, `AdminPlanFormPage.jsx`.

**O que foi feito:**
- Substituídos os `alert('Erro ao …: ' + err.message)` (desvincular, atualizar status em conta e em AdminUsers, atualizar plano) por copy fixa sem `err.message`.
- Substituídos os fallbacks `setX(err.message || 'Erro ao …')` (carregar dados da conta, opções de vínculo, criar vínculo, reativar, transferir, convidar atleta/trainer, salvar dados, salvar/criar conta, salvar plano, carregar planos/contas/plano) por "Não foi possível _ação_. Tente novamente.".
- Regras de negócio mantidas com copy específica nossa: limite de atletas atingido (link/reativar/transferir/convidar) e e-mail já cadastrado — sem `err.message`.
- Sucessos com nome/e-mail entre aspas; "criar a senha" no convite de trainer.
- `confirm()` de Desvincular/Reativar mantidos (já em bom tom).
- Catches que ficaram sem uso de `err` migrados para `catch {` (padrão já usado no código), evitando variável não usada; `console.error(err)` preservado onde já existia (load handlers).

**Limites respeitados:** sem mudança de comportamento, estrutura de tratamento, layout ou fluxo; sem banner (isso é a H-32); sem refactor amplo.

**Sem mudanças em:** serviços, `firestore.rules`, `firestore.indexes.json`, `functions/`, modelo de dados.

**Validado:** `npm run build` ✅ 106 módulos, 0 erros.

**Próximo passo:** H-32 — Feedback de ações administrativas via banner padronizado.

---

## H-30 — Organização dos vínculos: busca, ordenação e contagem (Wave 7 — concluída)

**Recorte fechado com o usuário:** controles dentro da `AthleteLinksTable` (estado local) · badge só "Convidado" · ordenar "Mais recente" (padrão) + "Nome (A–Z)" · busca única nome/e-mail client-side · contagem "Mostrando X de Y" · empty real vs busca-sem-resultado separados.

**Arquivo:** `src/components/account/AthleteLinksTable.jsx`

**O que foi feito:**
- Estado local `search` e `sortBy` (default `'recent'`); helper `tsSeconds(ts)` para ler `.seconds`.
- Lista derivada `visibleLinks` via `useMemo([links, search, sortBy, isInactive])`: filtro `includes` case-insensitive em `displayName`/`email`; ordenação `recent` por `linkedAt` (Ativos) / `unlinkedAt` (Inativos) desc, ou `name` por `localeCompare('pt-BR')`.
- Toolbar acima da tabela: input de busca + select (Mais recente / Nome (A–Z)) + "Mostrando {visibleLinks.length} de {links.length}".
- Badge "Convidado" (`StatusBadge kind="userStatus" value="invited"`) na célula do nome quando `athlete.status === 'invited'` — **fecha o item deslocado da H-26**.
- Estados vazios separados: lista realmente vazia → `EmptyStateCard` (inalterado, antes do toolbar); busca sem resultado (lista não-vazia) → `<p>` "Nenhum atleta corresponde à busca.".
- 6 novos estilos: `toolbar`, `search`, `sortSelect`, `count`, `noMatch`, `nameCell`.

**Decisão de natureza:** `AthleteLinksTable` deixou de ser 100% apresentacional (ganhou estado local) — intencional, justificado pelo reuso nas abas Ativos/Inativos. `AccountAdminPage` permaneceu intocada.

**Sem mudanças em:** `AccountAdminPage`, serviços, `firestore.rules`, `firestore.indexes.json`, `functions/`, modelo de dados. Tudo client-side.

**Validado:** `npm run build` ✅ 106 módulos, 0 erros.

**Próximo passo:** H-31 — Revisão de microcopy (mensagens de sucesso / erro / confirmação).

---

## H-29 — Resumo de card de atleta mais informativo (Wave 7 — concluída)

**Recorte fechado com o usuário:** corte de inatividade de 14 dias · "Último check-in: DD/MM/AAAA" (data absoluta) + rótulo âmbar "Sem atividade há X dias" quando estoura o corte · só cards ativos (trainer + coach) · cards inativos sem resumo · sem nova query/backend/modelo.

**Arquivo:** `src/pages/trainer/TrainerAthletesPage.jsx`

**O que foi feito:**
- Bloco `activitySummary` do card ativo: data agora prefixada com "Último check-in: "; após o badge de status, rótulo âmbar "Sem atividade há X dias" quando `daysSince(activityDate) > INACTIVITY_DAYS`.
- Helper local `daysSince(ts)` (mesmo tratamento de Timestamp do `formatDate`: `ts.toDate()` ou `ts.seconds`; `Math.floor((Date.now() - d)/86400000)`).
- Constante `INACTIVITY_DAYS = 14`.
- Estilo `inactivityLabel` (pill âmbar `#fef3c7`/`#92400e`); `activitySummary` ganhou `flexWrap: 'wrap'` para o rótulo quebrar linha em cards estreitos.
- Reusa o `lastActivity` já carregado por `listActivitiesByAthlete({ limit: 1 })` — **sem nova query**.

**Escopo respeitado:** sem atividade → "Sem atividades registradas" (inalterado); cards inativos seguem sem resumo (igual H-20); comportamento idêntico para trainer e coach.

**Sem mudanças em:** serviços, `firestore.rules`, `firestore.indexes.json`, `functions/`, modelo de dados.

**Validado:** `npm run build` ✅ 106 módulos, 0 erros.

**Próximo passo:** H-30 — Organização dos vínculos: busca, ordenação e contagem.

---

## H-28 — Estados de carregamento e erro padronizados (Wave 7 — concluída)

**Recorte fechado com o usuário:** reusar `EmptyStateCard` (loading) · reusar `ErrorStateCard` com "Tentar novamente" (erro) · só na carga principal de cada tela · retry chama o `load()` existente · sub-cargas e erros de formulário fora de escopo.

**Componentes reaproveitados:** `EmptyStateCard.jsx` e `ErrorStateCard.jsx` (já em uso em Atividades/Dashboard). Nenhum componente novo.

**Arquivos:**
- `src/pages/admin/AdminAccountsPage.jsx` — loading → `EmptyStateCard`; erro → `ErrorStateCard` `onAction={load}`. Estilos `hint`/`errorText` removidos.
- `src/pages/admin/AdminPlansPage.jsx` — idem. Estilos `hint`/`errorText` removidos.
- `src/pages/account/AccountAdminPage.jsx` — loading/erro principal → cards com retry. `hint`/`errorText` mantidos (ainda usados em hints de formulário e no guard de conta).
- `src/pages/trainer/TrainerAthletesPage.jsx` — `load()` **elevado** de dentro do `useEffect` para um `useCallback` no escopo do componente (para viabilizar o retry); `useEffect(() => { load(); }, [load])`. Loading/erro principal → cards com retry. `errorText` removido; `hint` mantido para a sub-carga "Carregando histórico…".

**Preservação de comportamento (TrainerAthletesPage):** guard `if (!user?.uid) return;` movido para dentro do `useCallback`; deps `[user?.uid, isCoach]` idênticas às do `useEffect` anterior. Com uid ausente, `loading` permanece `true` como antes.

**Notas:**
- `error` das 4 telas é string → `ErrorStateCard message={error}` (sem `.message`).
- Sub-cargas (toggle "mostrar inativos") e erros de formulário (`inviteError`, `transferError`, `linkError`, `reactivateError`, `infoError`) **não** foram tocados.

**Sem mudanças em:** serviços, `firestore.rules`, `firestore.indexes.json`, `functions/`.

**Validado:** `npm run build` ✅ 106 módulos, 0 erros.

**Próximo passo:** H-29 — Resumo de card de atleta mais informativo em "Meus Atletas".

---

## H-27 — Estados vazios (empty states) consistentes (Wave 7 — concluída)

**Recorte fechado com o usuário:** reusar o `EmptyStateCard` existente · sem ícone nesta wave · CTA só onde a ação já existe na tela · listas sem ação própria ficam só com mensagem · mensagens de validação em formulários ficam fora de escopo.

**Componente reaproveitado:** `src/components/feedback/EmptyStateCard.jsx` (já usado em Atividades/Detalhe/Dashboard) — nenhum componente novo criado.

**Arquivos:**
- `src/pages/trainer/TrainerAthletesPage.jsx` — listas de ativos e inativos → `EmptyStateCard` (message-only; trainer não convida).
- `src/pages/account/AccountAdminPage.jsx` — seção "Treinadores e Coaches" → `EmptyStateCard` com CTA "+ Convidar" (mesmo handler do botão do header).
- `src/pages/admin/AdminAccountsPage.jsx` — vazio → CTA "+ Nova conta"; sem match de filtro → CTA "Limpar filtros".
- `src/pages/admin/AdminPlansPage.jsx` — vazio → CTA "+ Novo plano".
- `src/components/account/AthleteLinksTable.jsx` — empties de ativos/inativos → `EmptyStateCard` (message-only; botões já no header acima); estilo `empty` removido.

**Decisões de escopo:**
- CTAs reaproveitam os botões/handlers que já existem em cada tela — nenhuma navegação ou estado novo.
- `styles.hint` foi mantido onde ainda serve ao estado de carregamento ("Carregando…").
- Mensagens de validação em formulários da `AccountAdminPage` ("Nenhum atleta/treinador disponível para vincular") **não** foram tocadas — não são empty state de lista.

**Sem mudanças em:** serviços, `firestore.rules`, `firestore.indexes.json`, `functions/`.

**Validado:** `npm run build` ✅ 106 módulos, 0 erros.

**Próximo passo:** H-28 — Estados de carregamento e erro padronizados nas listas.

---

## H-26 — Componente único de badge de status (Wave 7 — concluída)

**Commit:** `b4fc9bb`. **Recorte fechado com o usuário:** abstração mínima (componente) · API semântica por domínio · reuso de `kind="userStatus"` para conta/plano. Detalhe completo em `docs/wave7-proposal.md`.

**Arquivos:**
- `src/components/ui/StatusBadge.jsx` — NOVO. API `<StatusBadge kind value />`. Tons: success/neutral/info/warning/accent. Domínios: `userStatus` (invited/active/inactive), `role` (trainer/coach), `activity` (open/completed). Fallback: valor cru + tom neutro.
- `src/pages/account/AccountAdminPage.jsx` — badges de papel e status → `StatusBadge`; removidos `trainerStatusLabel`/`trainerStatusStyle` e estilos `badgeTrainer`/`badgeCoach`.
- `src/pages/trainer/TrainerAthletesPage.jsx` — badges de atividade e atleta inativo → `StatusBadge`; removidos `badgeOpen`/`badgeDone`/`inactiveBadge`.
- `src/pages/admin/AdminAccountsPage.jsx` — badge de status → `StatusBadge` (default defensivo de "Ativo" preservado); removidos `statusStyle`/`statusLabel`.
- `src/pages/admin/AdminPlansPage.jsx` — badge `isActive` → `StatusBadge`; removidos `badgeActive`/`badgeInactive`.

**Padronizações aplicadas:** pill único `3px 10px / 12px / weight 600 / radius 999px`; removido o uppercase solto do badge de atleta inativo; cinza de inativo unificado em `#475569`.

**Ajuste de escopo:** `AthleteLinksTable` não tinha badge — adicionar um "Convidado" para atletas é comportamento novo, **movido para H-30** (onde a tabela será mexida).

**Sem mudanças em:** serviços, `firestore.rules`, `firestore.indexes.json`, `functions/`.

**Validado:** `npm run build` ✅ 106 módulos, 0 erros.

**Próximo passo:** H-27 — Estados vazios (empty states) consistentes nas listas.

---

## H-10 — Coach visualiza atletas de todos os seus trainers (Wave 4 — concluída)

**Arquivos alterados:**
- `functions/index.js` — nova Cloud Function `coachAthletes` (Express + `requireAuth`)
- `src/services/coach-athletes-backend.service.js` — NOVO — cliente HTTP para `coachAthletes`
- `src/services/trainer-athlete-context.service.js` — `listTrainerAthleteOptions` aceita `role`; branch `coach` chama `fetchCoachAthletes`
- `src/pages/CheckInPage.jsx` — passa `role: normalizedProfileType` na chamada de `listTrainerAthleteOptions`
- `src/pages/CheckOutPage.jsx` — idem
- `src/pages/activities/ActivitiesListPage.tsx` — passa `role` na chamada de `listTrainerAthleteOptions`
- `src/pages/trainer/TrainerAthletesPage.jsx` — branch coach usando `fetchCoachAthletes`; card mostra `trainerName`; seção de inativos oculta para coach

**O que foi implementado:**

`functions/index.js` — `coachAthletes`:
- `GET ?coachUid=<uid>` com `requireAuth`; token.uid deve ser igual a coachUid
- Verifica `papel === 'coach'` no Firestore
- Busca todos os trainers subordinados: `users WHERE treinador_id == coachUid AND papel == 'trainer'` (Admin SDK — bypass de regras)
- Para cada trainerUid (+ coachUid): `athlete_links WHERE trainerId == X AND status == 'active'`
- Deduplica por athleteId (primeiro trainer vence)
- Busca perfis dos atletas; retorna `[{uid, displayName, email, trainerUid, trainerName}]`
- Ordenação por displayName pt-BR no servidor

`src/services/coach-athletes-backend.service.js`:
- Padrão idêntico a `athlete-dashboard-backend.service.js`
- `resolveEndpoint()` com suporte a emulador (`VITE_USE_FUNCTIONS_EMULATOR=true`)
- URL produção: `https://us-central1-afp-avaliacaofisica.cloudfunctions.net/coachAthletes`
- URL emulador: `http://127.0.0.1:5001/afp-avaliacaofisica/us-central1/coachAthletes`

`src/services/trainer-athlete-context.service.js`:
- `listTrainerAthleteOptions(uid, { includeSelfAthlete, role })` — novo parâmetro `role` (default `'trainer'`)
- Branch `role === 'coach'`: chama `fetchCoachAthletes(uid)` e mapeia para `{id, displayName, trainerUid, trainerName}`
- Branch trainer: comportamento idêntico ao anterior

`src/pages/trainer/TrainerAthletesPage.jsx`:
- Desestrutura `role` de `useAuth()`; `isCoach = role === 'coach'`
- Branch coach: `fetchCoachAthletes(user.uid)` + `activityService.listActivitiesByAthlete({ limit: 1 })` em paralelo; falha na activity é silenciosa (`Promise.allSettled`)
- Branch trainer: comportamento idêntico ao anterior
- Card coach: exibe `trainerName` ("Treinador: X") em cinza claro abaixo do email
- Seção de inativos: oculta quando `isCoach` (dados de `getTrainerInactiveAthletes(coachUid)` seriam enganosos — só mostraria links diretos do coach, não dos sub-trainers)

**Decisão arquitetural registrada:**
- Client SDK não pode fazer query `athlete_links WHERE trainerId == trainerUid` com `auth.uid == coachUid` (regra Firestore: `trainerId == request.auth.uid`)
- Solução: Cloud Function com Admin SDK — único caminho sem mudança de schema ou de regras Firestore
- Coach não inclui sua própria UID como "trainer" no resultado visível — a deduplicação usa coachUid como fallback para atletas com link direto ao coach (edge case)
- Atividades de sub-trainer athletes não são legíveis pelo coach via Client SDK (`trainerUserId != coachUid`); exibe "Sem atividades registradas" — comportamento aceitável

**Deploy realizado em 2026-05-29:**
- `firebase deploy --only functions` → `coachAthletes` criada (Node 22, us-central1) ✅
- `firebase deploy --only hosting` → build 105 módulos publicado ✅

**Fix pós-smoke-test (mesmo dia):** coach recebia 403 ao carregar atividades de atletas de sub-trainers.

Causa: `trainerDashboardStats` e `trainerActivities` verificavam apenas `athlete.treinador_id === trainerUid` (trainer direto) e fallback por atividades compartilhadas. Para atletas de sub-trainers, nenhum dos dois passava.

Correção: helper `resolveTrainerAthleteAuth(callerUid, athleteUid, athleteData)` adicionado em `functions/index.js`. Terceiro caminho de autorização:
1. `athlete.treinador_id === callerUid` (trainer direto — caminho original)
2. Alguma activity com `trainerUserId === callerUid` (fallback legacy — caminho original)
3. **Novo — coach:** caller tem `papel === 'coach'`, o athlete tem link ativo, e o trainer real desse link tem `treinador_id === callerUid`

Ambas as funções agora chamam o helper no lugar do bloco de auth inline. Caminho do trainer inalterado.

- `firebase deploy --only functions` (fix) → `trainerDashboardStats` e `trainerActivities` atualizadas ✅

**Fix 2 pós-deploy (2026-05-30):** dropdown de atletas em CheckIn/CheckOut mostrava UID para atletas de sub-trainers.

Causa: `useUserDisplayNames` busca `users/{uid}` via Client SDK. Firestore bloqueia a leitura quando `athlete.treinador_id ≠ coachUid` (sub-trainer athletes). O catch silenciava o erro e o fallback exibia o UID.

Correção em `CheckInPage.jsx` e `CheckOutPage.jsx`:
- `currentAthleteLabel`: prioriza `trainerAthletes.find(a => a.id === effectiveAthleteId)?.displayName` antes de `userDisplayNames[id]`
- Option label no dropdown: prioriza `athlete.displayName` antes de `userDisplayNames[athlete.id]`

O `displayName` já vem populado em `trainerAthletes` via `listTrainerAthleteOptions` (Cloud Function para coach, `getUserProfile` para trainer). O `userDisplayNames` permanece como fallback.

- `firebase deploy --only hosting` (fix 2) → CheckIn e CheckOut com nomes corretos para atletas de sub-trainers ✅

**Validação manual (após deploy):**
1. Login como `coach@dev.local` → navegar para `/trainer/athletes` → ver atleta `cathleteB@dev.local` (atleta do ctrainer) com "Treinador: [nome ctrainer]"
2. Login como `coach@dev.local` → CheckIn → seletor de atleta lista `cathleteB@dev.local`
3. Login como `coach@dev.local` → CheckOut → seletor de atleta lista `cathleteB@dev.local`
4. Login como `coach@dev.local` → Atividades → seletor de atleta lista `cathleteB@dev.local`
5. Login como `ctrainer@dev.local` → confirmar que comportamento de trainer não mudou

**Validado em:** build limpo (105 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ 105 módulos |

---

## H-20 — Meus Atletas: resumo de atividade recente por card (Wave 5 — concluída)

**Arquivo alterado:** `src/pages/trainer/TrainerAthletesPage.jsx`

**O que foi feito:**
- Import de `activityService` adicionado
- No `load()` dos atletas ativos: o `Promise.allSettled` interno agora busca `getUserProfile` e `activityService.listActivitiesByAthlete({ limit: 1 })` em paralelo. Falha em qualquer uma das duas não impede o card de aparecer (`Promise.allSettled` por design).
- `lastActivity` (primeiro item retornado, ou `null`) é anexado ao objeto do atleta em estado.
- No card ativo: seção `activitySummary` exibe data formatada + badge de status (`'open'` → azul "Em andamento", `'completed'` → verde "Concluída", sem atividade → cinza itálico "Sem atividades registradas").
- Cards inativos sem resumo (escopo mínimo).
- Comportamento idêntico para trainer e coach — `listActivitiesByAthlete` já era permitida pelas regras Firestore existentes (confirmado pelo CheckOutPage).
- 5 novos estilos adicionados: `activitySummary`, `activityDate`, `badgeOpen`, `badgeDone`, `activityNone`.

**Validação manual:**
1. Trainer com atletas com atividade concluída → data + badge verde "Concluída"
2. Trainer com atleta com sessão aberta → badge azul "Em andamento"
3. Trainer com atleta sem histórico → texto cinza "Sem atividades registradas"
4. Login como coach → mesmo comportamento
5. Cards inativos → sem resumo (correto)

**Estado do roadmap após H-20:** Wave 5 completa. H-10 permanece bloqueada (decisão arquitetural pendente sobre Cloud Function para coach ver atletas de todos os seus trainers).

---

## H-19 — CheckOut: calcular duração automaticamente (Wave 5 — concluída)

**Arquivo alterado:** `src/pages/CheckOutPage.jsx`

**O que foi feito:**
- `useEffect([elapsedMinutes])`: quando `elapsedMinutes` se torna disponível (após `openActivity` carregar) e `form.duracaoMin` ainda está vazio, pré-preenche com `String(elapsedMinutes)`. Guard `form.duracaoMin === ''` impede sobrescrever valor já digitado pelo usuário.
- Step 3: texto de apoio exibe `"Calculado automaticamente com base no check-in (X min). Você pode ajustar se necessário."` quando `elapsedMinutes > 0`. Caso contrário exibe o texto original.
- Campo permanece editável; submit persiste o valor final que estiver no input.
- Nenhuma mudança em backend, serviços, Firestore ou modelo de dados.

**Validação manual:**
1. Fazer check-in, aguardar alguns minutos, abrir check-out
2. Step 1: "Tempo decorrido" mostra X min
3. Avançar até step 3: campo "Duração" deve estar pré-preenchido com X e texto de apoio visível
4. Editar o valor → submit → verificar no Firestore que `durationMinutes` reflete o valor editado
5. Abrir check-out sem sessão ativa → nenhum erro (campo fica vazio, texto original)

**Próximo passo:** H-20 — Meus Atletas: resumo de atividade recente por card

---

## H-18 — CheckIn: salvar progresso como rascunho (Wave 5 — concluída)

**Arquivos alterados:**
- `src/pages/CheckInPage.jsx`
- `src/components/pain-map/usePainRegions.ts`

**O que foi feito:**

`usePainRegions.ts`: adicionada função `resetRegions(regions: Record<string, boolean>)` ao retorno do hook — expõe o `setSelected` interno para permitir restauração programática do mapa de dor. Mudança aditiva, sem breaking change.

`CheckInPage.jsx`:
- 4 funções de draft no escopo do módulo: `draftKey`, `saveDraft`, `loadDraft`, `clearDraft` — todas usam `localStorage`, erros silenciosos
- Chave de draft: `checkin_draft_{uid}_{athleteId}` — escopo por usuário + atleta
- Restore no `onAuthStateChanged` effect: após `targetAthleteId` estar definido, carrega draft e restaura `form`, `step` e mapa de dor via `resetRegions`
- `useEffect([form, step])`: auto-salva draft a cada mudança; guards para `user`, `effectiveAthleteId`, `pageLoading`, `contextLoading`, `success` evitam salvar estado inicial antes da page estar pronta
- `clearDraft` chamado no `handleSubmit` após `setSuccess(true)` — draft apagado apenas em submit bem-sucedido

**Comportamento:**
- Draft ignorado (não apagado) se check-in estiver bloqueado por sessão aberta
- Restauração silenciosa, sem banner
- Sem botão de descartar rascunho

**Validação manual:**
1. Iniciar check-in → preencher etapas 1-3 → navegar para outra página
2. Voltar para check-in → wizard deve retomar no step correto com dados preenchidos
3. Marcar regiões de dor no mapa → sair → voltar → mapa deve mostrar regiões marcadas
4. Completar check-in → voltar para check-in → wizard deve começar do zero (draft limpo)

**Próximo passo:** H-19 — CheckOut: calcular duração automaticamente

---

## H-17 — Atividades: busca além da janela de 7 dias (Wave 5 — concluída)

**Arquivo alterado:** `src/pages/activities/ActivitiesListPage.tsx`

**O que foi alterado:**
- `loadActivities` recebeu novo parâmetro `daysParam: number` (3º argumento, antes do `athleteId` opcional)
- Os dois call sites internos passam `daysParam` para `getTrainerDashboardStatsByPeriod` e `getAthleteDashboardStats`
- Estado `days: number` adicionado (default `7`)
- `useEffect([days])` adicionado: recarrega a lista quando o período muda, respeitando o papel e o atleta selecionado
- `handleAthleteChange` atualizado para passar `days` na chamada de `loadActivities`
- Retry de erro atualizado para passar `days`
- Dropdown de período adicionado na UI (sempre visível, acima do seletor de atleta): opções 7 / 30 / 90 / 180 dias

**Nenhuma mudança no backend:** `functions/index.js` já aceitava `?days=N` (1–365) desde a implementação original.

**Validação manual:**
1. Login como athlete → mudar dropdown de 7 para 30 dias → lista recarrega com atividades do período maior
2. Login como trainer → selecionar atleta → mudar período → lista recarrega
3. Login como trainer → mudar período → depois mudar atleta → lista recarrega com período correto

**Próximo passo:** H-18 — CheckIn: salvar progresso como rascunho

---

## H-16 — Dashboard: atualização automática após checkout (Wave 5 — concluída)

**Arquivo alterado:** `src/pages/CheckOutPage.jsx`

**O que foi alterado:**
- `useEffect` de navegação pós-sucesso (linhas 163-170): ao invés de sempre navegar para `/dashboard`, agora redireciona para `/dashboard?athleteId=${selectedAthleteId}` quando `isTrainerProfile && selectedAthleteId`; atletas continuam indo para `/dashboard` sem parâmetro
- Dependências do effect atualizadas para incluir `isTrainerProfile` e `selectedAthleteId`

**Decisão de escopo confirmada pelo usuário:**
- Sem banner ou indicador visual extra — os dados atualizados do dashboard são suficientes
- O Dashboard já suporta `?athleteId=` desde H-02; nenhuma alteração no Dashboard foi necessária

**Validação manual:**
1. Login como trainer — selecionar atleta — concluir checkout — aguardar 1,2s → deve redirecionar para `/dashboard?athleteId=XXX` com o atleta pré-selecionado
2. Login como coach — selecionar atleta — concluir checkout → mesmo comportamento
3. Login como athlete — concluir checkout → redireciona para `/dashboard` sem parâmetro

**Próximo passo:** H-17 — Atividades: busca além da janela de 7 dias

---

## H-01 — ActivityDetailPage: visualização completa (Wave 1 — concluída)

**Arquivo:** `src/pages/activities/ActivityDetailPage.tsx`

**O que foi adicionado ao stub existente:**
- `trainerUserId` e `athleteUserId` no tipo `Activity` e no normalizador — necessários para a verificação de autoria
- **Regiões de dor:** `dorRegioes` era normalizado mas nunca renderizado; agora exibido como tags vermelhas usando `getRegionByCode`
- **Botão "Fechar sessão":** visível apenas quando `isOpen && auth.currentUser.uid ∈ {trainerUserId, athleteUserId}`; navega para `/checkout`
- **PSE com label descritivo:** `5 → "5 • Moderado"` usando a mesma escala do Dashboard
- **Hidratação com label descritivo:** `3/8 → "3/8 — Amarelo claro — hidratação adequada"`
- **Notas do checkout** (`checkout.notes`) normalizadas e exibidas junto com recuperação
- Sessão em andamento: seção de check-out exibe mensagem explicativa em vez de dados ausentes

**Validado em:** build limpo (97 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ |

---

## O que foi concluído neste ciclo

### Correções do fluxo coach (maio 2026)

**Problema raiz:** coach não via atletas em nenhuma tela operacional.

Três bugs independentes corrigidos:

1. **Dashboard `loadCoachFilters`** — chamava `listTrainerAthleteOptions(ctrainerUid)` com `auth.uid == coachUid`, query bloqueada pelo Firestore. Corrigido para `listTrainerAthleteOptions(coachUid)`.
2. **Dashboard `loadDashboardStats`** — usava `selectedTrainer` (ctrainerUid) como `trainerUserId` na query de atividades; atividades criadas pelo coach têm `trainerUserId: coachUid`. Corrigido para sempre usar `uid` (coachUid).
3. **CheckIn / CheckOut** — branch `if (normalizedProfileType === 'trainer')` excluía `'coach'`. Corrigido para `=== 'trainer' || === 'coach'` em ambas as páginas.

**Seed de dados:** `cathlete@dev.local` (atleta do coach) e `cathleteB@dev.local` (atleta do ctrainer) com `treinador_id` correto para cada papel. Link equivocado `cathlete↔ctrainer` desativado.

### Infraestrutura de testes (maio 2026)

- `firestore.rules.test.ts` — 21 casos Vitest cobrindo coach/trainer/athlete
- `scripts/seed-coach-emulator.mjs` — seed self-contained do emulador
- `scripts/validate-coach-flow-emulator.mjs` — validação ponta a ponta via Admin SDK
- `npm run test:coach-flow:emulator` — self-contained (seed + validação)
- Porta Firestore padronizada: **8081** em todos os arquivos

### H-02 — Dashboard respeita `?athleteId=` (Wave 1 — concluída)

**Arquivo:** `src/pages/DashboardPage.jsx`

**Mudança:** `useSearchParams` lê `athleteId` da URL. Passado para `loadTrainerFilters` e `loadCoachFilters` como parâmetro opcional. Aplicado apenas se o ID pertencer à lista já carregada — sem acesso a dados de outro trainer.

**Validado em:** staging (manual) + build limpo.

---

## Validações já feitas

| Teste | Resultado | Data |
|---|---|---|
| `npm run test:rules:emulator` | 21/21 ✅ | 2026-05-28 |
| `npm run test:coach-flow:emulator` | 26/26 ✅ | 2026-05-28 |
| Smoke test staging — coach@dev.local | ✅ | 2026-05-28 |
| Smoke test staging — ctrainer@dev.local | ✅ (após fix cathleteB) | 2026-05-28 |
| Smoke test staging — cathlete@dev.local | ✅ | 2026-05-28 |
| `firebase deploy` | ✅ produção | 2026-05-28 |
| Build H-02 | ✅ | 2026-05-28 |

---

## Decisões arquiteturais relevantes

### 1. `treinador_id` é single-value — um responsável por atleta

A regra Firestore `resource.data.treinador_id == request.auth.uid` exige que um atleta tenha exatamente um responsável com permissão de leitura. Um atleta não pode ser lido por coach e ctrainer simultaneamente via Client SDK.

**Consequência:** cada atleta de teste tem seu próprio responsável:
- `cathlete@dev.local` → `treinador_id: coachUid`
- `cathleteB@dev.local` → `treinador_id: ctrainerUid`

### 2. Coach não pode consultar `athlete_links` de trainer subordinado

`WHERE trainerId == ctrainerUid` com `auth.uid == coachUid` é bloqueado pelas regras. O Dashboard do coach lista apenas os atletas com `trainerId == coachUid`. H-10 requer decisão sobre Cloud Function antes de implementar.

### 3. `handleTrainerChange` não recarrega atletas

Por design: quando o coach troca o treinador no filtro, a lista de atletas não muda (permanece a do coach). Comentado no código. Documentado em `firestore.rules.test.ts` como comportamento esperado.

### 4. Porta Firestore: 8081

Migrado de 8080 para evitar conflito com outro processo. Fixado em: `firebase.json`, `firestore.rules.test.ts`, `src/services/firebase/config.js`.

---

## H-03 — AccountAdminPage: reativar vínculo inativo (Wave 1 — concluída)

**Arquivos alterados:**
- `src/services/athleteLinkService.js` — adicionada `getAccountInactiveAthleteLinks`
- `src/components/account/AthleteLinksTable.jsx` — props `mode`, `reactivatingId`, `onReactivate`; botão "Reativar" verde para modo `inactive`
- `src/pages/account/AccountAdminPage.jsx` — tabs Ativos/Inativos, carregamento de inativos no `load()`, handler `handleReactivate` com check de `canAddAthlete`

**O que foi implementado:**
- `getAccountInactiveAthleteLinks(accountId)` — query `WHERE accountId == X AND status == 'inactive'`
- Tabs "Ativos (N)" / "Inativos (N)" acima da tabela de vínculos
- Aba Inativos: lista vínculos enriquecidos com perfil do atleta; botão "Reativar" por linha
- Fluxo de reativação: verifica `canAddAthlete` **antes** do `confirm()`; bloqueia com mensagem se limite atingido; chama `reactivateAthleteLink` → `load()` para refrescar ambas as abas
- Atletas com vínculo inativo excluídos do formulário "Vincular atleta" (usam "Reativar" em vez de nova criação)
- Aba Ativos: comportamento idêntico ao anterior

**Validado em:** build limpo (97 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ |

---

## H-04 — account_admin convida trainer (Wave 2 — concluída)

**Arquivos alterados:**
- `src/services/userService.js` — `createUser` agora aceita `accountId` e persiste no Firestore
- `src/pages/account/AccountAdminPage.jsx` — seção "Treinadores" com lista + formulário de convite

**O que foi implementado:**
- `createUser` recebe `accountId` (opcional; `null` por padrão para não quebrar `AdminUserFormPage`)
- `AccountAdminPage.load()` busca `listUsers({ papel: 'trainer', accountId })` em paralelo com o resto
- Seção "Treinadores" exibe tabela com Nome, E-mail e badge de status (Convidado/Ativo/Inativo)
- "+ Convidar trainer": formulário inline com E-mail + Nome → chama `createUser({ papel: 'trainer', status: 'invited', accountId })`
- `createUser` envia `sendPasswordResetEmail` automaticamente → email de convite já sai
- Erro `auth/email-already-in-use` tratado com mensagem específica
- Mensagem de sucesso verde após convite: "Convite enviado para x@y.z. O trainer receberá um e-mail para criar sua senha."
- Índice composto `(accountId, papel)` já existia — nenhuma mudança em `firestore.indexes.json`
- Regras Firestore: `isAccountAdmin() → allow create` em `users/` já cobria este caso — nenhuma mudança

**Validado em:** build limpo (97 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ |

---

## H-05 — account_admin convida athlete e vincula a trainer (Wave 2 — concluída)

**Arquivos alterados:**
- `src/pages/account/AccountAdminPage.jsx` — botão "+ Convidar athlete", formulário inline, `handleOpenInviteAthleteForm`, `handleInviteAthlete`

**O que foi implementado:**
- Botão "+ Convidar athlete" sempre visível no header de "Vínculos de atletas" (criação de usuário não consome limite)
- Formulário inline: E-mail, Nome, dropdown de Trainer (opcional — trainers + coaches da conta)
- Dropdown carregado sob demanda ao abrir o formulário (`listUsers` trainer + coach em paralelo)
- Fluxo com trainer selecionado: `canAddAthlete` é verificado **antes** de criar o usuário → se limite atingido, bloqueia com mensagem e permite criar sem vínculo
- `createUser({ papel: 'athlete', status: 'invited', accountId })` → `linkAthleteChecked(newUid, trainerId, accountId)` quando trainer selecionado
- `linkAthleteChecked` faz dual-write `treinador_id` automaticamente (comportamento existente)
- Sem trainer: apenas `createUser` — athlete aparecerá na tabela de vínculos inativos/sem vínculo futuramente; pode ser vinculado depois via "+ Vincular atleta"
- Race condition tratada: se `linkAthleteChecked` lançar `limit_reached` após o usuário ser criado, mensagem explicativa + `load()` atualiza a lista
- E-mail já cadastrado tratado com `auth/email-already-in-use`
- Mensagem de sucesso verde com nome do atleta e treinador (ou instrução de vincular depois)
- Formulários "Convidar athlete" e "Vincular atleta" fecham-se mutuamente
- Troca de tab (Ativos/Inativos) fecha o formulário de convite

**Sem mudanças em:** `userService.js`, `accountService.js`, `athleteLinkService.js`, `firestore.rules`, `firestore.indexes.json`

**Validado em:** build limpo (97 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ |

---

## H-06 — Profile completion flow para usuário convidado (Wave 2 — concluída)

**Arquivos alterados:**
- `src/context/AuthContext.jsx` — adicionada `refreshProfile()` ao contexto
- `src/components/ProtectedRoute.jsx` — redireciona para `/perfil/completar` se `profileCompleted === false` e não é admin
- `src/app/router.jsx` — rota `/perfil/completar` + componente `ProfileCompletionGuard`
- `src/pages/profile/ProfileCompletionPage.jsx` — nova página (criada)

**O que foi implementado:**
- `refreshProfile()` em `AuthContext` — re-lê `getUserProfile(uid)` e atualiza o estado do contexto; necessário para que `ProtectedRoute` não redirecione de volta após salvar
- `ProtectedRoute` agora verifica `profile.profileCompleted === false` → redireciona para `/perfil/completar`; exceção: `papel === 'platform_admin'` ou `papel === 'account_admin'` — esses nunca são interceptados
- `/perfil/completar` fica fora do `ProtectedAppLayout` (sem nav bar) — acessível a qualquer usuário autenticado
- `ProfileCompletionGuard`: se já tiver perfil completo (`profileCompleted !== false`), redireciona direto para `/dashboard` — evita loop para usuários que acessam a rota diretamente
- `ProfileCompletionPage`: formulário com Nome (obrigatório), Telefone, Data de nascimento, Sexo
- Ao salvar: `updateUserProfile({ ...form, profileCompleted: true, status: 'active' })` → `refreshProfile()` → navigate `/dashboard`
- `status: 'active'` é gravado junto com o perfil — usuário sai de `invited` para `active` ao completar

**Decisão arquitetural:** `refreshProfile` + `navigate` sequencial — React garante que o estado atualizado de `profile` esteja disponível no próximo render do `ProtectedRoute`, evitando loop de redirect.

**Validado em:** build limpo (98 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ |

---

## H-07 — Reenvio de convite (Wave 2 — concluída)

**Arquivos alterados:**
- `src/pages/account/AccountAdminPage.jsx` — import `sendInviteEmail`, estados `resendingEmail`/`resendFeedback`, handler `handleResendInvite`, botão na tabela de trainers, props para `AthleteLinksTable`, banner de feedback, style `btnResend`
- `src/components/account/AthleteLinksTable.jsx` — props `resendingEmail`/`onResendInvite`, botão "Reenviar convite" para atletas com `status === 'invited'`, style `btnResend`

**O que foi implementado:**
- `handleResendInvite(email)` chama `sendInviteEmail(email)` (= `sendPasswordResetEmail` — mesmo mecanismo do `createUser`)
- **Trainers:** botão "Reenviar convite" (âmbar) visível ao lado do badge de status apenas quando `t.status === 'invited'`
- **Athletes (aba Ativos):** botão "Reenviar convite" visível ao lado do "Desvincular" quando `link.athlete?.status === 'invited'` e `onResendInvite` está disponível
- **Aba Inativos:** botão NÃO aparece (atletas inativos não precisam de reenvio)
- `resendingEmail` rastreia qual e-mail está sendo enviado → desabilita o botão e mostra "Enviando…"
- Banner de feedback (verde/vermelho) aparece logo após o `AccountSummaryCard`; persiste até a próxima ação de reenvio
- Sem cooldown nesta versão (conforme especificado)

**Validado em:** build limpo (98 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ |

---

## Wave 2 — concluída

Todas as histórias de Wave 2 estão done: H-04 ✅, H-05 ✅, H-06 ✅, H-07 ✅.

---

## H-08 — Transferir atleta entre trainers (Wave 3 — concluída)

**Arquivos alterados:**
- `src/services/athleteLinkService.js` — adicionada `transferAthleteLink` (Firestore batch atômico)
- `src/services/accountService.js` — adicionada `transferAthleteWithBatch` (wrapper sem limit check)
- `src/components/account/AthleteLinksTable.jsx` — prop `onTransfer`, botão "Transferir" (azul) no modo active, style `btnTransfer`
- `src/pages/account/AccountAdminPage.jsx` — estados `transferTarget/transferTrainerId/transferring/transferError`, handlers `handleOpenTransferForm/handleTransfer`, formulário inline de transferência

**O que foi implementado:**
- `transferAthleteLink` — `writeBatch` com três operações atômicas: deactivate old link, create new link, update `treinador_id` no doc do atleta
- Botão "Transferir" (azul) em cada linha da aba Ativos
- Formulário inline: dropdown com trainers/coaches da conta excluindo o treinador atual
- Fluxo: `handleOpenTransferForm(link)` carrega staff sob demanda, filtra o treinador atual; `handleTransfer()` chama `transferAthleteWithBatch` → `load()`
- Formulários mutuamente exclusivos: abrir transferência fecha convite/vínculo; trocar tab fecha transferência
- Sem limit check — same-account, net-zero (estratégia C escolhida pelo usuário)

**Decisão arquitetural:** Firestore `writeBatch` cobre múltiplas coleções (`athlete_links` + `users`), tornando as três operações verdadeiramente atômicas.

**Validado em:** build limpo (98 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ |

---

---

## H-12 — account_admin visualiza uso do plano com detalhes (Wave 3 — concluída)

**Arquivos alterados:**
- `src/components/account/AccountSummaryCard.jsx` — reescrito para incluir todos os novos requisitos
- `src/pages/account/AccountAdminPage.jsx` — passa prop `upgradeUrl`

**O que foi implementado:**
- **Barra de progresso "X de Y atletas ativos"** — label explícito "N de L — M vagas restantes" ou "N de L — limite atingido"; barra colorida (azul < 80%, âmbar ≥ 80%, vermelho = limite)
- **Lista de features do plano** — mapeamento estático por `planId` (starter/pro/academy); sem mudança no Firestore; exibe checkmarks verdes com os recursos incluídos
- **CTA de upgrade com link configurável** — lê `upgradeUrl` prop (passado de `import.meta.env.VITE_UPGRADE_URL`) ou `plan.upgradeUrl` se existir; oculto quando não configurado; botão vermelho no banner de limite e link sutil na seção de features
- **Estado de limite atingido com destaque visual** — card com borda/fundo vermelho (`cardAtLimit`), banner explícito com título + texto descritivo + botão de upgrade
- **Botões de criação desabilitados no limite** — "+ Vincular atleta" já substituído por badge de limite (H-03); link form e invite-athlete form validam antes do envio; formulários internos bloqueiam com mensagem de erro antes de qualquer escrita

**Decisão arquitetural:** features do plano como mapeamento estático no cliente (não no Firestore) — os plans já têm `description`, `activeAthleteLimit` e `targetAccountType`, mas não `features[]`. Mapeamento estático é suficiente para apresentação; se plans ganhar campo `features` no futuro, basta adicionar fallback `plan.features ?? PLAN_FEATURES[plan.planId]`.

**Validado em:** build limpo (98 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ |

---

---

## H-11 — account_admin edita dados da academia (Wave 3 — concluída)

**Arquivos alterados:**
- `src/pages/account/AccountAdminPage.jsx` — import `updateAccount`, 5 estados, handlers `handleOpenInfoForm`/`handleSaveInfo`, seção "Dados da academia" (view + form), helper `InfoRow`, estilos `infoCard`/`infoFormGrid`/`infoLabel`

**O que foi implementado:**
- Seção "Dados da academia" com dois modos: view e edit in-place
- **View mode:** grade responsiva com campos Nome, CNPJ, Endereço, Telefone, E-mail de contato; "—" para campos vazios; botão "Editar"
- **Edit mode:** formulário inline com 5 inputs em grid; validação de nome obrigatório antes do `updateAccount`; `savingInfo` desabilita botões durante escrita
- Salva via `updateAccount(accountId, patch, user.uid)` — sem mudança no service
- Atualização otimista: `setAccount((prev) => ({ ...prev, ...patch }))` evita re-leitura do Firestore
- Mensagem de sucesso "Dados salvos com sucesso." após fechar o formulário
- Campos `cnpj`, `address`, `phone`, `contactEmail` são novos no documento (Firestore adiciona automaticamente; não precisou de migração)

**Campos canônicos gravados em `accounts/{id}`:**
| Campo | Tipo | Obrigatório |
|---|---|---|
| `name` | string | sim |
| `cnpj` | string | não |
| `address` | string | não |
| `phone` | string | não |
| `contactEmail` | string | não |

**Validado em:** build limpo (98 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ |

---

---

## H-09 — Trainer visualiza histórico de vínculos (Wave 3 — concluída)

**Arquivos alterados:**
- `src/services/athleteLinkService.js` — adicionada `getTrainerInactiveAthletes(trainerId)` + export
- `src/pages/trainer/TrainerAthletesPage.jsx` — reescrito com toggle, cards inativos, data de desvinculação

**O que foi implementado:**
- `getTrainerInactiveAthletes(trainerId)` — `WHERE trainerId == X AND status == 'inactive'`; usa o índice composto `(trainerId, status)` já existente em `firestore.indexes.json`
- **Enriquecimento corrigido:** loading de ativos agora mantém o dado do link (`{ ...profile, link }`) — antes era descartado
- **Toggle "Mostrar inativos":** botão discreto abaixo da lista de ativos; lazy load na primeira ativação; após carregado exibe contagem no label; segunda ativação só alterna visibilidade sem nova query
- **Cards inativos visualmente distintos:** background `#f8fafc`, borda `#e2e8f0`, avatar cinza, nome em `#94a3b8`, sem boxShadow
- **Badge "Inativo":** pill cinza ao lado do nome
- **Data de desvinculação:** "Desvinculado em: DD/MM/AAAA" via `formatDate(link.unlinkedAt)` com suporte a `Timestamp.toDate()` e fallback por `.seconds`
- **Sem "Ver painel" para inativos:** botão ausente; apenas "Avaliar" disponível
- **Ordenação:** inativos por `unlinkedAt` decrescente (mais recente primeiro)

**Nenhuma mudança em:** `firestore.indexes.json`, `firestore.rules`

**Validado em:** build limpo (98 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ |

---

---

## H-13 — platform_admin cria e configura nova conta (Wave 3 — concluída)

**Arquivos alterados:**
- `src/services/accountService.js` — `createAccount` aceita `athleteLimitOverride` e `status`; `canAddAthlete` usa override se presente; nova `listAccounts()`; export object atualizado
- `src/pages/admin/AdminAccountsPage.jsx` — NOVA — lista `/admin/accounts`
- `src/pages/admin/AdminAccountFormPage.jsx` — NOVA — formulário `/admin/accounts/new`
- `src/app/router.jsx` — imports + 2 rotas + link "Contas" na nav do `platform_admin`

**O que foi implementado:**

- **`listAccounts()`** — `getDocs(collection('accounts'))` com sort client-side por nome; sem índice novo (sem `orderBy`)
- **`createAccount` atualizado** — aceita `athleteLimitOverride: number | null` (gravado apenas se não-null) e `status: 'active'` por default
- **`canAddAthlete` atualizado** — `limit = account.athleteLimitOverride != null ? Number(account.athleteLimitOverride) : Number(plan.activeAthleteLimit)`
- **`/admin/accounts`** — tabela com colunas Nome, Tipo, Plano, Uso (mini barra de progresso), Status (badge verde/cinza); botão "+ Nova conta"
- **`/admin/accounts/new`** — formulário com Nome (obrigatório), Tipo (dropdown trainer/academia), Plano (dropdown de plans ativos com limit exibido), Limite override opcional (input numérico com placeholder do padrão do plano); validação de inteiro positivo; ao salvar → navega para `/admin/accounts`
- **Link "Contas" na navbar** — visível apenas para `platform_admin`

**Decisão arquitetural:** `athleteLimitOverride` como campo opcional no documento `accounts` — sem nova collection, índice ou regra. `canAddAthlete` lê o campo antes de usar o padrão do plano. Contas sem o campo continuam usando o plano normalmente.

**Nenhuma mudança em:** `firestore.rules`, `firestore.indexes.json`

**Validado em:** build limpo (100 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ |

---

## H-14 — platform_admin lista e busca contas (Wave 4 — concluída)

**Arquivos alterados:**
- `src/pages/admin/AdminAccountsPage.jsx` — adicionados filtros (busca por nome, filtro por plano, filtro por status), `useMemo` para filtragem client-side, linhas clicáveis navegam para `/admin/users?accountId=...`
- `src/pages/admin/AdminUsersPage.jsx` — `useSearchParams` inicializa filtros da URL; banner azul de conta; botão "✕ Limpar" e "← Contas"; passa `disableStatus={!!filters.accountId}` ao `UserFilters`
- `src/components/users/UserFilters.jsx` — prop `disableStatus`; select desabilitado com tooltip quando ativo

**O que foi implementado:**
- Barra de filtros: input de busca por nome, dropdown por plano, dropdown por status, botão "Limpar filtros"
- Filtragem client-side via `useMemo` — todos os dados carregados em uma query; sem queries adicionais
- Contagem de resultados "X de Y contas" quando há filtro ativo
- Clique na linha navega para `/admin/users?accountId=xxx&accountName=...` — `accountName` via URL param (sem query Firestore extra)
- `AdminUsersPage` lê `accountId` e `accountName` da URL; exibe banner azul com nome da conta
- Filtro de status desabilitado quando `accountId` ativo (índice composto `(accountId, status)` não existe em `users`)

**Nenhuma mudança em:** `firestore.rules`, `firestore.indexes.json`

**Validado em:** build limpo (100 módulos, 0 erros).

---

## H-15 — platform_admin gerencia planos (Wave 4 — concluída)

**Arquivos alterados:**
- `src/services/accountService.js` — adicionadas `listAllPlans`, `createPlan`, `updatePlan`; export object atualizado
- `src/pages/admin/AdminPlansPage.jsx` — NOVA — lista `/admin/plans`
- `src/pages/admin/AdminPlanFormPage.jsx` — NOVA — formulário `/admin/plans/new` e `/admin/plans/:planId/edit`
- `src/app/router.jsx` — imports + 3 rotas + link "Planos" na nav do `platform_admin`

**O que foi implementado:**

- **`listAllPlans()`** — `getDocs(collection('plans'))` sem filtro (ativos + inativos), sort client-side por nome; usada apenas na tela de admin
- **`createPlan({ name, activeAthleteLimit, description, isActive }, uid)`** — ID auto-gerado por Firestore; grava `createdBy`, `createdAt`, `updatedAt`
- **`updatePlan(planId, data, uid)`** — `updateDoc` omitindo `planId/createdAt/createdBy`; grava `updatedBy`, `updatedAt`
- **`/admin/plans`** — tabela com colunas Nome (+ ID como subtexto), Descrição, Limite de atletas, Status (badge verde/cinza), Ações (Editar + Desativar/Ativar); botão "+ Novo plano"
- **`/admin/plans/new`** — formulário com Nome (obrigatório), Limite de atletas (obrigatório, inteiro ≥ 1), Descrição (opcional); sem campo status (novos planos sempre ativos)
- **`/admin/plans/:planId/edit`** — mesmos campos + dropdown Status (Ativo/Inativo) com nota de que desativar não afeta contas existentes; carrega via `getPlan(planId)`
- **Toggle Desativar/Ativar** — botão por linha; `updatePlan({ isActive: !plan.isActive })` + atualização otimista local
- **Link "Planos" na navbar** — visível apenas para `platform_admin`

**Compatibilidade garantida:**
- `listActivePlans()` permanece inalterada — planos inativos não aparecem nos dropdowns de criação de conta
- `canAddAthlete()` usa `getPlan()` (sem filtro `isActive`) — contas existentes vinculadas a planos desativados continuam funcionando
- `AccountSummaryCard` usa mapeamento estático `PLAN_FEATURES` — não afetado

**Regras Firestore:** `allow write: if isPlatformAdmin()` em `plans/` já cobria este caso. Nenhuma mudança.

**Nenhuma mudança em:** `firestore.rules`, `firestore.indexes.json`

**Validado em:** build limpo (102 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ |

---

## H-21 — Centralizar criação de usuário em Cloud Function (Wave 4 — concluída)

**Arquivos alterados:**
- `functions/index.js` — novo callable `createUserCallable` + import `FieldValue`
- `src/services/firebase/config.js` — adiciona `getFunctions`, `connectFunctionsEmulator` (porta 5001), exporta `functions`
- `src/services/userService.js` — `createUser` substituído por `httpsCallable`; app secundário removido

**O que foi implementado:**

- **`createUserCallable` (Cloud Function callable):**
  - Verifica `context.auth` — não executa sem autenticação
  - Lê o doc do caller para verificar `papel` (`platform_admin` ou `account_admin`)
  - `account_admin`: valida que `accountId == callerData.accountId`; bloqueia criação de `platform_admin`
  - Cria o Auth user via Admin SDK (`firebaseAuth.createUser`) — sem app secundário no cliente
  - Escreve `users/{uid}` com exatamente os mesmos campos de antes (schema inalterado)
  - Retorna `{ uid: string }`
  - Mapeia `auth/email-already-exists` → `HttpsError('already-exists', ...)` para que o cliente possa detectar

- **`src/services/firebase/config.js`:**
  - `getFunctions(app)` instanciado junto com `auth` e `db`
  - `connectFunctionsEmulator(functions, '127.0.0.1', 5001)` quando `VITE_USE_FUNCTIONS_EMULATOR=true`
  - `functions` adicionado ao export

- **`src/services/userService.js`:**
  - Removido: `initializeApp`, `getApps` (firebase/app), `createUserWithEmailAndPassword`, `signOut`, `setDoc`, padrão `getSecondaryAuth`, `generateTempPassword`
  - Adicionado: `httpsCallable` (firebase/functions), import de `functions` do config
  - `createUser` chama `httpsCallable(functions, 'createUserCallable')` e mapeia `functions/already-exists` → `auth/email-already-in-use` para não quebrar as UIs consumidoras
  - `sendPasswordResetEmail` client-side mantida (não-crítica, como antes)
  - `_createdByUid` parâmetro mantido na assinatura para não quebrar os call-sites (a função já não o usa — o callerUid vem do `context.auth.uid` na função)

**Compatibilidade mantida:**
- `AccountAdminPage` — detecção de `err.code === 'auth/email-already-in-use'` funciona sem mudança
- `AdminUserFormPage` — `err.message` genérico funciona sem mudança
- Todos os papéis (athlete, trainer, account_admin, platform_admin) suportados
- Schema do documento `users/{uid}` idêntico ao anterior
- `sendPasswordResetEmail` (invite flow) continua client-side, inalterado

**Nenhuma mudança em:** `firestore.rules`, `firestore.indexes.json`, `AccountAdminPage`, `AdminUserFormPage`

**Nota de deploy:** `createUserCallable` precisa ser deployada via `firebase deploy --only functions`. A função `athleteDashboardStats`, `trainerDashboardStats` e `trainerActivities` já existem em produção — o deploy incremental adicionará apenas a nova função.

**Ordem de deploy obrigatória:** functions **antes** do hosting. O front-end novo chama o callable — se o hosting for publicado antes da função existir, `createUser` falhará em produção.

**Emulador:** para testar localmente com emulador, definir `VITE_USE_FUNCTIONS_EMULATOR=true` no `.env.local` e iniciar com `firebase emulators:start`.

**Status de rollout:** deployada em produção em 2026-05-29 — aguardando smoke test.

| Deploy | Resultado | Data |
|---|---|---|
| `firebase deploy --only functions` | ✅ `createUserCallable` criada (Node 22, us-central1) | 2026-05-29 |
| `firebase deploy --only hosting` | ✅ build 104 módulos publicado | 2026-05-29 |
| Smoke test | ❌ falhou — `context.auth` null em produção | 2026-05-29 |
| Fix: migração para v2 `onCall` API | ✅ deployado | 2026-05-29 |
| `firebase deploy --only functions` (fix) | ✅ `createUserCallable` atualizada — aguardando re-smoke-test | 2026-05-29 |

**Bug pós-deploy diagnosticado e corrigido:**

- **Sintoma:** "Authentication required." ao convidar trainer em produção — `context.auth` sempre null
- **Causa raiz:** `firebase-functions` v6 deploya todas as funções como **2nd Gen (Cloud Run)**. O `context.auth` da API v1 (`functions.https.onCall`) era injetado pelo runtime Gen 1, que **não existe** no Cloud Run. As outras funções (onRequest) não sofreram o problema porque verificam o `Authorization` header manualmente via middleware.
- **Correção:** migrar `createUserCallable` para API v2 (`firebase-functions/v2/https` → `onCall`, `HttpsError`). No v2, `request.auth` é populado corretamente pelo Firebase Functions framework para chamadas autenticadas em Gen 2.
- **Arquivo alterado:** apenas `functions/index.js` — cliente inalterado (`httpsCallable` é agnóstico à versão de API do servidor).

**Aviso não bloqueante:** `firebase-functions` v6.6.0 reportou aviso de versão desatualizada. Não afeta o funcionamento — atualização deve ser tratada como manutenção separada (há breaking changes na nova versão).

**Validado em:** build limpo (104 módulos, 0 erros).

| Teste | Resultado |
|---|---|
| `npm run build` | ✅ |

---

## Wave 6 — Admin Operacional (concluída em 2026-05-30)

### H-22 — AdminUsersPage: correção de crash

**Arquivo alterado:** `src/pages/admin/AdminUsersPage.jsx`

- `const [users, setUsers] = useState([]);` estava ausente — página crashava ao tentar renderizar a tabela.
- Linha adicionada na declaração de estados (linha 19).

---

### H-23 — platform_admin edita conta existente

**Arquivos alterados:**
- `src/pages/admin/AdminAccountFormPage.jsx` — reescrito com suporte a modo edição
- `src/app/router.jsx` — rota `/admin/accounts/:accountId/edit` adicionada
- `src/pages/admin/AdminAccountsPage.jsx` — botão "Editar" por linha (stop propagation)

**O que foi implementado:**
- `useParams()` detecta `accountId` → `isEdit = Boolean(accountId)`
- `useEffect` carrega `listActivePlans()` e `getAccount(accountId)` em paralelo
- Formulário pré-preenchido com dados existentes no modo edição
- Campo `status` (Ativa/Inativa) exibido apenas em modo edição
- `handleSubmit`: chama `updateAccount` (edição) ou `createAccount` (criação)
- Título e label do botão mudam conforme o modo
- Rota `/admin/accounts/:accountId/edit` protegida por `platform_admin`
- Botão "Editar" por linha em `AdminAccountsPage` com `e.stopPropagation()` para não interferir com o clique na linha (navega para `/admin/users`)

**Decisão de escopo:** troca de plano com efeito imediato — o novo limite vale na próxima verificação de `canAddAthlete`. Contas já acima do limite não são bloqueadas retroativamente.

---

### H-24 — account_admin visualiza e convida coaches

**Arquivo alterado:** `src/pages/account/AccountAdminPage.jsx`

**O que foi implementado:**
- `load()` busca trainers e coaches em paralelo: `listUsers({ papel: 'trainer', accountId })` + `listUsers({ papel: 'coach', accountId })`; listas mescladas e ordenadas por nome
- Seção renomeada para "Treinadores e Coaches"; botão "+ Convidar"
- `inviteForm` ganhou campo `papel` (default `'trainer'`); `handleInviteTrainer` passa `papel` para `createUser`; mensagem de sucesso diferenciada por papel
- Formulário de convite tem `<select>` para papel (Trainer / Coach)
- Coluna "Papel" na tabela com badges coloridos: azul para trainer (`#dbeafe`/`#1d4ed8`), roxo para coach (`#ede9fe`/`#7c3aed`)

---

### H-25 — account_admin desativa/reativa trainer ou coach

**Arquivo alterado:** `src/pages/account/AccountAdminPage.jsx`

**O que foi implementado:**
- Import de `toggleUserStatus` de `userService`
- Estado `togglingTrainer` rastreia o uid sendo alterado
- `handleToggleTrainerStatus(trainer)`: `newStatus = trainer.status === 'active' ? 'inactive' : 'active'`; chama `toggleUserStatus(uid, newStatus, user.uid)`; atualiza estado local otimisticamente
- Botão "Desativar" (vermelho) para trainers ativos; "Reativar" (verde) para trainers inativos
- Botões ausentes para status `'invited'` (não faz sentido desativar quem ainda não aceitou o convite)
- `toggleUserStatus` altera apenas `users.status` — sem cascata em `athlete_links` (decisão confirmada pelo usuário: atletas continuam vinculados; `canAddAthlete` não é afetado)

---

### Deploy Wave 6

| Deploy | Resultado | Data |
|---|---|---|
| `npm run build` | ✅ 0 erros | 2026-05-30 |
| `firebase deploy --only hosting` | ✅ publicado | 2026-05-30 |

**Smoke test sugerido (não executado automaticamente):**
1. `platform_admin` → `/admin/users` → página carrega sem crash (H-22)
2. `platform_admin` → `/admin/accounts` → botão "Editar" na linha → formulário pré-preenchido → salvar → volta para lista (H-23)
3. `account_admin` → `/account` → seção "Treinadores e Coaches" → coaches com badge roxo; "+ Convidar" → dropdown de papel (H-24)
4. `account_admin` → `/account` → botão "Desativar" em trainer ativo → badge muda; "Reativar" restaura (H-25)

---

## Próximo passo imediato

Wave 6 completa. Todas as histórias do roadmap estão concluídas (Waves 1–6 + H-21).

Próximas evoluções possíveis (não priorizadas):
- Notificações / push para athletes
- Relatórios de desempenho por período
- Exportação de dados (CSV/PDF)
- Onboarding guiado para novos usuários convidados

Ver `docs/roadmap.md` para o estado completo.

---

## Como retomar sem depender do chat

1. Ler `docs/roadmap.md` — estado do produto e próxima história
2. Ler `docs/handoff.md` — contexto de sessão (este arquivo)
3. Ler `CLAUDE.md` — regras de trabalho
4. Rodar `npm run test:rules:emulator && npm run test:coach-flow:emulator` para confirmar que tudo está verde
5. Implementar a próxima história marcada como `doing` no roadmap
6. Ao concluir: atualizar `roadmap.md` (status) e `handoff.md` (o que foi feito)

---

## Contas de teste

| Email | Senha | Papel |
|---|---|---|
| `coach@dev.local` | `Dev@AFP2025!` | coach |
| `ctrainer@dev.local` | `Dev@AFP2025!` | trainer (subordinado ao coach) |
| `cathlete@dev.local` | `Dev@AFP2025!` | athlete (atleta do coach) |
| `cathleteB@dev.local` | `Dev@AFP2025!` | athlete (atleta do ctrainer) |

UIDs de produção (staging = produção):
- coach: `XZhJi9FzuTUF3W4gFJk5zpVgdjo1`
- ctrainer: `huisheYvxUa3dfKnJWouSkwDEgJ3`
- cathlete: `TRPBpdQkkjWchDQXX25qmtb5P8N2`
- cathleteB: `DdIVnPevHIgbdw7eLv61BVpOaDi1`
