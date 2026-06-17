# Documentação Técnica e Arquitetura - Sistema de Controle de PCP (Grupo Dass)

Este documento detalha de forma exaustiva a arquitetura, as tecnologias, as especificações de módulos e os fluxos operacionais do Sistema de Controle de PCP (Planejamento e Controle de Produção) para controle de programação de REP, almoxarifado, entrega rápida e controle de fluxo do Grupo Dass.

---

## 1. Visão Geral do Sistema

O Sistema de Controle de PCP é uma aplicação web de alto desempenho projetada especificamente para otimização de fluxos produtivos industriais, rastreamento físico de materiais e gerenciamento do PCP. 

Para alcançar velocidade de renderização instantânea (0ms), eliminar custos adicionais de servidores Node.js em produção e simplificar o deploiamento, o sistema foi estruturado como uma **Single Page Application (SPA)** nativa compilada com **Vite + React**. 

Toda a camada de persistência reside no **Google Sheets**, atuando como um banco de dados altamente acessível para os gestores. A ponte de comunicação entre a interface web e as planilhas é feita por meio de uma API sob demanda hospedada no **Google Apps Script (Macros baseadas em JavaScript)**.

---

## 2. Arquitetura do Sistema e Fluxo de Dados

A arquitetura descarta a necessidade de servidores intermediários adicionais ou Next.js em produção. O navegador carrega o pacote estático SPA e realiza requisições HTTPS POST diretas à API do Apps Script com bypass CORS e otimizações de cache inteligentes.

### Diagrama de Comunicação Síncrona / Assíncrona

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │               INTERFACE DO USUÁRIO (Vite + React SPA)                  │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
        [ Memória e Cache ]                        [ Ações de API ]
      - localDataCache (SWR)                    - lib/api.ts (POST Request)
      - localStorage (Preferências)              - URL do Google Apps Script
                 │                                       │
                 ▼                                       ▼
 ┌───────────────────────────────────┐   ┌────────────────────────────────┐
 │      MOCK BACKEND FALLBACK        │   │     GOOGLE APPS SCRIPT API     │
 │ (Redundância offline automática   │   │  (doPost(e) encapsulando CRUD   │
 │ se a rede/API do Google falhar)   │   │   e sincronização de tabelas)  │
 └───────────────────────────────────┘   └────────────────────────────────┘
                                                         │
                                                         ▼
                                             ┌────────────────────────────┐
                                             │  PLANILHA GOOGLE (DATABASE)│
                                             │    - Wip042                │
                                             │    - 042 BD / BD ASICS NEW  │
                                             │    - Usuários e Registros  │
                                             └────────────────────────────┘
