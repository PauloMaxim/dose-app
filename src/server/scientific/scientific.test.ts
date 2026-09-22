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
  const sources = new Map([
    ["dose_catalog:select", { article_id: id, provider: "dose_catalog", external_id: "select" }],
  ]);

  class Query {
    private filters: Record<string, unknown> = {};
    private operation = "select";
    private payload: any;
    constructor(private table: string) {}
    select() {
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
    or() {
      return this;
    }
    limit() {
      return this;
    }
    maybeSingle() {
      if (this.table === "articles") return Promise.resolve({ data: row, error: null });
      const key = `${this.filters.provider}:${this.filters.external_id}`;
      return Promise.resolve({ data: sources.get(key) ?? null, error: null });
    }
    single() {
      if (this.operation === "update") Object.assign(row, this.payload);
      return Promise.resolve({ data: this.table === "articles" ? row : null, error: null });
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
  const client = { from: (table: string) => new Query(table) } as unknown as SupabaseClient;
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
