/* Sugestões de promoção/oferta prontas por segmento — atalho pra preencher o
 * formulário de criação, não trava o usuário nelas (pode editar tudo). */

export type SugestaoPromocao = { titulo: string; oferta: string; descricao: string };

const SUGESTOES: Record<string, SugestaoPromocao[]> = {
  geral: [
    { titulo: "Diagnóstico gratuito", oferta: "Primeira consultoria sem custo", descricao: "Conversa de 30 min pra mapear o problema antes de qualquer proposta." },
    { titulo: "Condição de fechamento no mês", oferta: "10% de desconto fechando até o fim do mês", descricao: "Pressão de tempo saudável pra destravar negociações paradas." },
  ],
  odontologia: [
    { titulo: "Avaliação gratuita", oferta: "Avaliação + raio-X sem custo", descricao: "Porta de entrada clássica pra quem nunca veio à clínica." },
    { titulo: "Clareamento com desconto", oferta: "20% de desconto em clareamento dental", descricao: "Bom pra época de fotos/eventos (fim de ano, formaturas, verão)." },
    { titulo: "Indique e ganhe", oferta: "Limpeza grátis pra quem indicar um novo paciente", descricao: "Gera recorrência via boca a boca dos próprios pacientes." },
  ],
  saude: [
    { titulo: "Pacote de retorno", oferta: "Consulta de retorno com 50% de desconto em até 30 dias", descricao: "Incentiva acompanhamento sem parecer insistente." },
    { titulo: "Check-up sazonal", oferta: "Pacote de exames com condição especial", descricao: "Bom pra início de ano ou campanhas de prevenção (outubro rosa, novembro azul etc.)." },
  ],
  estetica: [
    { titulo: "Avaliação + 1 sessão grátis", oferta: "Primeira sessão do procedimento sem custo", descricao: "Reduz a barreira de entrada pra quem nunca fez o procedimento." },
    { titulo: "Pacote fechado com desconto", oferta: "15% de desconto fechando pacote de 5+ sessões", descricao: "Aumenta o ticket médio e já garante recorrência." },
  ],
  tecnologia: [
    { titulo: "Diagnóstico técnico gratuito", oferta: "Visita de diagnóstico sem custo", descricao: "Padrão do setor — remove a objeção de 'não sei o que eu tenho'." },
    { titulo: "Contrato anual com desconto", oferta: "2 meses grátis fechando plano anual", descricao: "Empurra cliente mensal pra contrato mais longo (reduz churn)." },
  ],
  imobiliaria: [
    { titulo: "Visita guiada no fim de semana", oferta: "Agende e ganhe prioridade na negociação", descricao: "Bom pra lançamentos e estoque que precisa girar." },
    { titulo: "Condição de lançamento", oferta: "Isenção de taxa de corretagem nas primeiras unidades", descricao: "Clássico de lançamento — cria urgência real (estoque limitado)." },
  ],
  educacao: [
    { titulo: "Matrícula com desconto", oferta: "Taxa de matrícula grátis até [data]", descricao: "Bom pra período de captação (dezembro–fevereiro, meio do ano)." },
    { titulo: "Aula experimental", oferta: "Primeira aula sem compromisso", descricao: "Reduz o risco percebido de quem está decidindo entre escolas/cursos." },
  ],
  servicos: [
    { titulo: "Orçamento sem compromisso", oferta: "Visita técnica/orçamento grátis", descricao: "Padrão pro setor — remove o atrito de 'quanto custa pra eu saber se vale'." },
    { titulo: "Fidelidade", oferta: "10% de desconto pra clientes recorrentes", descricao: "Recompensa quem já comprou antes, incentiva repetição." },
  ],
};

export function sugestoesPorSegmento(segmentoId: string): SugestaoPromocao[] {
  return SUGESTOES[segmentoId] ?? SUGESTOES.geral;
}
