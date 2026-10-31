import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarEmail } from "@/lib/email/resend";
import { ehGestor } from "@/lib/segmentos";

/*
 * Alertas de SLA (agendador, a cada 5 min): conversa com cliente esperando além do
 * tempo de resposta da empresa → e-mail para o responsável (ou para os gestores, se
 * ninguém assumiu). Um aviso por espera: sla_alertado_em >= aguardando_desde = já avisado.
 * O sino mostra as mesmas conversas em tempo real (app/app/notificacoes/actions.ts).
 */

const MAX_POR_RODADA = 40;

export async function alertasSla(db: SupabaseClient) {
  const { data: configs, error } = await db.from("sla_config").select("org_id, tempo_resposta_min, alertar_email").eq("ativo", true);
  if (error) throw error;
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const resumo = { empresas: configs?.length ?? 0, estouradas: 0, avisos: 0 };

  for (const cfg of configs ?? []) {
    const corte = new Date(Date.now() - cfg.tempo_resposta_min * 60_000).toISOString();
    const { data: conversas } = await db.from("wa_conversas")
      .select("id, nome, telefone, canal, atribuido_a, aguardando_desde, sla_alertado_em, ultima_mensagem")
      .eq("org_id", cfg.org_id).neq("status", "resolvida").eq("ia_ativa", false)
      .not("aguardando_desde", "is", null).lt("aguardando_desde", corte)
      .order("aguardando_desde").limit(MAX_POR_RODADA);
    const pendentes = (conversas ?? []).filter((c) => !c.sla_alertado_em || c.sla_alertado_em < c.aguardando_desde!);
    resumo.estouradas += pendentes.length;
    if (!pendentes.length) continue;

    let gestores: string[] | null = null;
    for (const c of pendentes) {
      // Marca antes de enviar: se o e-mail falhar, não vira spam a cada 5 min
      const { data: marcada } = await db.from("wa_conversas").update({ sla_alertado_em: new Date().toISOString() })
        .eq("id", c.id).eq("aguardando_desde", c.aguardando_desde!).select("id");
      if (!marcada?.length || !cfg.alertar_email) continue;

      let destinos: string[];
      if (c.atribuido_a) destinos = [c.atribuido_a];
      else {
        if (!gestores) {
          const { data: ms } = await db.from("org_membros").select("user_id, papel").eq("org_id", cfg.org_id).eq("ativo", true);
          gestores = (ms ?? []).filter((m) => ehGestor(m.papel)).map((m) => m.user_id);
        }
        destinos = gestores;
      }
      if (!destinos.length) continue;
      const { data: perfis } = await db.from("profiles").select("id, email").in("id", destinos);
      const minutos = Math.round((Date.now() - Date.parse(c.aguardando_desde!)) / 60_000);
      const nome = c.nome || (c.telefone ? `+${c.telefone}` : "Cliente");
      for (const p of perfis ?? []) {
        if (!p.email) continue;
        const r = await enviarEmail("alerta_sla", p.email, {
          nome, userId: p.id, url: `${app}/app/inbox?c=${c.id}`,
          texto: `${nome} está esperando resposta há ${minutos} min (${c.canal}) — o combinado é ${cfg.tempo_resposta_min} min.${c.ultima_mensagem ? ` Última mensagem: "${c.ultima_mensagem.slice(0, 140)}"` : ""}`,
        });
        if (r.ok) resumo.avisos++;
      }
    }
  }
  return resumo;
}
