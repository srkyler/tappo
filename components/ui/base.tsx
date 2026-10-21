import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/* Tappo — primitivas visuais monocromáticas (server-safe) */

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Pagina({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10", className)}>{children}</div>;
}

export function Cabecalho({ rotulo, titulo, descricao, acoes }: {
  rotulo?: string;
  titulo: string;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-gray-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {rotulo && <p className="rotulo mb-2">{rotulo}</p>}
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[32px]">{titulo}</h1>
        {descricao && <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-gray-400">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}

export function Painel({ titulo, acao, children, className, corpo }: {
  titulo?: React.ReactNode;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  corpo?: string;
}) {
  return (
    <section className={cn("painel overflow-hidden", className)}>
      {titulo && (
        <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-5 py-3.5">
          <h2 className="text-[14px] font-medium text-white">{titulo}</h2>
          {acao}
        </div>
      )}
      <div className={corpo}>{children}</div>
    </section>
  );
}

export function Kpi({ rotulo, valor, detalhe }: { rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode }) {
  return (
    <div className="painel p-5">
      <p className="rotulo">{rotulo}</p>
      <p className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.03em] text-white tabular">{valor}</p>
      {detalhe && <p className="mt-2 text-[12px] text-gray-500">{detalhe}</p>}
    </div>
  );
}

const TOM_STATUS: Record<string, string> = {
  // preenchido = mais quente; contorno = neutro; tracejado = encerrado
  "Reunião": "bg-white text-black border-white",
  "Qualificado": "bg-gray-200 text-black border-gray-200",
  "Ganho": "bg-white text-black border-white",
  "Ativa": "bg-white text-black border-white",
  "Respondeu": "bg-gray-200 text-black border-gray-200",
  "Contatado": "text-white border-gray-500",
  "Follow-up": "text-white border-gray-500",
  "Nova": "text-gray-300 border-gray-700",
  "Rascunho": "text-gray-300 border-gray-700",
  "Ativo": "text-white border-gray-500",
  "Pausada": "text-gray-400 border-gray-700 border-dashed",
  "Concluída": "text-gray-400 border-gray-700",
  "Concluído": "text-gray-400 border-gray-700",
  "Perdido": "text-gray-500 border-gray-800 border-dashed line-through",
  "Removido": "text-gray-500 border-gray-800 border-dashed",
};

export function Status({ valor, className }: { valor: string; className?: string }) {
  return (
    <span className={cn(
      "inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em]",
      TOM_STATUS[valor] ?? "text-gray-300 border-gray-700",
      className,
    )}>
      {valor}
    </span>
  );
}

export function Vazio({ icone, titulo, texto, acao }: {
  icone?: React.ReactNode;
  titulo: string;
  texto?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icone && <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-gray-800 text-gray-400">{icone}</div>}
      <p className="text-[15px] font-medium text-white">{titulo}</p>
      {texto && <p className="mt-1.5 max-w-[42ch] text-[13px] leading-relaxed text-gray-500">{texto}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

export function Barra({ valor, max = 100, className }: { valor: number; max?: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((valor / max) * 100)) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-gray-800", className)}>
      <div className="h-full rounded-full bg-white transition-[width] duration-700 ease-[var(--ease-gaveta)]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Rotulo({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-medium text-gray-300">{children}</label>;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em] text-white", className)}>
      <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-md bg-white font-mono text-[13px] font-bold text-black">T</span>
      tappo
    </span>
  );
}
