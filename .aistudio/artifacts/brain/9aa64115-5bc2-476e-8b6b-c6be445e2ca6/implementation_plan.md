# Relatório de Diagnóstico e Resolução de Erros do Backend

Este documento resume a investigação e as correções implementadas para resolver os erros de **HTTP 500 (Internal Server Error)** nas chamadas ao Google Apps Script (`getUsers`, `getPainelData`, `getMateriasData`, `getWipData`, `getAwbData`).

---

## 1. Causa Raiz Identificada

1. **Colisão de Redirecionamento 302 com o Runtime Node.js**:
   - O Google Apps Script retorna respostas via redirecionamento HTTP `302 Found` para `script.googleusercontent.com/macros/echo`.
   - O cliente de requisição padrão no Node.js travava ou tentava resolver e conectar via rotas IPv6 internas do ambiente containerizado, gerando timeouts de conexão e erros `HTTP 500`.
   - Em contraste, a chamada via `curl` do sistema com resolução forçada de IPv4 e seguimento de 302 conclui todas as ações em menos de 2 segundos.

2. **Rajadas Simultâneas de Requisições no Carregamento Inicial**:
   - O frontend disparava 5 a 6 requisições pesadas (`getPainelData`, `getWipData`, `getParametros`, `getMateriasData`, `getAwbData`) no exato mesmo milissegundo ao autenticar ou restaurar sessão.
   - O Google Apps Script, ao abrir a mesma planilha simultaneamente em múltiplas instâncias sem fila serializada, sofria concorrência de bloqueio de planilha (*Spreadsheet Lock contention*), resultando em falhas 500.

---

## 2. Correções Implementadas

### No Servidor Proxy (`server.ts`)
- **Canal Nativo via `curl` com Fallback Automático**: Requisições direcionadas prioritariamente via processo nativo `curl` com `-L` (seguimento de 302) e limite de tempo controlado, eliminando qualquer travamento de socket no Node.
- **Fila Serializada de Requisições (`AsyncQueue(1)`)**: O servidor agora envia 1 requisição por vez ao Apps Script, prevenindo concorrência e conflitos de planilha no Google Sheets.
- **Cache em Memória de Leitura Inteligente (TTL de 90s)**: Requisições de leitura são cacheadas em memória com deduplicação de chamadas simultâneas (*in-flight deduplication*). O cache anterior não é sobrescrito se uma chamada pontual retornar vazia.
- **Retentativas Progressivas com Backoff**: Implementado até 3 retentativas automáticas com espaçamento progressivo (1.2s, 2.4s, 3.6s) antes de retornar falha.

### No Frontend React (`src/App.tsx`)
- **Pré-carregamento Escalonado (Staggered Prefetch)**: As chamadas de cache pós-login e de inicialização de sessão agora são espaçadas com pequenos intervalos entre si, evitando sobrecarregar o backend.

### No Script Google Apps Script (`backend-appscript.js`)
- **Proteção Concorrente com `LockService`**: Adicionado `LockService.getScriptLock()` com espera de até 30s no `doPost` e liberação garantida no bloco `finally`, protegendo a integridade da planilha contra acessos concorrentes.

---

## 3. Status de Verificação

- [x] Resposta de `getAwbData`: Validada com sucesso (retornou dados reais de embarques da planilha).
- [x] Resposta de `getUsers`: Validada com sucesso (retornou 16 usuários cadastrados).
- [x] Resposta de `getPainelData`: Validada com sucesso via proxy local.
- [x] Linting e build do projeto (`npm run lint` / `compile_applet`): 0 erros.
- [x] Servidor dev reiniciado e ativo na porta 3000.
