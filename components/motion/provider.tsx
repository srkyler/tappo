"use client";

import { MotionConfig } from "framer-motion";

/** Quem pede menos movimento no sistema recebe só opacidade, sem deslocamentos. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
