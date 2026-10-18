# BUGS-TAPP0-CRM.md

Relatório de bugs encontrados no código existente. Revise antes de aplicar correções em produção.

---

## Bug 1: `atribuirConversa` lança erro se conversa não existe

**Arquivo:** `app/app/inbox/actions.ts:143`
**Severidade:** Média
**Descrição:** `.single()` lança exceção quando não encontra registro, em vez de retornar null.

```typescript
const { data: antes } = await supabase
  .from("wa_conversas")
  .select("atribuido_a, lead_id")
  .eq("id", conversaId)
  .single();  // ← lança PostgrestError se não existir
```

**Fix sugerido:** usar `.maybeSingle()` e tratar caso `antes` seja null.

---

## Bug 2: `enviarMensagem` define responsável sem checar permissão

**Arquivo:** `app/app/inbox/actions.ts:111`
**Severidade:** Baixa
**Descrição:** Qualquer usuário que responde uma conversa sem dono se torna automaticamente o responsável (`atribuido_a: user.id`), mesmo que seja apenas um atendente com restrições.

**Fix sugerido:** verificar papel do usuário ou permitir apenas se o usuário já participa da empresa.

---

## Bug 3: `novaConversa` pode falhar com `onConflict` no chat_id null

**Arquivo:** `app/app/inbox/actions.ts:191`
**Severidade:** Média
**Descrição:** `onConflict: "org_id,chat_id"` requer que `chat_id` não seja null. Se `chatDoTelefone()` retornar algo inválido ou o telefone estiver em formato estranho, o upsert pode falhar.

**Fix sugerido:** validar `chatId` antes do upsert (já tem validação, mas o split pode gerar undefined).

---

## Bug 4: `marcarComoLida` chamado com `selId` possivelmente null

**Arquivo:** `components/inbox/inbox-view.tsx:104`
**Severidade:** Baixa
**Descrição:** No efeito que escuta mensagens, `marcarComoLida(selId)` é chamado sem verificar se `selId` existe. Se `selId` for null, a query `eq("id", null)` não encontra nada (não é erro, mas é desnecessário).

**Fix sugerido:** `if (selId) marcarComoLida(selId);`

---

## Bug 5: Botão de IA mostra sem verificar conexão WORKING

**Arquivo:** `components/inbox/inbox-view.tsx:238`
**Severidade:** Baixa
**Descrição:** O botão "IA atendendo / Você atendendo" aparece baseado apenas em `conexao?.ia_ativa`, sem verificar se `conexao.status === "WORKING"`. Usuário pode achar que a IA está ativa quando o WhatsApp está desconectado.

**Fix sugerido:** condicionar também a `conexao?.status === "WORKING"`.

---

## Bug 6: `listarTarefas` não passa `org_id` explicitamente

**Arquivo:** `app/app/tarefas/actions.ts:24-31`
**Severidade:** Média
**Descrição:** Depende exclusivamente do RLS para filtrar por `org_atual()`. Funciona, mas se o RLS falhar ou não estiver aplicado, vaza dados entre empresas.

**Fix sugerido:** adicionar `.eq("org_id", empresa.id)` na query (já tem `empresa` disponível).

---

## Bug 7: Migração separada da migration principal

**Arquivo:** `supabase/migrations/20261016150000_multiempresa.sql` vs `supabase/setup_completo.sql`
**Severidade:** Alta
**Descrição:** As tabelas novas (tags, propostas, duplicados, tarefas recorrentes, SLA, histórico, score, comissões, campos personalizados, contas, pessoas) só estão no `setup_completo.sql`, não na migration versionada. Se alguém aplicar só a migration, essas tabelas não existem.

**Fix sugerido:** criar migration separada `20261017000000_crm_avancado.sql` com todas as tabelas novas e atualizar `setup_completo.sql` para incluir ambas em ordem.

---

## Bug 8: `salvarConexao` apaga chave mesmo sem intenção

**Arquivo:** `app/app/inbox/actions.ts:53-54`
**Severidade:** Baixa
**Descrição:** Se `remover_chave` for "on", a chave é definida como null mesmo que o usuário tenha apenas querido editar outros campos. O checkbox de "remover chave" deve ser explícito.

**Fix sugerido:** só limpar `api_key_cifrada` se o campo `remover_chave` estiver marcado intencionalmente.

---

## Bug 9: `exportarCSV` não escapa corretamente aspas duplas em todos os casos

**Arquivo:** `components/leads/leads-view.tsx`
**Severidade:** Baixa
**Descrição:** A função de exportação CSV faz replace de `"` por `""`, mas se o valor contiver quebras de linha, o CSV pode ficar malformado.

**Fix sugerido:** envolver valores com quebra de linha em aspas e escapar corretamente (já faz parcialmente).

---

## Bug 10: Filtro "minhas conversas" esconde conversas não atribuídas

**Arquivo:** `components/inbox/inbox-view.tsx:122-123`
**Severidade:** Baixa (comportamento esperado, mas confuso)
**Descrição:** No filtro "minhas", só aparecem conversas onde `atribuido_a === userId`. Conversas novas sem responsável não aparecem em nenhum filtro exceto "ativas". Usuário pode achar que perdeu conversas.

**Fix sugerido:** adicionar indicativo visual no filtro "ativas" mostrando quantas estão sem responsável.

---

## Como aplicar correções

1. Revise cada bug acima.
2. Corrija no código.
3. Rode `npx tsc --noEmit` e `npx eslint .` para validar.
4. Rode `npx next build` para garantir que o build passa.
5. Commit e push.

**Importante:** O banco de produção ainda não tem as novas tabelas. **Não suba para a VPS antes de aplicar `supabase/setup_completo.sql` no SQL Editor do Supabase.**
