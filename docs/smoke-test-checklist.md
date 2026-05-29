# AFP — Smoke Test: Coach / Trainer / Athlete

> Versão mínima para rodar antes de deploy.
> Foco nas regressões reais introduzidas e corrigidas no fluxo coach.

---

## Credenciais de teste

| Role    | Email                  | Senha          | Notas                                          |
|---------|------------------------|----------------|------------------------------------------------|
| Coach   | `coach@dev.local`      | `Dev@AFP2025!` | Supervisa ctrainer; cathlete vinculado direto  |
| Trainer | `trainer.test@afp.dev` | `Test@AFP2025!`| Conta `test-account-starter`; 12 atletas       |
| Athlete | qualquer `athlete-test-NN@...` | — | Atleta real da conta do trainer acima |

---

## Antes de começar

Abra **DevTools → Console** e deixe aberto durante todos os blocos.
Qualquer `permission-denied` fora do esperado = **bloqueante**.

---

## Bloco A — Auth

| # | Ação | Esperado | Falha bloqueante |
|---|------|----------|-----------------|
| A1 | Login como `coach@dev.local` | Redireciona para `/dashboard` | Tela branca · 401 · redirect loop |
| A2 | Inspecionar `profile.papel` no console | `'coach'` | `undefined` · `'treinador'` · string vazia |

---

## Bloco B — Painel (coach)

> **O que quebrou aqui**: `loadCoachFilters` chamava `listTrainerAthleteOptions(ctrainerUid)`,
> que emite `athlete_links WHERE trainerId == ctrainerUid` com `auth.uid == coachUid`.
> Firestore nega porque `trainerId ≠ auth.uid`. A lista de atletas era sobrescrita com `[]`.

| # | Ação | Esperado | Falha bloqueante |
|---|------|----------|-----------------|
| B1 | Abrir `/dashboard` como coach | Seletor **Treinador** visível com "Treinador Dev (Coach)" | Seletor ausente · "Carregando" infinito |
| B2 | Verificar seletor **Atleta** | Visível com "Atleta Dev (Coach)" ao lado do seletor de treinador | Seletor ausente · "Selecione um atleta nos filtros" sem seletor disponível |
| B3 | Selecionar "Atleta Dev (Coach)" | Dashboard carrega (stats zerados se sem atividades, sem erro vermelho) | `permission-denied` no console · card de erro |
| B4 | Trocar período 7d → 30d | Stats recarregam; seletor de atleta permanece | Seletor desaparece após troca de período |

---

## Bloco C — Atividades (coach)

| # | Ação | Esperado | Falha bloqueante |
|---|------|----------|-----------------|
| C1 | Navegar para `/activities` | Seletor de atleta visível com "Atleta Dev (Coach)" | Seletor ausente · "Nenhum atleta selecionado" sem seletor |
| C2 | Verificar lista de atividades | Lista vazia **ou** atividades do par `coachUid + cathleteUid` | `permission-denied` · spinner infinito |

---

## Bloco D — Check-in (coach)

> **O que quebrou aqui**: `if (normalizedProfileType === 'trainer')` excluía `'coach'`.
> Atletas nunca eram carregados. O formulário agia como se o próprio coach fosse o atleta.

| # | Ação | Esperado | Falha bloqueante |
|---|------|----------|-----------------|
| D1 | Navegar para `/checkin` | Seletor de atleta visível com "Atleta Dev (Coach)" | Seletor ausente · formulário sem seletor de atleta |
| D2 | Avançar pelos 6 passos | Todos renderizam sem erro | Trava em algum passo · erro de permissão |
| D3 | Submeter | Redireciona para `/dashboard`; atividade criada com `trainerUserId == coachUid` e `athleteUserId == cathleteUid` | "Sessão já aberta" indevido · `permission-denied` na criação |

---

## Bloco E — Check-out (coach)

| # | Ação | Esperado | Falha bloqueante |
|---|------|----------|-----------------|
| E1 | Navegar para `/checkout` após D3 | Seletor de atleta visível; resumo da sessão aberta exibido | Seletor ausente · "Nenhuma sessão em aberto" mesmo após check-in |
| E2 | Preencher PSE + duração e submeter | Redireciona para `/dashboard`; atividade `status: completed` | Erro de permissão · botão inativo sem motivo |

---

## Bloco F — Meus Atletas (coach)

