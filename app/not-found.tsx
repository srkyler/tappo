import Link from "next/link";
import { Logo } from "@/components/ui/base";

export const metadata = { title: "Página não encontrada — Tappo" };

export default function NaoEncontrada() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center gap-6 bg-black px-6 text-center">
      <Link href="/"><Logo /></Link>
      <div className="flex flex-col items-center gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">Erro 404</p>
        <h1 className="max-w-[18ch] text-[clamp(1.6rem,4vw,2.4rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
          Essa página saiu do fichário.
        </h1>
        <p className="max-w-[42ch] text-[15px] leading-[1.6] text-gray-400">
          O endereço não existe ou mudou de lugar. Volte para o início e continue de onde parou.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/app" className="btn btn-primario">Ir para o Tappo</Link>
        <Link href="/" className="btn btn-secundario">Voltar ao site</Link>
      </div>
    </main>
  );
}
