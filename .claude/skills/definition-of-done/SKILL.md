# Skill: Definition of Done

Checklist obrigatório antes de considerar uma User Story concluída e pronta para commit.
Consultado pelo `tech-lead` e `qa` ao final de cada US.

---

## ✅ Código

- [ ] Sem `any` em TypeScript — usar `unknown` + type guards se necessário
- [ ] Sem `console.log` em código de produção
- [ ] Sem comentários `// TODO` ou placeholders não implementados
- [ ] Funções com responsabilidade única e menos de 50 linhas
- [ ] Mensagens de exceção em português: `NotFoundException('Paciente não encontrado')`

## ✅ Backend

- [ ] Toda query em tabela tenant-scoped tem `.where({ tenant_id })`
- [ ] Toda rota protegida tem `JwtAuthGuard` + `TenantGuard`
- [ ] Rotas públicas documentadas com justificativa (booking, webhook, patient portal)
- [ ] DTOs com `class-validator` em todos os campos
- [ ] Eventos emitidos em mudanças de estado relevantes (`appointment.completed`, etc.)
- [ ] Migration criada se houve mudança de schema
- [ ] Migration é reversível (função `down` implementada)

## ✅ Frontend

- [ ] Design system aplicado — paleta âmbar/creme/azul aço, nunca cinzas default
- [ ] Montserrat nos headings, Xilosa no corpo
- [ ] Textos de UI em português brasileiro natural
- [ ] Empty states e erros com mensagens do domínio ("Nenhuma consulta agendada")
- [ ] Loading e erro tratados visualmente (Skeleton, toast)

## ✅ Testes

- [ ] Testes unitários cobrindo happy path + edge cases + erros
- [ ] Cenário de isolamento de tenant testado (usuário A não acessa dados do tenant B)
- [ ] Todos os testes passando: `pnpm --filter backend test`
- [ ] Playwright validou o fluxo no browser (se houver interface)

## ✅ Revisão

- [ ] `tech-lead` emitiu veredito **✅ APROVADO** ou **⚠️ APROVADO COM OBSERVAÇÕES**
- [ ] Observações do tech-lead registradas se houver (`OBS-TL-N`)
- [ ] Nenhum **🚫 BLOQUEANTE** em aberto

## ✅ Commit

- [ ] Formato: `<type>(<scope>): <descrição em inglês, imperativo, < 50 chars>`
- [ ] Scope reflete o módulo afetado (`auth`, `patients`, `appointments`, etc.)
- [ ] Breaking change marcado com `!` e descrito no footer se aplicável
- [ ] Um commit por responsabilidade — não misturar features distintas

---

## Veredito Final

A US só está **DONE** quando todos os itens acima estão marcados.

Se algum item não se aplica à US atual (ex: sem frontend, sem migration),
marque explicitamente como `N/A` com justificativa — não deixe em branco.
