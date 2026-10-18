# PEDIDO-CLAUDE-CRM-COMPLETO.md

## Visão Geral

Este documento especifica **todas as funcionalidades** que o Tappo CRM deve ter para ser competitivo com Deskcomm, Pipedrive, RD Station, Kommo e Simples Dental. O código base já existe em Next.js 16 + Supabase + Tailwind. O banco de dados já tem multiempresa, RLS, organizações, membros, convites, segmentos, funis, tarefas, metas, painel do gestor, inbox WhatsApp/Telegram/E-mail, tags e propostas.

**Requisito obrigatório:** Todas as novas funcionalidades devem respeitar o modelo multiempresa (`org_id` + RLS por `org_atual()`) e usar os clientes Supabase canônicos (`lib/supabase/browser.ts` para client, `lib/supabase/server.ts` para server, `lib/supabase/admin.ts` para admin).

---

## 1. CONTATOS E LEADS (base de dados)

### 1.1 Detecção automática de duplicados
- Quando um lead é criado via inbox, webhook ou formulário, verificar se já existe outro lead com o mesmo **telefone** ou **e-mail** na mesma empresa.
- Criar registro em `lead_duplicados` (tabela já existe no `setup_completo.sql`).
- Tela `/app/leads/duplicados` para o gestor revisar e mesclar duplicados.
- Ao mesclar: manter o lead mais antigo, mover atividades/tarefas/deals do duplicado para o original, excluir o duplicado.

### 1.2 Enriquecimento automático
- Ao criar um lead com CNPJ/CPF, buscar dados públicos (Receita WS, ViaCEP, etc.) e preencher automaticamente: razão social, endereço, cidade, estado, CNAE.
- Ao criar um lead com LinkedIn URL, tentar extrair: cargo, empresa, localização.

### 1.3 Histórico completo de alterações por lead (auditoria)
- Tabela `lead_historico` já existe no banco.
- Criar trigger no PostgreSQL ou interceptar no Next.js para registrar toda alteração de: status, responsável, valor, etapa do pipeline, notas.
- Tela na Ficha 360° (`/app/leads/[id]`) mostrando a linha do tempo de alterações com: campo alterado, valor antigo, valor novo, quem alterou, quando.

### 1.4 Lead score automático
- Calcular score de 0 a 100 baseado em: origem, respostas, reuniões agendadas, valor do deal, recência de interação, tags.
- Classificação: Frio (0-25), Morno (26-50), Quente (51-75), Qualificado (76-100).
- Tabela `lead_score` já existe no banco.
- Exibir score na lista de leads e na Ficha 360°.

### 1.5 Campos personalizados por empresa/segmento
- Tabela `campos_personalizados` já existe no banco.
- Tela `/app/campos-personalizados` para o dono/gestor criar campos customizados para leads, deals e contatos.
- Tipos: texto, número, data, seleção (com opções), booleano.
- Nos formulários de lead/deal, renderizar dinamicamente os campos personalizados da empresa.
- Armazenar valores em JSONB (coluna `campos_extras` ou similar).

### 1.6 Contas e Pessoas (empresa vs contato)
- Tabelas `contas` e `pessoas` já existem no banco.
- Telas: `/app/contas` (lista de empresas/clientes) e `/app/pessoas` (lista de contatos).
- Uma conta pode ter várias pessoas vinculadas.
- Uma pessoa pode ser "líder/decision maker".
- Vincular lead a conta/pessoa existente ao criar.
- Na Ficha 360°, mostrar conta vinculada e todas as pessoas da conta.

### 1.7 Importação/Exportação em massa
- Importação CSV/Excel de leads, contas, pessoas, deals.
- Exportação CSV de qualquer lista (leads, deals, tarefas, conversas).
- Mapeamento de colunas na importação.
- Validação e preview antes de importar.

### 1.8 Tags avançadas
- Tags já existem. Adicionar: cores personalizadas, categoria de tag, contagem de leads por tag.
- Filtrar leads por múltiplas tags (AND/OR).
- Tag automática por origem ou comportamento (ex.: lead que respondeu WhatsApp ganha tag "Respondeu").

---

## 2. PIPELINE E VENDAS

### 2.1 Funil customizável por empresa
- Já existe `etapas_do_segmento` no SQL. Adicionar: reordenar etapas via arrastar, adicionar/editar/remover etapas customizadas por empresa.
- Cada etapa tem: nome, probabilidade (0-100), tipo (aberto/ganho/perdido), cor, SLA (dias máximos na etapa).
- Alerta quando um deal fica parado numa etapa além do SLA.

