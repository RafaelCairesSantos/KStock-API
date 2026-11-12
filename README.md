# KStock-API

> API RESTful corporativa para controle e rastreamento de estoque, movimentações de inventário, auditoria, assinaturas e recuperação de contas.

---

## 🛠️ Tecnologias e Arquitetura

- **Linguagem & Runtime**: Node.js v20+ / v24.x (CommonJS)
- **Framework Web**: Express.js
- **Banco de Dados**: MySQL 8.0 (InnoDB com suporte a transações ACID)
- **Camada de Acesso a Dados**: `mysql2/promise` com pool de conexões reutilizável
- **Segurança**: Helmet, CORS restritivo, criptografia com BcryptJS e autenticação JWT (JSON Web Token)
- **Controle de Acesso**: RBAC (Role-Based Access Control) com perfis `ADMIN`, `GERENTE` e `OPERADOR`
- **Serviço de E-mail**: Nodemailer com suporte a Resend API, Brevo API e SMTP tradicional
- **Uploads**: Multer para upload e validação de imagens de produtos
- **Testes Automatizados**: Jest (suíte unitária cobrindo serviços, middlewares e regras de negócio)
- **Documentação Interativa**: Swagger UI / OpenAPI 3.0

---

## 🏗️ Estrutura Arquitetural

O projeto adota uma arquitetura em camadas com estrita separação de responsabilidades:

```text
Requisição HTTP
    ↓
Middlewares Globais (Helmet, CORS, Express JSON)
    ↓
Rotas Versionadas (/api/v1/...)
    ↓
Middlewares de Rota (verifyJWT, verifyRole, upload, validateBody)
    ↓
Controllers (Manipulação HTTP, validação de formato e respostas)
    ↓
Services (Regras de negócio, transações atômicas de estoque e orquestração)
    ↓
Repositories (Queries SQL parametrizadas e pool de conexões)
    ↓
MySQL 8.0 (Tabelas relacionais com FKs, índices e integridade referencial)
```

---

## 🚀 Como Executar

### Pré-requisitos
- Node.js 20+ ou 24+
- MySQL 8.0 instalado localmente ou via Docker

### 1. Clonar o repositório e instalar dependências
```bash
git clone https://github.com/RafaelCairesSantos/KStock-API.git
cd KStock-API
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e configure suas variáveis:
```bash
cp .env.example .env
```

Conteúdo padrão do `.env`:
```ini
# Configurações do Servidor
PORT=3000
NODE_ENV=development

# Banco de Dados MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=kstock_db
DB_CONNECTION_LIMIT=10

# Autenticação e Segurança
JWT_SECRET=sua_chave_secreta_super_segura_kstock_2026
JWT_EXPIRES_IN=8h
MAX_FILE_SIZE_MB=5

# Provedores de E-mail (Recuperação de Senha)
# Opção 1: Resend (Recomendado via HTTP)
RESEND_API_KEY=

# Opção 2: Brevo API
BREVO_API_KEY=

# Opção 3: SMTP (Gmail, Ethereal, Outlook)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=teste@ethereal.email
SMTP_PASS=
SMTP_FROM="KeepStock <teste@ethereal.email>"
```

### 3. Executar Migrations e População Inicial (Seeds)
```bash
# Cria o banco de dados e as 7 tabelas com relacionamentos e índices
npm run migrate

# Popula usuários de exemplo, categorias, fornecedores e produtos
npm run seed
```

### 4. Iniciar o Servidor
```bash
# Modo de desenvolvimento com reload automático
npm run dev

# Modo de produção
npm start
```

### 5. Execução via Docker Compose
Para subir o banco MySQL 8.0 e a API Node.js de forma 100% conteinerizada:
```bash
docker-compose up -d --build
```

---

## 🧪 Testes Automatizados (Jest)

A API possui uma suíte organizada de testes unitários desenvolvida com **Jest**, cobrindo as regras críticas do sistema (autenticação, movimentações atômicas, cálculos de estoque e middlewares de segurança):

### Estrutura de Testes (`tests/`):
```text
tests/
└── unit/
    ├── appError.test.js           # Criação e padronização da classe AppError
    ├── middlewares.test.js        # validateBody, isValidEmail, verifyJWT, verifyRole, errorHandler
    ├── authService.test.js        # Cadastro, login, hash bcrypt, OTP de reset e emissão de JWT
    ├── movimentacaoService.test.js# ENTRADA, SAIDA, AJUSTE, saldo insuficiente (422) e auditoria
    └── produtoService.test.js     # Consulta de produtos e algoritmo de previsão de ruptura
