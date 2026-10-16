/* ============================================================
   Tappo — Componentes Reutilizáveis do Mundo Fichário
   Importar: import { Carimbo, Placa, FichaCard, GavetaHeader } from "@/components/tappo"
   ============================================================ */

import type { ReactNode } from "react";

/* ── Tipos ── */
export type StatusTipo = "nova" | "contatado" | "qualificado" | "reuniao" | "followup" | "perdido" | "ativa" | "rascunho";

/* ──────────────────────────────────────────────
   CARIMBO — estado de uma ficha ou item
   ────────────────────────────────────────────── */
const CARIMBO_CORES: Record<StatusTipo, { border: string; text: string; rotate: string }> = {
  nova:        { border: "#D4D4D4", text: "#D4D4D4", rotate: "-3deg"  },
  contatado:   { border: "#0A0A0A", text: "#0A0A0A", rotate: "4deg"   },
  qualificado: { border: "#D4D4D4", text: "#D4D4D4", rotate: "-2deg"  },
  reuniao:     { border: "#FAFAFA", text: "#FAFAFA", rotate: "-5deg"  },
  followup:    { border: "#0A0A0A", text: "#0A0A0A", rotate: "3deg"   },
  perdido:     { border: "rgba(250,250,250,0.3)", text: "rgba(250,250,250,0.4)", rotate: "0deg" },
  ativa:       { border: "#D4D4D4", text: "#D4D4D4", rotate: "-2deg"  },
  rascunho:    { border: "#FAFAFA", text: "#FAFAFA", rotate: "2deg"   },
};

const CARIMBO_LABELS: Record<StatusTipo, string> = {
  nova:        "NOVA",
  contatado:   "CONTATADO",
  qualificado: "QUALIFICADO",
  reuniao:     "REUNIÃO",
  followup:    "FOLLOW-UP",
  perdido:     "PERDIDO",
  ativa:       "ATIVA",
  rascunho:    "RASCUNHO",
};

export function Carimbo({
  status,
  label,
  className = "",
}: {
  status: StatusTipo;
  label?: string;
  className?: string;
}) {
  const cor = CARIMBO_CORES[status];
  return (
    <span
      className={`inline-block font-bold text-[9px] tracking-[0.14em] px-[7px] py-[3px] rounded-[3px] border-2 ${className}`}
      style={{
        borderColor: cor.border,
        color: cor.text,
        transform: `rotate(${cor.rotate})`,
        fontFamily: "Courier Prime, monospace",
      }}
    >
      {label ?? CARIMBO_LABELS[status]}
    </span>
  );
}

/* ──────────────────────────────────────────────
   PLACA — contador / stat card de latão
   ────────────────────────────────────────────── */
export function Placa({
  valor,
  label,
  delta,
  deltaPositivo = true,
}: {
  valor: string | number;
  label: string;
  delta?: string;
  deltaPositivo?: boolean;
}) {
  return (
    <div
      className="border border-[#555555] p-[10px_16px]"
      style={{ background: "linear-gradient(180deg, rgba(250,250,250,0.14), rgba(250,250,250,0.05))" }}
    >
      <span
        className="block text-[20px] font-bold text-[#FAFAFA]"
        style={{ fontFamily: "Courier Prime, monospace" }}
      >
        {valor}
      </span>
      <span
        className="text-[rgba(250,250,250,0.62)] uppercase tracking-[0.14em] text-[11px]"
        style={{ fontFamily: "Courier Prime, monospace" }}
      >
        {label}
      </span>
      {delta && (
        <span
          className={`block text-[10px] mt-1 ${deltaPositivo ? "text-[#D4D4D4]" : "text-[#FAFAFA]"}`}
          style={{ fontFamily: "Courier Prime, monospace" }}
        >
          {delta}
        </span>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   FICHA CARD — card de lead no estilo ficha pautada
   ────────────────────────────────────────────── */
export function FichaCard({
  nome,
  empresa,
  cargo,
  cod,
  status,
  children,
  className = "",
}: {
  nome: string;
  empresa?: string;
  cargo?: string;
  cod?: string;
  status?: StatusTipo;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative p-3 ${className}`}
      style={{
        background: "linear-gradient(180deg, #FAFAFA 0%, #EDEDED 100%)",
        border: "1px solid #D4D4D4",
        backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0 1px, transparent 1px 22px)",
        color: "#0A0A0A",
        fontFamily: "Courier Prime, monospace",
      }}
    >
      {/* Nome */}
      <div className="font-bold text-[12px] border-b border-[#D4D4D4] pb-[6px] mb-[6px] text-[#0A0A0A]">
        {nome}
      </div>

      {/* Cargo e empresa */}
      {cargo  && <div className="text-[10px] text-[#333333]">{cargo}</div>}
      {empresa && <div className="text-[10px] text-[#333333]">{empresa}</div>}

      {/* Código GAR */}
      {cod && (
        <div className="font-bold text-[#0A0A0A] tracking-[0.08em] text-[10px] mt-1">{cod}</div>
      )}

      {/* Conteúdo extra */}
      {children}

      {/* Carimbo de status */}
      {status && (
        <div className="absolute right-[10px] bottom-[8px]">
          <Carimbo status={status} />
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   GAVETA HEADER — cabeçalho de seção/módulo
   ────────────────────────────────────────────── */
export function GavetaHeader({
  rotulo,
  titulo,
  subtitulo,
  acao,
}: {
  rotulo: string;
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between pb-6 border-b border-[rgba(250,250,250,0.2)]">
      <div>
        <div
          className="text-[11px] tracking-[0.3em] text-[#FAFAFA] uppercase mb-2"
          style={{ fontFamily: "Courier Prime, monospace" }}
        >
          {rotulo}
        </div>
        <h1
          className="text-[28px] font-bold text-[#FAFAFA]"
          style={{ fontFamily: "Courier Prime, monospace" }}
        >
          {titulo}
        </h1>
        {subtitulo && (
          <p
            className="text-[rgba(250,250,250,0.5)] text-[13px] mt-1"
            style={{ fontFamily: "Literata, Georgia, serif" }}
          >
            {subtitulo}
          </p>
        )}
      </div>
      {acao && <div>{acao}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────
   SELO CTA — botão carimbado (wrapper de <button>/<a>)
   ────────────────────────────────────────────── */
export function SeloCTA({
  children,
  onClick,
  className = "",
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`selo-cta ${className} disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