### 2.2 Cotação / Orçamento / Proposta PDF
- Tabela `propostas` já existe.
- Gerar PDF da proposta (usando biblioteca como `jspdf` ou endpoint server).
- Template de proposta personalizável por empresa (logo, cores, termos).
- Enviar proposta por e-mail e WhatsApp.
- Rastrear se o cliente visualizou a proposta (webhook de abertura).

### 2.3 Assinatura digital de proposta
- Quando a proposta é aceita, capturar assinatura digital (canvas ou integração com DocuSign/Hellosign).
- Marcar proposta como "assinada" e criar deal automaticamente no pipeline.

### 2.4 Comissões por vendedor
- Tabela `comissoes` já existe no banco.
- Tela `/app/comissoes` para o gestor configurar: percentual por vendedor, por segmento, por tipo de negócio.
- Calcular comissão automaticamente quando deal vai para etapa "Ganho".
- Relatório de comissões por mês, por vendedor, status (pendente/pago/cancelado).

### 2.5 Previsão de fechamento por IA
- Usar o agente de IA existente para prever: qual lead vai fechar, quando, qual o valor provável.
- Baseado em: histórico de deals ganhos/perdidos, score do lead, atividade recente.
- Exibir previsão no painel do gestor e na Ficha 360°.

### 2.6 Receita recorrente (assinaturas)
- Para negócios de assinatura (SaaS, planos de saúde, etc.): registrar valor mensal, data de renovação, status da assinatura.
- Alertar sobre renovações próximas e cancelamentos.
- MRR (Monthly Recurring Revenue) no painel do gestor.

### 2.7 Motivo de perda
- Ao marcar deal como "Perdido", obrigar selecionar motivo (preço, concorrente, sem orçamento, não respondeu, etc.).
- Relatório de motivos de perda para melhorar o funil.

### 2.8 SLA por etapa do pipeline
- Cada etapa tem SLA em dias.
- Alerta visual quando deal está prestes a estourar o SLA.
- Relatório de tempo médio por etapa.

---

## 3. ATENDIMENTO / INBOX MULTICANAL

### 3.1 Múltiplos números WhatsApp por empresa
- Já existe `wa_conexoes` com `org_id`. Permitir múltiplas conexões WAHA por empresa (diferentes números para diferentes departamentos).
- Seletor de número ao enviar mensagem.
- Filtro de conversas por número.

### 3.2 SLA de resposta
- Tabela `sla_config` já existe no banco.
- Configurar tempo máximo de resposta (padrão 15 min).
- Alerta visual na lista de conversas quando ultrapassa o SLA (ex.: badge vermelho, som).
- Relatório de tempo médio de resposta por atendente e por canal.

### 3.3 Canais adicionais
- **WhatsApp:** já existe (WAHA).
- **Telegram:** já existe (conexao-telegram).
- **E-mail:** já existe (conexao-email).
- **Instagram Direct:** API do Instagram (opcional, via webhook).
- **Chat do site:** widget de chat embarqueável.
- **SMS:** via Twilio ou similar (opcional).
- Unificar todas as conversas numa única lista de inbox com ícone do canal.

### 3.4 Chatbot de qualificação por segmento
- Já existe instruções de IA por segmento em `lib/segmentos.ts`.
- Adicionar: fluxo de qualificação (perguntas pré-definidas por segmento) antes de passar para humano.
- Exemplo odontologia: "Qual tratamento procura?" → "Qual melhor período?" → agenda avaliação.
- Salvar respostas como notas no lead.

### 3.5 Respostas rápidas no inbox
- Já implementado (templates). Melhorar: atalho de teclado (/, ctrl+space), buscar templates, variáveis {{nome}}, {{empresa}}, {{cidade}}.

### 3.6 Gravação de chamada e histórico de chamadas
- Integração com WAHA/telefonia para gravar chamadas.
- Histórico: data, duração, número, resultado (atendeu, não atendeu, ocupado).
- Ligação direta do CRM (click-to-call).

### 3.7 Fila de atendimento com prioridade
- Conversas podem ter prioridade (baixa, média, alta, urgente).
- Ordenar fila por prioridade e tempo de espera.
- Atendente "puxa" a próxima da fila ou gestor atribui.

### 3.8 Transferência de conversa entre atendentes
- Já implementado (`atribuirConversa`). Adicionar: nota obrigatória ao transferir, notificação para o novo responsável.

