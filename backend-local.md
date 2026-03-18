# OpereCheck - Setup do Backend Local

Guia para outro desenvolvedor configurar o ambiente de desenvolvimento completo.

## Pre-requisitos

- [Node.js](https://nodejs.org/) v18+
- [Bun](https://bun.sh/) (gerenciador de pacotes)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (rodando)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

### Instalar Supabase CLI

```bash
# Windows (via scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# macOS
brew install supabase/tap/supabase

# npm (qualquer OS)
npx supabase --version
```

---

## 1. Clonar e instalar dependencias

```bash
git clone <repo-url> operecheck
cd operecheck
git checkout saas
bun install
```

---

## 2. Subir o Supabase local (Docker)

```bash
# Inicia todos os containers: Postgres, Auth, Storage, Realtime, etc.
supabase start
```

Apos rodar, o CLI mostra as credenciais:

```
API URL:   http://127.0.0.1:54321
DB URL:    postgresql://postgres:postgres@127.0.0.1:54322/postgres
Anon key:  eyJhbGci...
Service role key: eyJhbGci...
Studio URL: http://127.0.0.1:54323
```

> **Importante:** As keys de demo sao iguais para todos os devs locais. Sao keys padrao do Supabase local, nao sao sensiveis.

---

## 3. Criar o arquivo `.env.local`

Na raiz do projeto, crie `.env.local` com as credenciais do passo anterior:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Stripe (usar chaves de teste)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_SUA_CHAVE_AQUI
STRIPE_SECRET_KEY=sk_test_SUA_CHAVE_AQUI
```

> **Nota:** As chaves do Stripe sao individuais. Cada dev precisa da sua conta Stripe em modo teste, ou pedir as chaves de teste ao lead.

---

## 4. Rodar as migrations

As migrations criam todo o schema: tabelas, RLS policies, triggers, funcoes.

```bash
supabase db reset
```

Esse comando:
1. Apaga o banco local
2. Roda todas as migrations em `supabase/migrations/` na ordem
3. Roda o `supabase/seed.sql` que cria usuarios e dados de teste

---

## 5. Configurar o Auth Hook (JWT custom claims)

O hook `custom_access_token_hook` injeta dados da organizacao no JWT. Para ativa-lo no Supabase local:

1. Abra o Supabase Studio: http://127.0.0.1:54323
2. Va em **Authentication > Hooks**
3. Ative o hook "Custom Access Token" apontando para a funcao `custom_access_token_hook`
4. Salve

Sem esse hook, o login funciona mas o JWT nao tera `org_id`, `role`, `plan`, etc.

---

## 6. Rodar o app

```bash
bun run dev
```

O app roda em http://localhost:3000 (acessivel na rede via http://SEU_IP:3000).

---

## 7. Usuarios de teste

Criados automaticamente pelo `seed.sql`:

| Email | Senha | Nivel | Acesso |
|---|---|---|---|
| `admin@operecheck.com.br` | `123456` | Superadmin (Plataforma) | /platform |
| `dono@restaurante.com` | `123456` | Admin (dono da org) | /dashboard + /admin |
| `func@restaurante.com` | `123456` | Funcionario | /dashboard |

---

## 8. Comandos uteis

```bash
# Parar o Supabase
supabase stop

# Resetar banco (apaga tudo e reaplica migrations + seed)
supabase db reset

# Ver status dos containers
supabase status

# Abrir o Studio (interface visual do banco)
# http://127.0.0.1:54323

# Rodar testes
bun run test:run

# Build de producao
bun run build

# Lint
bun run lint
```

---

## 9. Estrutura do banco (migrations)

As migrations estao em `supabase/migrations/` e sao executadas em ordem alfabetica:

| Arquivo | Descricao |
|---|---|
| `00000000000000_initial_schema.sql` | Schema base: users, stores, sectors, functions, templates, checklists, etc. |
| `20260315000001_saas_foundation.sql` | Multi-tenant: organizations, members, invites, RLS, JWT hook |
| `20260315000002_add_tenant_id.sql` | Adiciona tenant_id em todas as tabelas existentes |
| `20260318000001_fix_handle_new_user_tenant_id.sql` | Fix: trigger de signup auto-cria org e seta tenant_id |

---

## 10. Fluxo de uma nova migration

```bash
# Criar arquivo de migration
supabase migration new nome_descritivo

# Editar o arquivo gerado em supabase/migrations/

# Aplicar
supabase db reset
```

---

## Troubleshooting

### "Docker nao esta rodando"
Abra o Docker Desktop e espere inicializar antes de rodar `supabase start`.

### "Porta 54321 ja em uso"
Outro Supabase local esta rodando. Pare com `supabase stop` ou mude a porta no `supabase/config.toml`.

### "Login nao funciona / JWT sem org_id"
O Auth Hook nao foi configurado. Siga o passo 5.

### "RLS bloqueando queries"
Verifique se o usuario tem `tenant_id` setado e pertence a uma `organization_members`. O `supabase db reset` recria tudo limpo.

### "Dados sumiram"
`supabase db reset` apaga tudo. Use apenas quando quiser voltar ao estado inicial.
