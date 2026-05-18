"use client";

import type { ReactNode } from "react";
import { FilterChip } from "./FilterChip";

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI", dot: "bg-emerald-500" },
  { value: "anthropic", label: "Anthropic", dot: "bg-amber-500" },
  { value: "google", label: "Google", dot: "bg-sky-500" },
  { value: "meta", label: "Meta", dot: "bg-indigo-500" },
  { value: "moonshot", label: "Moonshot", dot: "bg-violet-500" },
  { value: "zhipu", label: "Zhipu", dot: "bg-rose-500" },
  { value: "nvidia", label: "NVIDIA", dot: "bg-lime-500" },
];

const MODALITY_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "vision", label: "Vision" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
];

const AVAILABILITY_OPTIONS = [
  { value: "api", label: "API" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "claude-ai", label: "Claude.ai" },
  { value: "gemini-app", label: "Gemini app" },
  { value: "bedrock", label: "Bedrock" },
  { value: "vertex", label: "Vertex" },
  { value: "azure", label: "Azure" },
  { value: "open-weights", label: "Open weights" },
];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 inline-block w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function FilterBar() {
  return (
    <div className="space-y-3">
      <Group label="Provider">
        {PROVIDER_OPTIONS.map((o) => (
          <FilterChip
            key={o.value}
            paramKey="provider"
            value={o.value}
            label={o.label}
            dotClass={o.dot}
          />
        ))}
      </Group>
      <Group label="Modality">
        {MODALITY_OPTIONS.map((o) => (
          <FilterChip
            key={o.value}
            paramKey="modality"
            value={o.value}
            label={o.label}
          />
        ))}
      </Group>
      <Group label="Availability">
        {AVAILABILITY_OPTIONS.map((o) => (
          <FilterChip
            key={o.value}
            paramKey="availability"
            value={o.value}
            label={o.label}
          />
        ))}
      </Group>
    </div>
  );
}
