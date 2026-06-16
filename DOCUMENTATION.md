# Documentação Técnica e Arquitetura - Sistema de Controle de PCP

Este documento detalha a arquitetura, as tecnologias e o funcionamento do Sistema de Controle de PCP (Planejamento e Controle de Produção).

---

## 1. Visão Geral do Projeto

O Sistema de Controle de PCP é uma aplicação web moderna desenvolvida para gerenciar ordens de produção, rastreamento de materiais e controle de crachás/colaboradores. A aplicação utiliza o Google Sheets como banco de dados, proporcionando uma interface familiar para os gestores e uma infraestrutura de baixo custo e alta acessibilidade.

---

## 2. Arquitetura do Sistema

A aplicação segue uma arquitetura de **Single Page Application (SPA)** com renderização híbrida via **Next.js 15**.

### Diagrama de Fluxo de Dados

```mermaid
graph TD
    A[Usuário / Browser] -->|Interação UI| B[Componentes React]
    B -->|Chamada de API| C[DataCache - lib/cache.ts]
    C -->|SWR / Redundância| B
    C -->|Fetch| D[Next.js API Routes /app/api]
    D -->|Google SDK| E[Google Sheets API]
    E -->|Leitura/Escrita| F[(Google Sheets)]
    
    subgraph "Frontend (Client-Side)"
        B
        C
    end
    
    subgraph "Backend (Server-Side)"
        D
    end
    
    subgraph "Database Layer"
        F
    end
```

---

## 3. Stack Tecnológica

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS (Utilitários de CSS)
- **Animações:** `motion/react` (Framer Motion)
- **Ícones:** `lucide-react`
- **Tipografia:** Inter (Google Fonts)

### Backend & Integração
- **Runtime:** Node.js (Vercel/Cloud Run)
- **Integração de Dados:** Google Sheets API v4 via `googleapis` SDK.
- **Comunicação:** Fetch API com suporte a SWR (Stale-While-Revalidate).

---

## 4. Estrutura de Arquivos

```text
/
├── app/                # Next.js App Router
│   ├── api/            # Endpoints de API (Server-side)
│   │   └── pcp/        # CRUD do Google Sheets
│   ├── globals.css     # Estilos globais e Tailwind
│   ├── layout.tsx      # Layout raiz e fontes
│   └── page.tsx        # Dashboard principal e lógica de UI
├── lib/                # Utilitários e Lógica de Negócio
│   ├── api.ts          # Wrapper de comunicação com backend
│   ├── cache.ts        # Sistema de cache e redundância
│   ├── google-sheets.ts # Configuração do cliente Google Sheets
│   └── utils.ts        # Funções auxiliares (Tailwind Merge, etc.)
├── public/             # Ativos estáticos
└── package.json        # Dependências e scripts
```

---

## 5. Detalhes dos Módulos

### 5.1. Camada de Dados (Google Sheets)
O sistema utiliza uma planilha do Google como banco de dados central.
- **Configuração:** Localizada em `lib/google-sheets.ts`.
- **Autenticação:** Utiliza uma Service Account do Google via variáveis de ambiente (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`).
- **Planilha:** O ID da planilha é definido em `GOOGLE_SHEETS_SPREADSHEET_ID`.

### 5.2. Sistema de Cache (`lib/cache.ts`)
Para garantir performance e disponibilidade (mesmo em conexões instáveis), implementamos uma classe `DataCache`:
- **SWR (Stale-While-Revalidate):** Exibe dados antigos instantaneamente enquanto busca atualizações em segundo plano.
- **Redundância Crítica:** Se a API falhar, o sistema mantém os últimos dados válidos em memória para evitar que a interface fique em branco.
- **TTL (Time To Live):** Controle de expiração de dados para evitar sobrecarga na API do Google.

### 5.3. Endpoints de API (`app/api/pcp/route.ts`)
O backend expõe métodos RESTful:
- **GET:** Lista todas as ordens ou filtra por código de barras.
- **POST:** Adiciona uma nova ordem de produção.
- **PUT:** Atualiza uma ordem existente (busca por ID na coluna A).
- **DELETE:** Remove ou limpa uma linha da planilha.

---

## 6. Funcionalidades Principais

1.  **Dashboard de Indicadores:** Visualização em tempo real de ordens em andamento, atrasadas e concluídas.
2.  **Gestão de Ordens:** Formulário completo para cadastro de ordens vinculando solicitante, destinatário e detalhes da ordem.
3.  **Leitura de Código de Barras:** Filtro rápido de dados através de scanners de código de barras.
4.  **Controle de Acesso:** Sistema de login (atualmente simulado/mockado) com diferentes níveis de permissão (Admin vs. Operador).
5.  **Follow-up de Produção:** Acompanhamento detalhado de cada etapa do processo produtivo.

---

## 7. Configuração de Ambiente (.env)

Para rodar o projeto, são necessárias as seguintes chaves:

```env
# Google Sheets Config
GOOGLE_SERVICE_ACCOUNT_EMAIL=seu-email@service-account.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=id-da-sua-planilha

# Opcional: URL do Apps Script (se usado como fallback)
NEXT_PUBLIC_APPS_SCRIPT_URL=https://script.google.com/...
```

---

## 8. Considerações de Performance

Devido às limitações de cota da API do Google Sheets, o sistema:
- Agrupa requisições sempre que possível.
- Utiliza cache agressivo no frontend.
- Desabilita minificação pesada no build para garantir estabilidade em ambientes de recursos limitados (Cloud Run).

---

**Desenvolvido por:** Equipe de Engenharia de Software
**Última Atualização:** 07 de Abril de 2026
