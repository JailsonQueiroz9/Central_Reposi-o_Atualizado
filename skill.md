# MEMÓRIA DE LONGO PRAZO & ARQUITETURA - CONTROLE DE REP (Dass)
Este ficheiro serve como o guia definitivo de design, estrutura, regras de ouro, documentação detalhada do sistema, fluxo de backend/frontend e log de progresso para manter o contexto contínuo deste projeto na arquitetura Vite + React.

## 1. Visão Geral e Arquitetura do Sistema
O Controle de REP (Dass) é uma aplicação SPA (Single Page Application) de alto desempenho para a gestão de programação, controlo e follow-up de materiais, almoxarifado, entrega rápida e controlo de ordens de fabrico.

A aplicação foi libertada da complexidade de servidores Node.js em produção. Toda a camada de dados é consumida de forma síncrona/assíncrona no lado do cliente (client-side) através de requisições HTTP POST direcionadas à API do Google Apps Script. A resiliência e a velocidade instantânea da interface são garantidas por uma camada local de cache em buffer (SWR) e persistência de estados no localStorage.

### Diagrama de Fluxo e Sincronização (SPA Nativa com Vite)
```
 ┌────────────────────────────────────────────────────────────────────────┐
 │               INTERFACE DO UTILIZADOR (Vite + React SPA)               │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
        [ Memória e Cache ]                        [ Ações de API ]
      - localDataCache (SWR)                    - lib/api.ts (POST)
      - localStorage (Colunas/Layout)           - lib/google-sheets.ts
                 │                                       │
                 ▼                                       ▼
 ┌───────────────────────────────────┐   ┌────────────────────────────────┐
 │      MOCK BACKEND FALLBACK        │   │     GOOGLE APPS SCRIPT API     │
 │  (Dados mockados de redundância)  │   │  (Bulk updates, Sync de Sheet) │
 └───────────────────────────────────┘   └────────────────────────────────┘
```

## 2. Estrutura de Pastas e Diretórios (Padrão Vite)
O projeto segue a estrutura padrão de uma aplicação React purificada, concentrando todo o código-fonte dentro da pasta src/:

```
projeto-rep-dass/
├── public/                  # Elementos estáticos (Logótipos Dass, ícones)
├── src/
│   ├── components/
│   │   └── views/          # Ecrãs isolados (ProgramacaoPCP, Painel, Almox, etc.)
│   ├── lib/
│   │   ├── api.ts          # Chamadas HTTP para o Google Apps Script
│   │   └── cache.ts        # Sistema de cache estática com TTL
│   ├── App.tsx             # Gestor central de ecrãs / Router do Dashboard
│   ├── main.tsx            # Ponto de entrada do React e renderização do DOM
│   └── index.css           # Configuração global do Tailwind CSS
├── index.html              # Ponto de entrada do browser (na raiz do projeto)
├── vite.config.ts          # Configuração mestre do compilador Vite
└── package.json            # Dependências e scripts de build
```

## 3. Dicionário de Módulos e Componentes (views)
O sistema é dividido em visões dedicadas dentro da pasta src/components/views/. Abaixo está o detalhamento técnico de cada ecrã:

### 1. Programação PCP (ProgramacaoPCP.tsx)
Objetivo: Visualização detalhada e edição inline da folha de cálculo mestre do PCP (Wip042).

Funcionalidades Críticas:
- Edição Inline Dinâmica: Edição por duplo clique rápida em células diretamente na tabela mestre.
- Seletor Dinâmico de Colunas: Dropdown interativo ao lado do botão "Ajustar / Quebrar Linhas" que exibe/oculta colunas individualmente. Suporta barra de busca inteligente integrada com suporte completo a normalização e acentuação de strings (desconsidera caracteres diacríticos, ex: LINHA SERIG corresponde a SERIG).
- Funções de Lote "Todas/Nenhuma": Ajuste de todos os seletores com um único clique.
- Persistência de Visibilidade: Opções de colunas ocultadas persistidas localmente no localStorage por máquina (pcp_hidden_columns_v1).
- Recálculo de Sticky Columns (getStickyLeft): As 3 primeiras colunas (LINHA / FÁBRICA, LINHAS ANTIGAS, LINHA SERIG) são congeladas à esquerda. Ao ocultar as anteriores, o deslocamento left CSS de cada uma é recalculado programaticamente em pixels, prevenindo sobreposição visual.

### 2. Painel (Painel.tsx)
Objetivo: Dashboard de gestão com contagens, indicadores principais, gráficos comparativos de andamento e acompanhamento de metas do PCP.

Funcionalidades Críticas:
- Integrações nativas de gráficos de barra e de linha usando a biblioteca recharts.
- Resumo de materiais a aguardar separação, pedidos atrasados e taxa de assertividade por linha.

### 3. Almoxarifado (Almox.tsx) e Cadastro do Almoxarifado (CadastroAlmx.tsx)
Objetivo: Registo detalhado e controlo de separação interna de materiais físicos, conferência de lotes de MPOK (Matéria-Prima OK).

