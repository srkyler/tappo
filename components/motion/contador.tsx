"use client";
import { useReduzir } from "@/components/motion/use-reduzir";

import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Número que gira até o valor quando entra na tela (formato pt-BR). */
export function Contador({ valor, atraso = 0 }: { valor: number; atraso?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visto = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduzir = useReduzir();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (reduzir || !visto) return;
    const c = animate(0, valor, { duration: 1.6, delay: atraso, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [visto, valor, atraso, reduzir]);

  return <span ref={ref} className="tabular">{(reduzir ? valor : n).toLocaleString("pt-BR")}</span>;
}
