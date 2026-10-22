import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "WhatsApp configurável — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Atendimento" titulo="WhatsApp (WAHA) configurável" descricao="Configure múltiplas instâncias, horário de atendimento, mensagens automáticas e rodízio." />

      <div className="grid lg:grid-cols-[1fr_420px] gap-6">
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Instâncias WAHA</h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            <div className="rounded-lg border border-gray-800 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400">
                    ✓
                  </span>
                  <span className="text-[13px] font-medium text-white">Comercial (principal)</span>
                </div>
                <span className="text-[11px] text-emerald-400">Conectado</span>
              </div>
              <p className="text-[11px] text-gray-500">+55 11 99999-8888</p>
              <p className="text-[11px] text-gray-600">Rodízio: ativo · IA: ativa</p>
              <div className="mt-2 flex gap-2">
                <button className="btn btn-primario btn-sm flex-1">Gerenciar</button>
                <button className="btn btn-secundario btn-sm">Desconectar</button>
              </div>
            </div>
            <div className="rounded-lg border border-gray-800 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400">
                    ?
                  </span>
                  <span className="text-[13px] font-medium text-white">Suporte (secundário)</span>
                </div>
                <span className="text-[11px] text-amber-400">QR pendente</span>
              </div>
              <p className="text-[11px] text-gray-500">Não conectado</p>
              <div className="mt-2 flex gap-2">
                <button className="btn btn-primario btn-sm flex-1">Conectar</button>
                <button className="btn btn-secundario btn-sm">Excluir</button>
              </div>
            </div>
            <button className="mt-3 btn btn-fantasma btn-sm w-full flex items-center justify-center gap-1">
              <span>+</span> Nova instância
            </button>
          </div>
        </section>

        <section className="painel p-5">
          <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Configuração da instância ativa</h3>
          <form className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Nome da instância</label>
              <input name="nome" defaultValue="Comercial" className="campo w-full" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Número de telefone</label>
                <input name="numero" defaultValue="+55 11 99999-8888" className="campo w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Status</label>
                <select name="status" className="campo w-full">
                  <option value="conectado">Conectado</option>
                  <option value="desconectado">Desconectado</option>
                  <option value="qr_pendente">Aguardando QR</option>
                  <option value="erro">Erro</option>
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Horário de início</label>
                <input name="hora_inicio" type="time" defaultValue="09:00" className="campo w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Horário de fim</label>
                <input name="hora_fim" type="time" defaultValue="18:00" className="campo w-full" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Dias de funcionamento</label>
              <div className="flex gap-2 flex-wrap">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                  <button
                    key={d}
                    onClick={() => {}}
                    className={`rounded px-2 py-1 text-[11px] ${d === "Sáb" || d === "Dom" ? "bg-gray-800 text-gray-500 border border-gray-700" : "bg-white text-black border-none"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3 mt-3">
              <input type="checkbox" name="rodizio" defaultChecked className="mt-1" />
              <span>
                <span className="block text-[14px] font-medium text-white">Rodízio de atendimento</span>
                <span className="block text-[12.5px] text-gray-500">Distribui conversas automaticamente por saldo de atendimentos abertos.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
              <input type="checkbox" name="usar_ia" defaultChecked className="mt-1" />
              <span>
                <span className="block text-[14px] font-medium text-white">IA responde automaticamente</span>
                <span className="block text-[12.5px] text-gray-500">Usa o agente de IA configurado no admin.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
              <input type="checkbox" name="criar_lead" defaultChecked className="mt-1" />
              <span>
                <span className="block text-[14px] font-medium text-white">Criar lead automaticamente</span>
                <span className="block text-[12.5px] text-gray-500">Quando um novo contato manda mensagem, cria o lead na base.</span>
              </span>
            </label>
            <button className="mt-4 btn btn-primario w-full">Salvar configuração</button>
          </form>
        </section>
      </div>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Mensagens automáticas</h2>
        </div>
        <div className="px-5 py-3 space-y-3">
          <div className="rounded-lg border border-gray-800 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium text-white">Boas-vindas</span>
              <span className="text-[11px] text-gray-500">Primeira mensagem</span>
            </div>
            <textarea
              rows={3}
              defaultValue="Olá! Bem-vindo à nossa empresa. Em que podemos ajudar hoje?"
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[12px] focus:ring-0"
            />
          </div>
          <div className="rounded-lg border border-gray-800 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium text-white">Fora de horário</span>
              <span className="text-[11px] text-gray-500">Fora do expediente</span>
            </div>
            <textarea
              rows={3}
              defaultValue="Olá! Nosso horário de atendimento é das 9h às 18h. Retornaremos assim que possível."
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[12px] focus:ring-0"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default function WhatsAppConfigPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
