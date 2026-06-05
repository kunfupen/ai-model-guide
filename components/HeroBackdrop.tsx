"use client";

import { useEffect, useRef } from "react";

/**
 * Renders the hero grid + glow and gives them a subtle parallax drift as the
 * page scrolls. Pointer-events-none and decorative only. Disabled under
 * prefers-reduced-motion.
 */
export function HeroBackdrop() {
  const gridRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (gridRef.current) {
          gridRef.current.style.transform = `translateY(${y * 0.15}px)`;
        }
        if (glowRef.current) {
          glowRef.current.style.transform = `translateY(${y * 0.28}px)`;
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={gridRef} className="hero-grid will-change-transform" aria-hidden />
      <div ref={glowRef} className="hero-glow will-change-transform" aria-hidden />
    </>
  );
}
