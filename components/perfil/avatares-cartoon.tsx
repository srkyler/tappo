/* Avatares cartoon — formas simples (não são fotos nem precisam de upload). */

type IconeProps = { tamanho?: number };

const Raposa = ({ tamanho = 32 }: IconeProps) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#F59E0B" /><path d="M10 14 18 22 10 24Z" fill="#C2410C" /><path d="M38 14 30 22 38 24Z" fill="#C2410C" /><ellipse cx="24" cy="28" rx="13" ry="11" fill="#FDE68A" /><circle cx="18" cy="26" r="2.4" fill="#1C1917" /><circle cx="30" cy="26" r="2.4" fill="#1C1917" /><path d="M24 29 21 33 27 33Z" fill="#1C1917" /></svg>
);
const Gato = ({ tamanho = 32 }: IconeProps) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#8B5CF6" /><path d="M11 10 19 20 11 20Z" fill="#6D28D9" /><path d="M37 10 29 20 37 20Z" fill="#6D28D9" /><circle cx="24" cy="27" r="13" fill="#DDD6FE" /><circle cx="19" cy="26" r="2.2" fill="#1C1917" /><circle cx="29" cy="26" r="2.2" fill="#1C1917" /><path d="M24 29v2M18 32h4M26 32h4" stroke="#1C1917" strokeWidth="1.6" strokeLinecap="round" /></svg>
);
const Robo = ({ tamanho = 32 }: IconeProps) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#64748B" /><rect x="11" y="15" width="26" height="20" rx="6" fill="#CBD5E1" /><circle cx="19" cy="25" r="3" fill="#2563EB" /><circle cx="29" cy="25" r="3" fill="#2563EB" /><rect x="18" y="31" width="12" height="2.4" rx="1.2" fill="#1C1917" /><rect x="22" y="8" width="4" height="6" rx="2" fill="#CBD5E1" /></svg>
);
const Alien = ({ tamanho = 32 }: IconeProps) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#22C55E" /><ellipse cx="24" cy="26" rx="12" ry="14" fill="#BBF7D0" /><ellipse cx="18" cy="24" rx="3.2" ry="5" fill="#14532D" transform="rotate(-12 18 24)" /><ellipse cx="30" cy="24" rx="3.2" ry="5" fill="#14532D" transform="rotate(12 30 24)" /><path d="M20 33q4 3 8 0" stroke="#14532D" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
);
const Urso = ({ tamanho = 32 }: IconeProps) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#92400E" /><circle cx="12" cy="12" r="6" fill="#92400E" /><circle cx="36" cy="12" r="6" fill="#92400E" /><circle cx="24" cy="27" r="13" fill="#D6A05E" /><ellipse cx="24" cy="31" rx="5" ry="3.6" fill="#92400E" /><circle cx="18" cy="24" r="2" fill="#1C1917" /><circle cx="30" cy="24" r="2" fill="#1C1917" /></svg>
);
const Panda = ({ tamanho = 32 }: IconeProps) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#F5F5F4" /><circle cx="12" cy="12" r="6" fill="#1C1917" /><circle cx="36" cy="12" r="6" fill="#1C1917" /><circle cx="24" cy="27" r="13" fill="#FAFAF9" /><ellipse cx="17" cy="25" rx="4" ry="5" fill="#1C1917" /><ellipse cx="31" cy="25" rx="4" ry="5" fill="#1C1917" /><circle cx="17" cy="26" r="1.6" fill="#FAFAF9" /><circle cx="31" cy="26" r="1.6" fill="#FAFAF9" /><ellipse cx="24" cy="32" rx="2" ry="1.4" fill="#1C1917" /></svg>
);
const Coruja = ({ tamanho = 32 }: IconeProps) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#B45309" /><path d="M12 10 18 18 9 18Z" fill="#78350F" /><path d="M36 10 30 18 39 18Z" fill="#78350F" /><ellipse cx="24" cy="27" rx="14" ry="13" fill="#FDBA74" /><circle cx="18" cy="25" r="5.5" fill="#FFFBEB" /><circle cx="30" cy="25" r="5.5" fill="#FFFBEB" /><circle cx="18" cy="25" r="2.4" fill="#1C1917" /><circle cx="30" cy="25" r="2.4" fill="#1C1917" /><path d="M24 29 21 34 27 34Z" fill="#78350F" /></svg>
);
const Dragao = ({ tamanho = 32 }: IconeProps) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#16A34A" /><path d="M16 10 20 18 12 16Z" fill="#14532D" /><path d="M32 10 28 18 36 16Z" fill="#14532D" /><ellipse cx="24" cy="28" rx="13" ry="11" fill="#86EFAC" /><circle cx="18" cy="26" r="2.2" fill="#1C1917" /><circle cx="30" cy="26" r="2.2" fill="#1C1917" /><path d="M19 33q5 4 10 0" stroke="#14532D" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
);
const Fantasma = ({ tamanho = 32 }: IconeProps) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#E5E7EB" /><path d="M14 30V20a10 10 0 0 1 20 0v10l-3-3-3 3-4-3-3 3-3-3-4 3Z" fill="#FFFFFF" /><circle cx="19" cy="21" r="2" fill="#1C1917" /><circle cx="29" cy="21" r="2" fill="#1C1917" /></svg>
);
const Estrela = ({ tamanho = 32 }: IconeProps) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#EAB308" /><path d="M24 8 29 20 42 20 32 28 36 41 24 33 12 41 16 28 6 20 19 20Z" fill="#FEF9C3" /><circle cx="20" cy="26" r="1.8" fill="#1C1917" /><circle cx="28" cy="26" r="1.8" fill="#1C1917" /></svg>
);

export const AVATARES_CARTOON = {
  raposa: { nome: "Raposa", Icone: Raposa },
  gato: { nome: "Gato", Icone: Gato },
  robo: { nome: "Robô", Icone: Robo },
  alien: { nome: "Alien", Icone: Alien },
  urso: { nome: "Urso", Icone: Urso },
  panda: { nome: "Panda", Icone: Panda },
  coruja: { nome: "Coruja", Icone: Coruja },
  dragao: { nome: "Dragão", Icone: Dragao },
  fantasma: { nome: "Fantasma", Icone: Fantasma },
  estrela: { nome: "Estrela", Icone: Estrela },
} as const;

export type AvatarIconeId = keyof typeof AVATARES_CARTOON;
export const ehAvatarIconeValido = (v: string | null | undefined): v is AvatarIconeId => !!v && v in AVATARES_CARTOON;
