/*
 * Segmentos atendidos pelo Tappo. Cada um ajusta termos da interface, funil padrão
 * (SQL: public.etapas_do_segmento) e um ponto de partida para a IA de atendimento.
 */

export type Termos = { lead: string; leads: string; negocio: string; negocios: string };

export type Segmento = {
  id: string;
  nome: string;
  exemplos: string;
  termos: Termos;
  instrucoesIA: string;
};

const B2B: Termos = { lead: "Lead", leads: "Leads", negocio: "Negócio", negocios: "Negócios" };
const PACIENTE: Termos = { lead: "Paciente", leads: "Pacientes", negocio: "Tratamento", negocios: "Tratamentos" };
const CLIENTE: Termos = { lead: "Cliente", leads: "Clientes", negocio: "Venda", negocios: "Vendas" };

export const SEGMENTOS: Segmento[] = [
  {
    id: "geral", nome: "Vendas B2B", exemplos: "SaaS, consultoria, indústria, agências", termos: B2B,
    instrucoesIA: "Qualifique o contato: pergunte empresa, cargo e o desafio principal. Ofereça agendar uma conversa de 15 minutos com um especialista.",
  },
  {
    id: "odontologia", nome: "Clínica odontológica", exemplos: "implantes, ortodontia, clareamento, harmonização", termos: PACIENTE,
    instrucoesIA: "Acolha o paciente, pergunte qual tratamento procura (implante, aparelho, limpeza, clareamento…) e ofereça agendar uma avaliação. Peça nome completo e melhor período (manhã/tarde). Nunca dê diagnóstico nem preço fechado: diga que o valor é definido na avaliação. Em caso de dor forte ou urgência, passe para um atendente.",
  },
  {
    id: "saude", nome: "Clínica médica / saúde", exemplos: "consultórios, fisioterapia, psicologia, nutrição", termos: PACIENTE,
    instrucoesIA: "Acolha o paciente, entenda a especialidade desejada e se tem convênio ou é particular. Ofereça horários para consulta. Nunca dê orientação médica. Em urgência, oriente procurar pronto-socorro e passe para um atendente.",
  },
  {
    id: "estetica", nome: "Estética e beleza", exemplos: "clínicas de estética, salões, spas", termos: CLIENTE,
    instrucoesIA: "Entenda o procedimento de interesse, explique de forma simples e ofereça uma avaliação gratuita. Peça nome e melhor dia.",
  },
  {
    id: "tecnologia", nome: "Informática e tecnologia", exemplos: "assistência técnica, software, redes, TI gerenciada", termos: CLIENTE,
    instrucoesIA: "Entenda o problema ou projeto (equipamento, sistema, rede), se é pessoa física ou empresa e a urgência. Para orçamento, colete modelo/quantidade e cidade. Ofereça visita técnica ou diagnóstico.",
  },
  {
    id: "imobiliaria", nome: "Imobiliária", exemplos: "venda, locação, lançamentos", termos: CLIENTE,
    instrucoesIA: "Pergunte se busca comprar ou alugar, região, faixa de valor e número de quartos. Ofereça agendar uma visita com um corretor.",
  },
  {
    id: "educacao", nome: "Educação", exemplos: "escolas, cursos, idiomas, faculdades", termos: { lead: "Aluno", leads: "Alunos", negocio: "Matrícula", negocios: "Matrículas" },
    instrucoesIA: "Entenda o curso ou série de interesse e para quem é. Ofereça visita ou aula experimental e explique como funciona a matrícula.",
  },
  {
    id: "servicos", nome: "Serviços e varejo", exemplos: "oficinas, lojas, prestadores, eventos", termos: CLIENTE,
    instrucoesIA: "Entenda o que o cliente precisa, colete os dados para orçamento e ofereça o próximo passo (visita, orçamento por escrito ou compra).",
  },
];

export const segmentoPorId = (id: string | null | undefined) => SEGMENTOS.find((s) => s.id === id) ?? SEGMENTOS[0];

export const PAPEIS = {
  dono: "Dono",
  gestor: "Gestor",
  vendedor: "Vendedor",
  atendente: "Atendente",
} as const;
export type Papel = keyof typeof PAPEIS;
export const ehGestor = (p: string | null | undefined) => p === "dono" || p === "gestor";
