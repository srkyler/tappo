"use client";

import { useEffect, useRef, useState } from "react";
import { useReduzir } from "./use-reduzir";

/**
 * Vídeo de ambiente: mudo, em loop, sem controles.
 * Pausa fora da tela e respeita prefers-reduced-motion (mostra só o pôster).
 * Fontes: Mixkit (licença livre), tratadas para o tom nogueira em .impeccable/build/videos.
 */
export function FundoVideo({ src, poster, className = "", posicao = "center" }: {
  src: string;
  poster: string;
  className?: string;
  posicao?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduzir = useReduzir();
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || reduzir) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.05 });
    io.observe(v);
    return () => io.disconnect();
  }, [reduzir]);

  return (
    <div className={`absolute inset-0 overflow-hidden grayscale contrast-[1.08] ${className}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: posicao }} />
      {!reduzir && (
        <video
          ref={ref}
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          onCanPlay={() => setPronto(true)}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1.2s] ease-out"
          style={{ objectPosition: posicao, opacity: pronto ? 1 : 0 }}
        />
      )}
    </div>
  );
}
