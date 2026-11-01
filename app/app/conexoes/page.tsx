import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { ConexoesView, type ConexaoWaTela, type MetaAdsTela } from "@/components/conexoes/conexoes-view";
import { bancoPronto, usuarioAtual } from "@/lib/data/queries";
import { wahaServidorPronto } from "@/lib/whatsapp/waha";
import { urlWebhookCloud } from "@/lib/whatsapp/cloud";
import { CartaoWhatsOficial, type ConexaoCloudTela } from "@/components/conexoes/cartao-whatsapp-oficial";
import { empresaAtual } from "@/lib/data/empresa";
import { ehGestor } from "@/lib/segmentos";

export const metadata = { title: "Conexões — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const { supabase } = await usuarioAtual();
  const empresa = await empresaAtual();
  const gestor = ehGestor(empresa?.papel);
  // Com a migration do WhatsApp oficial pendente, as colunas novas não existem: cai no select antigo
  const colunas = "id, apelido, sessao, status, numero, ia_ativa, ia_instrucoes, distribuicao";
  const lerWa = async () => {
    const r = await supabase.from("wa_conexoes").select(`${colunas}, provedor, token, cloud_phone_number_id, cloud_waba_id, cloud_verify_token`).order("criado_at", { ascending: false });
    if (!r.error) return r.data ?? [];
    const v = await supabase.from("wa_conexoes").select(colunas).order("criado_at", { ascending: false });
    return (v.data ?? []).map((c) => ({ ...c, provedor: "waha", token: null, cloud_phone_number_id: null, cloud_waba_id: null, cloud_verify_token: null }));
  };
  const [waTodas, tg, em, meta] = await Promise.all([
    lerWa(),
    supabase.from("telegram_conexoes").select("status, bot_username").maybeSingle(),
    supabase.from("email_conexoes").select("endereco_envia").maybeSingle(),
    supabase.from("integracao").select("id, ativo, configuracao, ultimo_sync").eq("tipo", "meta_ads").maybeSingle(),
  ]);

  const wa = { data: waTodas.filter((c) => c.provedor !== "cloud") };
  const conexoesCloud: ConexaoCloudTela[] = waTodas.filter((c) => c.provedor === "cloud").map((c) => ({
    id: c.id, apelido: c.apelido, status: c.status, numero: c.numero, ia_ativa: c.ia_ativa, distribuicao: c.distribuicao,
    phone_number_id: c.cloud_phone_number_id, waba_id: c.cloud_waba_id,
    // Só quem configura vê o endereço e o token de verificação do webhook
    webhook: gestor && c.token ? urlWebhookCloud(c.token) : null,
    verify_token: gestor ? c.cloud_verify_token : null,
  }));
  const conexoesWa: ConexaoWaTela[] = (wa.data ?? []).map((c) => ({
    id: c.id, apelido: c.apelido, sessao: c.sessao, status: c.status, numero: c.numero,
    ia_ativa: c.ia_ativa, ia_instrucoes: c.ia_instrucoes ?? "", distribuicao: c.distribuicao,
  }));

  const cfg = (meta.data?.configuracao ?? {}) as { conta?: string; chave_cifrada?: string };
  const metaAds: MetaAdsTela | null = meta.data ? {
    ativo: meta.data.ativo,
    conta: cfg.conta ?? null,
    tem_chave: !!cfg.chave_cifrada,
    ultimo_sync: meta.data.ultimo_sync,
  } : null;

  return (
    <ConexoesView
      wahaPronto={wahaServidorPronto()}
      conexoesWa={conexoesWa}
      telegram={tg.data ? { status: tg.data.status, username: tg.data.bot_username } : null}
      email={em.data ? { endereco_envia: em.data.endereco_envia } : null}
      metaAds={metaAds}
      extra={<CartaoWhatsOficial conexoes={conexoesCloud} gestor={gestor} />}
    />
  );
}

export default function ConexoesPage() {
  return (
    <Pagina>
      <Cabecalho rotulo="Integrações" titulo="Conexões" descricao="Canais e plataformas da empresa em um lugar só: WhatsApp, Meta Ads, Telegram, e-mail e mais." />
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
