"use client";

import { useEffect, useState } from "react";

/**
 * A thin progress bar pinned to the top of the viewport that fills as the page
 * scrolls. Decorative; hidden under prefers-reduced-motion.
 */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabled(false);
      return;
    }
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left"
      style={{
        transform: `scaleX(${progress})`,
        background:
          "linear-gradient(90deg, var(--color-accent), color-mix(in oklch, var(--color-accent) 50%, #f0abfc))",
        transition: "transform 0.1s linear",
      }}
    />
  );
}