### 3.9 Botão de "Não perturbe" / status do atendente
- Atendente define status: Disponível, Ocupado, Ausente, Offline.
- Rodízio só atribui para atendentes "Disponíveis".
- Exibir status na lista da equipe.

---

## 4. TAREFAS E ATIVIDADE

### 4.1 Calendário de tarefas (visão semanal/mensal)
- Tela `/app/calendario` com visão de calendário (FullCalendar ou similar).
- Arrastar tarefa para mudar data/hora.
- Filtrar por responsável, tipo, prioridade.
- Sincronizar com Google Calendar (opcional).

### 4.2 Tarefas recorrentes
- Tabela `tarefas_recorrentes` já existe no banco.
- Criar tarefa que se repete: diária, semanal, mensal, anual.
- Gerar automaticamente as tarefas individuais a partir da recorrente.

### 4.3 Lembretes por WhatsApp/E-mail
- Enviar lembrete automático antes da tarefa vencer (ex.: 1 hora antes).
- Usar templates de WhatsApp ou e-mail.

### 4.4 Checklist dentro da tarefa
- Uma tarefa pode ter vários itens de checklist.
- Marcar itens como concluídos.
- Tarefa só considera concluída quando todos os itens do checklist estão feitos (opcional).

### 4.5 Tarefa vinculada a múltiplos leads
- Uma tarefa pode estar vinculada a vários leads/deals/contatos.
- Visualizar todas as tarefas relacionadas a um lead na Ficha 360°.

---

## 5. MARKETING / CADÊNCIA / AUTOMAÇÃO

### 5.1 Cadência multi-canal
- Já existe `campanhas` e `campaign_steps`. Melhorar: adicionar WhatsApp e Telegram como canais de passo da cadência.
- Sequência: Dia 1 → E-mail, Dia 3 → WhatsApp, Dia 7 → Ligação, etc.
- Condicional: se respondeu, parar cadência; se não respondeu, continuar.

### 5.2 Gatilhos de automação
- "Quando lead muda para etapa X, criar tarefa para responsável."
- "Quando lead não responde há 3 dias, enviar WhatsApp automático."
- "Quando deal ganha, enviar e-mail de boas-vindas."
- Configurar via tela `/app/automacoes`.

### 5.3 Disparo de WhatsApp Template aprovado
- Enviar templates aprovados pelo WhatsApp Business (fora das 24h).
- Gerenciar templates por empresa.

### 5.4 E-mail de boas-vindas personalizado
- Já existe `templates_padrao`. Adicionar: editor de HTML para e-mail, variáveis dinâmicas.

### 5.5 Landing page de captura própria
- Página pública `/captar/[token]` para capturar leads (formulário simples: nome, telefone, e-mail, mensagem).
- Conectar a uma fonte de captação existente (`lead_sources`).
- Redirecionar após captura ou mostrar mensagem de sucesso.

---

## 6. GESTÃO E RELATÓRIOS

### 6.1 Dashboard executivo (CEO/Dono)
- Tela `/app/executivo` com visão consolidada de todas as empresas (se o usuário é dono de múltiplas).
- KPIs: total de leads, deals abertos, ganho do mês, previsão, conversão, ticket médio, ciclo de vendas.
- Comparativo mês a mês.

### 6.2 Meta de vendas por vendedor/mês
- Já existe `metas`. Melhorar: tela visual de progresso da meta (barras, percentual).
- Alerta quando vendedor está abaixo da meta esperada para o período.

### 6.3 Relatório de conversão por origem
- Quantos leads por origem (LinkedIn, Indicação, Evento, Site, WhatsApp).
- Taxa de conversão de lead → deal → ganho por origem.
- Custo de aquisição (se integrado com anúncios).

### 6.4 Relatório de atendimento por atendente
- Conversas atendidas, tempo médio de resposta, tempo médio de resolução, conversas por canal, avaliação do cliente (se houver).

### 6.5 Taxa de resposta por canal
- WhatsApp vs E-mail vs Telegram: qual tem melhor taxa de resposta?
- Melhor horário para enviar mensagens.

### 6.6 Tempo médio para fechar negócio
- Do primeiro contato até o deal ganhar/perder.
- Por segmento, por vendedor, por tipo de negócio.

### 6.7 Churn / reativação de clientes
- Identificar clientes que não compram há X dias (baseado em deals ganhos).
- Campanha de reativação automática.
- Relatório de churn mensal.

