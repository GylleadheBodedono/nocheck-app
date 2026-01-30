# Recebimento Backend

API para validação de recebimento de mercadorias do **Grupo Do Nô**.

Compara valores lançados pelo **estoquista** (recebimento físico) e **aprendiz** (lançamento no Teknisa), alertando divergências via Microsoft Teams.

---

## Fluxo

```
┌─────────────┐     webhook     ┌─────────────────┐
│  Estoquista │ ──────────────► │                 │
│  (recebe)   │                 │                 │
└─────────────┘                 │     Backend     │
                                │                 │
┌─────────────┐     webhook     │  ┌───────────┐  │     ┌──────────────┐
│   Aprendiz  │ ──────────────► │  │  Compara  │──┼────►│ Google Sheets│
│  (lança)    │                 │  │  valores  │  │     └──────────────┘
└─────────────┘                 │  └───────────┘  │
                                │        │        │
                                └────────┼────────┘
                                         │ erro?
                                         ▼
                                ┌──────────────┐
                                │ Teams Alert  │
                                └──────────────┘
```

---

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/webhook/estoquista` | Webhook Checklist Fácil (estoquista) |
| `POST` | `/api/webhook/aprendiz` | Webhook Checklist Fácil (aprendiz) |

---

## Stack

- **Next.js 16** (API Routes)
- **TypeScript**
- **Google Sheets API** (armazenamento)
- **Microsoft Teams** (alertas)
- **Checklist Fácil** (origem dos dados)

---

## Setup

### 1. Instalar dependências

```bash
bun install
```

### 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

```env
# API Checklist Fácil
CHECKLIST_API_TOKEN=seu_token
CHECKLIST_API_BASE=https://integration.checklistfacil.com.br

# Google Sheets
GOOGLE_SHEETS_ID=id_da_planilha

# Microsoft Teams
TEAMS_WEBHOOK_URL=url_do_webhook
```

### 3. Credenciais Google

Coloque o arquivo JSON da conta de serviço na raiz do projeto.

### 4. Rodar

```bash
bun dev
```

---

## Lojas

| ID | Nome |
|----|------|
| 1 | BDN Boa Viagem |
| 2 | BDN Guararapes |
| 3 | BDN Afogados |
| 4 | BDN Tacaruna |
| 5 | BDN Olinda |
| 6 | BRDN Boa Viagem |
| 7 | BRDN Riomar |
| 8 | BRDN Guararapes |

---

## Planilha

Colunas geradas automaticamente:

| Coluna | Descrição |
|--------|-----------|
| Data/Hora | Timestamp do recebimento |
| Loja | Nome da unidade |
| Nota Fiscal | Número da NF |
| Fornecedor | Nome do fornecedor |
| Estoquista | Quem recebeu |
| Valor Estoquista | R$ informado pelo estoquista |
| Aprendiz | Quem lançou |
| Valor Aprendiz | R$ lançado no Teknisa |
| Status | `OK` ou `ERRO` |
| Diferença | Valor da divergência |
| Foto | URL da foto da NF |
| Lançamento | Código Teknisa |

---

## Deploy

### Vercel

```bash
vercel --prod
```

Configure as variáveis de ambiente no painel da Vercel.

---

## Licença

Uso interno - Grupo Do Nô
