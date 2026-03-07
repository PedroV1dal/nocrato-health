# Módulo: event-log/

## O que este módulo faz

Serviço de audit trail append-only para o sistema Nocrato Health. Centraliza todos os
INSERTs no `event_log`, garantindo que nenhum módulo escreva diretamente nessa tabela
sem passar por este serviço. É declarado como `@Global()` para ser injetável em qualquer
módulo sem necessidade de reimportar.

## Principais arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `event-log.module.ts` | Módulo `@Global()` que provê e exporta `EventLogService` |
| `event-log.service.ts` | Único método público: `append(...)` — INSERT no event_log |
| `event-log.service.spec.ts` | Testes unitários do EventLogService |

## Regras de negócio

- **Append-only**: o service expõe apenas `append()` — não há métodos de update, delete ou listagem
- **Fire-and-complete**: `append()` é `async void` — callers podem awaitar ou não (recomendável await para garantir consistência do log)
- **Sem returning**: o INSERT não usa `.returning()` — não é necessário o ID gerado
- **Tenant isolation**: `tenantId` é sempre passado como parâmetro explícito — nunca inferido ou aceito de body HTTP
- **actor_id nullable**: pode ser `null` para eventos do sistema ou do agente
- **Tipos válidos de actor_type**: `'doctor' | 'patient' | 'agent' | 'system'`

## Padrão de injeção

```typescript
constructor(private readonly eventLogService: EventLogService) {}

await this.eventLogService.append(
  tenantId,
  'appointment.created',
  'doctor',
  actorId,
  { appointmentId, patientId }
)
```

## O que NÃO pertence a este módulo

- Leitura do event_log (consultas de auditoria) — futuro módulo admin
- Emissão de eventos via EventEmitter2 (responsabilidade dos services de domínio)
- Processamento de eventos (responsabilidade do agent/)

## Como rodar / testar isoladamente

```bash
pnpm --filter @nocrato/api test -- --testPathPattern=event-log
```
