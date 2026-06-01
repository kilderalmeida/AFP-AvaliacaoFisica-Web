# AFP Web — Roadmap técnico

_Atualizado em: 2026-06-01 (Wave 7 registrada — EPIC-9 Polimento de UX, H-26 a H-33; H-26 é a próxima história, aguardando fechamento do recorte)_

---

## Estado atual do produto

### Funcional e em produção

| Área | Situação |
|---|---|
| Login / logout / recuperação de senha | Completo |
| Roteamento por papel (athlete / trainer / coach / platform_admin / account_admin) | Completo |
| CheckIn (wizard 6 etapas) | Completo |
| CheckOut (wizard 3 etapas) | Completo |
| Dashboard (athlete, trainer, coach) | Completo — bugs de coach corrigidos em 2026-05 |
| Atividades — lista 7 dias | Completo |
| Meus Atletas (trainer/coach) | Completo |
| Avaliação PAFP | Completo |
| Admin de usuários `/admin/users` (platform_admin) | Completo — Wave 6 |
| Admin de contas `/admin/accounts` (platform_admin) | Completo — Wave 6 (edição de conta, troca de plano) |
| Admin de conta `/account` (account_admin) | Completo — Wave 6 (coaches, ativar/desativar trainer) |
| Regras de segurança Firestore | Completas e testadas |
| Emulador — testes automatizados | `npm run test:rules:emulator` e `npm run test:coach-flow:emulator` passando |

### Incompleto / stub

| Área | Situação |
|---|---|
| ActivityDetailPage (`/activities/:id`) | Stub vazio — H-01 |
| Reativação de vínculo inativo | Serviço existe, UI ausente — H-03 |
| Cadastro/convite de trainer e athlete | Ausente — Wave 2 |
| Profile completion flow | Ausente — Wave 2 |
| Gestão de academia (account_admin) | Ausente — Wave 3 |
| Admin de plataforma (contas, planos) | Ausente — Wave 4 |

---

## Épicos e Histórias

### EPIC-1 — Correções bloqueantes

| ID | Título | Wave | Status |
|---|---|---|---|
| H-01 | ActivityDetailPage: visualização completa da atividade | 1 | **done** |
| H-02 | Dashboard: respeitar `?athleteId=` vindo de Meus Atletas | 1 | **done** |
| H-03 | AccountAdminPage: reativar vínculo inativo | 1 | **done** |

### EPIC-2 — Cadastro e convite de usuários

| ID | Título | Wave | Status |
|---|---|---|---|
| H-04 | account_admin convida trainer | 2 | **done** |
| H-05 | account_admin convida athlete e vincula a trainer | 2 | **done** |
| H-06 | Profile completion flow para usuário convidado | 2 | **done** |
| H-07 | Reenvio de convite | 2 | **done** |

### EPIC-3 — Gestão de vínculos

| ID | Título | Wave | Status |
|---|---|---|---|
| H-08 | Transferir atleta entre trainers | 3 | **done** |
| H-09 | Trainer visualiza histórico de vínculos | 3 | **done** |
| H-10 | Coach visualiza atletas de todos os seus trainers | 4 | **done** |

### EPIC-4 — Gestão de conta / academia

| ID | Título | Wave | Status |
|---|---|---|---|
| H-11 | account_admin edita dados da academia | 3 | **done** |
| H-12 | account_admin visualiza uso do plano com detalhes | 3 | **done** |
| H-13 | platform_admin cria e configura nova conta | 3 | **done** |

### EPIC-5 — Administração da plataforma

| ID | Título | Wave | Status |
|---|---|---|---|
| H-14 | platform_admin lista e busca contas | 4 | **done** |
| H-15 | platform_admin gerencia planos | 4 | **done** |

### EPIC-7 — Segurança de back-end

| ID | Título | Wave | Status |
|---|---|---|---|
| H-21 | Centralizar criação de usuário em Cloud Function | 4 | **done** |

### EPIC-8 — Admin operacional (Wave 6)

| ID | Título | Wave | Status |
|---|---|---|---|
| H-22 | AdminUsersPage: correção de crash (useState ausente) | 6 | **done** |
| H-23 | platform_admin edita conta existente (plano, nome, status, override) | 6 | **done** |
| H-24 | account_admin visualiza e convida coaches na seção de treinadores | 6 | **done** |
| H-25 | account_admin desativa/reativa trainer ou coach | 6 | **done** |

### EPIC-6 — Polimento das telas operacionais

