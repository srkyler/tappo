import "server-only";
import { registrarExecutor } from "./fila";
import { descreverImagem, midiaConfig, transcrever } from "@/lib/ai/midia";
import { responderComIA } from "@/lib/whatsapp/atendimento";
import { urlDaMidia, type Conexao } from "@/lib/whatsapp/waha";

/*
 * Tipos de job do Tappo. Importe este arquivo (e não só fila.ts) em quem processa
 * a fila, para os executores estarem registrados.
 */

const TETO_MIDIA = 20 * 1024 * 1024;

/*
 * midia_whatsapp: áudio → transcrição, imagem → descrição; grava em
 * wa_mensagens.transcricao e, se pedido, chama a IA. Sem transcrição/visão
 * configurada (ou se falhar de vez), a IA responde mesmo assim — o histórico
 * avisa que chegou um áudio/imagem que ela não consegue abrir, e ela pede texto.
 */
registrarExecutor("midia_whatsapp", async (db, job) => {
  const { mensagem_id, conexao_id, responder } = job.payload as { mensagem_id: string; conexao_id: string; responder?: boolean };
  const [{ data: msg }, { data: conexao }] = await Promise.all([
    db.from("wa_mensagens").select("id, org_id, conversa_id, tipo, midia_url, midia_mime, transcricao").eq("id", mensagem_id).maybeSingle(),
    db.from("wa_conexoes").select("*").eq("id", conexao_id).maybeSingle(),
  ]);
  if (!msg || !conexao || msg.org_id !== conexao.org_id) return; // apagada ou de outra empresa: nada a fazer
  const c = conexao as Conexao;

  const cfg = await midiaConfig(db);
  const ligado = msg.tipo === "audio" ? cfg?.transcricao_ativa : msg.tipo === "imagem" ? cfg?.visao_ativa : false;
  const ultima = job.tentativas >= job.max_tentativas;
  if (cfg && ligado && msg.midia_url && !msg.transcricao) {
    try {
      const alvo = urlDaMidia(c, msg.midia_url);
      if (!alvo) throw new Error("URL de mídia fora do WAHA");
      const res = await fetch(alvo.url, { headers: alvo.chave ? { "X-Api-Key": alvo.chave } : {}, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`WAHA devolveu ${res.status} ao baixar a mídia`);
      const bytes = await res.arrayBuffer();
      if (bytes.byteLength > TETO_MIDIA) throw new Error("Mídia grande demais para a IA");
      const mime = msg.midia_mime || res.headers.get("content-type") || "";
      const texto = msg.tipo === "audio" ? await transcrever(cfg, bytes, mime) : await descreverImagem(db, cfg, bytes, mime);
      if (texto) await db.from("wa_mensagens").update({ transcricao: texto.slice(0, 8000) }).eq("id", msg.id);
    } catch (e) {
      // Ainda há tentativas: a fila tenta de novo. Na última, segue sem transcrição (a IA pede texto).
      if (!ultima) throw e;
    }
  }
  if (responder) await responderComIA(db, c, msg.conversa_id, msg.id);
});
