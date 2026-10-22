import type { NextConfig } from "next";

/**
 * URLs planas usadas antes da reorganização do app (o app vive sob /app/*).
 * Mantemos redirecionamentos para links antigos não quebrarem.
 */
const LEGADOS = [
  "agente", "analytics", "assinatura-recorrente", "assinaturas", "atendimento-atendente",
  "automacoes", "boas-vindas-email", "cadencia", "calendario", "campanhas",
  "campos-personalizados", "captacao", "chatbot-qualificacao", "checklist-tarefa", "comissoes",
  "contas", "crm", "duplicados", "empresa", "enriquecimento", "executivo", "funil-editor",
  "gestor", "gravacao-chamada", "inbox", "integracao", "jarvis", "leads", "marketing",
  "notificacoes", "perfil", "permissoes", "pessoas", "pipeline", "previsao-ia",
  "proposta-aprovacao", "propostas", "prospeccao", "radar", "respostas", "sla", "tags",
  "tarefa-multi-lead", "tarefas", "tarefas-recorrentes", "templates-whatsapp", "whatsapp-config",
];

const nextConfig: NextConfig = {
  // Build enxuto para Docker (.next/standalone)
  output: "standalone",
  // Oculta o badge "N" do indicador de dev no canto da tela
  devIndicators: false,
  async redirects() {
    return [
      ...LEGADOS.map((r) => ({ source: `/${r}`, destination: `/app/${r}`, permanent: false })),
      ...LEGADOS.map((r) => ({ source: `/${r}/:path*`, destination: `/app/${r}/:path*`, permanent: false })),
    ];
  },
};

export default nextConfig;
