import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/ui/base";

export const metadata = { title: "Convite — Tappo" };

// Rota bloqueante: lê cookies/auth e redireciona em tempo de requisição —
// não há shell estático a pré-renderizar (Next 16: instant = false).
export const instant = false;

/* Aceite de convite para uma equipe. Sem login, o proxy manda para /login?next=… */

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-black p-6">
      <div className="painel w-full max-w-sm space-y-4 p-6 text-center">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="text-[18px] font-semibold text-white">{titulo}</h1>
        <p className="text-[14px] text-gray-400">{texto}</p>
        <Link href="/app" className="btn btn-primario btn-sm">Ir para o app</Link>
      </div>
    </main>
  );
}

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32,80}$/.test(token)) return <Aviso titulo="Convite inválido" texto="Confira o link recebido." />;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/convite/${token}`);

  const admin = createAdminClient();
  const { data: conv } = await admin.from("org_convites").select("id, org_id, email, papel, aceito_em, expira_em, organizacoes(nome)").eq("token", token).maybeSingle();
  if (!conv) return <Aviso titulo="Convite não encontrado" texto="Ele pode ter sido cancelado. Peça um novo ao gestor." />;
  if (conv.aceito_em) redirect("/app");
  if (new Date(conv.expira_em) < new Date()) return <Aviso titulo="Convite expirado" texto="Peça um novo convite ao gestor da equipe." />;
  if (conv.email.toLowerCase() !== user.email?.toLowerCase()) {
    return <Aviso titulo="E-mail diferente" texto={`Este convite é para ${conv.email}. Entre com esse e-mail para aceitar.`} />;
  }

  await admin.from("org_membros").upsert({ org_id: conv.org_id, user_id: user.id, papel: conv.papel, ativo: true }, { onConflict: "org_id,user_id" });
  await admin.from("org_convites").update({ aceito_em: new Date().toISOString() }).eq("id", conv.id);
  await admin.from("profiles").update({ org_atual: conv.org_id }).eq("id", user.id);
  redirect("/app");
}
