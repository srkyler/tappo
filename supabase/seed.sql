-- =============================================================
-- seed.sql
-- Dados sintéticos de desenvolvimento para o Tappo
-- ◆ NUNCA usar em produção — apenas ambiente local/staging
--
-- Usuário de teste:  dev@tappo.io / dev123456
-- Este arquivo assume que o usuário já existe em auth.users.
-- Execute após criar o usuário no dashboard do Supabase ou via:
--   supabase auth create --email dev@tappo.io --password dev123456
-- =============================================================

-- Interrompe se o usuário de seed não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'dev@tappo.io'
  ) THEN
    RAISE EXCEPTION
      'Usuário dev@tappo.io não encontrado em auth.users. '
      'Crie o usuário antes de executar o seed. '
      'Veja o comentário no topo deste arquivo.';
  END IF;
END;
$$;

-- Variável local para o user_id do dev
-- Usada em todo o seed para associar os registros
DO $$
DECLARE
  uid       UUID;
  -- IDs das etapas do pipeline
  st_prosp  UUID;
  st_quali  UUID;
  st_reun   UUID;
  st_prop   UUID;
  st_fech   UUID;
  -- IDs de leads
  l_helena  UUID;
  l_rafael  UUID;
  l_marina  UUID;
  l_carlos  UUID;
  l_julia   UUID;
  l_pedro   UUID;
  l_fernanda UUID;
  l_bruno   UUID;
  l_amanda  UUID;
  l_tiago   UUID;
  l_carla   UUID;
  l_eduardo UUID;
  l_patricia UUID;
  l_rodrigo UUID;
  l_isabela UUID;
  -- IDs de campaigns
  c_ind_sul UUID;
  c_clinsp  UUID;
  c_imob    UUID;
  c_cont    UUID;
  -- IDs de deals
  d01 UUID; d02 UUID; d03 UUID; d04 UUID; d05 UUID;
  d06 UUID; d07 UUID; d08 UUID; d09 UUID; d10 UUID;

