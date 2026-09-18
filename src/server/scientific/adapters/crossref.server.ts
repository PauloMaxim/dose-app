import "../server-only";
import { fetchScientific, type HttpOptions } from "../http";
import { author, emptyArticle, stripTags, text } from "../parse-utils";
import { normalizeDoi } from "../identity";
import type { DiscoveryOptions, ScientificAdapter, ScientificArticle } from "../types";

type CrossrefWork = Record<string, any>;
export function parseCrossref(payload: unknown): ScientificArticle[] {
  const records = (payload as { message?: { items?: CrossrefWork[] } })?.message?.items ?? [];
  return records
    .filter((r) => text(r.title?.[0]))
    .map((r) => {
      const doi = normalizeDoi(r.DOI);
      const article = emptyArticle("crossref", text(r.title[0])!, doi ?? text(r.URL) ?? "unknown");
      article.doi = doi;
      article.abstract = text(r.abstract) ? stripTags(r.abstract) : null;
      article.publisher = text(r.publisher);
      article.journal = text(r["container-title"]?.[0]);
      article.volume = text(r.volume);
      article.issue = text(r.issue);
      article.pages = text(r.page ?? r["article-number"]);
      article.authors = (r.author ?? []).map((a: CrossrefWork) =>
        author(a.given, a.family, a.name, a.ORCID),
      );
      article.publicationTypes = text(r.type) ? [r.type] : [];
      const parts = r.published?.["date-parts"]?.[0] ?? r.issued?.["date-parts"]?.[0];
      article.publishedAt = parts?.[0]
        ? `${parts[0]}-${String(parts[1] ?? 1).padStart(2, "0")}-${String(parts[2] ?? 1).padStart(2, "0")}`
        : null;
      article.doiUrl = doi ? `https://doi.org/${doi}` : null;
      article.originalUrl = text(r.URL) ?? article.doiUrl;
      article.provenance[0].sourceUrl = article.originalUrl;
      article.provenance[0].license = text(r.license?.[0]?.URL);
      return article;
    });
}

export class CrossrefAdapter implements ScientificAdapter {
  readonly source = "crossref" as const;
  constructor(
    private readonly http: HttpOptions = {},
    private readonly mailto = process.env.CROSSREF_MAILTO,
  ) {}
  async discover(options: DiscoveryOptions): Promise<ScientificArticle[]> {
    const url = new URL("https://api.crossref.org/works");
    url.searchParams.set("query.bibliographic", options.query);
    url.searchParams.set("rows", String(Math.min(options.limit ?? 20, 100)));
    url.searchParams.set("offset", String(options.offset ?? 0));
    const filters = [
      options.dateFrom && `from-pub-date:${options.dateFrom}`,
      options.dateTo && `until-pub-date:${options.dateTo}`,
    ].filter(Boolean);
    if (filters.length) url.searchParams.set("filter", filters.join(","));
    if (this.mailto) url.searchParams.set("mailto", this.mailto);
    const agent = this.mailto
      ? `DoseScientificIngest/1.0 (mailto:${this.mailto})`
      : "DoseScientificIngest/1.0";
    return parseCrossref(
      await (
        await fetchScientific(url, {
          ...this.http,
          headers: { "User-Agent": agent, ...this.http.headers },
        })
      ).json(),
    );
  }
}
