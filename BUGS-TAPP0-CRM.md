# BUGS-TAPP0-CRM.md

Relatório de bugs encontrados no código existente. Revise antes de aplicar correções em produção.

---

## Bug 1: `atribuirConversa` lança erro se conversa não existe

**Status (31/10/2026):** ✅ Corrigido — `.maybeSingle()` e retorno "Conversa não encontrada" antes do update (antes a ação dizia ok sem alterar nada).

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

**Status (31/10/2026):** ✔️ Mantido por design — quem responde uma conversa sem dono assume (padrão Chatwoot/DeskcommCRM); todos que respondem já são membros da empresa (RLS). Transferir para outra pessoa continua só para gestor.

**Arquivo:** `app/app/inbox/actions.ts:111`
**Severidade:** Baixa
**Descrição:** Qualquer usuário que responde uma conversa sem dono se torna automaticamente o responsável (`atribuido_a: user.id`), mesmo que seja apenas um atendente com restrições.

**Fix sugerido:** verificar papel do usuário ou permitir apenas se o usuário já participa da empresa.

---

## Bug 3: `novaConversa` pode falhar com `onConflict` no chat_id null

**Status (31/10/2026):** ✔️ Não reproduz — `chatDoTelefone()` devolve `null` para telefone inválido e a ação para antes do upsert; `split` de `"…@c.us"` sempre devolve string.

**Arquivo:** `app/app/inbox/actions.ts:191`
**Severidade:** Média
**Descrição:** `onConflict: "org_id,chat_id"` requer que `chat_id` não seja null. Se `chatDoTelefone()` retornar algo inválido ou o telefone estiver em formato estranho, o upsert pode falhar.

**Fix sugerido:** validar `chatId` antes do upsert (já tem validação, mas o split pode gerar undefined).

---

## Bug 4: `marcarComoLida` chamado com `selId` possivelmente null

**Status (31/10/2026):** ✔️ Não reproduz — o efeito começa com `if (!selId) return;`.

**Arquivo:** `components/inbox/inbox-view.tsx:104`
**Severidade:** Baixa
**Descrição:** No efeito que escuta mensagens, `marcarComoLida(selId)` é chamado sem verificar se `selId` existe. Se `selId` for null, a query `eq("id", null)` não encontra nada (não é erro, mas é desnecessário).

**Fix sugerido:** `if (selId) marcarComoLida(selId);`

---

## Bug 5: Botão de IA mostra sem verificar conexão WORKING

**Status (31/10/2026):** ✅ Corrigido — o botão e o ícone de IA dependem do canal da conversa: WhatsApp com algum número `WORKING` e IA ligada; Telegram `WORKING`; e-mail configurado.

**Arquivo:** `components/inbox/inbox-view.tsx:238`
**Severidade:** Baixa
**Descrição:** O botão "IA atendendo / Você atendendo" aparece baseado apenas em `conexao?.ia_ativa`, sem verificar se `conexao.status === "WORKING"`. Usuário pode achar que a IA está ativa quando o WhatsApp está desconectado.

**Fix sugerido:** condicionar também a `conexao?.status === "WORKING"`.

---

## Bug 6: `listarTarefas` não passa `org_id` explicitamente

**Status (31/10/2026):** ✅ Já corrigido no código — `listarTarefas` filtra `.eq("org_id", empresa.id)`.

**Arquivo:** `app/app/tarefas/actions.ts:24-31`
**Severidade:** Média
**Descrição:** Depende exclusivamente do RLS para filtrar por `org_atual()`. Funciona, mas se o RLS falhar ou não estiver aplicado, vaza dados entre empresas.

**Fix sugerido:** adicionar `.eq("org_id", empresa.id)` na query (já tem `empresa` disponível).

---

## Bug 7: Migração separada da migration principal

**Status (31/10/2026):** ✅ Corrigido em `778703c` — migration `20261018120000_telas_complementares.sql`; `setup_completo.sql` só é gerado por `npm run db:setup`.

**Arquivo:** `supabase/migrations/20261016150000_multiempresa.sql` vs `supabase/setup_completo.sql`
**Severidade:** Alta
**Descrição:** As tabelas novas (tags, propostas, duplicados, tarefas recorrentes, SLA, histórico, score, comissões, campos personalizados, contas, pessoas) só estão no `setup_completo.sql`, não na migration versionada. Se alguém aplicar só a migration, essas tabelas não existem.

**Fix sugerido:** criar migration separada `20261017000000_crm_avancado.sql` com todas as tabelas novas e atualizar `setup_completo.sql` para incluir ambas em ordem.

---

## Bug 8: `salvarConexao` apaga chave mesmo sem intenção

**Status (31/10/2026):** ✔️ Obsoleto — URL e API key do WAHA saíram da interface (vêm do `.env`); `remover_chave` não existe mais.

**Arquivo:** `app/app/inbox/actions.ts:53-54`
**Severidade:** Baixa
**Descrição:** Se `remover_chave` for "on", a chave é definida como null mesmo que o usuário tenha apenas querido editar outros campos. O checkbox de "remover chave" deve ser explícito.

**Fix sugerido:** só limpar `api_key_cifrada` se o campo `remover_chave` estiver marcado intencionalmente.

---

## Bug 9: `exportarCSV` não escapa corretamente aspas duplas em todos os casos

**Status (31/10/2026):** ✅ Corrigido — célula sempre entre aspas (quebra de linha é válida dentro), BOM UTF-8 para o Excel, fim de linha `
` e proteção contra injeção de fórmula (`=`, `+`, `-`, `@` prefixados com `'`).

**Arquivo:** `components/leads/leads-view.tsx`
**Severidade:** Baixa
**Descrição:** A função de exportação CSV faz replace de `"` por `""`, mas se o valor contiver quebras de linha, o CSV pode ficar malformado.

**Fix sugerido:** envolver valores com quebra de linha em aspas e escapar corretamente (já faz parcialmente).

---

## Bug 10: Filtro "minhas conversas" esconde conversas não atribuídas

**Status (31/10/2026):** ✅ Corrigido — novo filtro "Sem responsável" com contagem.

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