```

### Como Executar os Testes:
```bash
# Executa toda a suíte de testes
npm test

# Executa testes em modo observação contínua (watch)
npx jest --watch

# Executa uma suíte específica
npx jest tests/unit/authService.test.js

# Executa com relatório de cobertura (coverage)
npx jest --coverage
```

---

## 📑 Documentação Interativa (Swagger UI)

Com o servidor rodando, a documentação Swagger OpenAPI 3.0 interativa está disponível em:
👉 **`http://localhost:3000/api/docs`**

- **Healthcheck do Servidor**: `GET http://localhost:3000/health`

---

## 📌 Guia de Endpoints da API (`/api/v1`)

### 🔐 Autenticação e Recuperação de Conta (`/api/v1/auth`)
| Método | Endpoint | Descrição | Acesso |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Cadastro de novo usuário (`OPERADOR`) | Público |
| `POST` | `/api/v1/auth/login` | Login com e-mail e senha (retorna JWT) | Público |
| `GET` | `/api/v1/auth/me` | Dados do usuário autenticado e assinatura ativa | Autenticado |
| `POST` | `/api/v1/auth/forgot-password` | Solicita código OTP de 6 dígitos via e-mail | Público |
| `POST` | `/api/v1/auth/verify-reset-code` | Valida código OTP de verificação | Público |
| `POST` | `/api/v1/auth/reset-password` | Redefine senha com código OTP informado | Público |
| `POST` | `/api/v1/auth/esqueci-senha` | Alias em português para forgot-password | Público |
| `POST` | `/api/v1/auth/resetar-senha` | Alias em português para reset-password | Público |

### 📊 Dashboard e Métricas (`/api/v1/dashboard`)
| Método | Endpoint | Descrição | Acesso |
|---|---|---|---|
| `GET` | `/api/v1/dashboard/resumo` | Indicadores gerais: total de itens, alertas, movimentações hoje | Autenticado |

### 👥 Usuários (`/api/v1/usuarios`)
| Método | Endpoint | Descrição | Acesso |
|---|---|---|---|
| `GET` | `/api/v1/usuarios` | Listagem paginada e busca por nome/e-mail | ADMIN |
| `GET` | `/api/v1/usuarios/:id` | Detalhes do usuário por ID | Autenticado |
| `POST` | `/api/v1/usuarios` | Criação de usuário com perfil customizado | ADMIN |
| `PUT` | `/api/v1/usuarios/:id` | Atualização cadastral (nome, e-mail) | Autenticado / ADMIN |
| `PATCH` | `/api/v1/usuarios/:id/perfil` | Alteração de perfil de acesso (RBAC) | ADMIN |
| `DELETE` | `/api/v1/usuarios/:id` | Remoção de usuário do sistema | ADMIN |

### 💳 Assinaturas (`/api/v1/assinaturas`)
| Método | Endpoint | Descrição | Acesso |
|---|---|---|---|
| `GET` | `/api/v1/assinaturas/minha` | Dados da assinatura do usuário logado | Autenticado |
| `GET` | `/api/v1/assinaturas` | Listagem de todas as assinaturas | ADMIN, GERENTE |
| `GET` | `/api/v1/assinaturas/:id` | Detalhes de uma assinatura | ADMIN, GERENTE |
| `POST` | `/api/v1/assinaturas` | Criação manual de assinatura | ADMIN |
| `PATCH` | `/api/v1/assinaturas/:id/status` | Ativação, cancelamento ou alteração de status | ADMIN |

