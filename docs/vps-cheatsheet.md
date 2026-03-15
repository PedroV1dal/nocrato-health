# VPS Cheatsheet — Comandos do Dia a Dia

Referência rápida para operações no servidor Hostinger (produção).

---

## Acesso ao Servidor

```bash
ssh root@IP_DO_VPS
```

---

## Docker — Status e Logs

```bash
# Ver todos os containers rodando
docker ps

# Status dos containers do projeto
docker compose -f /opt/nocrato-health-v2/docker/docker-compose.prod.yml ps

# Logs em tempo real (todos os serviços)
docker compose -f /opt/nocrato-health-v2/docker/docker-compose.prod.yml logs -f

# Logs de um serviço específico
docker logs nocrato_api_prod -f
docker logs nocrato_postgres_prod -f
docker logs nocrato_nginx_prod -f
docker logs nocrato_web_prod -f
```

---

## Docker — Reiniciar Serviços

```bash
# Reiniciar um serviço (ex: após mudar .env)
docker compose -f /opt/nocrato-health-v2/docker/docker-compose.prod.yml restart api

# Reiniciar todos os serviços
docker compose -f /opt/nocrato-health-v2/docker/docker-compose.prod.yml restart

# Parar tudo
docker compose -f /opt/nocrato-health-v2/docker/docker-compose.prod.yml down

# Subir tudo
docker compose -f /opt/nocrato-health-v2/docker/docker-compose.prod.yml up -d
```

---

## Docker — Deploy de Nova Versão

```bash
cd /opt/nocrato-health-v2

# Puxar código novo
git pull origin main

# Rebuildar e subir (zero-downtime parcial)
docker compose -f docker/docker-compose.prod.yml build
docker compose -f docker/docker-compose.prod.yml up -d

# Se houver migrations novas
docker compose -f docker/docker-compose.prod.yml run --rm api node dist/database/migrate.js
```

---

## Banco de Dados — Acesso

```bash
# Conectar no psql
docker exec -it nocrato_postgres_prod psql -U nocrato nocrato

# Sair do psql
\q
```

### Comandos úteis dentro do psql

```sql
-- Listar tabelas
\dt

-- Ver estrutura de uma tabela
\d agency_members

-- Listar todos os membros da agência
SELECT id, email, name, role, status, created_at FROM agency_members;

-- Listar todos os doutores
SELECT d.email, d.name, d.onboarding_completed, d.status, t.slug
FROM doctors d
JOIN tenants t ON t.id = d.tenant_id;

-- Listar tenants
SELECT id, slug, name, status FROM tenants;
```

---

## Banco de Dados — Trocar Senha do Admin

```bash
# Passo 1: gerar o hash da nova senha (substituir MinhaNovaSenh@123)
docker exec nocrato_api_prod node -e "
  const bcrypt = require('bcrypt');
  bcrypt.hash('MinhaNovaSenh@123', 10).then(h => console.log(h));
"

# Passo 2: conectar no banco
docker exec -it nocrato_postgres_prod psql -U nocrato nocrato
```

```sql
-- Passo 3: atualizar (colar o hash gerado no passo 1)
UPDATE agency_members
SET password_hash = 'HASH_AQUI'
WHERE email = 'admin@nocrato.com';

-- Verificar
SELECT email, role, status FROM agency_members;
```

---

## Banco de Dados — Backup e Restore

```bash
# Backup completo
docker exec nocrato_postgres_prod pg_dump -U nocrato nocrato > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore (cuidado: sobrescreve dados existentes)
docker exec -i nocrato_postgres_prod psql -U nocrato nocrato < backup_YYYYMMDD_HHMMSS.sql
```

---

## Banco de Dados — Migrations

```bash
# Rodar migrations pendentes
docker compose -f /opt/nocrato-health-v2/docker/docker-compose.prod.yml \
  run --rm api node dist/database/migrate.js

# Rodar seed (idempotente — não duplica dados)
docker compose -f /opt/nocrato-health-v2/docker/docker-compose.prod.yml \
  run --rm api node dist/database/seed.js
```

---

## Variáveis de Ambiente

```bash
# Ver o .env atual
cat /opt/nocrato-health-v2/.env

# Editar
nano /opt/nocrato-health-v2/.env

# Após editar, reiniciar a API para aplicar
docker compose -f /opt/nocrato-health-v2/docker/docker-compose.prod.yml restart api
```

---

## Nginx — SSL e Certificados

```bash
# Verificar validade do certificado
certbot certificates

# Renovar certificado manualmente (normalmente é automático via cron)
certbot renew

# Recarregar nginx após mudança de config
docker exec nocrato_nginx_prod nginx -s reload

# Testar config do nginx (sem recarregar)
docker exec nocrato_nginx_prod nginx -t
```

---

## Health Check

```bash
# Verificar se a API está respondendo
curl https://app.nocrato.com/health

# Resposta esperada:
# {"status":"ok","database":true}

# Verificar se o frontend carrega
curl -I https://app.nocrato.com
# Resposta esperada: HTTP/2 200
```

---

## Acesso ao Banco via DBeaver (do computador local)

```bash
# Criar túnel SSH (deixar rodando em background)
ssh -L 5433:localhost:5432 root@IP_DO_VPS -N

# Conectar no DBeaver:
# Host:     localhost
# Port:     5433
# Database: nocrato
# User:     nocrato
# Password: (valor de DB_PASSWORD no .env do servidor)
```

---

## Nomes dos Containers em Produção

| Container | Serviço |
|-----------|---------|
| `nocrato_postgres_prod` | Banco de dados PostgreSQL |
| `nocrato_api_prod` | Backend NestJS |
| `nocrato_web_prod` | Frontend React |
| `nocrato_nginx_prod` | Reverse proxy + SSL |
| `nocrato_evolution_prod` | Evolution API (WhatsApp) |

---

## Projeto no Servidor

```
/opt/nocrato-health-v2/    ← raiz do projeto
/opt/nocrato-health-v2/.env ← variáveis de ambiente (nunca commitar)
```
