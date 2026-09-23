import assert from "node:assert/strict";
import test from "node:test";
import { resolveArticleRouteKind } from "../../lib/article-route";
import { toScientificArticleDetail } from "./article-detail";
import { queryScientificArticleDetail } from "./article-detail.server";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID,
    title: "Original scientific title",
    authors: [{ given: "Ada", family: "Lovelace", collectiveName: null }],
    journal: "Journal of Real Results",
    publisher: "Scientific Publisher",
    published_at: "2026-09-01",
    doi: "10.1000/real",
    pmid: "12345678",
    pmcid: "PMC123456",
    abstract: "Source supplied abstract.",
    publication_types: ["Journal Article"],
    study_type: "cohort",
    classification_version: "rules-v1",
    original_url: "https://example.org/article",
    pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
    pmc_url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC123456/",
    doi_url: "https://doi.org/10.1000/real",
    article_sources: [{ provider: "pubmed", external_id: "12345678", source_url: null }],
    article_topics: [
      {
        topics: {
          id: "223e4567-e89b-12d3-a456-426614174000",
          name: "Cardiologia preventiva",
          specialties: {
            id: "323e4567-e89b-12d3-a456-426614174000",
            name: "Cardiologia",
          },
        },
      },
    ],
    ...overrides,
  };
}

test("scientific detail accepts each real provenance and rejects dose_catalog-only", () => {
  for (const provider of ["pubmed", "europe_pmc", "crossref"]) {
    assert.ok(
      toScientificArticleDetail(
        row({ article_sources: [{ provider, external_id: "source-id", source_url: null }] }),
      ),
    );
  }
  assert.equal(
    toScientificArticleDetail(
      row({ article_sources: [{ provider: "dose_catalog", external_id: "legacy" }] }),
    ),
    null,
  );
});

test("mixed provenance preserves real metadata without injecting legacy article fields", () => {
  const detail = toScientificArticleDetail(
    row({
      article_sources: [
        { provider: "dose_catalog", external_id: "summit" },
        { provider: "crossref", external_id: "10.1000/real" },
      ],
    }),
  );
  assert.ok(detail);
  assert.equal(detail.title, "Original scientific title");
  assert.equal(detail.doi, "10.1000/real");
  assert.equal(detail.pmid, "12345678");
  assert.equal(detail.pmcid, "PMC123456");
  assert.equal(detail.abstract, "Source supplied abstract.");
  for (const artificial of ["synopsis", "tldr", "practice", "minutes", "cover", "summary"])
    assert.equal(artificial in detail, false);
  assert.equal("evidenceLevel" in detail, false);
});

test("nullable scientific metadata remains absent rather than fabricated", () => {
  const detail = toScientificArticleDetail(
    row({ authors: null, journal: null, publisher: null, published_at: null, abstract: null }),
  );
  assert.ok(detail);
  assert.deepEqual(detail.authors, []);
  assert.equal(detail.journal, null);
  assert.equal(detail.publisher, null);
  assert.equal(detail.publishedAt, null);
  assert.equal(detail.abstract, null);
});

test("UUID routing never invokes legacy lookup while known slugs remain legacy", () => {
  let legacyCalls = 0;
  assert.equal(
    resolveArticleRouteKind(UUID, () => {
      legacyCalls += 1;
      return true;
    }),
    "scientific",
  );
  assert.equal(legacyCalls, 0);
  assert.equal(
    resolveArticleRouteKind("summit", (slug) => slug === "summit"),
    "legacy",
  );
  assert.equal(
    resolveArticleRouteKind("unknown", () => false),
    "not-found",
  );
});

test("detail query validates UUID, restricts real provenance and returns not-found", async () => {
  const calls: Array<[string, unknown]> = [];
  const terminal = { data: null, error: null };
  const query = {
    select(value: string) {
      calls.push(["select", value]);
      return this;
    },
    eq(field: string, value: unknown) {
      calls.push([`eq:${field}`, value]);
      return this;
    },
    in(field: string, value: unknown) {
      calls.push([`in:${field}`, value]);
      return this;
    },
    maybeSingle() {
      return terminal;
    },
  };
  const client = { from: (table: string) => (calls.push(["from", table]), query) };
  assert.equal(await queryScientificArticleDetail(client as never, UUID), null);
  assert.deepEqual(calls.find(([name]) => name === "in:article_sources.provider")?.[1], [
    "pubmed",
    "europe_pmc",
    "crossref",
  ]);
  await assert.rejects(() => queryScientificArticleDetail(client as never, "summit"));
});
