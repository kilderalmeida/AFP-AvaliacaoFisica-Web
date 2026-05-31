# CLAUDE.md — Instruções para o agente de desenvolvimento AFP Web

## Contexto do projeto

Aplicação React 19 + Firebase para gestão de avaliações físicas. Papéis canônicos: `athlete`, `trainer`, `coach`, `account_admin`, `platform_admin`.

Leia sempre antes de começar:
- `docs/roadmap.md` — estado de cada história e dependências
- `docs/handoff.md` — o que foi feito na última sessão e qual é o próximo passo

---

## Regras de trabalho

### 1. Uma história por vez

Implemente exatamente uma história por vez, na ordem definida em `docs/roadmap.md`. Nunca antecipe funcionalidades de waves futuras durante a implementação de uma história corrente.

### 2. Escopo estrito

Dentro de uma história:
- Não refatore código além do necessário para atender os critérios de aceite
- Não adicione tratamento de erro para cenários que não existem
- Não crie abstrações para reutilização futura hipotética
- Não mova ou renomeie arquivos sem motivo direto para a história

### 3. Decisões arquiteturais — parar e consultar

Se durante a implementação surgir uma decisão arquitetural não prevista (nova coleção, mudança de regra Firestore, novo índice, Cloud Function), **pare, descreva o problema e as opções, e aguarde confirmação** antes de prosseguir.

### 4. Regras Firestore — não tocar sem consulta explícita

`firestore.rules` só é alterado quando a história exige e o usuário aprova explicitamente. O mesmo vale para `firestore.indexes.json`.

### 5. Não mexer em usuários reais

Scripts de seed só criam/modificam contas `@dev.local` e `@afp.dev`. Nunca alterar contas reais de usuários.

### 6. Atualizar roadmap e handoff ao concluir cada história

Ao terminar uma história:
1. Atualizar `docs/roadmap.md`: mudar status de `doing` para `done`
2. Atualizar `docs/handoff.md`: registrar o que foi feito, validações, próximo passo
3. Registrar decisões arquiteturais tomadas em `docs/handoff.md`

---

## Convenções do projeto

### Idioma

- UI: português brasileiro
- Código (variáveis, funções, comentários): inglês
- Documentação técnica (este repositório): português

### Campos canônicos

| Campo | Valores válidos |
|---|---|
| `users.papel` | `'athlete'`, `'trainer'`, `'coach'`, `'account_admin'`, `'platform_admin'` |
| `athlete_links.status` | `'active'`, `'inactive'` |
| `activities.status` | `'open'`, `'completed'` |

### Dual-write obrigatório

Toda mutação em `athlete_links` deve sincronizar `users/{athleteId}.treinador_id`:
- Criar link → `treinador_id = trainerId`
- Desativar link → `treinador_id = null`
- Reativar link → `treinador_id = trainerId`

Isso é necessário para que a regra Firestore `resource.data.treinador_id == request.auth.uid` permita ao trainer ler o doc do atleta.

### ID de `athlete_links`

Sempre `{athleteId}_{trainerId}`. Determinístico — nunca usar `doc()` sem ID.

### Porta do emulador Firestore

**8081** — fixada em `firebase.json`, `firestore.rules.test.ts` e `src/services/firebase/config.js`. Não alterar.

---

## Testes obrigatórios antes de deploy

```bash
npm run test:rules:emulator          # deve passar 21/21
npm run test:coach-flow:emulator     # deve passar 26/26
npm run build                        # sem erros de compilação
```

Smoke test manual usando `docs/smoke-test-checklist.md` com as contas `@dev.local`.

---

## Estrutura de scripts relevantes

| Script | Propósito |
|---|---|
| `scripts/seed-dev-local-coach.mjs` | Seed de dados de teste em produção (só @dev.local) |
| `scripts/seed-coach-emulator.mjs` | Seed do emulador — tem guard de segurança |
| `scripts/validate-coach-flow-emulator.mjs` | Validação ponta a ponta via Admin SDK |
| `scripts/diagnose-ctrainer.mjs` | Diagnóstico pontual de dados do ctrainer em staging |

---

## Restrições permanentes

- Nunca usar `--no-verify` em commits
- Nunca fazer force push em `main`
- Nunca rodar `seed-coach-emulator.mjs` diretamente — apenas via `firebase emulators:exec`
- Nunca commitar `.env.local`
- `firebase deploy` só após aprovação explícita do usuário
