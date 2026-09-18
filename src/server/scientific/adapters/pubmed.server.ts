import "../server-only";
import { fetchScientific, type HttpOptions } from "../http";
import { attr, emptyArticle, tag, tags } from "../parse-utils";
import { normalizeDoi } from "../identity";
import type { DiscoveryOptions, ScientificAdapter, ScientificArticle } from "../types";

export function parsePubMedXml(xml: string): ScientificArticle[] {
  const records = [...xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/gi)].map(
    (m) => m[1],
  );
  return records.map((record) => {
    const pmid = tag(record, "PMID") ?? "";
    const article = emptyArticle(
      "pubmed",
      tag(record, "ArticleTitle") ?? "Untitled PubMed record",
      pmid,
    );
    article.pmid = pmid || null;
    article.doi = normalizeDoi(attr(record, "ArticleId", "IdType", "doi"));
    article.pmcid = attr(record, "ArticleId", "IdType", "pmc")?.toUpperCase() ?? null;
    article.abstract = tags(record, "AbstractText").join("\n") || null;
    article.journal = tag(record, "Title") ?? tag(record, "ISOAbbreviation");
    article.language = tag(record, "Language");
    article.volume = tag(record, "Volume");
    article.issue = tag(record, "Issue");
    article.pages = tag(record, "MedlinePgn");
    article.publicationTypes = tags(record, "PublicationType");
    article.keywords = tags(record, "Keyword");
    article.meshTerms = tags(record, "DescriptorName");
    article.authors = [...record.matchAll(/<Author(?:\s[^>]*)?>([\s\S]*?)<\/Author>/gi)].map(
      (m) => ({
        given: tag(m[1], "ForeName"),
        family: tag(m[1], "LastName"),
        collectiveName: tag(m[1], "CollectiveName"),
        orcid: attr(m[1], "Identifier", "Source", "ORCID"),
      }),
    );
    const year = tag(record, "Year");
    const month = tag(record, "Month")?.padStart(2, "0");
    const day = tag(record, "Day")?.padStart(2, "0");
    article.publishedAt = year
      ? `${year}-${/^\d+$/.test(month ?? "") ? month : "01"}-${day ?? "01"}`
      : null;
    article.pubmedUrl = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : null;
    article.pmcUrl = article.pmcid
      ? `https://pmc.ncbi.nlm.nih.gov/articles/${article.pmcid}/`
      : null;
    article.doiUrl = article.doi ? `https://doi.org/${article.doi}` : null;
    article.originalUrl = article.pubmedUrl;
    article.provenance[0].sourceUrl = article.pubmedUrl;
    return article;
  });
}

export class PubMedAdapter implements ScientificAdapter {
  readonly source = "pubmed" as const;
  constructor(
    private readonly http: HttpOptions = {},
    private readonly apiKey = process.env.NCBI_API_KEY,
  ) {}
  async discover(options: DiscoveryOptions): Promise<ScientificArticle[]> {
    const search = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
    search.searchParams.set("db", "pubmed");
    search.searchParams.set("retmode", "json");
    search.searchParams.set("term", options.query);
    search.searchParams.set("retmax", String(Math.min(options.limit ?? 20, 100)));
    search.searchParams.set("retstart", String(options.offset ?? 0));
    if (options.dateFrom) {
      search.searchParams.set("mindate", options.dateFrom);
      search.searchParams.set("datetype", "pdat");
    }
    if (options.dateTo) search.searchParams.set("maxdate", options.dateTo);
    if (this.apiKey) search.searchParams.set("api_key", this.apiKey);
    const ids =
      (
        (await (await fetchScientific(search, this.http)).json()) as {
          esearchresult?: { idlist?: string[] };
        }
      ).esearchresult?.idlist ?? [];
    if (!ids.length) return [];
    const fetchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi");
    fetchUrl.searchParams.set("db", "pubmed");
    fetchUrl.searchParams.set("retmode", "xml");
    fetchUrl.searchParams.set("id", ids.join(","));
    if (this.apiKey) fetchUrl.searchParams.set("api_key", this.apiKey);
    return parsePubMedXml(await (await fetchScientific(fetchUrl, this.http)).text());
  }
}