Funcionalidades Críticas:
- Modais de separação assistida e controlo de stock.
- Cadastro de lotes, datas de validade da matéria-prima e contagem por prateleira física.
- **Controle de Prioridades Integrado:** Visualização direta da coluna de "Prioridade" para rastreamento de ordens com criticidade alta ou embarque diretamente no fluxo do almoxarifado.

### 4. Cadastro de Ordens (Cadastro.tsx)
Objetivo: Entrada assistida de novas solicitações e programação física de ordens produtivas.

Funcionalidades Críticas:
- Auto-complete inteligente de campos com base na tabela mestre vinculada e busca refinada de referências de produtos.

### 5. Cadastro e Entrega Rápida (CadastroEntrega.tsx)
Objetivo: Registo ágil de entrega de insumos direto nas células produtivas do Grupo Dass.

Funcionalidades Críticas:
- Suporte à biometria por crachá e inserção ágil por leitores de código de barras físico.
- Input auto-focado por padrão para leitura direta com scanner, mapeando dados de funcionários cadastrados instantaneamente via requisição ao backend (getUserByCracha).
- **Separação por Categoria de Demanda:** Divisão estruturada entre abas de "M²" (Métrico de Tecidos) e "Aviamentos" (Unidades, quilos, milheiros).
- **Controle Visual de Urgência:** Rastreamento unificado de prioridades, exibindo badges inteligentes de criticidade no painel de conferência.

### 5b. Entrega Dublagem (EntregaDublagem.tsx)
Objetivo: Tela de entrega dedicada para as equipes do setor de Dublagem.

Funcionalidades Críticas:
- **Filtro Inteligente por Setor:** Restringe e exibe exclusivamente os lotes em andamento ou separados cuja destinação final pertença ao setor de **DUBLAGEM**.
- **Foco Operacional Estrito:** Exibição simplificada e direta focada estritamente em materiais métricos (M²) da Dublagem, otimizando o fluxo físico de separações por coletores móveis sem abas desnecessárias.

### 6. Disponível na Central (DisponivelCentral.tsx)
Objetivo: Painel de materiais prontos libertados pela central de estocagem para entrega nas linhas fabris correspondentes.

Funcionalidades Críticas:
- Ação física integrada "Pagar ao Destinatário" que atualiza o registo síncrono da coluna Data_Ent_Central.
- Atualização sob demanda: ao processar pagamentos, o reload da lista é despachado via API imediatamente, evitando loops contínuos de polling que interrompem o scroll do operador.

### 7. Follow-Up e Lote Centralizado (FollowUp.tsx)
Objetivo: Esteira de histórico, trilha de auditoria dos insumos solicitados e transição dinâmica de processos de compra.

Funcionalidades Críticas:
- Seleção em Lote Dinâmica: Sistema de checkboxes múltiplos acoplado a um checkbox mestre no cabeçalho, ativo especificamente para registos com status inicial "SOLICITADO COMPRA".
- Barra Flutuante de Ação: Componente animado usando Framer Motion (motion/react) que surge suavemente a partir do rodapé ao selecionar um ou mais elementos.
- Geração Dinâmica de Relatório em PDF: Agrupa itens comprados estruturalmente por marca de produto vinculada e gera layouts estruturados limpos em conformidade com as regras de identidade visual da Dass.
- Transição de Status Automatizada: Atualiza múltiplos registos em lote para a situação "EM PROCESSO DE COMPRA" de forma unificada na folha de cálculo via Apps Script.

### 8. Chat de Recados (Chat.tsx)
Objetivo: Canal síncrono para recados rápidos, boletins informativos de linha de fabricação, alertas de falta de linha serigráfica e anúncios gerais.

## 4. Lógica de Persistência e Variáveis de Ambiente
### 1. Chamadas de API (src/lib/api.ts)
- Bypass de CORS: Configurado o Content-Type: 'text/plain;charset=utf-8' para evitar preflights automáticos de navegadores, combinado com redirect: 'follow' para respeitar os redirecionamentos encriptados do Google Apps Script.
- Redundância MOCK: Caso a API do Google Sheets falhe ou fique inacessível, o sistema ativa imediatamente uma camada local simulada offline sem travar a interface do operador.
- Injeção de Variáveis no Vite: A URL da API do Apps Script deve obrigatoriamente usar o prefixo VITE_. O acesso no código é feito via import.meta.env.VITE_API_URL (substituindo o antigo process.env.NEXT_PUBLIC_API_URL).

### 2. Controle Dinâmico SWR (src/lib/cache.ts)
- Estrutura: Classe genérica estática baseada em tempo de vida (TTL) que guarda em buffer local as requisições de listas estáticas (Usuários, Papéis de Acesso). Reduz o tempo de renderização de 3,5s para instantâneo (0ms), poupando limites da API do Google Workspace.

## 5. Gerenciamento de Configurações, Compilação e Deploy
A arquitetura Vite elimina a necessidade do Node.js rodar em produção no Cloud Run. O build gera apenas ficheiros estáticos puros indexados pelo browser.

