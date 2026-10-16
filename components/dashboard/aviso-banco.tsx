import { Database } from "lucide-react";

/** Mostrado quando as tabelas do Supabase ainda não existem. */
export function AvisoBanco() {
  return (
    <div className="painel mb-8 flex gap-4 border-white/30 p-5">
      <Database size={20} className="mt-0.5 shrink-0 text-white" />
      <div className="text-[13.5px] leading-relaxed text-gray-300">
        <p className="font-medium text-white">Banco de dados ainda não configurado</p>
        <p className="mt-1">
          Abra o Supabase → <strong className="text-white">SQL Editor</strong>, cole o conteúdo de{" "}
          <code className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[12px] text-white">supabase/setup_completo.sql</code>{" "}
          e clique em <strong className="text-white">Run</strong>. Depois recarregue esta página.
        </p>
      </div>
    </div>
  );
}