---

## 7. MULTIEMPRESA / EQUIPE

### 7.1 Hierarquia de equipes
- Já existe papéis (dono, gestor, vendedor, atendente).
- Adicionar: gestor de equipe (gerente que supervisiona vendedores específicos).
- Relatório hierárquico: dono → gerentes → vendedores → atendentes.

### 7.2 Convite por domínio de e-mail
- Quando alguém se cadastra com e-mail @empresa.com, sugerir automaticamente entrar na empresa que tem esse domínio cadastrado.
- Auto-aprovação para domínios confiáveis.

### 7.3 Controle de acesso granular por tela
- Já existe RLS por org_id. Adicionar: permissões por tela/módulo (ex.: vendedor não pode ver comissões, atendente não pode ver pipeline).
- Configurar em `/app/permissoes`.

### 7.4 Sessão de múltiplas empresas
- Já existe `trocarEmpresa`. Melhorar: lembrar última empresa acessada, alternância rápida no menu.

---

## 8. INTEGRAÇÕES

### 8.1 Google Calendar
- Sincronizar tarefas e compromissos com Google Calendar.
- Criar evento do Google Calendar a partir de uma tarefa.

### 8.2 Google Contacts / Outlook Contacts
- Sincronizar contatos e leads.

### 8.3 Zapier / n8n / Make
- Webhook público já existe (`lead_sources`). Documentar e expor mais endpoints para automação.

### 8.4 API REST pública
- Endpoints para: criar lead, buscar lead, criar deal, enviar mensagem, listar conversas.
- Autenticação por API key por empresa.

---

## 9. UX / INTERFACE

### 9.1 Modo escuro já existe. Melhorar:
- Tema por segmento (cores da clínica odontológica vs imobiliária, etc.).
- Favicon e logo personalizados por empresa.

### 9.2 Busca global (Ctrl+K)
- Já existe `PaletaComandos`. Expandir: buscar leads, deals, contatos, tarefas, conversas, templates.

### 9.3 Atalhos de teclado
- `N` = novo lead, `C` = nova conversa, `T` = nova tarefa, `ESC` = fechar modal, `?` = mostrar atalhos.

### 9.4 Notificações em tempo real
- Usar Supabase Realtime (já configurado para tarefas e conversas).
- Notificação toast quando nova mensagem chega, quando lead é atribuído, quando tarefa vence.

---

## 10. DOCUMENTAÇÃO DE UPDATE

Cada nova funcionalidade deve incluir:
1. **Migração SQL** no `supabase/migrations/` e atualizar `supabase/setup_completo.sql`.
2. **Tipos TypeScript** em `lib/data/types.ts`.
3. **Queries** em `lib/data/queries.ts`.
4. **Server Actions** em `app/app/*/actions.ts`.
5. **Página** em `app/app/*/page.tsx`.
6. **Componente** em `components/*/`.
7. **Navegação** em `components/dashboard/app-nav.tsx` (se aplicável).
8. **Atualizar `PRODUCT.md`** com a nova funcionalidade.
9. **Testar:** `npx tsc --noEmit`, `npx eslint .`, `npx next build`.

---

## Prioridade de Implementação

**Sprint 1 (Crítico para produção):**
- [ ] Aplicar migração no Supabase (setup_completo.sql)
- [ ] Detecção de duplicados
- [ ] Histórico de alterações (lead_historico)
- [ ] Campos personalizados
- [ ] Contas e Pessoas

**Sprint 2 (Vendas):**
- [ ] Propostas PDF
- [ ] Comissões
- [ ] Funil customizável com SLA
- [ ] Motivo de perda

**Sprint 3 (Atendimento):**
- [ ] Múltiplos WhatsApp
- [ ] SLA de resposta com alerta
- [ ] Chatbot de qualificação
- [ ] Gravação de chamada

**Sprint 4 (Gestão):**
- [ ] Dashboard executivo
- [ ] Relatório de conversão por origem
- [ ] Lead score
- [ ] Calendário de tarefas

**Sprint 5 (Automação):**
- [ ] Cadência multi-canal
- [ ] Gatilhos de automação
- [ ] API REST pública
- [ ] Integrações (Zapier, Google Calendar)

---

**Observação importante:** O commit `c173c1e` já está no GitHub. Antes de implementar qualquer coisa nova em produção, **aplique a migração no Supabase** rodando `supabase/setup_completo.sql` no SQL Editor.
