import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { InboxView, type ConexaoTela, type ConversaTela } from "@/components/inbox/inbox-view";
import { bancoPronto, usuarioAtual } from "@/lib/data/queries";
import { urlWebhook } from "@/lib/whatsapp/waha";
import { membrosDaEmpresa } from "@/lib/data/empresa";

export const metadata = { title: "Inbox — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const { supabase, user } = await usuarioAtual();
  const [conexao, conversas, membros] = await Promise.all([
    supabase.from("wa_conexoes").select("base_url, sessao, token, status, numero, ia_ativa, ia_instrucoes, distribuicao, api_key_cifrada").maybeSingle(),
    supabase.from("wa_conversas")
      .select("id, chat_id, nome, telefone, lead_id, status, ia_ativa, nao_lidas, ultima_mensagem, ultima_em, atribuido_a, leads(nome, empresa, cod)")
      .order("ultima_em", { ascending: false }).limit(300),
    membrosDaEmpresa(),
  ]);
  if (conversas.error) return <AvisoBanco />;

  const c = conexao.data;
  const tela: ConexaoTela | null = c ? {
    base_url: c.base_url, sessao: c.sessao, status: c.status, numero: c.numero,
    ia_ativa: c.ia_ativa, ia_instrucoes: c.ia_instrucoes, tem_chave: !!c.api_key_cifrada, webhook: urlWebhook(c.token),
    distribuicao: c.distribuicao,
  } : null;

  return <InboxView userId={user!.id} conexao={tela} conversasIniciais={(conversas.data ?? []) as unknown as ConversaTela[]} membros={membros} />;
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
