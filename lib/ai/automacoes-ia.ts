import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agenteDoAtendente } from "./atendentes";
import { gerarRespostaIA, historicoDaConversa, paraConversaIA } from "./atendimento";
import { dentroDoHorario, perfilDaEmpresa } from "./assistente";
import { rodarAgente } from "./motor";
import { registrarErro } from "@/lib/erros";
import { enviarERegistrar } from "@/lib/whatsapp/atendimento";
import type { Conexao } from "@/lib/whatsapp/waha";

/*
 * Automações da IA de atendimento, rodadas pela fila/agendador:
 *  - resumo na transferência (2.4): o humano abre a conversa e lê o essencial no topo;
 *  - follow-up (2.5): cliente calado há N dias recebe UMA mensagem personalizada;
 *  - FAQs sugeridas (2.6): pergunta que a IA não soube e um humano respondeu vira
 *    sugestão em Conhecimento › Sugestões, para o gestor aprovar.
 */

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resumo de 3–5 linhas da conversa para quem vai assumir. */
export async function resumirConversa(db: SupabaseClient, orgId: string, conversaId: string, motivo: string | null) {
  const agente = await agenteDoAtendente(db, null);
  if (!agente) return;
  const historico = await historicoDaConversa(db, conversaId, 30);
  if (!historico.length) return;
  const transcricao = historico.map((m) => `${m.role === "user" ? "Cliente" : "Atendimento"}: ${m.content}`).join("\n").slice(-12000);
  let texto = "";
  await rodarAgente({
    agente: { ...agente, max_tokens: Math.min(agente.max_tokens, 600) },
    sb: null,
    mensagens: [{ role: "user", content: `Conversa de atendimento:\n\n${transcricao}\n\n${motivo ? `Motivo da transferência: ${motivo}\n\n` : ""}Escreva o resumo.` }],
    sistema: {
      estavel: "Você resume conversas de atendimento para o atendente humano que vai assumir. Em português, no máximo 5 linhas curtas, sem markdown: 1) quem é o cliente (o que se sabe); 2) o que ele quer; 3) o que já foi respondido ou combinado; 4) próximo passo sugerido. Só fatos da conversa — não invente.",
      volatil: "",
    },
    ferramentas: { definicoes: [], rotulos: {}, executar: async () => "" },
    emitir: (e) => { if (e.t === "texto") texto += e.d; },
    sinal: AbortSignal.timeout(60_000),
  });
  if (!texto.trim()) return;
  await db.from("wa_conversas").update({ resumo_ia: texto.trim().slice(0, 2000), resumo_em: new Date().toISOString() })
    .eq("id", conversaId).eq("org_id", orgId);
}

const MARCA_SEM_FOLLOWUP = "[SEM_FOLLOWUP]";
const MAX_FOLLOWUPS_POR_RODADA = 15;

