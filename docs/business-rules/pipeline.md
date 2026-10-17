# Pipeline (funis)

Uma empresa pode ter vários funis (`pipelines`) — ex.: "Vendas", "Pós-venda", "Suporte".
Exatamente um é `padrao` (criado automaticamente no cadastro da empresa; não pode ser excluído).

- `pipeline_stages.pipeline_id` → de qual funil é a etapa. `ordem` é único **por funil**,
  não por empresa inteira.
- `deals.stage_id` aponta pra uma etapa — o funil do negócio é implícito por ela.
- `pipeline_stages.tipo`: `aberto` | `ganho` | `perdido`. Analytics em geral filtram por
  esse campo, não pelo nome da etapa (o nome é customizável por empresa/segmento).

## Mover um negócio

`moverDeal(id, stageId, motivoPerda?)` (`app/app/actions.ts`). Se a etapa de destino é
`tipo = 'perdido'`, a UI (Kanban) pede o motivo antes de confirmar — fica em `deals.motivo_perda`.
Mover automaticamente dispara `dispararAutomacoes("deal_mudou_etapa", ...)`.

## Criar/gerenciar funis

`criarPipeline`, `renomearPipeline`, `excluirPipeline` (`app/app/actions.ts`). Um funil só
pode ser excluído se nenhum negócio estiver em nenhuma das suas etapas (o FK de `deals.stage_id`
é `ON DELETE RESTRICT` — a checagem na action é só pra dar um erro legível antes).

## Relatórios

`painel_gestor()` e `analytics_resumo()` (funções SQL, `SECURITY INVOKER` — respeitam RLS)
agregam **todos os funis juntos** da empresa. Não há corte por funil nos relatórios ainda —
se isso for necessário, é uma extensão dessas duas functions, não do schema.
