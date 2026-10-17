import "server-only";

/**
 * Prospecção via Google Places API (New) — oficial, não é scraping.
 * Busca empresas por texto livre (ex.: "dentista em São Paulo") e devolve
 * nome, endereço, telefone, site. Precisa de GOOGLE_MAPS_API_KEY no .env
 * (console.cloud.google.com > APIs & Services > ative "Places API (New)").
 */

export type EmpresaEncontrada = {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  site: string | null;
  avaliacao: number | null;
  totalAvaliacoes: number | null;
};

type RespostaPlaces = {
  places?: {
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    rating?: number;
    userRatingCount?: number;
  }[];
};

export async function buscarEmpresas(consulta: string, regiao?: string): Promise<{ ok: true; empresas: EmpresaEncontrada[] } | { ok: false; erro: string }> {
  const chave = process.env.GOOGLE_MAPS_API_KEY;
  if (!chave) return { ok: false, erro: "GOOGLE_MAPS_API_KEY não configurada. Peça pro administrador configurar no .env." };

  const textQuery = regiao ? `${consulta} em ${regiao}` : consulta;
  try {
    const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": chave,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({ textQuery, languageCode: "pt-BR", maxResultCount: 20 }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      if (resp.status === 403) return { ok: false, erro: "Chave do Google Maps recusada (403). Confira se a 'Places API (New)' está ativada e a chave é válida." };
      return { ok: false, erro: `Google Places respondeu ${resp.status}: ${texto.slice(0, 200)}` };
    }

    const dados = (await resp.json()) as RespostaPlaces;
    const empresas: EmpresaEncontrada[] = (dados.places ?? []).map((p) => ({
      id: p.id,
      nome: p.displayName?.text ?? "Sem nome",
      endereco: p.formattedAddress ?? null,
      telefone: p.internationalPhoneNumber ?? null,
      site: p.websiteUri ?? null,
      avaliacao: p.rating ?? null,
      totalAvaliacoes: p.userRatingCount ?? null,
    }));
    return { ok: true, empresas };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    return { ok: false, erro: /abort/i.test(msg) ? "Tempo esgotado consultando o Google Maps." : msg };
  }
}
