/*
 * Telas do app que o dono/gestor pode esconder por papel (Empresa e equipe ›
 * Permissões). Módulo neutro (sem "use client"/"server-only"): usado pelo
 * menu, pela tela de configuração e pela validação no servidor.
 */

export const TELAS_CONFIGURAVEIS: { href: string; label: string; grupo: string }[] = [
  { href: "/app/agente", label: "Agente IA", grupo: "Geral" },
  { href: "/app/jarvis", label: "Jarvis", grupo: "Geral" },
  { href: "/app/inbox", label: "Inbox", grupo: "Geral" },
  { href: "/app/conexoes", label: "Conexões", grupo: "Geral" },
  { href: "/app/radar", label: "Radar", grupo: "Geral" },
  { href: "/app/leads", label: "Leads", grupo: "Vendas" },
  { href: "/app/prospeccao", label: "Prospecção", grupo: "Vendas" },
  { href: "/app/pipeline", label: "Pipeline", grupo: "Vendas" },
  { href: "/app/campanhas", label: "Campanhas", grupo: "Vendas" },
  { href: "/app/propostas", label: "Propostas", grupo: "Vendas" },
  { href: "/app/tags", label: "Tags", grupo: "Vendas" },
  { href: "/app/duplicados", label: "Duplicados", grupo: "Vendas" },
  { href: "/app/assistente", label: "Assistente IA", grupo: "Atendimento" },
  { href: "/app/respostas", label: "Respostas rápidas", grupo: "Atendimento" },
  { href: "/app/automacoes", label: "Automações", grupo: "Atendimento" },
  { href: "/app/chatbot-qualificacao", label: "Chatbot Qualificação", grupo: "Atendimento" },
  { href: "/app/sla", label: "SLA atendimento", grupo: "Atendimento" },
  { href: "/app/atendimento-atendente", label: "Atendimento por Atendente", grupo: "Atendimento" },
  { href: "/app/captacao", label: "Captação", grupo: "Atendimento" },
  { href: "/app/webhooks", label: "Webhooks", grupo: "Atendimento" },
  { href: "/app/marketing", label: "Calendário de Marketing", grupo: "Marketing" },
  { href: "/app/analytics", label: "Analytics", grupo: "Marketing" },
  { href: "/app/tarefas", label: "Tarefas", grupo: "Rotina" },
  { href: "/app/calendario", label: "Calendário", grupo: "Rotina" },
  { href: "/app/gestor", label: "Painel do gestor", grupo: "Gestão" },
  { href: "/app/executivo", label: "Dashboard executivo", grupo: "Gestão" },
  { href: "/app/comissoes", label: "Comissões", grupo: "Gestão" },
  { href: "/app/contas", label: "Contas", grupo: "Cadastros" },
  { href: "/app/pessoas", label: "Pessoas", grupo: "Cadastros" },
  { href: "/app/campos-personalizados", label: "Campos personalizados", grupo: "Cadastros" },
  { href: "/app/empresa", label: "Empresa e equipe", grupo: "Cadastros" },
];

export const PAPEIS_CONFIGURAVEIS = ["gestor", "vendedor", "atendente"] as const;
export type PapelConfiguravel = (typeof PAPEIS_CONFIGURAVEIS)[number];

export const telaConfiguravel = (href: string) => TELAS_CONFIGURAVEIS.some((t) => t.href === href);

/** A tela `path` está dentro de algum módulo bloqueado? (/app/leads bloqueia /app/leads/123) */
export const bloqueada = (path: string, ocultas: readonly string[]) => ocultas.some((m) => path === m || path.startsWith(`${m}/`));
