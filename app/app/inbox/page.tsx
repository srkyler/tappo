import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { InboxView, type ConexaoTela, type ConexaoTelegramTela, type ConversaTela } from "@/components/inbox/inbox-view";
import type { EmailConexaoTela } from "@/components/inbox/conexao-email";
import { bancoPronto, usuarioAtual } from "@/lib/data/queries";
import { urlWebhook } from "@/lib/whatsapp/waha";
import { membrosDaEmpresa } from "@/lib/data/empresa";
import { lerSlaConfig } from "@/lib/data/crm";

export const metadata = { title: "Inbox — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const { supabase, user } = await usuarioAtual();
  const [conexoes, conexaoTelegram, emailConexao, conversas, membros, slaConfig] = await Promise.all([
    supabase.from("wa_conexoes").select("id, base_url, sessao, token, status, numero, ia_ativa, ia_instrucoes, distribuicao, api_key_cifrada, apelido").order("criado_at", { ascending: false }),
    supabase.from("telegram_conexoes").select("status, bot_username, ia_ativa, ia_instrucoes, distribuicao, bot_token_cifrada").maybeSingle(),
    supabase.from("email_conexoes").select("endereco_recebe, endereco_envia, ia_ativa, ia_instrucoes, webhook_secret").maybeSingle(),
    supabase.from("wa_conversas")
      .select("id, chat_id, nome, telefone, lead_id, status, ia_ativa, nao_lidas, ultima_mensagem, ultima_em, atribuido_a, canal, leads(nome, empresa, cod)")
      .order("ultima_em", { ascending: false }).limit(300),
    membrosDaEmpresa(),
    lerSlaConfig(),
  ]);
  if (conversas.error) return <AvisoBanco />;

  const telas: ConexaoTela[] = (conexoes.data ?? []).map((c) => ({
    id: c.id,
    base_url: c.base_url, sessao: c.sessao, status: c.status, numero: c.numero,
    ia_ativa: c.ia_ativa, ia_instrucoes: c.ia_instrucoes, tem_chave: !!c.api_key_cifrada, webhook: urlWebhook(c.token),
    distribuicao: c.distribuicao, apelido: c.apelido,
  }));

  const t = conexaoTelegram.data;
  const telaTelegram: ConexaoTelegramTela | null = t ? {
    status: t.status, username: t.bot_username, ia_ativa: t.ia_ativa, ia_instrucoes: t.ia_instrucoes, tem_token: !!t.bot_token_cifrada, distribuicao: t.distribuicao,
  } : null;

  const ec = emailConexao.data;
  const telaEmail: EmailConexaoTela | null = ec ? {
    endereco_recebe: ec.endereco_recebe, endereco_envia: ec.endereco_envia,
    ia_ativa: ec.ia_ativa, ia_instrucoes: ec.ia_instrucoes,
    webhook: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/v1/email/inbound/${ec.webhook_secret}`,
  } : null;

  return (
    <InboxView
      userId={user!.id}
      conexoes={telas}
      conexaoTelegram={telaTelegram}
      emailConexao={telaEmail}
      conversasIniciais={(conversas.data ?? []) as unknown as ConversaTela[]}
      membros={membros}
      slaConfig={slaConfig ? { tempo_resposta_min: slaConfig.tempo_resposta_min, ativo: slaConfig.ativo } : null}
    />
  );
}

export default function InboxPage() {
  return (
    <Pagina>
      <Cabecalho rotulo="Atendimento" titulo="Inbox" descricao="Conversas do WhatsApp em tempo real. A IA responde sozinha e passa para você quando precisa." />
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
