export type Pendencia = {
  id: string;
  tipo: "mensagem" | "transferida" | "tarefa" | "sla";
  titulo: string;
  detalhe: string;
  href: string;
  em: string;
  urgente: boolean;
};
