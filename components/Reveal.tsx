"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reveals its children with a fade-and-rise the first time they scroll into
 * view. No-ops (renders visible immediately) under prefers-reduced-motion or
 * when IntersectionObserver is unavailable.
 */
export function Reveal({
  children,
  delayMs = 0,
  as: Tag = "div",
  className = "",
  id,
}: {
  children: React.ReactNode;
  delayMs?: number;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Component = Tag as React.ElementType;
  return (
    <Component
      ref={ref}
      id={id}
      data-reveal={shown ? "in" : "out"}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`reveal ${className}`}
    >
      {children}
    </Component>
  );
}
