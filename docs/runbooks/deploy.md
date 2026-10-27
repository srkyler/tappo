# Deploy

Guia completo e atualizado: [`COMO-SUBIR-NA-VPS.txt`](../../COMO-SUBIR-NA-VPS.txt) (passo a passo
em português simples) e [`DEPLOY.md`](../../DEPLOY.md) (referência técnica dos scripts).
Este arquivo é só o resumo de "o que rodar", não repete as explicações.

## Primeira instalação

```bash
bash deploy/install.sh https://github.com/<usuario>/tappo.git
```

Interativo, valida cada credencial, detecta proxy existente, pode criar o projeto Supabase
sozinho (com um token pessoal) e pode criar a primeira conta de login.

## Atualizar

```bash
cd /root/tappo
git pull
bash deploy/update.sh
```

Faz backup antes, reaplica o schema, rebuild, e **reverte sozinho** se o healthcheck falhar
depois do update.

## Diagnóstico

```bash
bash deploy/healthcheck.sh
```

Read-only — containers, DNS/HTTPS, Supabase, WAHA. Primeiro lugar a olhar quando algo não funciona.

## Backup

```bash
bash deploy/backup.sh
```

`pg_dump` do banco (precisa de `SUPABASE_DB_URL` no `.env`) + sessões do WhatsApp. Agende no
cron — o plano grátis do Supabase não faz backup sozinho.