| # | Ação | Esperado | Falha bloqueante |
|---|------|----------|-----------------|
| F1 | Navegar para `/trainer/athletes` | Card de "Atleta Dev (Coach)" visível | "Nenhum atleta vinculado a você no momento" |
| F2 | Clicar em "Ver painel" | Navega para `/dashboard?athleteId=...` sem erro | Tela branca · `permission-denied` |

---

## Bloco G — Regressão Trainer

| # | Ação | Esperado | Falha bloqueante |
|---|------|----------|-----------------|
| G1 | Login como `trainer.test@afp.dev`, abrir `/dashboard` | Seletor de **atleta** (sem seletor de treinador) | Seletor de treinador aparece indevido · lista vazia |
| G2 | `/activities` como trainer | Atletas carregados; atividades visíveis | Lista vazia · `permission-denied` |
| G3 | `/checkin` como trainer | Seletor de atleta presente; fluxo completo funciona | Trainer vê formulário sem seletor (tratado como atleta) |
| G4 | `/trainer/athletes` como trainer | Lista de atletas da conta | "Erro ao carregar atletas" |

---

## Bloco H — Regressão Athlete

| # | Ação | Esperado | Falha bloqueante |
|---|------|----------|-----------------|
| H1 | Login como atleta, abrir `/dashboard` | Stats próprios sem seletores de trainer/atleta | Seletor de atleta aparece · tela vazia |
| H2 | `/checkin` como atleta | Formulário para o próprio atleta, sem seletor de treinador | Seletor visível · formulário trava |

---

## Staging vs. Emulador

| Item | Emulador | Staging |
|------|----------|---------|
| Usuários | `@dev.local` do seed | Contas `@dev.local` ou equivalentes de staging |
| Regressão trainer/athlete | `trainer.test@afp.dev` + atletas da conta | Conta trainer real da conta de staging |
| Limpeza pós-teste | Desnecessária (`@dev.local` isolados) | Deletar atividades criadas nos blocos D/E se conta for compartilhada |
| Critério de erros | `warn` aceitável; `error permission-denied` = falha | Mesmo critério |

---

## Mini checklist — DevTools Console

Rejeitar se qualquer item aparecer:

```
❌  FirebaseError: Missing or insufficient permissions   → permission-denied
❌  [listTrainerAthleteOptions] erro crítico             → query falhou totalmente
❌  [listTrainerAthleteOptions] atletas resolvidos: 0   → links existem mas getUserProfile negado
❌  Error loading trainer filters                        → loadCoachFilters falhou
```

Aceitáveis (não são falha):

```
✅  getUserProfile falhou para N atletas   → athlete-dev-001/002 têm treinador_id stale; silenciado por Promise.allSettled
✅  DeprecationWarning: punycode           → Node.js; irrelevante em browser
✅  Stats zerados no Painel               → conta nova sem atividades; correto
```

---

## Critérios de aprovação

| Critério | Condição |
|----------|----------|
| Coach vê atleta no Painel | B2 passa |
| Coach consegue criar check-in | D3 passa |
| Coach consegue criar check-out | E2 passa |
| Trainer não regrediu | G1–G4 passam |
| Athlete não regrediu | H1–H2 passam |
| Zero `permission-denied` em operações normais | Console limpo em todos os blocos |

**Aprovado** = todos os critérios satisfeitos.
**Reprovado** = qualquer `❌` no console ou "Falha bloqueante" observada.

---

## Notas para QA

- **Ordem D → E obrigatória**: check-in deve preceder check-out. Rodar D duas vezes bloqueia D3
  ("sessão já aberta"). Fazer check-out antes de nova tentativa de check-in.
- **localStorage**: o seletor de atleta persiste via `afp_trainer_selected_athlete_{uid}`.
  Se o atleta selecionado sumir da lista, o primeiro disponível é auto-selecionado.
  Limpar `localStorage` entre runs isolados se necessário: `localStorage.clear()` no console.
- **Stats zerados ≠ falha**: Painel com contadores zerados é correto para conta sem atividades.
- **Atividades do coach**: gravadas com `trainerUserId: coachUid`. Se o Painel mostrar vazio
  após check-in, verificar que `loadDashboardStats` passou `userInfo.uid` (não `selectedTrainer`).
- **Automação**: veja `firestore.rules.test.ts` (regras) e
  `scripts/validate-coach-flow-emulator.mjs` (dados + queries no emulador).
