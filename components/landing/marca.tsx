import { cn } from "@/components/ui/base";

/**
 * Marca Tappo — wordmark monocromático com três barras verticais
 * em altura crescente (h-4 / h-6 / h-8). Sem cor: só preto e branco.
 */
export function Marca({ compacta = false, className }: { compacta?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-texto", className)}>
      <span aria-hidden="true" className="flex items-end gap-[3px]">
        <span className={cn("w-[3px] rounded-[1px] bg-texto", compacta ? "h-3" : "h-4")} />
        <span className={cn("w-[3px] rounded-[1px] bg-texto", compacta ? "h-4.5" : "h-6")} />
        <span className={cn("w-[3px] rounded-[1px] bg-texto", compacta ? "h-6" : "h-8")} />
      </span>
      <span className={cn("font-bold tracking-[-0.02em]", compacta ? "text-[15px]" : "text-xl")}>
        tappo
      </span>
    </span>
  );
}
