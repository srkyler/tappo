import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/*
 * Rate limiting em memória (instância única — padrão do Tappo, sem Redis).
 * Inspirado no DeskcommCRM: identificador SEMPRE hasheado (nada de IP/e-mail
 * em texto claro nos baldes) e janela fixa com varredura periódica.
 *
 * Uso: bloqueia força-bruta de login, spam de "recuperar senha" e cadastro.
 */

type Balde = { janela: number; cont: number };
const baldes = new Map<string, Balde>();
let ultimaVarredura = 0;

/** Chave opaca: sha256 do identificador, 32 hex (nunca guarda dado bruto). */
function opaco(valor: string): string {
  return createHash("sha256").update(valor.trim().toLowerCase()).digest("hex").slice(0, 32);
}

function varrer(agora: number) {
  if (agora - ultimaVarredura < 60_000) return; // no máx. 1x por minuto
  ultimaVarredura = agora;
  for (const [k, b] of baldes) if (b.janela <= agora) baldes.delete(k);
}

/**
 * Incrementa e decide. `max` por `janelaSeg`. Retorna true se BLOQUEADO.
 * Compara tamanhos antes do timingSafeEqual (regra do repo).
 */
export function limitar(chave: { acao: string; ip?: string | null; id?: string | null }, max: number, janelaSeg: number): boolean {
  const agora = Date.now();
  varrer(agora);

  const blocos: string[] = [];
  if (chave.ip) blocos.push(`ip:${opaco(chave.ip)}`);
  if (chave.id) blocos.push(`id:${opaco(chave.id)}`);
  if (!blocos.length) return false; // sem identificação: nunca cria balde global (evita DoS de custo zero)

  for (const b of blocos) {
    const k = `${chave.acao}:${b}`;
    const atual = baldes.get(k);
    if (!atual || atual.janela <= agora) {
      baldes.set(k, { janela: agora + janelaSeg * 1000, cont: 1 });
      continue;
    }
    atual.cont += 1;
    if (atual.cont > max) return true; // bloqueado
  }
  return false;
}

/** Mensagem padronizada para as telas. */
export const MSG_RATE = "Muitas tentativas. Aguarde um minuto e tente novamente.";

/** Compara assinaturas em tempo constante (HMAC etc.). */
export function iguaisTempoConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try { return timingSafeEqual(ba, bb); } catch { return false; }
}
