export type Tipo = "filme" | "serie" | "canal";

export type Conteudo = {
  id: string;
  titulo: string;
  tipo: Tipo;
  ano: number;
  classificacao: string;
  duracao: string;
  generos: string[];
  sinopse: string;
  nota: number;
  destaque?: boolean;
  aoVivo?: boolean;
  atual?: string;
  episodios?: { numero: number; titulo: string; duracao: string }[];
  videoUrl: string;
  cor: string;
};

const VIDEO_SAMPLE =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

export const catalogo: Conteudo[] = [
  {
    id: "neon-city",
    titulo: "Neon City",
    tipo: "filme",
    ano: 2025,
    classificacao: "16",
    duracao: "2h 12min",
    generos: ["Ficção científica", "Ação"],
    sinopse:
      "Em uma metrópole governada por corporações, uma hacker descobre uma conspiração que pode reescrever a realidade de todos os cidadãos.",
    nota: 8.7,
    destaque: true,
    videoUrl: VIDEO_SAMPLE,
    cor: "#7c3aed",
  },
  {
    id: "ultima-estacao",
    titulo: "Última Estação",
    tipo: "filme",
    ano: 2024,
    classificacao: "14",
    duracao: "1h 54min",
    generos: ["Suspense", "Drama"],
    sinopse:
      "Um trem intercontinental se torna a última esperança de sobrevivência quando um vírus desconhecido colapsa o país.",
    nota: 8.1,
    videoUrl: VIDEO_SAMPLE,
    cor: "#db2777",
  },
  {
    id: "o-codigo-9",
    titulo: "O Código 9",
    tipo: "filme",
    ano: 2025,
    classificacao: "16",
    duracao: "2h 03min",
    generos: ["Ação", "Espionagem"],
    sinopse:
      "Um agente aposentado é convocado de volta para impedir que um algoritmo militar caia nas mãos erradas.",
    nota: 7.9,
    videoUrl: VIDEO_SAMPLE,
    cor: "#2563eb",
  },
  {
    id: "maré-vermelha",
    titulo: "Maré Vermelha",
    tipo: "filme",
    ano: 2023,
    classificacao: "14",
    duracao: "1h 48min",
    generos: ["Aventura", "Fantasia"],
    sinopse:
      "Uma tripulação de pescadores desperta uma antiga maldição das profundezas e precisa navegar entre mundos para reverter o feito.",
    nota: 7.4,
    videoUrl: VIDEO_SAMPLE,
    cor: "#dc2626",
  },
  {
    id: "horizonte-proibido",
    titulo: "Horizonte Proibido",
    tipo: "filme",
    ano: 2024,
    classificacao: "10",
    duracao: "2h 21min",
    generos: ["Ficção científica", "Drama"],
    sinopse:
      "A primeira colônia humana em Marte esconde um segredo que pode separar a humanidade para sempre.",
    nota: 8.9,
    destaque: true,
    videoUrl: VIDEO_SAMPLE,
    cor: "#ea580c",
  },
  {
    id: "sombras-de-tokio",
    titulo: "Sombras de Tóquio",
    tipo: "filme",
    ano: 2025,
    classificacao: "18",
    duracao: "1h 59min",
    generos: ["Crime", "Thriller"],
    sinopse:
      "Um detetive investiga desaparecimentos ligados a um clube clandestino no submundo de Tóquio.",
    nota: 8.3,
    videoUrl: VIDEO_SAMPLE,
    cor: "#4f46e5",
  },
  {
    id: "aurora",
    titulo: "Aurora",
    tipo: "filme",
    ano: 2024,
    classificacao: "12",
    duracao: "1h 45min",
    generos: ["Drama", "Romance"],
    sinopse:
      "Dois estranhos cruzam caminhos em um observatório no Ártico durante a maior aurora boreal da história.",
    nota: 7.8,
    videoUrl: VIDEO_SAMPLE,
    cor: "#0891b2",
  },
  {
    id: "protocolo-zeta",
    titulo: "Protocolo Zeta",
    tipo: "filme",
    ano: 2025,
    classificacao: "16",
    duracao: "2h 08min",
    generos: ["Ação", "Ficção científica"],
    sinopse:
      "Uma força-tarefa internacional persegue um exército de drones renegados pela Europa Oriental.",
    nota: 7.6,
    videoUrl: VIDEO_SAMPLE,
    cor: "#059669",
  } as Conteudo,
  {
    id: "império-de-cinza",
    titulo: "Império de Cinza",
    tipo: "serie",
    ano: 2025,
    classificacao: "16",
    duracao: "2 temporadas",
    generos: ["Drama", "Político"],
    sinopse:
      "Famílias poderosas disputam o controle de uma nação enquanto um jornalista expõe a verdade que pode derrubar todas elas.",
    nota: 9.1,
    destaque: true,
    atual: "T2 · E4",
    episodios: [
      { numero: 1, titulo: "A sucessão", duracao: "52min" },
      { numero: 2, titulo: "Cartas marcadas", duracao: "48min" },
      { numero: 3, titulo: "O pacto", duracao: "55min" },
      { numero: 4, titulo: "Cinzas", duracao: "51min" },
    ],
    videoUrl: VIDEO_SAMPLE,
    cor: "#9333ea",
  },
  {
    id: "floresta-de-vidro",
    titulo: "Floresta de Vidro",
    tipo: "serie",
    ano: 2024,
    classificacao: "14",
    duracao: "1 temporada",
    generos: ["Mistério", "Sobrenatural"],
    sinopse:
      "Em uma cidade isolada na Amazônia, crianças começam a desaparecer e a floresta parece estar viva.",
    nota: 8.5,
    atual: "T1 · E7",
    episodios: [
      { numero: 1, titulo: "O desaparecimento", duracao: "44min" },
      { numero: 2, titulo: "Rios de vidro", duracao: "46min" },
      { numero: 3, titulo: "O chamado", duracao: "43min" },
    ],
    videoUrl: VIDEO_SAMPLE,
    cor: "#16a34a",
  },
  {
    id: "orbita-zero",
    titulo: "Órbita Zero",
    tipo: "serie",
    ano: 2025,
    classificacao: "12",
    duracao: "3 temporadas",
    generos: ["Ficção científica", "Aventura"],
    sinopse:
      "A tripulação da estação Ápice descobre que a Terra deixou de transmitir sinais há três meses.",
    nota: 8.8,
    atual: "T3 · E1",
    episodios: [
      { numero: 1, titulo: "Silêncio", duracao: "58min" },
      { numero: 2, titulo: "Deriva", duracao: "54min" },
    ],
    videoUrl: VIDEO_SAMPLE,
    cor: "#6366f1",
  },
  {
    id: "chefes-de-guerra",
    titulo: "Chefes de Guerra",
    tipo: "serie",
    ano: 2023,
    classificacao: "18",
    duracao: "2 temporadas",
    generos: ["Ação", "Crime"],
    sinopse:
      "A ascensão e queda de três cartéis rivais contada pelos próprios líderes.",
    nota: 8.2,
    atual: "T2 · E9",
    episodios: [
      { numero: 1, titulo: "Território", duracao: "49min" },
      { numero: 2, titulo: "Alianças", duracao: "47min" },
    ],
    videoUrl: VIDEO_SAMPLE,
    cor: "#b91c1c",
  },
  {
    id: "canal-tappo-noticias",
    titulo: "Tappo Notícias 24h",
    tipo: "canal",
    aoVivo: true,
    ano: 2026,
    classificacao: "Livre",
    duracao: "Ao vivo",
    generos: ["Notícias"],
    sinopse: "Cobertura jornalística 24 horas, análise e entrevistas exclusivas.",
    nota: 0,
    videoUrl: VIDEO_SAMPLE,
    cor: "#dc2626",
  },
  {
    id: "canal-tappo-filmes",
    titulo: "Tappo Filmes",
    tipo: "canal",
    aoVivo: true,
    ano: 2026,
    classificacao: "14",
    duracao: "Ao vivo",
    generos: ["Cinema"],
    sinopse: "Os melhores filmes sem interrupção, 24 horas por dia.",
    nota: 0,
    videoUrl: VIDEO_SAMPLE,
    cor: "#7c3aed",
  },
  {
    id: "canal-tappo-series",
    titulo: "Tappo Séries",
    tipo: "canal",
    aoVivo: true,
    ano: 2026,
    classificacao: "16",
    duracao: "Ao vivo",
    generos: ["Séries"],
    sinopse: "Maratona infinita das séries mais populares da plataforma.",
    nota: 0,
    videoUrl: VIDEO_SAMPLE,
    cor: "#db2777",
  },
  {
    id: "canal-tappo-esportes",
    titulo: "Tappo Esportes",
    tipo: "canal",
    aoVivo: true,
    ano: 2026,
    classificacao: "Livre",
    duracao: "Ao vivo",
    generos: ["Esportes"],
    sinopse: "Jogos ao vivo, melhores momentos e transmissões exclusivas.",
    nota: 0,
    videoUrl: VIDEO_SAMPLE,
    cor: "#16a34a",
  },
  {
    id: "canal-tappo-doc",
    titulo: "Tappo Documentários",
    tipo: "canal",
    aoVivo: true,
    ano: 2026,
    classificacao: "10",
    duracao: "Ao vivo",
    generos: ["Documentários"],
    sinopse: "Histórias reais, natureza e cultura do Brasil e do mundo.",
    nota: 0,
    videoUrl: VIDEO_SAMPLE,
    cor: "#0891b2",
  },
  {
    id: "canal-tappo-infantil",
    titulo: "Tappo Kids",
    tipo: "canal",
    aoVivo: true,
    ano: 2026,
    classificacao: "Livre",
    duracao: "Ao vivo",
    generos: ["Infantil"],
    sinopse: "Desenhos e programas educativos para a criançada.",
    nota: 0,
    videoUrl: VIDEO_SAMPLE,
    cor: "#f59e0b",
  },
];

export function buscarPorId(id: string) {
  return catalogo.find((c) => c.id === id);
}

export function destaques() {
  return catalogo.filter((c) => c.destaque);
}

export function porTipo(tipo: Tipo) {
  return catalogo.filter((c) => c.tipo === tipo);
}

export function canais() {
  return catalogo.filter((c) => c.tipo === "canal");
}

export function continuandoAssistir() {
  return catalogo.filter((c) => c.tipo !== "canal").slice(0, 6);
}

export function pesquisar(q: string) {
  const termo = q.trim().toLowerCase();
  if (!termo) return [];
  return catalogo.filter(
    (c) =>
      c.titulo.toLowerCase().includes(termo) ||
      c.generos.some((g) => g.toLowerCase().includes(termo)) ||
      c.sinopse.toLowerCase().includes(termo)
  );
}
