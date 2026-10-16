import { Suspense } from "react";
import { headers } from "next/headers";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { CaptacaoView, type Fonte, type LogWebhook } from "@/components/captacao/captacao-view";
import { bancoPronto, usuarioAtual } from "@/lib/data/queries";

export const metadata = { title: "Captação — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const { supabase } = await usuarioAtual();
  const [{ data: fontes, error }, { data: logs }] = await Promise.all([
    supabase.from("lead_sources").select("id, nome, token, origem, status_inicial, ativo, recebidos, ultimo_em").order("created_at", { ascending: false }),
    supabase.from("webhook_log").select("id, source_id, ok, resultado, created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  if (error) return <AvisoBanco />;
  const h = await headers();
  const origem = process.env.NEXT_PUBLIC_APP_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return <CaptacaoView fontes={(fontes ?? []) as Fonte[]} logs={(logs ?? []) as LogWebhook[]} origem={origem.replace(/\/$/, "")} />;
}

export default function CaptacaoPage() {
  return (
    <Pagina>
      <Cabecalho rotulo="Automação" titulo="Captação" descricao="URLs que recebem leads de landing pages, formulários, Zapier, Make e n8n e já colocam na sua base com contato agendado para hoje." />
      <Suspense fallback={<div className="esqueleto h-80" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
