import assert from "node:assert/strict";
import test from "node:test";
import { parseCrossref } from "./adapters/crossref.server";
import { parseEuropePmc } from "./adapters/europe-pmc.server";
import { parsePubMedXml } from "./adapters/pubmed.server";
import { fetchScientific, ScientificHttpError } from "./http";
import { articleIdentity, bibliographicFallback, normalizeDoi } from "./identity";
import { deduplicateArticles, mergeArticles, promoteLegacyArticle } from "./merge";
import { emptyArticle } from "./parse-utils";
import { persistScientificArticle } from "./persistence.server";
import type { ScientificArticle } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

const article = (
  source: "pubmed" | "europe_pmc" | "crossref",
  id: string,
  values: Partial<ScientificArticle> = {},
) => ({
  ...emptyArticle(source, "A sufficiently long exact biomedical study title", id),
  authors: [{ given: "Ana", family: "Silva", collectiveName: null, orcid: null }],
  publishedAt: "2024-01-02",
  ...values,
});

type PersistenceSourceRow = {
  article_id: string;
  provider: string;
  external_id: string;
  [key: string]: any;
};

function persistenceClient(row: Record<string, any>, initialSources: PersistenceSourceRow[]) {
  const sources = new Map(
    initialSources.map((source) => [`${source.provider}:${source.external_id}`, source]),
  );
  let inserts = 0;

  class Query {
    private filters: Record<string, unknown> = {};
    private alternatives: string | null = null;
    private operation = "select";
    private payload: any;

    constructor(private table: string) {}

    select() {
      return this;
    }

    insert(payload: any) {
      inserts++;
      this.operation = "insert";
      this.payload = payload;
      return this;
    }

    update(payload: any) {
      this.operation = "update";
      this.payload = payload;
      return this;
    }

    upsert(payload: any) {
      this.operation = "upsert";
      this.payload = payload;
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters[column] = value;
      return this;
    }

    or(alternatives: string) {
      this.alternatives = alternatives;
      return this;
    }

    limit() {
      return this;
    }

    private matchesArticleIdentity() {
      if (this.filters.id !== undefined) return row.id === this.filters.id;
      if (!this.alternatives) return false;
      return this.alternatives.split(",").some((alternative) => {
        const separator = alternative.indexOf(".eq.");
        const column = alternative.slice(0, separator);
        const expected = alternative.slice(separator + 4);
        const actual = column === "doi_normalized" ? normalizeDoi(row.doi) : (row[column] ?? null);
        return actual === expected;
      });
    }

    maybeSingle() {
      if (this.table === "articles") {
        return Promise.resolve({ data: this.matchesArticleIdentity() ? row : null, error: null });
      }
      const key = `${this.filters.provider}:${this.filters.external_id}`;
      return Promise.resolve({ data: sources.get(key) ?? null, error: null });
    }

    single() {
      if (this.operation === "update") Object.assign(row, this.payload);
      if (this.operation === "insert") Object.assign(row, this.payload);
      const data =
        this.table === "articles" && (this.operation !== "select" || this.matchesArticleIdentity())
          ? row
          : null;
      return Promise.resolve({ data, error: data ? null : new Error("Article not found") });
    }

    then(resolve: (value: any) => void) {
      if (this.operation === "upsert") {
        sources.set(`${this.payload.provider}:${this.payload.external_id}`, this.payload);
        return Promise.resolve({ data: null, error: null }).then(resolve);
      }
      const data = [...sources.values()].filter(
        (source) => source.article_id === this.filters.article_id,
      );
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  }

  return {
    client: { from: (table: string) => new Query(table) } as unknown as SupabaseClient,
    sources,
    insertCount: () => inserts,
  };
}

function persistedArticleRow(values: Record<string, any> = {}) {
  return {
    id: "article-id",
    title: "Legacy editorial title",
    abstract: "Legacy editorial abstract",
    authors: [],
    journal: "Legacy journal",
    publisher: "Legacy publisher",
    published_at: "2024-01-02",
    doi: null,
    pmid: null,
    pmcid: null,
    language: "por",
    publication_types: ["Editorial"],
    volume: null,
    issue: null,
    pages: null,
    original_url: "https://dose.test/legacy",
    pubmed_url: null,
    pmc_url: null,
    doi_url: null,
    keywords: ["legacy"],
    mesh_terms: ["legacy"],
    bibliographic_key: null,
    ingested_at: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...values,
  };
}

test("normalizes DOI URL, doi prefix, case and whitespace", () =>
  assert.equal(normalizeDoi(" DOI: HTTPS://DOI.ORG/10.1000/ABC "), "10.1000/abc"));
test("rejects an invalid DOI", () => assert.equal(normalizeDoi("not-an-id"), null));
test("deduplicates by DOI", () =>
  assert.equal(
    deduplicateArticles([
      article("pubmed", "1", { doi: "https://doi.org/10.1234/ONE", pmid: "1" }),
      article("crossref", "x", { doi: "doi:10.1234/one", pmid: "2" }),
    ]).length,
    1,
  ));
test("deduplicates by PMID", () =>
  assert.equal(
    deduplicateArticles([
      article("pubmed", "1", { pmid: "42" }),
      article("europe_pmc", "42", { pmid: "42" }),
    ]).length,
    1,
  ));
test("deduplicates by PMCID", () =>
  assert.equal(
    deduplicateArticles([
      article("pubmed", "1", { pmcid: "PMC42" }),
      article("europe_pmc", "PMC42", { pmcid: "pmc42" }),
    ]).length,
    1,
  ));
test("uses only conservative bibliographic fallback", () => {
  const a = article("pubmed", "x");
  assert.ok(bibliographicFallback(a));
  assert.match(articleIdentity(a), /^bibliographic:/);
  assert.equal(bibliographicFallback({ ...a, authors: [] }), null);
});
test("deduplicates exact bibliographic fallback", () =>
  assert.equal(deduplicateArticles([article("pubmed", "x"), article("crossref", "y")]).length, 1));
test("merge keeps identifiers and richer abstract", () => {
  const out = mergeArticles(
    article("pubmed", "1", { pmid: "1", abstract: "short" }),
    article("crossref", "d", { doi: "10.1234/x", abstract: "a much longer abstract" }),
  );
  assert.equal(out.pmid, "1");
  assert.equal(out.doi, "10.1234/x");
  assert.equal(out.abstract, "a much longer abstract");
});
test("merge unions provenance idempotently", () => {
  const a = article("pubmed", "1");
  const b = article("crossref", "x");
  const once = mergeArticles(a, b);
  assert.equal(once.provenance.length, 2);
  assert.deepEqual(mergeArticles(once, b).provenance, once.provenance);
});

test("deduplication is idempotent across repeated ingestion input", () => {
  const input = [article("pubmed", "1", { pmid: "1" }), article("europe_pmc", "1", { pmid: "1" })];
  const once = deduplicateArticles(input);
  assert.deepEqual(deduplicateArticles([...once, ...input]), once);
});

test("legacy promotion uses incoming scientific metadata and preserves non-conflicting identifiers", () => {
  const legacy = article("pubmed", "legacy", {
    title: "O inimigo agora é a inércia",
    abstract: "Editorial abstract",
    journal: "Editorial journal",
    publisher: "Editorial publisher",
    doi: "10.1234/known",
    pmid: "37952131",
    pmcid: "PMC123",
    keywords: ["editorial"],
    publicationTypes: ["Editorial"],
  });
  const incoming = article("pubmed", "37952131", {
    title: "Canonical scientific title",
    abstract: null,
    journal: "Scientific Journal",
    publisher: null,
    doi: null,
    pmid: "37952131",
    pmcid: null,
    keywords: [],
    publicationTypes: ["Randomized Controlled Trial"],
  });

  const promoted = promoteLegacyArticle(legacy, incoming);
  assert.equal(promoted.title, "Canonical scientific title");
  assert.equal(promoted.abstract, null);
  assert.equal(promoted.publisher, null);
  assert.deepEqual(promoted.keywords, []);
  assert.equal(promoted.doi, "10.1234/known");
  assert.equal(promoted.pmid, "37952131");
  assert.equal(promoted.pmcid, "PMC123");
});

test("legacy promotion fails safely on conflicting identifiers", () => {
  assert.throws(
    () =>
      promoteLegacyArticle(
        article("pubmed", "legacy", { pmid: "1" }),
        article("pubmed", "incoming", { pmid: "2" }),
      ),
    /Conflicting PMID/,
  );
});

test("persistence promotes a dose_catalog PMID match once and retains provenance", async () => {
  const id = "d05e0000-0000-4000-8000-000000000003";
  const row: Record<string, any> = {
    id,
    title: "O inimigo agora é a inércia",
    abstract: "Editorial fallback must disappear",
    authors: [],
    journal: "Editorial journal",
    publisher: "Editorial publisher",
    published_at: "2023-11-11",
    doi: "10.1234/known",
    pmid: "37952131",
    pmcid: "PMC123",
    language: "por",
    publication_types: ["Editorial"],
    volume: "legacy volume",
    issue: "legacy issue",
    pages: "legacy pages",
    original_url: "https://dose.test/editorial",
    pubmed_url: null,
    pmc_url: null,
    doi_url: "https://doi.org/10.1234/known",
    keywords: ["editorial"],
    mesh_terms: ["legacy"],
    ingested_at: null,
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const { client, sources, insertCount } = persistenceClient(row, [
    { article_id: id, provider: "dose_catalog", external_id: "select" },
  ]);
  const incoming = article("pubmed", "37952131", {
    title: "Canonical scientific title",
    abstract: null,
    journal: "Scientific Journal",
    publisher: null,
    pmid: "37952131",
    doi: null,
    pmcid: null,
    publicationTypes: ["Randomized Controlled Trial"],
    keywords: [],
    meshTerms: [],
  });

  assert.equal(await persistScientificArticle(client, incoming), "reconciled");
  assert.equal(row.id, id);
  assert.equal(row.title, "Canonical scientific title");
  assert.equal(row.abstract, null);
  assert.equal(row.publisher, null);
  assert.equal(row.doi, "10.1234/known");
  assert.equal(row.pmcid, "PMC123");
  assert.equal(row.study_type, "randomized_trial");
  assert.deepEqual([...sources.values()].map((source) => source.provider).sort(), [
    "dose_catalog",
    "pubmed",
  ]);

  assert.equal(await persistScientificArticle(client, incoming), "updated");
  assert.equal(row.title, "Canonical scientific title");
  assert.equal(sources.size, 2);
  assert.equal(insertCount(), 0);
});

test("persistence promotes a legacy-only article selected by DOI", async () => {
  const id = "doi-article-id";
  const row = persistedArticleRow({ id, doi: "https://doi.org/10.1234/LEGACY" });
  const { client, sources, insertCount } = persistenceClient(row, [
    { article_id: id, provider: "dose_catalog", external_id: "legacy-doi" },
  ]);
  const incoming = article("crossref", "10.1234/legacy", {
    title: "Canonical DOI scientific title",
    abstract: "Scientific DOI abstract",
    doi: "10.1234/legacy",
    publisher: null,
  });

  assert.equal(await persistScientificArticle(client, incoming), "reconciled");
  assert.equal(row.id, id);
  assert.equal(row.title, "Canonical DOI scientific title");
  assert.equal(row.abstract, "Scientific DOI abstract");
  assert.equal(row.publisher, null);
  assert.equal(row.doi, "10.1234/legacy");
  assert.equal(sources.has("crossref:10.1234/legacy"), true);
  assert.equal(sources.has("dose_catalog:legacy-doi"), true);
  assert.equal(insertCount(), 0);
});

test("persistence promotes a legacy-only article selected by case-insensitive PMCID", async () => {
  const id = "pmcid-article-id";
  const row = persistedArticleRow({ id, pmcid: "PMC4242" });
  const { client, sources, insertCount } = persistenceClient(row, [
    { article_id: id, provider: "dose_catalog", external_id: "legacy-pmcid" },
  ]);
  const incoming = article("europe_pmc", "pmc4242", {
    title: "Canonical PMCID scientific title",
    abstract: "Scientific PMCID abstract",
    pmcid: "pmc4242",
    journal: null,
  });

  assert.equal(await persistScientificArticle(client, incoming), "reconciled");
  assert.equal(row.id, id);
  assert.equal(row.title, "Canonical PMCID scientific title");
  assert.equal(row.abstract, "Scientific PMCID abstract");
  assert.equal(row.journal, null);
  assert.equal(row.pmcid, "PMC4242");
  assert.equal(sources.has("europe_pmc:pmc4242"), true);
  assert.equal(sources.has("dose_catalog:legacy-pmcid"), true);
  assert.equal(insertCount(), 0);
});

test("persistence promotes a legacy-only article selected by bibliographic fallback", async () => {
  const id = "fallback-article-id";
  const incoming = article("crossref", "fallback-record", {
    title: "A sufficiently long exact biomedical study title",
    abstract: "Canonical fallback abstract",
    doi: null,
    pmid: null,
    pmcid: null,
    publisher: null,
  });
  const row = persistedArticleRow({
    id,
    title: incoming.title,
    authors: incoming.authors,
    published_at: incoming.publishedAt,
    bibliographic_key: bibliographicFallback(incoming),
  });
  const { client, sources, insertCount } = persistenceClient(row, [
    { article_id: id, provider: "dose_catalog", external_id: "legacy-fallback" },
  ]);

  assert.equal(await persistScientificArticle(client, incoming), "reconciled");
  assert.equal(row.id, id);
  assert.equal(row.abstract, "Canonical fallback abstract");
  assert.equal(row.publisher, null);
  assert.equal(sources.has("crossref:fallback-record"), true);
  assert.equal(sources.has("dose_catalog:legacy-fallback"), true);
  assert.equal(insertCount(), 0);
});

test("persistence keeps scientific-to-scientific merge behavior", async () => {
  const id = "scientific-article-id";
  const row = persistedArticleRow({
    id,
    title: "Existing scientific title that is deliberately longer",
    abstract: "Short abstract",
    doi: "10.1234/scientific",
    publisher: "Existing scientific publisher",
    publication_types: ["Clinical Trial"],
    keywords: ["existing"],
  });
  const { client, sources, insertCount } = persistenceClient(row, [
    { article_id: id, provider: "pubmed", external_id: "12345" },
  ]);
  const incoming = article("crossref", "10.1234/scientific", {
    title: "Short scientific title",
    abstract: "A substantially longer scientific abstract from Crossref",
    doi: "10.1234/scientific",
    publisher: null,
    publicationTypes: ["Journal Article"],
    keywords: ["incoming"],
  });

  assert.equal(await persistScientificArticle(client, incoming), "reconciled");
  assert.equal(row.id, id);
  assert.equal(row.title, "Existing scientific title that is deliberately longer");
  assert.equal(row.abstract, "A substantially longer scientific abstract from Crossref");
  assert.equal(row.publisher, "Existing scientific publisher");
  assert.deepEqual(row.publication_types, ["Clinical Trial", "Journal Article"]);
  assert.deepEqual(row.keywords, ["existing", "incoming"]);
  assert.equal(sources.has("pubmed:12345"), true);
  assert.equal(sources.has("crossref:10.1234/scientific"), true);
  assert.equal(insertCount(), 0);
});

const pubmedXml = `<PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>42</PMID><Article><ArticleTitle>Clinical trial title</ArticleTitle><Abstract><AbstractText>Reported abstract.</AbstractText></Abstract><AuthorList><Author><LastName>Silva</LastName><ForeName>Ana</ForeName></Author></AuthorList><Journal><Title>Medical Journal</Title><JournalIssue><Volume>2</Volume><Issue>3</Issue><PubDate><Year>2024</Year></PubDate></JournalIssue></Journal><Language>eng</Language><PublicationTypeList><PublicationType>Clinical Trial</PublicationType></PublicationTypeList></Article><MeshHeadingList><MeshHeading><DescriptorName>Heart</DescriptorName></MeshHeading></MeshHeadingList></MedlineCitation><PubmedData><ArticleIdList><ArticleId IdType="doi">10.1234/Test</ArticleId><ArticleId IdType="pmc">PMC99</ArticleId></ArticleIdList></PubmedData></PubmedArticle></PubmedArticleSet>`;
test("parses PubMed XML metadata", () => {
  const a = parsePubMedXml(pubmedXml)[0];
  assert.equal(a.pmid, "42");
  assert.equal(a.doi, "10.1234/test");
  assert.equal(a.pmcid, "PMC99");
  assert.deepEqual(a.meshTerms, ["Heart"]);
});
test("PubMed tolerates absent abstract and DOI", () => {
  const a = parsePubMedXml(
    `<PubmedArticle><PMID>7</PMID><ArticleTitle>Title only</ArticleTitle></PubmedArticle>`,
  )[0];
  assert.equal(a.abstract, null);
  assert.equal(a.doi, null);
});

test("parses Europe PMC identifiers, OA signal and authors", () => {
  const a = parseEuropePmc({
    resultList: {
      result: [
        {
          id: "42",
          pmid: "42",
          pmcid: "PMC99",
          doi: "10.1234/X",
          title: "Study",
          abstractText: "Abstract",
          isOpenAccess: "Y",
          authorList: { author: [{ firstName: "Ana", lastName: "Silva" }] },
        },
      ],
    },
  })[0];
  assert.equal(a.pmcid, "PMC99");
  assert.equal(a.provenance[0].isOpenAccess, true);
  assert.equal(a.authors[0].family, "Silva");
});
test("Europe PMC leaves missing metadata null", () => {
  const a = parseEuropePmc({ resultList: { result: [{ id: "1", title: "Minimal" }] } })[0];
  assert.equal(a.abstract, null);
  assert.equal(a.doi, null);
});

test("parses Crossref bibliographic metadata", () => {
  const a = parseCrossref({
    message: {
      items: [
        {
          DOI: "10.5555/X",
          title: ["Work"],
          publisher: "Publisher",
          "container-title": ["Journal"],
          published: { "date-parts": [[2023, 2, 3]] },
          author: [{ given: "A", family: "B" }],
        },
      ],
    },
  })[0];
  assert.equal(a.doi, "10.5555/x");
  assert.equal(a.publishedAt, "2023-02-03");
  assert.equal(a.publisher, "Publisher");
});
test("Crossref strips markup from supplied abstract", () =>
  assert.equal(
    parseCrossref({
      message: {
        items: [{ DOI: "10.5555/X", title: ["Work"], abstract: "<jats:p>Hello</jats:p>" }],
      },
    })[0].abstract,
    "Hello",
  ));

test("HTTP does not retry permanent errors", async () => {
  let calls = 0;
  await assert.rejects(
    fetchScientific(new URL("https://example.test"), {
      retries: 2,
      fetchImpl: async () => {
        calls++;
        return new Response("", { status: 400 });
      },
    }),
    ScientificHttpError,
  );
  assert.equal(calls, 1);
});
test("HTTP retries 429 then succeeds", async () => {
  let calls = 0;
  const response = await fetchScientific(new URL("https://example.test"), {
    retries: 1,
    fetchImpl: async () =>
      ++calls === 1
        ? new Response("", { status: 429, headers: { "retry-after": "0" } })
        : new Response("ok"),
  });
  assert.equal(await response.text(), "ok");
  assert.equal(calls, 2);
});
test("HTTP timeout is bounded", async () => {
  await assert.rejects(
    fetchScientific(new URL("https://example.test"), {
      timeoutMs: 5,
      retries: 0,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        ),
    }),
  );
});
