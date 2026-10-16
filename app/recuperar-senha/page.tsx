import { AuthShell, LinkRodape } from "@/components/auth/auth-ui";
import { FormRecuperar } from "@/components/auth/forms";

export const metadata = { title: "Recuperar senha — Tappo" };

export default function RecuperarSenhaPage() {
  return (
    <AuthShell rotulo="Recuperar senha" rodape={<LinkRodape pergunta="Lembrou a senha?" href="/login" texto="Voltar ao login" />}>
      <FormRecuperar />
    </AuthShell>
  );
}
