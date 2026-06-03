import type { ModelFrontmatter, Provider, Modality, Availability } from "./schemas";

export type SortKey = "name" | "newest" | "cheapest" | "context";

export type FilterQuery = {
  q?: string;
  provider?: Provider[];
  modality?: Modality[];
  availability?: Availability[];
  sort?: SortKey;
};

const SORT_KEYS: ReadonlyArray<SortKey> = ["name", "newest", "cheapest", "context"];

export function parseQuery(searchParams: URLSearchParams): FilterQuery {
  const arr = <T extends string>(k: string): T[] | undefined => {
    const raw = searchParams.get(k);
    if (!raw) return undefined;
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean) as T[];
    return parts.length ? parts : undefined;
  };
  const rawSort = searchParams.get("sort");
  const sort = rawSort && SORT_KEYS.includes(rawSort as SortKey)
    ? (rawSort as SortKey)
    : undefined;
  const q = searchParams.get("q")?.trim() || undefined;
  return {
    q,
    provider: arr<Provider>("provider"),
    modality: arr<Modality>("modality"),
    availability: arr<Availability>("availability"),
    sort,
  };
}

export function filterAndSort(
  models: ModelFrontmatter[],
  q: FilterQuery,
): ModelFrontmatter[] {
  const needle = q.q?.toLowerCase();
  const filtered = models.filter((m) => {
    if (needle) {
      const haystack = [
        m.name,
        m.provider,
        ...m.strengths,
        ...m.modalities,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (q.provider?.length && !q.provider.includes(m.provider)) return false;
    if (
      q.modality?.length &&
      !q.modality.some((x) => m.modalities.includes(x))
    )
      return false;
    if (
      q.availability?.length &&
      !q.availability.some((x) => m.availability.includes(x))
    )
      return false;
    return true;
  });

  const sorted = filtered.slice();
  switch (q.sort) {
    case "newest":
      sorted.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
      break;
    case "cheapest":
      sorted.sort((a, b) => {
        const ap = a.pricing?.inputPer1M ?? Number.POSITIVE_INFINITY;
        const bp = b.pricing?.inputPer1M ?? Number.POSITIVE_INFINITY;
        return ap - bp;
      });
      break;
    case "context":
      sorted.sort((a, b) => b.contextWindow - a.contextWindow);
      break;
    case "name":
    default:
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return sorted;
}