### 1. Configuração do Compilador (vite.config.ts)
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // Mantém o mapeamento de caminhos antigo
    },
  },
  build: {
    outDir: 'dist',                // Pasta de saída unificada para o deploy
    sourcemap: false,              // Desativado para builds mais rápidos e leves
    chunkSizeWarningLimit: 1200,   // Otimizado para Recharts e Framer Motion
  },
});
```

### 2. Scripts de Execução e Build (package.json)
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "tsc --noEmit"
}
```

### 3. Pipeline do Contêiner de Alta Performance (Dockerfile)
O deploy no Cloud Run utiliza um modelo multi-stage. O ambiente de desenvolvimento é descartado e o resultado final é servido pelo sirv-cli (servidor estático de arquivos ultra-leve), reduzindo o tamanho da imagem de 1.2GB para ~45MB:

```dockerfile
# Estágio 1: Compilação dos artefatos estáticos
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Estágio 2: Ambiente mínimo de execução (Zero Desperdício)
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g sirv-cli
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 8080

# A flag --single garante que qualquer rota digitada na URL seja redirecionada para o index.html, evitando erros 404
CMD ["sirv", "dist", "--port", "8080", "--single", "--host"]
```

## 6. Regras Técnicas Atuais e Padrões de Código
### 1. Dependências do React (Hooks & useEffect)
- Prevenção de Loops Infinitos: É proibido passar objetos ou arrays mutáveis diretamente no array de dependências do useEffect. Forneça sempre identificadores primitivos (ex: selectedItem?.id em vez de selectedItem). Isto mitiga re-renders infinitos que estouram as cotas de escrita/leitura da API da Google Sheets.

### 2. Estilização Tailwind
- CSS Puro Inline: Todas as classes são utilitários Tailwind CSS aplicados diretamente nos elementos, garantindo a consistência visual corporativa da Dass (cinza-ardósia escuro com destaques em laranja e âmbar vibrantes).

### 3. Importação de Ícones
Importe sempre de forma direta do repositório principal do vetor da biblioteca lucide-react:
```typescript
import { SlidersHorizontal, Eye, EyeOff } from 'lucide-react';
```

## 7. Histórico de Transição e Ajustes
- **Expulsão do Next.js**: Removida toda a infraestrutura complexa do Next.js. O projeto foi convertido com sucesso para Vite + React SPA, eliminando erros crónicos de manifestos em falta (routes-manifest.json).
- **Refatoração de Variáveis & URL de Produção**: Substituídos todos os mapeamentos de variáveis globais de process.env para o padrão ESM do Vite (import.meta.env) e sintonizada a URL definitiva de produção para a nova API do Google Apps Script (`https://script.google.com/macros/s/AKfycbwLQeduS0-5TcVcDVvlzCv0b-PwGb2LdFiAG5sjfqrymVZYwX8ysgE5KO-W92r01VM3jw/exec`).
- **Otimização do Contêiner**: Substituído o runtime de produção pelo servidor de ficheiros estáticos sirv-cli, reduzindo o cold start no Cloud Run para milissegundos e permitindo a configuração de alocação de CPU sob demanda (redução drástica de custos).
- **Integração com Nova Aba de Dados (`BD ASICS NOVO` / `042 BD`)**: Implementado no Apps Script o carregamento e cruzamento síncrono da tabela de apoio `BD ASICS NOVO` (ou `042 BD`), extraindo dinamicamente as colunas `AG` (Serig Giro) e `U` (Giro_Prod Cost) mapeadas pelo código chave de lote `N`, alimentando os cálculos lógicos para a determinação precisa do status "STATUS SERIGRAFIA".
- **Tratamento Robusto de Datas**: Incluída a função utilitária `formatDateString` na visualização do PCP para parsear e converter strings longas ou instâncias de Date geradas por fuso horários diferentes (ex: "Fri Aug 14 2026 00:00:00 GMT-0300 (Horário Padrão de Brasília)") para uma representação nacional amigável de padrão `DD/MM/YYYY`, sem quebras zonais de dia.
- **Correção nos Formulários de Entrada (Junho de 2026)**: Sanado o bug de contraste nos inputs das telas de `Login.tsx` e `Register.tsx`. O texto agora usa explicitamente a classe `text-gray-900 bg-white` para garantir legibilidade durante a digitação.
- **Rastreamento de Prioridades em Movimentações (Junho de 2026)**: Integrada a coluna "Prioridade" (Baixa, Média, Alta, Embarque) nos painéis de controle do almoxarifado (`Almox.tsx`) e conferência de remessas (`CadastroEntrega.tsx`).
- **Ajuste de Identidade Visual da Categoria "Embarque" (Junho de 2026)**: Reformulada a exibição visual da prioridade de maior urgência do sistema no `PriorityBadge`. O badge de embarque passou a adotar uma configuração de alto contraste (`bg-amber-100 text-black border-amber-300 font-black`) e a utilização do emoji de caminhão (🚚) no lugar do avião antigo (✈️).
