# docker/ — Infraestrutura Local

## O que este diretório faz

Contém os arquivos Docker Compose para subir a infraestrutura local de desenvolvimento e produção do Nocrato Health V2.

## Arquivos

| Arquivo | Propósito |
|---|---|
| `docker-compose.dev.yml` | Ambiente de desenvolvimento local — PostgreSQL 16 |
| `docker-compose.prod.yml` | Ambiente de produção — criado no Epic 11 (deploy Hetzner) |

## Serviços (dev)

| Serviço | Imagem | Porta | Credenciais |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `5432` | user: `nocrato` / db: `nocrato_health` / pass: `nocrato_secret` |

## Como usar

```bash
# Subir banco local
docker compose -f docker/docker-compose.dev.yml up -d

# Verificar status e health
docker compose -f docker/docker-compose.dev.yml ps

# Ver logs
docker compose -f docker/docker-compose.dev.yml logs postgres

# Derrubar (mantém volume com dados)
docker compose -f docker/docker-compose.dev.yml down

# Derrubar E apagar dados (reset total)
docker compose -f docker/docker-compose.dev.yml down -v
```

## Regras

- O volume `nocrato_postgres_data` persiste os dados entre restarts — não usar `-v` por acidente
- As credenciais do dev (`nocrato_secret`) são fixas e não-secretas — apenas para ambiente local
- Em produção, as credenciais vêm de variáveis de ambiente do host Hetzner — nunca commitadas
- Evolution API **não** entra no compose do dev MVP — rodar separado se necessário

## O que NÃO pertence aqui

- Configuração do NestJS (pertence a `apps/api/`)
- Variáveis de ambiente de produção (ficam no servidor Hetzner)
- Redis, S3, ou qualquer serviço fora do escopo MVP
