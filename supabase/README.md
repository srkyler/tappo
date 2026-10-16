# supabase/

Este diretório contém o schema e migrações do banco de dados do Tappo.

## Estrutura

```
supabase/
  migrations/   ← arquivos SQL versionados (001_init.sql, 002_leads.sql ...)
  seed.sql      ← dados sintéticos de desenvolvimento (nunca dados reais)
  README.md     ← este arquivo
```

## Regras de segurança obrigatórias (RLS)

**Toda tabela nova deve ter RLS habilitado desde a criação.**

```sql
-- Padrão mínimo para qualquer tabela com dados de usuário:
ALTER TABLE nome_da_tabela ENABLE ROW LEVEL SECURITY;

-- Política básica: usuário vê só os próprios dados
CREATE POLICY "usuario_ve_somente_seus_dados"
  ON nome_da_tabela
  FOR ALL
  USING (auth.uid() = user_id);
```

## Como criar uma migração

1. Crie um arquivo numerado: `supabase/migrations/001_descricao.sql`
2. Escreva o SQL — sempre com `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
3. Aplique localmente: `supabase db push` (requer Supabase CLI)
4. Em produção: aplique pelo Dashboard do Supabase ou via CI

## Nunca faça

- Deixar tabela sem RLS em produção
- Guardar senhas em colunas de texto simples
- Usar `service_role` em código client-side (browser)
- Commitar arquivos `.env` com chaves reais

## Tabelas planejadas (v1)

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfil do usuário (extensão do auth.users) |
| `leads` | Base de leads da empresa |
| `campaigns` | Campanhas de prospecção |
| `cadences` | Cadências de contato por campanha |
| `pipeline_stages` | Etapas do pipeline de vendas |
| `deals` | Negociações no pipeline |
| `activities` | Histórico de atividades por lead/deal |

Cada tabela acima terá `user_id uuid REFERENCES auth.users(id)` + RLS habilitado.
