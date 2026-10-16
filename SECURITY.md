# Segurança — Tappo

## Chaves de API e variáveis sensíveis

### Quais existem e onde ficam

| Variável | Onde fica | Risco se vazar |
|----------|-----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + Server | Baixo (é pública por design) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + Server | Médio — RLS mitiga |
| `SUPABASE_SERVICE_ROLE_KEY` | Apenas Server | **CRÍTICO — bypassa RLS** |

### Regras invioláveis

1. **`.env.local` nunca vai para o Git** — está no `.gitignore`
2. **`SUPABASE_SERVICE_ROLE_KEY` nunca vai para o browser** — só `lib/supabase/admin.ts` usa ela, e só em código server-side
3. **Nunca commite chaves reais** — use `.env.example` com valores fictícios
4. **Nunca log de chaves** — não use `console.log(process.env.SUPABASE_SERVICE_ROLE_KEY)`

### Rotação de chaves (a cada 90 dias)

**Supabase Anon Key + Service Role Key:**
1. Acesse: Supabase Dashboard → Settings → API
2. Clique em "Rotate" para gerar novas chaves
3. Atualize o `.env.local` no servidor de produção (Vercel: Settings → Environment Variables)
4. Faça novo deploy
5. Confirme que o app está funcionando antes de invalidar as antigas

**Em caso de vazamento (chave exposta em commit público):**
1. Rotacione IMEDIATAMENTE no Supabase Dashboard
2. Revogue o commit com `git filter-branch` ou BFG Repo Cleaner
3. Notifique os usuários se dados foram acessados

## Row Level Security (RLS)

Todo dado de usuário fica em tabelas com RLS habilitado. A regra básica:

```sql
-- Usuário só vê/edita seus próprios dados
CREATE POLICY "somente_proprio_usuario"
  ON tabela
  FOR ALL
  USING (auth.uid() = user_id);
```

Nunca crie tabela com dados de usuário sem essa proteção.

## Autenticação

- Middleware `proxy.ts` protege todas as rotas `/app/*`
- Use `requireAuth()` de `lib/auth/require-auth.ts` em Server Components sensíveis
- Sempre `getUser()` — nunca `getSession()` no server (getSession não valida com Supabase)
- Cookies com `SameSite=Lax` e `HttpOnly` (configurados pelo `@supabase/ssr`)

## Reportar vulnerabilidade

Não abra issue pública. Entre em contato diretamente com o time antes de divulgar.
