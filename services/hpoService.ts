/**
 * HPO search — cùng API web `packages/api/src/hpo/index.ts`.
 */
const HPO_SEARCH_URL = "https://api.htgen.io.vn/api/hpo/search";

export type HpoTerm = {
  id: string;
  name: string;
  definition?: string;
  synonyms?: string[];
};

export type HpoSearchResponse = {
  query: string;
  count: number;
  results: HpoTerm[];
};

export async function searchHpoTerms(query: string, limit: number = 20): Promise<HpoSearchResponse> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("limit", String(limit));
  const res = await fetch(`${HPO_SEARCH_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`HPO search failed: ${res.status}`);
  return res.json() as Promise<HpoSearchResponse>;
}
