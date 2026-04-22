# Firebase Setup Guide - AFP Web

## Configuração do Firebase

### 1. Criar um Projeto no Firebase Console

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Criar um novo projeto" ou "Adicionar projeto"
3. Preencha o nome do projeto (ex: "AFP")
4. Siga as instruções do assistente

### 2. Obter as Credenciais

1. No Firebase Console, vá para **Settings > Project Settings**
2. Na aba **General**, procure por **"Your apps"**
3. Clique em **"Web"** (ícone `</>`)
4. Copie as credenciais fornecidas

### 3. Configurar Variáveis de Ambiente

1. Na raiz do projeto (`afp-web/`), crie um arquivo `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Abra `.env.local` e preencham com suas credenciais:
   ```
   VITE_FIREBASE_API_KEY=sua_api_key_do_firebase
   VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=seu-projeto-id
   VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=seu-numero-sender
   VITE_FIREBASE_APP_ID=seu-app-id
   VITE_FIREBASE_MEASUREMENT_ID=seu-measurement-id
   ```

### 4. Habilitar Serviços no Firebase

#### Authentication (Autenticação)
1. No Firebase Console, vá para **Authentication > Sign-in method**
2. Habilite **Email/Password**

#### Firestore (Banco de Dados)
1. No Firebase Console, vá para **Firestore Database**
2. Clique em **Create Database**
3. Escolha iniciar em modo de testes (desenvolvimento)
4. Selecione a região (ex: `us-central1`)

### 5. Testar a Conexão

Após configurar o `.env.local`, reinicie o servidor Vite:
```bash
npm run dev
```

Se houver erro relacionado a Firebase, verifique:
- As credenciais estão corretas no `.env.local`?
- As variáveis de ambiente têm o prefixo `VITE_`?
- Firebase App, Auth e Firestore estão inicializados?

---

## Estrutura de Inicialização

O arquivo `src/services/firebaseConfig.js` já:
- ✅ Carrega as variáveis de ambiente
- ✅ Inicializa o Firebase App
- ✅ Configura Firebase Auth
- ✅ Configura Firestore Database
- ✅ Valida se as credenciais foram configuradas

Você pode importar em qualquer serviço:
```javascript
import { auth, db } from '../services/firebase/config.js';
```

---

## Segurança

⚠️ **IMPORTANTE**:
- Nunca commite o arquivo `.env.local` no repositório
- O arquivo `.gitignore` já deve incluir `.env.local`
- Use chaves públicas do Firebase (é seguro não é um problema)
- Configure as regras de Firestore e Auth adequadamente

