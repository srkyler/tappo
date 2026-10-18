import { AVATARES_CARTOON, ehAvatarIconeValido } from "./avatares-cartoon";

/** Prioridade: ícone cartoon escolhido > foto (upload/Google) > inicial do nome. */
export function AvatarUsuario({ nome, avatarUrl, avatarIcone, tamanho = 32 }: {
  nome: string;
  avatarUrl: string | null;
  avatarIcone: string | null;
  tamanho?: number;
}) {
  if (ehAvatarIconeValido(avatarIcone)) {
    const { Icone } = AVATARES_CARTOON[avatarIcone];
    return <span className="inline-flex shrink-0 overflow-hidden rounded-full" style={{ width: tamanho, height: tamanho }}><Icone tamanho={tamanho} /></span>;
  }
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" className="shrink-0 rounded-full object-cover" style={{ width: tamanho, height: tamanho }} referrerPolicy="no-referrer" />;
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-white font-semibold text-black"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.42 }}
    >
      {nome[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
