import { ImageResponse } from "next/og";
import { getAllModelSlugs, getModelBySlug } from "@/lib/content";
import type { Provider } from "@/lib/schemas";

export const dynamicParams = false;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AI Model Guide";

export async function generateStaticParams() {
  const slugs = await getAllModelSlugs();
  return slugs.map((slug) => ({ slug }));
}

const PROVIDER: Record<Provider, { label: string; dot: string }> = {
  openai: { label: "OpenAI", dot: "#10b981" },
  anthropic: { label: "Anthropic", dot: "#f59e0b" },
  google: { label: "Google", dot: "#0ea5e9" },
  microsoft: { label: "Microsoft", dot: "#06b6d4" },
  meta: { label: "Meta", dot: "#6366f1" },
  moonshot: { label: "Moonshot", dot: "#8b5cf6" },
  zhipu: { label: "Zhipu", dot: "#f43f5e" },
  nvidia: { label: "NVIDIA", dot: "#84cc16" },
};

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return `${tokens}`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { frontmatter } = await getModelBySlug(slug);
  const provider = PROVIDER[frontmatter.provider] ?? { label: frontmatter.provider, dot: "#a1a1aa" };

  const stats: { label: string; value: string }[] = [
    { label: "Context", value: `${formatContext(frontmatter.contextWindow)} tokens` },
    { label: "Modalities", value: frontmatter.modalities.join(" · ") },
  ];
  if (frontmatter.pricing) {
    stats.push({
      label: "Price / 1M",
      value: `$${frontmatter.pricing.inputPer1M} in · $${frontmatter.pricing.outputPer1M} out`,
    });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#09090b",
          padding: "72px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* ambient accent glow */}
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(124,92,255,0.35), transparent)",
          }}
        />

        {/* top: brand + provider */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#fafafa",
                color: "#09090b",
                fontSize: 22,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              AI
            </div>
            <div style={{ color: "#a1a1aa", fontSize: 26, fontWeight: 600 }}>
              Model Guide
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: provider.dot }} />
            <div style={{ color: "#e4e4e7", fontSize: 28, fontWeight: 600, letterSpacing: 1 }}>
              {provider.label}
            </div>
          </div>
        </div>

        {/* middle: model name */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#fafafa",
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.02,
            }}
          >
            {frontmatter.name}
          </div>
          {frontmatter.strengths.length > 0 && (
            <div style={{ color: "#a1a1aa", fontSize: 32, marginTop: 20, display: "flex" }}>
              {`Best for ${frontmatter.strengths.slice(0, 3).join(" · ")}`}
            </div>
          )}
        </div>

        {/* bottom: spec strip */}
        <div style={{ display: "flex", gap: 56 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ color: "#71717a", fontSize: 20, textTransform: "uppercase", letterSpacing: 2 }}>
                {s.label}
              </div>
              <div style={{ color: "#fafafa", fontSize: 30, fontWeight: 600 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
