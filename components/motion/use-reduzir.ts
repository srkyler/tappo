"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";

const nada = () => () => {};

/**
 * prefers-reduced-motion seguro para hidratação: o 1º render (servidor e cliente)
 * é sempre `false`; o valor real entra depois de montar.
 */
export function useReduzir() {
  const real = useReducedMotion();
  const montado = useSyncExternalStore(nada, () => true, () => false);
  return montado && !!real;
}
