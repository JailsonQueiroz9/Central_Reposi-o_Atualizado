# Sistema de Controle de PCP (Grupo Dass)

Sistema moderno de alto desempenho para Planejamento e Controle de Produção (PCP), focado no controle de REP, almoxarifado, entrega de insumos e rastreamento físico de materiais no fluxo produtivo.

## 🚀 Início Rápido

1. **Instalar dependências:**
   ```bash
   npm install
   ```
2. **Configurar Variáveis de Ambiente:**
   Configure as chaves e URLs de API no seu arquivo `.env` ou nas configurações do ambiente de desenvolvimento.
3. **Executar o ambiente de desenvolvimento:**
   ```bash
   npm run dev
   ```
4. **Validar Linha de Tipos/Compilação:**
   ```bash
   npm run lint
   ```

## 📂 Documentação Detalhada

Para mais informações sobre o funcionamento interno do sistema, fluxo de dados, diretórios e padrões técnicos:

👉 **[DOCUMENTATION.md](./DOCUMENTATION.md)** - Visão técnica da arquitetura e APIs.
👉 **[skill.md](./skill.md)** - Memória de longo prazo, dicionário de módulos, histórico de transição e regras de ouro técnicas.

## ✨ Funcionalidades Principais

- **Dashboard Integrado:** Visão em tempo real do estado de ordens (pendentes, concluídas, atrasadas).
- **Programação PCP:** Tabela interativa com edição online instantânea e visibilidade customizada de colunas persistida em cache.
- **Almoxarifado & MPOK:** Gestão assistida de lotes, validação de separação física de matérias-primas e verificação de recebíveis.
- **Cadastro e Entrega Rápida:** Integração instantânea com crachás de funcionários e scanners de códigos de barras com controle robusto de focalização automática.
- **Controle de Prioridades:** Visualização de criticidade das ordens (Baixa, Média, Alta, Embarque) integrada nativamente em todos os ecrãs de movimentação física.
- **Geração de Relatórios:** Exportação em PDF dinâmico agrupado por marca de produtos com layouts de alta fidelidade visual corporativa.

## 🛠️ Tecnologias Utilizadas

- **Framework:** React + Vite (SPA de alto desempenho, livre da complexidade de servidores Next.js em produção)
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS v4 (Design System focado na usabilidade corporativa)
- **Animações:** `motion` (`motion/react`) para transições fluidas de telas e barra flutuante
- **Ícones:** `lucide-react`
- **Geração de Documentos:** `jspdf`

---

Desenvolvido sob padrões industriais para a otimização logística e controle de fluxo do Grupo Dass.
