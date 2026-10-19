"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CalendarClock, Mail, Phone, Sparkles } from "lucide-react";
import { adiarLead, marcarContato } from "@/app/actions";

export function AcoesLead({ id, nome }: { id: string; nome: string }) {
  const [pendente, iniciar] = useTransition();
  const pergunta = `Me ajude a retomar o contato com ${nome}: veja a ficha e o histórico e escreva uma mensagem curta.`;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      <button disabled={pendente} onClick={() => iniciar(async () => { await marcarContato(id, "ligacao", nome); })} className="btn btn-fantasma btn-sm !h-8 !px-2.5" title="Registrar ligação (reagenda em 3 dias)"><Phone size={13} /><span className="hidden sm:inline">Liguei</span></button>
      <button disabled={pendente} onClick={() => iniciar(async () => { await marcarContato(id, "email", nome); })} className="btn btn-fantasma btn-sm !h-8 !px-2.5" title="Registrar e-mail (reagenda em 3 dias)"><Mail size={13} /><span className="hidden sm:inline">Enviei</span></button>
      <button disabled={pendente} onClick={() => iniciar(async () => { await adiarLead(id, 2); })} className="btn btn-fantasma btn-sm !h-8 !px-2.5" title="Adiar 2 dias"><CalendarClock size={13} /><span className="hidden sm:inline">+2d</span></button>
      <Link href={`/app/agente?q=${encodeURIComponent(pergunta)}`} className="btn btn-secundario btn-sm !h-8 !px-2.5" title="Pedir ajuda ao agente"><Sparkles size={13} /><span className="hidden sm:inline">IA</span></Link>
    </div>
  );
}