BEGIN
  -- ----------------------------------------------------------
  -- 0. Busca o user_id do usuário de desenvolvimento
  -- ----------------------------------------------------------
  SELECT id INTO uid FROM auth.users WHERE email = 'dev@tappo.io';

  -- ----------------------------------------------------------
  -- 1. Profile
  -- ----------------------------------------------------------
  INSERT INTO public.profiles (id, nome_completo, empresa, cargo, onboarding_concluido)
  VALUES (uid, 'Dev Tappo', 'Tappo SaaS', 'Fundador', true)
  ON CONFLICT (id) DO UPDATE SET
    nome_completo = EXCLUDED.nome_completo,
    empresa       = EXCLUDED.empresa,
    cargo         = EXCLUDED.cargo,
    onboarding_concluido = EXCLUDED.onboarding_concluido;

  -- ----------------------------------------------------------
  -- 2. Leads (15 fichas — espelho do LEADS_MOCK do frontend)
  -- ----------------------------------------------------------
  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0241', 'Helena Duarte',   'Indústria Moreno',      'Diretora de Compras',   'LinkedIn',   'Contatado',   'Contato via LinkedIn. Mostrou interesse na proposta de Q4.')
  RETURNING id INTO l_helena;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0244', 'Rafael Nunes',    'Nunes Log.',             'CEO',                    'Indicação',  'Reunião',     'Indicado por Eduardo Lima. Demo agendada para sexta.')
  RETURNING id INTO l_rafael;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0247', 'Marina Pacheco',  'Metalúrgica Andrade',   'Dir. de Operações',      'Evento',     'Qualificado', 'Conhecida na Feira Industrial SP 2026. 2ª tentativa de ligação pendente.')
  RETURNING id INTO l_marina;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0252', 'Carlos Betim',    'Betim & Filhos',         'Head Comercial',         'Prospecção', 'Nova',        'Primeiro contato pendente. Empresa com ~80 funcionários.')
  RETURNING id INTO l_carlos;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0256', 'Júlia Sampaio',   'Sampaio Odonto',         'Sócia',                  'LinkedIn',   'Follow-up',   'E-mail de aquecimento enviado. Aguardando retorno.')
  RETURNING id INTO l_julia;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0261', 'Pedro Alves',     'Construtora Alves',      'Diretor Geral',          'Prospecção', 'Nova',        NULL)
  RETURNING id INTO l_pedro;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0264', 'Fernanda Costa',  'Costa Importações',      'Gerente Comercial',      'LinkedIn',   'Contatado',   NULL)
  RETURNING id INTO l_fernanda;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0268', 'Bruno Ferreira',  'TechSul Sistemas',       'CTO',                    'Evento',     'Qualificado', 'Tech-savvy — prefere demo técnica. Agendado para próxima semana.')
  RETURNING id INTO l_bruno;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0271', 'Amanda Ramos',    'Ramos Distribuidora',    'Dir. de Vendas',         'Prospecção', 'Perdido',     'Decidiu não avançar. Budget insuficiente em Q4.')
  RETURNING id INTO l_amanda;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0275', 'Tiago Moreira',   'Moreira Advocacia',      'Sócio-fundador',         'Indicação',  'Reunião',     'Reunião de discovery marcada. Alto potencial.')
  RETURNING id INTO l_tiago;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0278', 'Carla Ribeiro',   'Ribeiro & Associados',   'Gerente de Projetos',    'LinkedIn',   'Follow-up',   NULL)
  RETURNING id INTO l_carla;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0282', 'Eduardo Lima',    'Lima Agronegócios',      'Presidente',             'Evento',     'Contatado',   'Maior ticket potencial da base. Prioridade alta.')
  RETURNING id INTO l_eduardo;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0285', 'Patrícia Souza',  'Souza Embalagens',       'Diretora Industrial',    'Prospecção', 'Nova',        NULL)
  RETURNING id INTO l_patricia;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0289', 'Rodrigo Matos',   'Matos Contabilidade',    'Sócio',                  'Indicação',  'Qualificado', 'Indicado por Helena Duarte.')
  RETURNING id INTO l_rodrigo;

  INSERT INTO public.leads (id, user_id, cod, nome, empresa, cargo, origem, status, notas)
  VALUES
    (gen_random_uuid(), uid, 'GAR-0293', 'Isabela Torres',  'Torres Imobiliária',     'Diretora Comercial',     'LinkedIn',   'Nova',        NULL)
  RETURNING id INTO l_isabela;

  -- ----------------------------------------------------------
  -- 3. Pipeline stages (etapas padrão do Tappo)
  -- ----------------------------------------------------------
  INSERT INTO public.pipeline_stages (id, user_id, nome, ordem, cor, is_fechado)
  VALUES
    (gen_random_uuid(), uid, 'Prospecção',   1, '#C1934E', false),
    (gen_random_uuid(), uid, 'Qualificado',  2, '#274B6D', false),
    (gen_random_uuid(), uid, 'Reunião',      3, '#A8322C', false),
    (gen_random_uuid(), uid, 'Proposta',     4, '#C1934E', false),
    (gen_random_uuid(), uid, 'Fechado',      5, '#4E6E4E', true);

  SELECT id INTO st_prosp FROM public.pipeline_stages WHERE user_id = uid AND nome = 'Prospecção';
  SELECT id INTO st_quali FROM public.pipeline_stages WHERE user_id = uid AND nome = 'Qualificado';
  SELECT id INTO st_reun  FROM public.pipeline_stages WHERE user_id = uid AND nome = 'Reunião';
  SELECT id INTO st_prop  FROM public.pipeline_stages WHERE user_id = uid AND nome = 'Proposta';
  SELECT id INTO st_fech  FROM public.pipeline_stages WHERE user_id = uid AND nome = 'Fechado';

  -- ----------------------------------------------------------
  -- 4. Deals (10 negociações — espelho do DEALS_MOCK)
  -- ----------------------------------------------------------
  INSERT INTO public.deals (id, user_id, nome, empresa, contato, lead_id, valor, stage_id, dias_em_etapa)
  VALUES (gen_random_uuid(), uid, 'Proposta Moreno Q4',       'Indústria Moreno',    'Helena Duarte',  l_helena,  48000,  st_prop,  12) RETURNING id INTO d01;

  INSERT INTO public.deals (id, user_id, nome, empresa, contato, lead_id, valor, stage_id, dias_em_etapa)
  VALUES (gen_random_uuid(), uid, 'Licença Nunes Log',         'Nunes Logística',    'Rafael Nunes',   l_rafael,  24000,  st_reun,  5)  RETURNING id INTO d02;

  INSERT INTO public.deals (id, user_id, nome, empresa, contato, lead_id, valor, stage_id, dias_em_etapa)
  VALUES (gen_random_uuid(), uid, 'Implantação Andrade',       'Metalúrgica Andrade','Marina Pacheco', l_marina,  72000,  st_quali, 8)  RETURNING id INTO d03;

  INSERT INTO public.deals (id, user_id, nome, empresa, contato, lead_id, valor, stage_id, dias_em_etapa)
  VALUES (gen_random_uuid(), uid, 'Plano Betim Filhos',        'Betim & Filhos',     'Carlos Betim',   l_carlos,  18000,  st_prosp, 2)  RETURNING id INTO d04;

  INSERT INTO public.deals (id, user_id, nome, empresa, contato, lead_id, valor, stage_id, dias_em_etapa)
  VALUES (gen_random_uuid(), uid, 'Contrato Sampaio Odonto',   'Sampaio Odonto',     'Júlia Sampaio',  l_julia,   9600,   st_reun,  7)  RETURNING id INTO d05;

  INSERT INTO public.deals (id, user_id, nome, empresa, contato, lead_id, valor, stage_id, dias_em_etapa)
  VALUES (gen_random_uuid(), uid, 'Licença TechSul',           'TechSul Sistemas',   'Bruno Ferreira', l_bruno,   36000,  st_quali, 14) RETURNING id INTO d06;

  INSERT INTO public.deals (id, user_id, nome, empresa, contato, lead_id, valor, stage_id, dias_em_etapa)
  VALUES (gen_random_uuid(), uid, 'Projeto Alves Construtora', 'Construtora Alves',  'Pedro Alves',    l_pedro,   60000,  st_prop,  19) RETURNING id INTO d07;

  INSERT INTO public.deals (id, user_id, nome, empresa, contato, lead_id, valor, stage_id, dias_em_etapa)
  VALUES (gen_random_uuid(), uid, 'Fechamento Moreira Adv',    'Moreira Advocacia',  'Tiago Moreira',  l_tiago,   14400,  st_fech,  30) RETURNING id INTO d08;

  INSERT INTO public.deals (id, user_id, nome, empresa, contato, lead_id, valor, stage_id, dias_em_etapa)
  VALUES (gen_random_uuid(), uid, 'Lima Agronegócios',         'Lima Agronegócios',  'Eduardo Lima',   l_eduardo, 90000,  st_prosp, 1)  RETURNING id INTO d09;

  INSERT INTO public.deals (id, user_id, nome, empresa, contato, lead_id, valor, stage_id, dias_em_etapa)
  VALUES (gen_random_uuid(), uid, 'Torres Imobiliária',        'Torres Imobiliária', 'Isabela Torres', l_isabela, 21600,  st_prosp, 3)  RETURNING id INTO d10;

  -- ----------------------------------------------------------
  -- 5. Campaigns
  -- ----------------------------------------------------------
  INSERT INTO public.campaigns (id, user_id, nome, descricao, status, etapa_atual, total_etapas, leads_count, respostas_count, reunioes_count)
  VALUES
    (gen_random_uuid(), uid, 'Indústrias Sul — Q4 2026',
      'Prospecção de indústrias do Sul com mais de 50 funcionários',
      'Ativa', 2, 5, 87, 23, 8)
  RETURNING id INTO c_ind_sul;

  INSERT INTO public.campaigns (id, user_id, nome, descricao, status, etapa_atual, total_etapas, leads_count, respostas_count, reunioes_count)
  VALUES
    (gen_random_uuid(), uid, 'Clínicas SP 2026',
      'Clínicas odontológicas e médicas na Grande São Paulo',
      'Ativa', 3, 5, 124, 41, 15)
  RETURNING id INTO c_clinsp;

  INSERT INTO public.campaigns (id, user_id, nome, descricao, status, etapa_atual, total_etapas, leads_count, respostas_count, reunioes_count)
  VALUES
    (gen_random_uuid(), uid, 'Imobiliárias Norte',
      'Imobiliárias e corretores do Norte e Nordeste',
      'Ativa', 1, 5, 56, 9, 3)
  RETURNING id INTO c_imob;

  INSERT INTO public.campaigns (id, user_id, nome, descricao, status, etapa_atual, total_etapas, leads_count, respostas_count, reunioes_count)
  VALUES
    (gen_random_uuid(), uid, 'Contabilidades BH',
      'Escritórios de contabilidade em Belo Horizonte',
      'Rascunho', 0, 4, 43, 0, 0)
  RETURNING id INTO c_cont;

  -- ----------------------------------------------------------
  -- 6. Cadences (etapas de cada campanha)
  -- ----------------------------------------------------------
  -- Campanha: Indústrias Sul
  INSERT INTO public.cadences (user_id, campaign_id, acao, quando, canal, ordem) VALUES
    (uid, c_ind_sul, 'E-mail de apresentação personalizado',  'Dia 1',  'E-mail',   1),
    (uid, c_ind_sul, 'Conexão no LinkedIn com mensagem',      'Dia 3',  'LinkedIn', 2),
    (uid, c_ind_sul, 'Ligação de follow-up',                  'Dia 7',  'Telefone', 3),
    (uid, c_ind_sul, 'E-mail com case de sucesso relevante',  'Dia 12', 'E-mail',   4),
    (uid, c_ind_sul, 'Última tentativa — convite para demo',  'Dia 18', 'LinkedIn', 5);

  -- Campanha: Clínicas SP
  INSERT INTO public.cadences (user_id, campaign_id, acao, quando, canal, ordem) VALUES
    (uid, c_clinsp, 'WhatsApp de introdução com vídeo',            'Dia 1',  'WhatsApp', 1),
    (uid, c_clinsp, 'E-mail com proposta de valor',                'Dia 2',  'E-mail',   2),
    (uid, c_clinsp, 'Ligação de qualificação',                     'Dia 5',  'Telefone', 3),
    (uid, c_clinsp, 'Demo personalizada agendada',                 'Dia 9',  'Videoconf',4),
    (uid, c_clinsp, 'Proposta formal + follow-up de fechamento',   'Dia 14', 'E-mail',   5);

  -- Campanha: Imobiliárias Norte
  INSERT INTO public.cadences (user_id, campaign_id, acao, quando, canal, ordem) VALUES
    (uid, c_imob, 'E-mail de cold outreach',         'Dia 1',  'E-mail',   1),
    (uid, c_imob, 'Ligação de primeiro contato',     'Dia 4',  'Telefone', 2),
    (uid, c_imob, 'Conexão LinkedIn + mensagem',     'Dia 7',  'LinkedIn', 3),
    (uid, c_imob, 'E-mail com ROI estimado',         'Dia 11', 'E-mail',   4),
    (uid, c_imob, 'Ligação de encerramento',         'Dia 16', 'Telefone', 5);

  -- Campanha: Contabilidades BH (rascunho)
  INSERT INTO public.cadences (user_id, campaign_id, acao, quando, canal, ordem) VALUES
    (uid, c_cont, 'E-mail de abertura',         'Dia 1',  'E-mail',   1),
    (uid, c_cont, 'Ligação de qualificação',    'Dia 5',  'Telefone', 2),
    (uid, c_cont, 'LinkedIn follow-up',         'Dia 9',  'LinkedIn', 3),
    (uid, c_cont, 'E-mail de encerramento',     'Dia 14', 'E-mail',   4);

  -- ----------------------------------------------------------
  -- 7. Activities (feed de atividades recentes)
  -- ----------------------------------------------------------
  INSERT INTO public.activities (user_id, tipo, descricao, lead_id, deal_id, ocorreu_em) VALUES
    (uid, 'ligacao',     'Ligação com Rafael Nunes — demo agendada para sexta',          l_rafael,   d02, now() - interval '20 minutes'),
    (uid, 'email',       'E-mail enviado para Helena Duarte (Indústria Moreno)',          l_helena,   d01, now() - interval '1 hour'),
    (uid, 'movimentacao','Carlos Betim movido para Qualificados no pipeline',            l_carlos,   d04, now() - interval '2 hours'),
    (uid, 'importacao',  '12 novos leads importados — Campanha Clínicas SP',             NULL,      NULL, now() - interval '3 hours'),
    (uid, 'reuniao',     'Reunião de discovery com Tiago Moreira — Moreira Advocacia',   l_tiago,   d08, now() - interval '1 day'),
    (uid, 'proposta',    'Proposta de R$ 48.000 enviada para Helena Duarte',             l_helena,   d01, now() - interval '2 days'),
    (uid, 'email',       'E-mail de aquecimento enviado para Júlia Sampaio',             l_julia,    d05, now() - interval '2 days'),
    (uid, 'ligacao',     'Ligação com Eduardo Lima — expressou interesse em demo',       l_eduardo,  d09, now() - interval '3 days'),
    (uid, 'nota',        'Nota interna: Bruno Ferreira prefere demo técnica detalhada',  l_bruno,    d06, now() - interval '4 days'),
    (uid, 'movimentacao','Projeto Alves Construtora avançou para Proposta',             l_pedro,    d07, now() - interval '5 days');

  RAISE NOTICE '✅ Seed concluído com sucesso para o usuário: %', uid;
END;
$$;
