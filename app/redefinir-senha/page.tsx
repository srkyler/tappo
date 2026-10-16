import { AuthShell } from "@/components/auth/auth-ui";
import { FormRedefinir } from "@/components/auth/forms";

export const metadata = { title: "Nova senha — Tappo" };

export default function RedefinirSenhaPage() {
  return (
    <AuthShell rotulo="Nova senha">
      <FormRedefinir />
    </AuthShell>
  );
}