### 📦 Produtos (`/api/v1/produtos`)
| Método | Endpoint | Descrição | Acesso |
|---|---|---|---|
| `GET` | `/api/v1/produtos` | Lista produtos com filtros, ordenação e paginação | Autenticado |
| `GET` | `/api/v1/produtos/alerta-estoque` | Produtos com estoque abaixo ou no limite mínimo | Autenticado |
| `GET` | `/api/v1/produtos/:id` | Detalhes completos do produto por ID | Autenticado |
| `GET` | `/api/v1/produtos/:id/previsao-ruptura`| Previsão estatística de dias até esgotar estoque | Autenticado |
| `POST` | `/api/v1/produtos` | Cadastro de produto (SKU único e saldo inicial) | ADMIN, GERENTE |
| `PUT` | `/api/v1/produtos/:id` | Atualização cadastral de produto | ADMIN, GERENTE |
| `POST` | `/api/v1/produtos/:id/foto` | Upload de imagem do produto via Multer | ADMIN, GERENTE |
| `DELETE` | `/api/v1/produtos/:id` | Exclusão (bloqueada se houver histórico de estoque) | ADMIN |

### 🔄 Movimentações de Estoque (`/api/v1/movimentacoes`)
| Método | Endpoint | Descrição | Acesso |
|---|---|---|---|
| `GET` | `/api/v1/movimentacoes` | Histórico paginado de movimentações com filtros | Autenticado |
| `GET` | `/api/v1/movimentacoes/vendas-mensais` | Consolidado anual/mensal de saídas para relatórios | Autenticado |
| `GET` | `/api/v1/movimentacoes/:id` | Detalhes de uma movimentação específica | Autenticado |
| `POST` | `/api/v1/movimentacoes` | Registro atômico (`ENTRADA`, `SAIDA`, `AJUSTE`) | Autenticado |

> **Regra Transacional de Estoque**:
> Toda movimentação é executada em uma transação atômica (`START TRANSACTION` -> `COMMIT`):
> 1. Trava o registro do produto com `SELECT ... FOR UPDATE`.
> 2. Valida o saldo: saídas não podem exceder o saldo disponível (retorna `422 INSUFFICIENT_STOCK`).
> 3. Atualiza `PRODUTO.quantidade_atual`.
> 4. Insere o registro em `MOVIMENTACAO`.
> 5. Insere automaticamente o log de auditoria em `HISTORICO`.

### 🏷️ Categorias & Fornecedores
- `/api/v1/categorias`: CRUD completo de categorias com unicidade de nome e proteção contra exclusão de categorias com produtos associados.
- `/api/v1/fornecedores`: CRUD completo com validação de formato e dígitos verificadores de CNPJ, unicidade e proteção de integridade referencial.

### 📜 Auditoria (`/api/v1/historico`)
- `/api/v1/historico`: Trilha de auditoria detalhada de alterações de cadastro, movimentações de estoque e exclusões (acesso: `ADMIN`, `GERENTE`).

---

## 🔒 Tratamento Padronizado de Erros

Todas as respostas de erro da API seguem o formato padronizado RFC-7807 simplificado:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Saldo insuficiente em estoque. Saldo disponível: 5, quantidade solicitada para saída: 10.",
    "details": {
      "saldoAtual": 5,
      "quantidadeSolicitada": 10
    }
  }
}
```

### Principais Códigos de Erro:
| Código HTTP | Code | Descrição |
|---|---|---|
| `400` | `MISSING_REQUIRED_FIELDS` | Campos obrigatórios não enviados no body |
| `400` | `INVALID_EMAIL` / `INVALID_CNPJ` | Formato inválido de e-mail ou CNPJ |
| `401` | `UNAUTHORIZED` / `INVALID_TOKEN` | Token ausente, adulterado ou expirado |
| `401` | `INVALID_CREDENTIALS` | E-mail ou senha incorretos |
| `403` | `FORBIDDEN` | Usuário autenticado sem permissão de acesso ao recurso |
| `404` | `ROUTE_NOT_FOUND` / `NOT_FOUND` | Rota ou recurso não encontrado |
| `409` | `DUPLICATE_ENTRY` / `DUPLICATE_EMAIL` | Conflito de dados únicos (e-mail, SKU, CNPJ) |
| `422` | `INSUFFICIENT_STOCK` | Saída solicitada maior que o estoque disponível |
| `500` | `INTERNAL_SERVER_ERROR` | Erro inesperado capturado pelo middleware global |
