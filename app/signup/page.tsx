import { AuthShell, BotaoGoogle, Divisor, LinkRodape } from "@/components/auth/auth-ui";
import { FormCadastro } from "@/components/auth/forms";

export const metadata = { title: "Criar conta — Tappo" };

export default function SignupPage() {
  return (
    <AuthShell
      rotulo="Criar conta"
      selo="Grátis"
      rodape={<LinkRodape pergunta="Já tem conta?" href="/login" texto="Entrar" />}
    >
      <BotaoGoogle />
      <Divisor />
      <FormCadastro />
    </AuthShell>
  );
}
