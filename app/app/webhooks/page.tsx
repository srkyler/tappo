import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { WebhooksView, type EnvioWebhookTela, type WebhookSaidaTela } from "@/components/webhooks/webhooks-view";
import { bancoPronto, usuarioAtual } from "@/lib/data/queries";
import { empresaAtual } from "@/lib/data/empresa";
import { ehGestor } from "@/lib/segmentos";
import { EVENTOS_SAIDA } from "@/lib/webhooks/saida";

export const metadata = { title: "Webhooks — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const { supabase } = await usuarioAtual();
  const empresa = await empresaAtual();
  const gestor = !!empresa && ehGestor(empresa.papel);

  const [wh, logs] = await Promise.all([
    supabase
      .from("webhook_saida")
      .select("id, url, eventos, ativo, secret, criado_em")
      .order("criado_em", { ascending: false }),
    supabase
      .from("webhook_saida_log")
      .select("id, webhook_id, evento, status, erro, enviado_em")
      .order("enviado_em", { ascending: false })
      .limit(30),
  ]);

  // O segredo só viaja para o cliente quando quem olha é gestor.
  const webhooks: WebhookSaidaTela[] = (wh.data ?? []).map((w) => ({
    id: w.id,
    url: w.url,
    eventos: w.eventos ?? [],
    ativo: w.ativo,
    secret: gestor ? w.secret : null,
    criado_em: w.criado_em,
  }));

  const logsPorWebhook = new Map<string, EnvioWebhookTela[]>();
  for (const l of logs.data ?? []) {
    const item: EnvioWebhookTela = { id: l.id, webhook_id: l.webhook_id, evento: l.evento, status: l.status, erro: l.erro, enviado_em: l.enviado_em };
    logsPorWebhook.set(l.webhook_id, [...(logsPorWebhook.get(l.webhook_id) ?? []), item]);
  }

  return (
    <WebhooksView
      webhooks={webhooks}
      logsPorWebhook={logsPorWebhook}
      gestor={gestor}
      eventos={EVENTOS_SAIDA.map((e) => ({ id: e.id, rotulo: e.rotulo, dica: e.dica }))}
    />
  );
}

export default function WebhooksPage() {
  return (
    <Pagina>
      <Cabecalho
        rotulo="Integrações"
        titulo="Webhooks de saída"
        descricao="O Tappo avisa a sua empresa: quando um lead entra ou muda de etapa, enviamos um POST assinado (HMAC-SHA256) para a URL que você configurar."
      />
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