```

### Mecanismos Críticos de Rede & Segurança:
1. **Bypass de CORS por Tipo de Conteúdo:** O cliente envia requisições HTTP POST com `Content-Type: 'text/plain;charset=utf-8'`. Esta escolha estratégica previne que navegadores bloqueiem chamadas ou disparem requisições preflight (`OPTIONS`) automáticas que reduzem o desempenho e extrapolam limites das cotas de rede do Google.
2. **Redirecionamento HTTPS Crítico:** A chamada de API obrigatoriamente inclui a propriedade `redirect: 'follow'` para capturar com precisão os redirecionamentos encriptados internos do domínio do Google (`script.google.com` para `script.googleusercontent.com`).
3. **Prevenção de Cache de Navegador:** Cada URL de requisição é injetada com um query parameter de timestamp (`?ts=Date.now()`) para invalidar caches indesejados da rede externa de entrega de conteúdo (CDN).
4. **Camada de Redundância e Proteção Offline:** Se o Apps Script atingir limites de taxa diários (rate limit do Google Sheets), responder com instabilidade de rede ou erro inesperado, a classe `api` capta a exceção silenciosamente e ativa o **Mock Backend Fallback**. Isso assegura que o operador nunca veja telas em branco ou erros fatais de script, mantendo o processo industrial ativo.

---

## 3. Stack Tecnológica

### Frontend & Build
- **Runtime & Compilador:** Vite (SPA moderna, eliminando manifestos lentos ou custos de servidor rodando em produção)
- **Framework React:** React 19 (Componentes funcionais com Hooks modernos)
- **Linguagem de Tipagem:** TypeScript 5+ (Tipagem estática robusta impedindo bugs em tempo de compilação)
- **Estilização Responsiva:** Tailwind CSS v4 (Classes nativas integradas via PostCSS de renderização estática)
- **Sincronização de Animações:** `motion` (`motion/react` / Framer Motion) para animações suaves de transição e barras flutuantes contextuais
- **Iconografia:** `lucide-react` (Ícones em vetor consistentes)
- **Geração de Relatórios Industriais:** `jspdf` para montagem dinâmica de comprovantes e transferências sem dependência do servidor

---

## 4. Estrutura Direcional de Arquivos

```text
projeto-rep-dass/
├── public/                  # Ícones globais, logotipos Dass
├── src/
│   ├── components/          # Componentes visuais
│   │   ├── views/          # Módulos Funcionais e Telas Principais do Operador
│   │   │   ├── Almox.tsx             # Painel Almoxafarife (Filtros, Listagem, Prioridades)
│   │   │   ├── Cadastro.tsx          # Entrada assistida e cadastro mestre de ordens
│   │   │   ├── CadastroAlmx.tsx      # Lançamento e validação física de MPOK
│   │   │   ├── CadastroEntrega.tsx   # Painel de Conferência Rápida / Entrega com Scanner
│   │   │   ├── EntregaDublagem.tsx   # Painel de Entrega Focada para o Setor de Dublagem
│   │   │   ├── Chat.tsx              # Recados em tempo real de linhas e alertas de matéria-prima
│   │   │   ├── Configuracao.tsx      # Configurações de usuários, controle de permissões
│   │   │   ├── DisponivelCentral.tsx # Visualizador de itens liberados prontos para transporte
│   │   │   ├── FollowUp.tsx          # Auditoria de insumos comprados com seleção em lote e PDF
│   │   │   ├── Login.tsx             # Autenticação otimizada e com acessibilidade
│   │   │   ├── Painel.tsx            # Dashboard gerencial do PCP com relatórios, Recharts
│   │   │   ├── ProgramacaoPCP.tsx    # Controle inline dinâmico da planilha mestre (Wip042)
│   │   │   └── Register.tsx          # Tela de cadastro de operadores
│   │   └── PWARegistration.tsx       # Módulo para o Service Worker/Ação PWA offline
│   ├── hooks/               # Custom hooks compartilhados (redimensionamento, busca)
│   ├── lib/
│   │   ├── api.ts          # Integrador central HTTP com o Google Apps Script & Mock Fallback
│   │   └── cache.ts        # Sistema estático de cache SWR (Stale-While-Revalidate) com TTL
│   ├── App.tsx             # Roteador central de ecrãs e painel unificado com controle de estado
│   ├── main.tsx            # Ponto de inicialização do React no Virtual DOM
│   └── index.css           # Estilo básico, import da fonte Inter e injeção do Tailwind CSS v4
├── index.html              # Ponto de entrada HTML do app
├── vite.config.ts          # Arquivo mestre de compilação rápida do Vite
└── package.json            # Pacotes instalados e scripts de execução
```

---

## 5. Dicionário Técnico de Módulos Operacionais

### 5.1. Autenticação e Controle Core (`Login.tsx`, `Register.tsx`)
Oferece login dinâmico com controle restrito de níveis de acesso (Admin vs Operador).
*   **Melhoria Crítica de Acessibilidade:** Foram redefinidas as cores de fundo e texto dos campos de formulários de Login e Cadastro de operador. Os campos agora contam com configuração explícita de `bg-white text-gray-900`. Isso resolve o bug visual que tornava os textos digitados invisíveis devido a backgrounds cinza-claros misturados com placeholders ou seleção nativa de fontes em navegadores.

### 5.2. Programação PCP (`ProgramacaoPCP.tsx`)
Ação principal de planejamento. Permite edição inline em tempo real e reajuste dinâmico de visibilidade das colunas.
*   **Visibilidade Persistida:** Opções de colunas ativas/ocultadas são salvas na chave `pcp_hidden_columns_v1` do `localStorage` do computador do planejador.
*   **Cálculo Dinâmico de Left Sticky:** O congelamento das primeiras colunas cruciais recalculam a largura física ocupada sob demanda caso as colunas vizinhas sejam ocultadas, impedindo a sobreposição de textos.

### 5.3. Painel Gerencial (`Painel.tsx`)
Gera visualizações analíticas de assertividade das equipes e o status logístico da produção integrando as bibliotecas do `recharts`.

### 5.4. Almoxarifado (`Almox.tsx`) e Cadastro Almoxarifado (`CadastroAlmx.tsx`)
Focado na gestão de separação de materiais.
*   **Módulo de Prioridade Integrado:** Exibe uma coluna de "Prioridade" para identificar demandas urgentes associadas a cada ordem produtiva.
*   **Sincronização de Crachá:** Vincula a movimentação física de peças ao crachá do colaborador encarregado do manuseio.

### 5.5. Cadastro e Entrega Rápida (`CadastroEntrega.tsx`)
Fornece interface rápida, focada para coletores móveis e terminais com scanners físicos de código de barras.
*   **Autofoco Inteligente:** Mantém o input de escaneamento focado automaticamente por padrão.
*   **Controle de Demanda de Materiais:** Divide os itens pendentes em duas grandes categorias: **M² (Métrico de Tecido)** e **Aviamento (Peças, quilos, milheiros)** em abas de navegação focadas, garantindo que o operador entregue a remessa de forma estruturada.

### 5.6. Entrega Dublagem Rápida (`EntregaDublagem.tsx`)
Visualização especializada do fluxo de entregas criada sob demanda para as equipes do setor de Dublagem.
*   **Filtro Inteligente de Setor:** Coleta os mesmos status de processamento da central (`MPOK` ou separações), mas exibe estritamente os lotes cuja destinação (`Setor` ou `destinatario_setor`) corresponda à **DUBLAGEM**.
*   **Identidade Própria:** Interface visual estilizada com a paleta índigo e o ícone de folhas/camadas (`Layers`), garantindo foco e clareza para a operação específica.

---

## 6. Controle Exclusivo de Prioridades (Identificação Visual Rápida)

Para impulsionar a agilidade operacional no chão de fábrica, foi introduzido em ambos os ecrãs de movimentação física (**Almoxarifado** e **Cadastro Entrega**) um controle visual unificado e normatizado via o componente `PriorityBadge`:

| Categoria | Identificação Visual (Badge Style) | Ícone / Detalhe | Finalidade de Uso |
| :--- | :--- | :--- | :--- |
| **Baixa** | Fundo azul claro, texto azul marinho, borda suave | - | Abastecimentos de rotina com ciclo normal |
| **Média** | Fundo laranja claro, texto laranja escuro | - | Atendimento preferencial |
| **Alta** | Fundo avermelhado brilhante, texto vermelho escuro | Font-extrabold | Alerta de risco iminente de parada de linha |
| **Embarque**| Fundo âmbar de alta intensidade, texto preto, borda forte | Caminhão (🚚) | **Urgência máxima**, programado para saída imediata |
| **Normal** | Fundo cinza suave, texto cinza escuro | - | Padrão padrão de dados históricos |

---

## 7. Informações de Configuração Operacional e Deploy (.env)

O sistema consome variáveis de ambiente mapeadas exclusivamente em tempo de build pelo motor do Vite. O prefixo `VITE_` é estritamente de uso obrigatório:

```env
# URL Principal da API do Google Apps Script
VITE_API_URL=https://script.google.com/macros/s/AKfycbwXt-KyiVYzIUu0R-O-WQKgHtEeM3Z3uGllCJuEnYr-iSmhcdsEk4xPE1GApVBSOK86rQ/exec

# ID Interno da planilha utilizada pelo macro nas rotinas do Apps Script
VITE_GOOGLE_SHEETS_SPREADSHEET_ID=id-da-planilha-mestre-pcp
```

### Otimizações do Pacote de Produção
Devido ao uso consolidado de gráficos pesados e animações de estado do Framer Motion, o compilador do Vite está configurado para:
*   Dividir pedaços de código grandes (Chunking) para aceleração de downloads no navegador.
*   Estender o limite de avisos de tamanho de pedaços para `1200kb` para acomodar gráficos síncronos e componentes do `jspdf`.
*   Descartar a geração de sourcemaps para reduzir em até 65% o tempo de compilação nas esteiras de Integração Contínua (CI/CD) e diminuir o peso final do pacote a ser servido.

---

**Última Atualização:** Junho de 2026
**Responsável de Engenharia:** Equipe de Desenvolvimento PCP Dass
