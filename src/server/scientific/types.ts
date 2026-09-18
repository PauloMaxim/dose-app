export type ScientificSource = "pubmed" | "europe_pmc" | "crossref";

export interface ScientificAuthor {
  given: string | null;
  family: string | null;
  collectiveName: string | null;
  orcid: string | null;
}

export interface SourceProvenance {
  source: ScientificSource;
  externalId: string;
  sourceUrl: string | null;
  discoveredBy: ScientificSource;
  isOpenAccess?: boolean;
  license?: string | null;
}

/** Metadata and abstract are explicit; full text is intentionally absent in Phase 3A. */
export interface ScientificArticle {
  title: string;
  abstract: string | null;
  authors: ScientificAuthor[];
  journal: string | null;
  publisher: string | null;
  publishedAt: string | null;
  doi: string | null;
  pmid: string | null;
  pmcid: string | null;
  language: string | null;
  publicationTypes: string[];
  volume: string | null;
  issue: string | null;
  pages: string | null;
  originalUrl: string | null;
  pubmedUrl: string | null;
  pmcUrl: string | null;
  doiUrl: string | null;
  keywords: string[];
  meshTerms: string[];
  discoveredBy: ScientificSource;
  provenance: SourceProvenance[];
  ingestedAt: string | null;
  updatedAt: string | null;
}

export interface DiscoveryOptions {
  query: string;
  sources?: ScientificSource[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface ScientificAdapter {
  readonly source: ScientificSource;
  discover(options: DiscoveryOptions): Promise<ScientificArticle[]>;
}
