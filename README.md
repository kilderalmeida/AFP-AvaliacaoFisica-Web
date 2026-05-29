# AFP — Avaliação Física Web

Aplicação React 19 + Firebase para gestão de avaliações físicas. Suporta quatro papéis: `athlete`, `trainer`, `coach` e `platform_admin`.

---

## Pré-requisitos

- Node 22+
- Firebase CLI: `npm install -g firebase-tools`
- Conta Firebase com Blaze plan (para Functions e deploy)
- Arquivo `.env.local` na raiz (ver modelo abaixo)

### `.env.local` (modelo)

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_USE_FUNCTIONS_EMULATOR=false

# Admin SDK (usado pelos scripts de seed/validação)
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Quando `VITE_USE_FUNCTIONS_EMULATOR=true` a aplicação se conecta automaticamente aos emuladores (Auth: 9099, Firestore: 8081).

---

## Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:5173
```

---

## Emuladores Firebase

### Portas configuradas

| Serviço   | Porta |
|-----------|-------|
| Auth      | 9099  |
| Firestore | 8081  |
| Functions | 5001  |
| Hosting   | 5000  |
| UI        | 4000  |

### Subir emuladores manualmente

```bash
firebase emulators:start --only auth,firestore,functions
```

Abrir a UI em: http://127.0.0.1:4000

---

## Scripts de teste

### Regras de segurança do Firestore

```bash
# Requer emulador Firestore em 127.0.0.1:8081
npm run test:rules:emulator
```

Roda 21 casos Vitest contra as regras reais (`firestore.rules`). Cobre:
- Coach lê `athlete_links` com `trainerId == coachUid` → ALLOW
- Coach lê `athlete_links` com `trainerId == ctrainerUid` → DENY (bug original documentado)
- Leitura de `users` por coach, trainer e unauthenticated
- Acesso a `activities` por coach e trainer

### Fluxo coach — seed + validação (self-contained)

```bash
npm run test:coach-flow:emulator
```

Sobe emuladores, popula dados de teste e valida o fluxo coach ponta a ponta:

1. **Seed** (`scripts/seed-coach-emulator.mjs`) — cria os Auth users e documentos Firestore com os mesmos UIDs da conta `@dev.local` de produção:
   - `coach@dev.local` (uid: `XZhJi9FzuTUF3W4gFJk5zpVgdjo1`, papel: `coach`)
   - `ctrainer@dev.local` (uid: `huisheYvxUa3dfKnJWouSkwDEgJ3`, papel: `trainer`, `treinador_id: coachUid`)
   - `cathlete@dev.local` (uid: `TRPBpdQkkjWchDQXX25qmtb5P8N2`, papel: `athlete`, `treinador_id: coachUid`)
   - `trainer.test@afp.dev` / `athlete.test@afp.dev` (regressão do fluxo trainer)
   - `athlete_links`: cathlete↔coach, cathlete↔ctrainer, athlete-test↔trainer-test

2. **Validação** (`scripts/validate-coach-flow-emulator.mjs`) — via Admin SDK (bypass de rules), confirma:
   - Documentos `users` existem com campos corretos
   - `athlete_links` existem e têm `status: active`
   - Queries que a aplicação executa retornariam os resultados esperados
   - Avisa sobre queries que o Client SDK com auth de coach negaria (comportamento correto)

> O seed bloqueia execução fora do emulador (`FIRESTORE_EMULATOR_HOST` não definido → exit 1).

### Regressão completa (todos os fluxos)

```bash
npm run test:regression:emulator
```

Encadeia: profile-bootstrap → trainer-flow → trainer-dashboard → trainer-activities → trainer-reassignment.

---

## Smoke test manual (staging)

Ver [docs/smoke-test-checklist.md](docs/smoke-test-checklist.md) para o roteiro completo com blocos A–H cobrindo coach, trainer e athlete.

Contas de teste em staging:
- Coach: `coach@dev.local` / `Dev@AFP2025!`
- Trainer (subordinado ao coach): `ctrainer@dev.local` / `Dev@AFP2025!`
- Atleta (vinculado ao coach): `cathlete@dev.local` / `Dev@AFP2025!`
- Trainer standalone: `trainer.test@afp.dev` (senha no Vault)

---

## Build e deploy

```bash
npm run build                  # gera dist/
firebase deploy --only hosting # deploy do frontend
firebase deploy                # frontend + rules + functions
```

Verificar antes do deploy:
1. `npm run test:rules:emulator` — 0 falhas
2. `npm run test:coach-flow:emulator` — 0 falhas
3. Smoke test manual aprovado em staging

---

## Arquitetura de dados

### Papéis (`users/{uid}.papel`)

| Valor            | Descrição                                  |
|------------------|--------------------------------------------|
| `athlete`        | Atleta — acessa próprios dados             |
| `trainer`        | Treinador — gerencia seus atletas          |
| `coach`          | Supervisor — tem trainers e atletas diretos|
| `platform_admin` | Admin da plataforma                        |

### Coleções principais

- **`users/{uid}`** — perfil do usuário. Campo `treinador_id` aponta para o treinador/coach direto; necessário para a regra Firestore `resource.data.treinador_id == request.auth.uid`.
- **`athlete_links/{athleteId}_{trainerId}`** — fonte de verdade dos vínculos trainer-atleta. Campos: `athleteId`, `trainerId`, `accountId`, `status` (`active`/`inactive`), `linkedAt`, `unlinkedAt`.
- **`activities/{id}`** — registros de check-in/check-out. Campos: `athleteUserId`, `trainerUserId`, `accountId`, `status`.

### Regra crítica de acesso

O Client SDK só permite leitura de `athlete_links` quando `resource.data.trainerId == request.auth.uid` ou `resource.data.athleteId == request.auth.uid`. O coach consulta sempre com seu próprio uid (`trainerId == coachUid`); nunca com o uid de um trainer subordinado.

---

## Estrutura de scripts

| Script                                        | Finalidade                                      |
|-----------------------------------------------|-------------------------------------------------|
| `scripts/seed-coach-emulator.mjs`             | Seed do emulador para o fluxo coach             |
| `scripts/validate-coach-flow-emulator.mjs`    | Validação do fluxo coach via Admin SDK          |
| `scripts/seed-dev-local-coach.mjs`            | Seed em produção para conta @dev.local          |
| `scripts/validate-*.mjs`                      | Validadores por fluxo (trainer, dashboard, etc) |
