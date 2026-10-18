import { Loader2 } from "lucide-react";

export function AvisoBanco() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-800 bg-black/50 text-gray-500 mb-3">
        <Loader2 className="animate-spin h-5 w-5" />
      </div>
      <h3 className="text-lg font-medium text-white">Conectando ao banco de dados…</h3>
      <p className="mt-1 text-sm text-gray-500">Aguarde enquanto o Tappo se conecta ao Supabase.</p>
    </div>
  );
}
