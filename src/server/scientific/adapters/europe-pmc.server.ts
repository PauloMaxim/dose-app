import "../server-only";
import { fetchScientific, type HttpOptions } from "../http";
import { author, emptyArticle, text } from "../parse-utils";
import { normalizeDoi } from "../identity";
import type { DiscoveryOptions, ScientificAdapter, ScientificArticle } from "../types";

type EpmcRecord = Record<string, any>;
export function parseEuropePmc(payload: unknown): ScientificArticle[] {
  const records = (payload as { resultList?: { result?: EpmcRecord[] } })?.resultList?.result ?? [];
  return records
    .filter((r) => text(r.title))
    .map((r) => {
      const externalId = text(r.pmid) ?? text(r.pmcid) ?? text(r.id) ?? "unknown";
      const article = emptyArticle("europe_pmc", text(r.title)!, externalId);
      article.abstract = text(r.abstractText);
      article.doi = normalizeDoi(r.doi);
      article.pmid = text(r.pmid);
      article.pmcid = text(r.pmcid)?.toUpperCase() ?? null;
      article.journal = text(r.journalTitle);
      article.publisher = text(r.publisher);
      article.publishedAt =
        text(r.firstPublicationDate) ?? (text(r.pubYear) ? `${r.pubYear}-01-01` : null);
      article.language = text(r.language);
      article.volume = text(r.journalVolume);
      article.issue = text(r.issue);
      article.pages = text(r.pageInfo);
      article.publicationTypes = Array.isArray(r.pubTypeList?.pubType) ? r.pubTypeList.pubType : [];
      article.keywords = Array.isArray(r.keywordList?.keyword) ? r.keywordList.keyword : [];
      article.authors = (r.authorList?.author ?? []).map((a: EpmcRecord) =>
        author(a.firstName ?? a.initials, a.lastName, a.collectiveName, a.authorId?.value),
      );
      article.pubmedUrl = article.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/` : null;
      article.pmcUrl = article.pmcid
        ? `https://pmc.ncbi.nlm.nih.gov/articles/${article.pmcid}/`
        : null;
      article.doiUrl = article.doi ? `https://doi.org/${article.doi}` : null;
      article.originalUrl = article.pmcUrl ?? article.pubmedUrl ?? article.doiUrl;
      article.provenance[0] = {
        ...article.provenance[0],
        sourceUrl: `https://europepmc.org/article/${text(r.source) ?? "MED"}/${text(r.id) ?? externalId}`,
        isOpenAccess: r.isOpenAccess === "Y",
        license: text(r.license),
      };
      return article;
    });
}

export class EuropePmcAdapter implements ScientificAdapter {
  readonly source = "europe_pmc" as const;
  constructor(private readonly http: HttpOptions = {}) {}
  async discover(options: DiscoveryOptions): Promise<ScientificArticle[]> {
    const url = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
    const dates =
      options.dateFrom || options.dateTo
        ? ` AND FIRST_PDATE:[${options.dateFrom ?? "0001-01-01"} TO ${options.dateTo ?? "3000-12-31"}]`
        : "";
    url.searchParams.set("query", `${options.query}${dates}`);
    url.searchParams.set("format", "json");
    url.searchParams.set("resultType", "core");
    url.searchParams.set("pageSize", String(Math.min(options.limit ?? 20, 100)));
    url.searchParams.set("cursorMark", "*");
    return parseEuropePmc(await (await fetchScientific(url, this.http)).json());
  }
}
