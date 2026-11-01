import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { FormCaptacao } from "./form";

/*
 * Página pública de captação (/captar/<token>). Sem sessão: lê a fonte pela
 * service role, só pelo token e só se estiver ativa. O envio vai para
 * /api/v1/webhooks/in/<token> — o mesmo caminho de landing pages e Zapier
 * (rate limit, duplicados, automações e webhooks de saída num lugar só).
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Fale com a gente", robots: { index: false, follow: false } };

export default async function CaptarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32,80}$/.test(token)) notFound();
  const db = createAdminClient();
  const { data: fonte } = await db.from("lead_sources").select("nome, org_id, ativo").eq("token", token).maybeSingle();
  if (!fonte?.ativo) notFound();
  const { data: org } = await db.from("organizacoes").select("nome").eq("id", fonte.org_id).maybeSingle();

  return (
    <main className="min-h-screen bg-[#070707] px-4 py-12 text-gray-200">
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          {org?.nome && <p className="text-[12px] uppercase tracking-wide text-gray-500">{org.nome}</p>}
          <h1 className="mt-1 text-[24px] font-semibold text-white">{fonte.nome}</h1>
          <p className="mt-1 text-[14px] text-gray-400">Preencha seus dados e entraremos em contato em breve.</p>
        </header>
        <FormCaptacao token={token} />
      </div>
    </main>
  );
}
