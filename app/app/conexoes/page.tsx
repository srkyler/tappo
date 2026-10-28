import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { ConexoesView, type ConexaoWaTela, type MetaAdsTela } from "@/components/conexoes/conexoes-view";
import { bancoPronto, usuarioAtual } from "@/lib/data/queries";
import { wahaServidorPronto } from "@/lib/whatsapp/waha";

export const metadata = { title: "Conexões — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const { supabase } = await usuarioAtual();
  const [wa, tg, em, meta] = await Promise.all([
    supabase.from("wa_conexoes").select("id, apelido, sessao, status, numero, ia_ativa, ia_instrucoes, distribuicao").order("criado_at", { ascending: false }),
    supabase.from("telegram_conexoes").select("status, bot_username").maybeSingle(),
    supabase.from("email_conexoes").select("endereco_envia").maybeSingle(),
    supabase.from("integracao").select("id, ativo, configuracao, ultimo_sync").eq("tipo", "meta_ads").maybeSingle(),
  ]);

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
