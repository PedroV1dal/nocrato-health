# Skill: Resumo de Continuação

Usado quando o contexto está próximo de 60-70%.
Gera um resumo estruturado para colar no início de uma nova conversa,
garantindo continuidade sem perder contexto crítico.

---

## Quando usar

Sugira proativamente quando:

- Contexto acima de 60%
- Uma US acabou de ser concluída
- Antes de iniciar uma US nova e complexa

---

## Formato do resumo

Produza um bloco pronto para colar em nova conversa:

---

## Contexto do Projeto — Nocrato Health V2

### Estado atual

- **Epic em andamento**: Epic-N — [título]
- **Última US concluída**: US-X.Y — [título]
- **Próxima US**: US-X.Y — [título e o que precisa ser feito]

### O que foi implementado nessa sessão

- `caminho/arquivo.ts` — [o que faz]
- `caminho/migration.ts` — [o que altera no schema]

### Decisões tomadas que não estão em ADR

- [decisão] — [justificativa]

### Problemas encontrados e soluções adotadas

- [problema] → [solução]

### Contexto crítico

- [informação que não está no código nem nos docs]
- [dependências entre módulos descobertas]
- [comportamentos inesperados encontrados]

### Próximo passo imediato

[instrução clara e direta do que fazer primeiro na nova conversa]

---

## Instrução ao apresentar

Após gerar o resumo, diga:
"Copie o bloco acima e cole como primeira mensagem na nova conversa."
