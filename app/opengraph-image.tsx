import { ImageResponse } from "next/og";
import { getAllModels } from "@/lib/content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AI Model Guide — compare Claude, GPT, Gemini and more";

export default async function Image() {
  const models = await getAllModels();
  const count = models.length;
  const providers = new Set(models.map((m) => m.frontmatter.provider)).size;

  const stat = (value: string, label: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", color: "#fafafa", fontSize: 40, fontWeight: 700 }}>
        {value}
      </div>
      <div
        style={{
          display: "flex",
          color: "#71717a",
          fontSize: 20,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        {label}
      </div>
    </div>
  );

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
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "#fafafa",
              color: "#09090b",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            AI
          </div>
          <div style={{ display: "flex", color: "#a1a1aa", fontSize: 28, fontWeight: 600 }}>
            Model Guide
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 940 }}>
          <div
            style={{
              display: "flex",
              color: "#fafafa",
              fontSize: 82,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.05,
            }}
          >
            The AI models, evaluated.
          </div>
          <div
            style={{
              display: "flex",
              color: "#a1a1aa",
              fontSize: 32,
              marginTop: 24,
            }}
          >
            {"Specs, benchmarks & guidance for OpenAI, Anthropic, Google & more."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 56 }}>
          {stat(String(count), "Models")}
          {stat(String(providers), "Providers")}
        </div>
      </div>
    ),
    { ...size },
  );
}