| ID | Título | Wave | Status |
|---|---|---|---|
| H-16 | Dashboard: atualização automática após checkout | 5 | **done** |
| H-17 | Atividades: busca além da janela de 7 dias | 5 | **done** |
| H-18 | CheckIn: salvar progresso como rascunho | 5 | **done** |
| H-19 | CheckOut: calcular duração automaticamente | 5 | **done** |
| H-20 | Meus Atletas: resumo de atividade recente por card | 5 | **done** |

### EPIC-9 — Polimento de UX (Wave 7)

_Refinamento de UX/apresentação, sem novas regras de negócio. Recorte detalhado em `docs/wave7-proposal.md`. Nenhuma história desta wave altera `firestore.rules`, `firestore.indexes.json` ou `functions/`._

| ID | Título | Wave | Status |
|---|---|---|---|
| H-26 | Componente único de badge de status (papel / status / atividade) | 7 | **done** |
| H-27 | Estados vazios (empty states) consistentes nas listas | 7 | **done** |
| H-28 | Estados de carregamento e erro padronizados nas listas | 7 | **done** |
| H-29 | Resumo de card de atleta mais informativo em "Meus Atletas" | 7 | **done** |
| H-30 | Organização dos vínculos: busca, ordenação e contagem | 7 | **next** |
| H-31 | Revisão de microcopy (mensagens de sucesso / erro / confirmação) | 7 | todo |
| H-32 | Feedback de ações administrativas via banner padronizado | 7 | todo |
| H-33 | Indicador de uso de plano mais legível no topo da conta | 7 | todo |

---

## Waves de implementação

```
Wave 1 — Desbloqueia uso real
  H-02  ✅ done
  H-01  ✅ done
  H-03  ✅ done

Wave 2 — Gestão operacional completa
  H-04  H-05  H-06 (depende H-04/05)  H-07 (depende H-04)

Wave 3 — Conta / academia
  H-11  H-09  H-08 (depende H-03)  H-12 (depende H-03)  H-13

Wave 4 — Admin da plataforma
  H-14 (depende H-13)  ✅ done
  H-15 (depende H-13)  ✅ done
  H-10  ✅ done (Cloud Function coachAthletes)

Wave 5 — Polish
  H-16  H-17  H-18  H-19  H-20  ✅ todas done

Wave 6 — Admin Operacional
  H-22  ✅ done  (crash fix AdminUsersPage)
  H-23  ✅ done  (editar conta — plano, override, status)
  H-24  ✅ done  (coaches na seção de treinadores + badge papel)
  H-25  ✅ done  (desativar/reativar trainer ou coach)

Wave 7 — Polimento de UX (EPIC-9 — em andamento)
  H-26  ✅ done  (StatusBadge — Conta, Meus Atletas, Admin contas e planos)
  H-27  ✅ done  (EmptyStateCard adotado nas listas; CTA onde a ação existe)
  H-28  ✅ done  (EmptyStateCard loading + ErrorStateCard retry nas 4 telas)
  H-29  ✅ done  ("Último check-in" + rótulo de inatividade 14d nos cards ativos)
  H-30  ⏭ next  (organização dos vínculos)
  H-31  todo    (microcopy)
  H-32  todo    (banner de feedback admin)
  H-33  todo    (indicador de uso de plano)
```

---

## Dependências

| História | Depende de |
|---|---|
| H-05 | H-04 |
| H-06 | H-04 ou H-05 |
| H-07 | H-04 |
| H-08 | H-03 |
| H-10 | H-02 + decisão arquitetural (Cloud Function vs redesign) |
| H-12 | H-03 |
| H-14 | H-13 |
| H-15 | H-13 |

---

## Decisões arquiteturais abertas

- **H-10 (Coach vê atletas de todos trainers):** o Client SDK não pode consultar `athlete_links WHERE trainerId == ctrainerUid` com `auth.uid == coachUid` (Firestore nega). Opções: Cloud Function com Admin SDK, ou nova estrutura de índice. Decisão necessária antes de iniciar H-10.
- **H-15 (Planos):** verificar se `plans` é collection Firestore editável ou constante em código antes de implementar CRUD.

---

## Comandos de referência

```bash
# Dev local
npm run dev

# Testes automatizados
npm run test:rules:emulator          # 21 casos Vitest — regras Firestore
npm run test:coach-flow:emulator     # 26 casos — seed + validação ponta a ponta

# Seed de staging (somente dados @dev.local)
node scripts/seed-dev-local-coach.mjs

# Diagnóstico pontual
node scripts/diagnose-ctrainer.mjs

# Deploy
npm run build && firebase deploy
```
