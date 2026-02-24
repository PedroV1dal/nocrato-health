# Prompt Engineering — Guia de Aplicação por Contexto

Este arquivo documenta **quando implementar** cada técnica de prompt engineering nos agentes do projeto. Não é um catálogo genérico — é um guia de decisão baseado no que já foi observado funcionando (ou não) neste projeto.

---

## Técnicas já implementadas

### Role / Persona Prompting
**Status**: Implementado em todos os agentes desde o início.

**Quando usar**: Sempre. É a camada base de qualquer agente. Define o viés, o tom e os limites de responsabilidade. Sem persona, o modelo tende a responder como assistente genérico.

**Trigger**: Criação de qualquer novo agente.

---

### Few-Shot (exemplos concretos de output)
**Status**: Implementado em `backend`, `frontend`, `dba`, `qa`, `designer`.

**Quando usar**: Quando o agente precisa produzir um artefato com formato repetível e estruturado (código, SQL, testes, CSS). Exemplos ensinam mais rápido do que descrições.

**Trigger**: O agente vai gerar código ou documentação com estrutura previsível. Se você consegue escrever um exemplo de "saída perfeita", use Few-Shot.

**Não usar quando**: O agente raciocina sobre trade-offs ou avalia algo (architect, tech-lead de revisão) — nesses casos, exemplos de output podem criar viés de confirmação.

---

### Skeleton of Thought (SoT)
**Status**: Implementado em `architect` (formato ADR) e `qa` (relatório de falha Playwright).

**Quando usar**: Quando a estrutura do output é tão importante quanto o conteúdo. O modelo preenche slots predefinidos ao invés de inventar formato.

**Trigger**: Existe um template que toda resposta do agente deve seguir (relatórios, decisões arquiteturais, checklists de aprovação).

**Diferença do Few-Shot**: Few-Shot mostra "aqui está um exemplo completo". SoT mostra "aqui está o esqueleto — preencha".

---

### Directional Stimulus (Anti-Genérico)
**Status**: Implementado em todos os agentes via seção `## Autenticidade`.

**Quando usar**: Quando o modelo tem um padrão default ruim para aquele domínio. No caso deste projeto: LLMs tendem a produzir código genérico de SaaS americano; a seção Autenticidade direciona para o domínio real (clínica brasileira, WhatsApp, doutores).

**Trigger**: Você percebe que o agente está produzindo outputs que "poderiam estar em qualquer projeto". Adicione restrições negativas explícitas ("não faça X") antes das positivas ("faça Y").

---

### Constraint-Based Prompting
**Status**: Implementado em `tech-lead`, `dba`, `backend` para isolamento de tenant.

**Quando usar**: Para regras não-negociáveis que, se violadas, causam bugs de segurança ou dados. Marcar como CRITICAL / MUST ajuda o modelo a não relativizar.

**Trigger**: Existe uma regra que nunca tem exceção no MVP (ex: toda query precisa de `tenant_id`).

---

### Decision Output Prompting (Veredito estruturado)
**Status**: Implementado em `tech-lead` via seção `## Decisão de Revisão`.

**Quando usar**: Quando o agente precisa emitir uma decisão com consequências claras (avança / não avança). Define os três estados possíveis (APROVADO / OBSERVAÇÃO / BLOQUEANTE) com critério de distinção.

**Trigger**: O agente tem papel de gatekeeper no processo (revisor, aprovador). Sem isso, a saída fica ambígua e o ciclo de aprovação quebra.

---

## Técnicas a implementar — com condição de trigger

### Chain of Thought (CoT)
**Status**: Não implementado.

**Onde aplicar**: `tech-lead` (revisão) e `architect` (avaliação de trade-offs).

**Quando implementar**: Quando revisões/avaliações começarem a retornar vereditos superficiais ou incorretos — ou seja, quando o agente aprova algo que deveria reprovar sem justificar o raciocínio.

**Como implementar**: Adicionar instrução antes do checklist:
```
Antes de emitir o veredito, percorra cada item do checklist em ordem e escreva uma linha de análise para cada um. Só então emita a decisão final.
```

**Por que não agora**: O checklist ordenado já força raciocínio sequencial implícito. CoT explícito adiciona verbosidade sem ganho claro neste momento.

---

### ReActing (Reason → Act → Observe → Repeat)
**Status**: Não implementado.

**Onde aplicar**: `qa` — especificamente para o protocolo Playwright via MCP.

**Quando implementar**: Quando o frontend existir e o QA começar a rodar testes Playwright reais. O loop iterativo (navegar → observar → ajustar → retestar) precisa ser explícito para o agente não desistir após a primeira falha.

**Como implementar**: Adicionar ao protocolo Playwright:
```
Ao encontrar uma falha:
1. REASON: qual elemento ou comportamento falhou e por quê pode ter acontecido
2. ACT: tente uma correção (ajustar seletor, aguardar elemento, recarregar)
3. OBSERVE: o problema foi resolvido?
4. Se não: repita até 3 tentativas antes de reportar como bug confirmado
```

**Trigger de implementação**: Início do Epic 1 (auth frontend) ou Epic 2 (agency portal) — qualquer US com UI interativa.

---

## Técnicas descartadas para este projeto

| Técnica | Motivo |
|---|---|
| **Self-Consistency** | Requer múltiplas amostras e votação — muito caro e sem benefício para geração de código determinístico |
| **Tree of Thought (ToT)** | Adequado para problemas de busca com ramificações. O projeto tem decisões arquiteturais documentadas em ADRs — não precisa de ToT em runtime |
| **Zero-Shot puro** | Só usado no campo `description` do YAML para roteamento. Para geração de código, Few-Shot sempre supera Zero-Shot |

---

## Princípio geral

> Adicionar técnicas de prompt tem custo: prompts maiores são mais lentos, mais caros, e podem introduzir instruções conflitantes. Só adicione uma técnica quando houver um problema observado que ela resolve. Não optimize prematuramente agentes que já funcionam.
