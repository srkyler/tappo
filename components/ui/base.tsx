import { cn as cnUtil } from "@/lib/utils";

export function cn(...classes: (string | undefined | null | boolean)[]) {
  return cnUtil(...classes);
}

export function Cabecalho({ rotulo, titulo, descricao }: { rotulo: string; titulo: string; descricao?: string }) {
  return (
    <div className="mb-6">
      <span className="inline-flex items-center gap-1 rounded-full border border-gray-800 bg-black/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
        {rotulo}
      </span>
      <h1 className="mt-1 text-[20px] font-bold tracking-tight text-white">{titulo}</h1>
      {descricao && <p className="mt-1 text-[13px] text-gray-500">{descricao}</p>}
    </div>
  );
}

export function Pagina({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-black text-white">{children}</div>;
}

export function Painel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-gray-800 bg-black/40 p-1", className)}>
      {children}
    </div>
  );
}

export function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-800 bg-black/50 text-gray-500 mb-3">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-white">{titulo}</h3>
      <p className="mt-1 text-sm text-gray-500">{texto}</p>
    </div>
  );
}

export function Status({ label }: { label: string }) {
  return <span className="text-[11px] font-medium text-gray-400 uppercase">{label}</span>;
}

export function Rotulo({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label className="block text-[12px] font-medium text-gray-300 mb-1.5" htmlFor={htmlFor}>{children}</label>;
}

export function Barra({ valor, maximo = 100, cor = "white", className }: { valor: number; maximo?: number; cor?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, (valor / maximo) * 100));
  return (
    <div className={cn("h-2 rounded-full bg-gray-800 overflow-hidden", className)}>
      <div className={cn("h-full transition-all duration-300", `bg-${cor}-500`)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("font-bold text-[20px] tracking-[6px]", className)}>
      TA<span className="text-amber-500">PP</span>O
    </div>
  );
}

export function Kpi({ label, valor, variacao, icone }: { label: string; valor: string | number; variacao?: string; icone?: React.ReactNode }) {
  return (
    <div className="painel p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
        {icone && <span className="text-gray-500">{icone}</span>}
      </div>
      <p className="mt-2 text-[22px] font-bold text-white">{valor}</p>
      {variacao && <p className="mt-1 text-[11px] text-amber-400">{variacao}</p>}
    </div>
  );
}

export function btn({ variant = "primario", size = "md", children, className }: { variant?: "primario" | "secundario" | "fantasma"; size?: "sm" | "md"; children: React.ReactNode; className?: string }) {
  const base = "inline-flex items-center justify-center rounded-lg font-medium text-[13px] transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600 disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<string, string> = {
    primario: "bg-white text-black hover:bg-gray-200",
    secundario: "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700",
    fantasma: "text-gray-400 hover:text-white hover:bg-gray-800/30",
  };
  const sizes: Record<string, string> = {
    sm: "px-2.5 py-1.5 text-[11px]",
    md: "px-4 py-2",
  };
  return <button className={cn(base, variants[variant], sizes[size], className)}>{children}</button>;
}

export function campo({ className }: { className?: string }) {
  return <input className={cn("block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none", className)} />;
}

export function esqueleto({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-gray-900", className)} />;
}