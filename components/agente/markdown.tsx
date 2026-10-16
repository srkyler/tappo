import { Fragment } from "react";

/* Markdown mínimo e seguro (sem HTML cru): parágrafos, listas, **negrito**, `código`, títulos. */

function inline(t: string, k: string) {
  const partes = t.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g);
  return partes.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={`${k}${i}`}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <code key={`${k}${i}`}>{p.slice(1, -1)}</code>;
    if (p.startsWith("_") && p.endsWith("_") && p.length > 2) return <em key={`${k}${i}`} className="text-gray-400">{p.slice(1, -1)}</em>;
    return <Fragment key={`${k}${i}`}>{p}</Fragment>;
  });
}

export function Markdown({ texto }: { texto: string }) {
  const blocos: React.ReactNode[] = [];
  const linhas = texto.split("\n");
  let lista: { tipo: "ul" | "ol"; itens: string[] } | null = null;
  let par: string[] = [];

  const fecharPar = () => {
    if (par.length) blocos.push(<p key={`p${blocos.length}`}>{inline(par.join(" "), `p${blocos.length}`)}</p>);
    par = [];
  };
  const fecharLista = () => {
    if (!lista) return;
    const L = lista.tipo;
    const n = blocos.length;
    blocos.push(L === "ul"
      ? <ul key={`l${n}`}>{lista.itens.map((it, i) => <li key={i}>{inline(it, `l${n}${i}`)}</li>)}</ul>
      : <ol key={`l${n}`}>{lista.itens.map((it, i) => <li key={i}>{inline(it, `l${n}${i}`)}</li>)}</ol>);
    lista = null;
  };

  for (const bruta of linhas) {
    const l = bruta.trimEnd();
    const ul = l.match(/^\s*[-*•]\s+(.*)$/);
    const ol = l.match(/^\s*\d+[.)]\s+(.*)$/);
    const h = l.match(/^#{1,4}\s+(.*)$/);
    if (ul || ol) {
      fecharPar();
      const tipo = ul ? "ul" : "ol";
      if (lista && lista.tipo !== tipo) fecharLista();
      lista ??= { tipo, itens: [] };
      lista.itens.push((ul ?? ol)![1]);
    } else if (h) {
      fecharPar(); fecharLista();
      blocos.push(<p key={`h${blocos.length}`} className="font-semibold text-white">{inline(h[1], `h${blocos.length}`)}</p>);
    } else if (!l.trim()) {
      fecharPar(); fecharLista();
    } else {
      fecharLista();
      par.push(l);
    }
  }
  fecharPar(); fecharLista();
  return <div className="prosa space-y-2">{blocos}</div>;
}