/** Follow-up no WhatsApp para quem parou de responder (só empresas que ligaram em /app/assistente). */
export async function rodarFollowups(db: SupabaseClient) {
  const { data: perfis, error } = await db.from("ia_perfil").select("org_id").eq("followup_ativo", true);
  if (error) throw error;
  const resumo = { empresas: perfis?.length ?? 0, enviados: 0, encerrados: 0, fora_do_horario: 0 };

  for (const { org_id: orgId } of perfis ?? []) {
    const perfil = await perfilDaEmpresa(db, orgId);
    if (dentroDoHorario(perfil.horario) === false) { resumo.fora_do_horario++; continue; } // ninguém gosta de lembrete às 23h
    const corte = new Date(Date.now() - perfil.followup_dias * 86_400_000).toISOString();
    const { data: conversas } = await db.from("wa_conversas").select("*")
      .eq("org_id", orgId).eq("canal", "whatsapp").neq("status", "resolvida").eq("ia_ativa", true)
      .lt("followups", perfil.followup_max).lt("ultima_em", corte)
      .or(`ultimo_followup_em.is.null,ultimo_followup_em.lt.${corte}`)
      .order("ultima_em", { ascending: false }).limit(MAX_FOLLOWUPS_POR_RODADA);

    for (const conversa of conversas ?? []) {
      try {
        // Só quando a última palavra foi nossa: se o cliente falou por último, é fila de atendimento, não follow-up
        const { data: ultima } = await db.from("wa_mensagens").select("direcao").eq("conversa_id", conversa.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (ultima?.direcao !== "saida") continue;

        const { data: conexoes } = await db.from("wa_conexoes").select("*").eq("org_id", orgId);
        const c = (conexoes?.find((x) => x.id === conversa.conexao_id && x.status === "WORKING")
          ?? conexoes?.find((x) => x.status === "WORKING")) as Conexao | undefined;
        if (!c?.ia_ativa) continue;

        const dias = Math.round((Date.now() - new Date(conversa.ultima_em).getTime()) / 86_400_000);
        const mensagens = [
          ...(await historicoDaConversa(db, conversa.id, 20)),
          {
            role: "user" as const,
            content: `[Mensagem automática do sistema — o cliente NÃO escreveu isto] O cliente não responde há ${dias} dia(s). Escreva UMA mensagem curta e natural retomando o assunto, com base no histórico e no que você lembra dele. Sem pressão e sem repetir a última mensagem. Se não fizer sentido retomar (assunto encerrado, compra feita, cliente pediu para não ser contatado), responda exatamente ${MARCA_SEM_FOLLOWUP}.`,
          },
        ];
        const r = await gerarRespostaIA(db, {
          orgId, conversa: paraConversaIA(conversa, "whatsapp"), canal: "whatsapp", instrucoesCanal: c.ia_instrucoes,
          mensagens, atendenteCanalId: c.atendente_id,
        });
        const texto = r?.texto.trim() ?? "";
        if (!texto || texto.includes(MARCA_SEM_FOLLOWUP)) {
          await db.from("wa_conversas").update({ followups: perfil.followup_max }).eq("id", conversa.id);
          resumo.encerrados++;
          continue;
        }
        await enviarERegistrar(db, c, conversa, texto, "ia");
        await db.from("wa_conversas").update({ followups: conversa.followups + 1, ultimo_followup_em: new Date().toISOString() }).eq("id", conversa.id);
        resumo.enviados++;
        await espera(3000 + Math.random() * 4000); // anti-banimento: nada de rajada
      } catch (e) {
        await registrarErro("ia:followup", e, { orgId, detalhe: { conversa: conversa.id } });
      }
    }
  }
  return resumo;
}

const chaveDaPergunta = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);

/** Perguntas sem resposta na base que um humano respondeu → FAQ sugerida (status "sugerido"). */
export async function sugerirFaqs(db: SupabaseClient) {
  const desde = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: execucoes, error } = await db.from("ia_execucoes")
    .select("org_id, conversa_id, pergunta, created_at, conhecimento_ids, transferiu")
    .eq("teste", false).eq("transferiu", true).not("conversa_id", "is", null).gte("created_at", desde)
    .order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  let sugeridas = 0;
  for (const ex of execucoes ?? []) {
    if ((ex.conhecimento_ids ?? []).length || !ex.pergunta) continue;
    const pergunta = ex.pergunta.split("\n").filter(Boolean).pop()!.trim().slice(0, 300);
    const chave = chaveDaPergunta(pergunta);
    if (chave.length < 8) continue;
    const { data: ja } = await db.from("ia_conhecimento").select("id").eq("org_id", ex.org_id).eq("pergunta_origem", chave).limit(1);
    if (ja?.length) continue;
    // A primeira resposta de um HUMANO depois da transferência
    const { data: resposta } = await db.from("wa_mensagens").select("corpo").eq("conversa_id", ex.conversa_id)
      .eq("direcao", "saida").eq("autor", "humano").gt("created_at", ex.created_at)
      .order("created_at").limit(1).maybeSingle();
    const conteudo = resposta?.corpo?.trim();
    if (!conteudo || conteudo.length < 10) continue;
    const { error: e2 } = await db.from("ia_conhecimento").insert({
      org_id: ex.org_id, tipo: "faq", titulo: pergunta, conteudo: conteudo.slice(0, 4000),
      status: "sugerido", origem: "conversa", pergunta_origem: chave, created_by: null,
    });
    if (!e2) sugeridas++;
  }
  return { analisadas: execucoes?.length ?? 0, sugeridas };
}
