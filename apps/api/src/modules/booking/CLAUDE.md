# Módulo: booking/

## O que este módulo faz
Geração e validação de tokens de booking + cálculo de slots disponíveis + criação de consultas via link público e in-chat.

## Principais arquivos
- `booking.module.ts` — declara BookingService; exporta para uso pelo agent/
- `booking.service.ts` — lógica de negócio: generateToken, validateToken, getSlots, bookAppointment, bookInChat
- `booking.controller.ts` — rotas públicas: GET /validate, GET /slots, POST /book (prefixo public/booking/:slug)

## Regras de negócio
- Tokens são válidos por 24h e usáveis apenas uma vez (used = false + expires_at no futuro)
- Token deve pertencer ao tenant indicado pelo slug — nunca validar cross-tenant
- Slots excluem: horários ocupados (appointments com status != cancelled/no_show/rescheduled) + horários passados se data=hoje
- Max 2 consultas com status 'scheduled' por phone por tenant
- Booking público marca token como used=true atomicamente com a criação da consulta (transação)
- Booking in-chat (bookInChat) não consome token — chamada interna do agent/

## O que NÃO pertence a este módulo
- Autenticação JWT de doctor/agency (sem guards JWT aqui — rotas são públicas)
- Envio de notificações WhatsApp (responsabilidade do agent/)
- Gestão de working_hours (apenas leitura da tabela doctors)
