# Multiempresa

Cada usuário pertence a uma ou mais empresas (`organizacoes`, via `org_membros`). A empresa
"ligada" no momento fica em `profiles.org_atual`, trocável pela tela (equipe só pode trocar
pra uma empresa onde é membro — `trg_proteger_org_atual`).

## Papéis dentro da empresa

| Papel | Pode |
|---|---|
| `dono` | Tudo, incluindo editar a empresa e ver `/app/gestor` |
| `gestor` | Mesmo que dono, exceto excluir a empresa |
| `vendedor` | Seus próprios leads/negócios + os atribuídos |
| `atendente` | Inbox e tarefas, sem pipeline de vendas |

`lib/segmentos.ts` tem `ehGestor(papel)`. Isso é **diferente** de ser admin da plataforma
(`/admin`, cadastro de agentes de IA) — ver `lib/admin/guard.ts`.

## Convites

`org_convites` guarda e-mail + papel + token, expira em 7 dias. Se a pessoa convidada já
tem conta, aceitar é automático no próximo login; se não tem, o convite é aplicado no
cadastro (`handle_new_user()` verifica convite pendente antes de criar uma empresa nova).

## Segmento e funil padrão

Toda empresa tem um `segmento` (`geral`, `odontologia`, `imobiliaria`, etc. — `lib/segmentos.ts`).
O segmento decide o **vocabulário** (lead vira "Cliente" ou "Paciente") e as etapas padrão do
funil "Principal", geradas por `etapas_do_segmento()`. Trocar o segmento depois não migra
etapas já criadas — isso é feito manualmente em "Aplicar funil do segmento"
(`app/app/empresa/actions.ts`), e só funciona se o funil ainda não tiver negócios.
