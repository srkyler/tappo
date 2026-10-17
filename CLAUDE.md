# Contexto Inicial do Projeto (Alethe AI Briefing)

> Este repositório foi clonado via Alethe. O briefing abaixo descreve a aplicação para orientar sua assistência.

## Tecnologias Detectadas
- Não especificada

## Resumo do Repositório (README)
```markdown
Nenhum README encontrado.
```

## Instrução Importante para o Agente
Ao iniciar a conversa com o usuário neste repositório, faça um resumo executivo direto de 2 a 3 frases explicando o propósito deste projeto.

---

# Convenções do Tappo (leitura obrigatória antes de editar código)

O briefing acima é genérico (gerado no clone). O que segue é real, aprendido corrigindo bugs
de verdade neste repositório — **sempre rode os 3 comandos abaixo antes de considerar
qualquer mudança terminada**, nessa ordem:

```bash
npx tsc --noEmit    # typecheck — pega a maioria dos erros de tipo
npm run lint        # eslint — pega regras de pureza do React que o tsc não vê
npm run build        # o único que pega erro de limite client/server do Next.js
```

`tsc` limpo **não** significa que o build passa. Vários bugs reais deste projeto só
aparecem no `next build` (ver exemplos abaixo). Rodar só `tsc` e achar que terminou já
quebrou o app em produção mais de uma vez aqui.

## 1. `"use server"` vs. `import "server-only"` — não são a mesma coisa

- `import "server-only"` (topo do arquivo): o arquivo nunca pode ser importado por um
  Client Component, nem direta nem indiretamente — nem funções de **leitura**. Use isso em
  `lib/data/*.ts` (queries puras, chamadas só de Server Components).
- `"use server"` (topo do arquivo, como string literal): todo export async vira uma Server
  Action real, chamável de um Client Component. Use isso em `app/**/actions.ts` — **mutações**.

**Nunca misture os dois no mesmo arquivo.** Se uma função de escrita (`salvarX`,
`excluirX`) precisa ser chamada de um componente `"use client"`, ela tem que morar num
arquivo `"use server"`, não em `lib/data/*.ts`. Isso já quebrou o build várias vezes:
o erro só aparece no `next build` ("You're importing a module that depends on
'server-only' ... in a Client Component"), o `tsc --noEmit` não avisa.

## 2. `<form action={fn}>` com Server Action

Se `fn` retorna `Promise<{ ok, erro }>` (o padrão `ActionResult` deste projeto), **não**
dá pra passar direto pro `action` do `<form>` — o tipo esperado é `void | Promise<void>`.
Dois caminhos certos:

```tsx
// Com feedback de erro (padrão do projeto — preferido)
"use client";
const [erro, setErro] = useState<string | null>(null);
const [pendente, iniciar] = useTransition();
<form action={(fd) => iniciar(async () => {
  const r = await salvarX(fd);
  if (!r.ok) setErro(r.erro);
})}>
```

Veja `components/crm/form-conta.tsx` como referência. Esse exato erro de tipo já
apareceu repetido em pelo menos 6 arquivos diferentes neste projeto.

## 3. Nunca `useState`/`useEffect`/`onClick` dentro de um Server Component

Um `async function Conteudo()` que busca dados no servidor **não pode** ter estado nem
handler de evento. Se precisar de um botão interativo (recalcular, abrir diálogo, etc.),
extraia um componente `"use client"` separado e passe os dados como prop. Ver
`components/leads/recalcular-score.tsx`.

## 4. `org_id` nas tabelas novas: sempre com `DEFAULT public.org_atual()`

```sql
org_id uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
```

Sem o `DEFAULT`, toda Server Action que insere nessa tabela sem passar `org_id`
explicitamente (o normal) falha com "null value in column org_id violates not-null
constraint" — ou, se também faltar RLS/coluna referenciada por uma policy, o
`setup_completo.sql` inteiro para de rodar no meio (erro que só aparece rodando o SQL
de verdade no Supabase, nunca no `tsc`). Sempre teste uma migration nova lendo-a de novo
depois de escrita, procurando por colunas que uma `CREATE POLICY` referencia mas a
`CREATE TABLE` não declarou.

## 5. Webhooks externos (sem sessão de usuário) usam `createAdminClient()`

Qualquer função chamada por uma rota pública (`app/api/**/route.ts` ou uma Server Action
invocada a partir de uma dessas rotas) não tem cookie de sessão — `createClient()`
(`lib/supabase/server.ts`) não autentica nada e o RLS bloqueia a leitura/escrita
silenciosamente. Use `createAdminClient()` (`lib/supabase/admin.ts`, service role) e
filtre manualmente por `org_id`/token, do jeito que `app/api/v1/webhooks/in/[token]/route.ts`
já faz corretamente.

## 6. Depois de criar/editar uma migration

```bash
npm run db:setup   # regenera supabase/setup_completo.sql a partir de supabase/migrations/*.sql
```

**Nunca edite `supabase/setup_completo.sql` à mão** — ele é sobrescrito na próxima vez
que alguém rodar `npm run db:setup`, e qualquer SQL colado manualmente ali se perde.

## 7. Não duplique o que já existe

Antes de criar uma tabela, tipo ou action nova, `grep` pelo nome — este projeto já teve
a mesma funcionalidade implementada duas vezes em arquivos diferentes (uma vez em
`lib/data/crm.ts`, outra em `app/app/automacoes/actions.ts`) por sessões que não liam o
que já existia. Automações, por exemplo, moram só em `app/app/automacoes/` +
`lib/data/automacoes.ts` — não crie uma segunda versão.
