import assert from "node:assert/strict";
import test from "node:test";
import { ScientificHttpError } from "../http";
import { emptyArticle } from "../parse-utils";
import type {
  DiscoveryOptions,
  ScientificAdapter,
  ScientificArticle,
  ScientificSource,
} from "../types";
import { contextualNeedId } from "./contextual-authorization";
import {
  CONTEXTUAL_BIBLIOGRAPHIC_DISCOVERY_REQUEST_VERSION,
  MAX_CONTEXTUAL_DISCOVERY_RESULTS,
  BibliographicIdentityConflictError,
  contextualBibliographicDiscoveryRequestSchema,
  discoverContextualBibliographicCandidates,
  type ContextualBibliographicDiscoveryRequest,
  type ContextualDiscoveryAdapters,
} from "./contextual-bibliographic-discovery";
import { contextualNeedSchema, type ContextualNeed } from "./contextual-need";

const need: ContextualNeed = contextualNeedSchema.parse({
  version: "contextual-need.v1",
  articleId: "article:source",
  subject: {
    kind: "endpoint_measure",
    endpointId: "endpoint:primary",
    name: "Synthetic endpoint",
    measure: "synthetic measure",
  },
  supportingFactIds: ["fact:one", "fact:two"],
  evidenceAnchorIds: ["anchor:one"],
  detectedGap: "endpoint_measure_definition_not_structured",
  contextualQuestion: "What does the synthetic measure measure?",
  editorialPurpose: "explain_endpoint_measure",
  method: { name: "central-endpoint-structural-gap", version: "1" },
  status: "candidate",
});

const request = (
  values: Partial<ContextualBibliographicDiscoveryRequest> = {},
): ContextualBibliographicDiscoveryRequest => ({
  schemaVersion: CONTEXTUAL_BIBLIOGRAPHIC_DISCOVERY_REQUEST_VERSION,
  id: "discovery:synthetic",
  contextualNeedId: contextualNeedId(need),
  intent: "bibliographic_discovery",
  query: "human reviewed bibliographic query",
  sources: ["pubmed"],
  limit: 5,
  ...values,
});

function article(
  source: ScientificSource,
  externalId: string,
  values: Partial<ScientificArticle> = {},
) {
  return {
    ...emptyArticle(source, "Synthetic bibliographic candidate", externalId),
    ...values,
  };
}

class FakeAdapter implements ScientificAdapter {
  calls: DiscoveryOptions[] = [];

  constructor(
    readonly source: ScientificSource,
    private readonly response: ScientificArticle[] | Error = [],
  ) {}

  async discover(options: DiscoveryOptions) {
    this.calls.push(structuredClone(options));
    if (this.response instanceof Error) throw this.response;
    return structuredClone(this.response);
  }
}

function adapters(values: Partial<Record<ScientificSource, ScientificAdapter>> = {}) {
  return {
    pubmed: values.pubmed ?? new FakeAdapter("pubmed"),
    europe_pmc: values.europe_pmc ?? new FakeAdapter("europe_pmc"),
    crossref: values.crossref ?? new FakeAdapter("crossref"),
  } satisfies ContextualDiscoveryAdapters;
}

test("requires a valid contextual need before calling an adapter", async () => {
  const pubmed = new FakeAdapter("pubmed");
  await assert.rejects(
    discoverContextualBibliographicCandidates(
      { ...need, status: "approved" } as unknown as ContextualNeed,
      request(),
      adapters({ pubmed }),
    ),
  );
  assert.equal(pubmed.calls.length, 0);
});

test("binds an explicit request to the exact contextual need identity", async () => {
  const changed = structuredClone(need);
  changed.contextualQuestion = "A revised question";
  const pubmed = new FakeAdapter("pubmed");
  await assert.rejects(
    discoverContextualBibliographicCandidates(changed, request(), adapters({ pubmed })),
    /exact contextual need identity/,
  );
  assert.equal(pubmed.calls.length, 0);
});

test("requires an explicit non-empty human-supplied query", () => {
  assert.equal(
    contextualBibliographicDiscoveryRequestSchema.safeParse(request({ query: " " })).success,
    false,
  );
  assert.equal(
    contextualBibliographicDiscoveryRequestSchema.safeParse({
      ...request(),
      intent: undefined,
    }).success,
    false,
  );
});

test("allows only unique PubMed, Europe PMC, and Crossref selections", () => {
  assert.equal(
    contextualBibliographicDiscoveryRequestSchema.safeParse({
      ...request(),
      sources: ["fda"],
    }).success,
    false,
  );
  assert.equal(
    contextualBibliographicDiscoveryRequestSchema.safeParse({
      ...request(),
      sources: ["pubmed", "pubmed"],
    }).success,
    false,
  );
});

test("passes the reviewed query and small limit only to explicitly selected adapters", async () => {
  const pubmed = new FakeAdapter("pubmed", [article("pubmed", "7", { pmid: "7" })]);
  const crossref = new FakeAdapter("crossref");
  await discoverContextualBibliographicCandidates(
    need,
    request({ query: " exact query ", limit: 2 }),
    adapters({ pubmed, crossref }),
  );
  assert.deepEqual(pubmed.calls, [
    { query: "exact query", sources: ["pubmed"], limit: 2, offset: 0 },
  ]);
  assert.equal(crossref.calls.length, 0);
  assert.equal(
    contextualBibliographicDiscoveryRequestSchema.safeParse(
      request({ limit: MAX_CONTEXTUAL_DISCOVERY_RESULTS + 1 }),
    ).success,
    false,
  );
});

test("returns an explicit empty result without persistence or fabricated candidates", async () => {
  assert.deepEqual(await discoverContextualBibliographicCandidates(need, request(), adapters()), {
    candidates: [],
    failures: [],
    discardedWithoutBibliographicIdentity: 0,
  });
});

test("preserves DOI, PMID, PMCID, locators, publication metadata, source, and need provenance", async () => {
  const input = article("europe_pmc", "record-9", {
    doi: "HTTPS://DOI.ORG/10.1234/SYNTHETIC",
    pmid: "9",
    pmcid: "pmc99",
    authors: [{ given: "Ada", family: "Lovelace", collectiveName: null, orcid: null }],
    journal: "Synthetic Journal",
    publisher: "Synthetic Publisher",
    publishedAt: "2025-02-03",
    language: "eng",
    publicationTypes: ["journal article"],
    volume: "4",
    issue: "2",
    pages: "1-5",
    originalUrl: "https://example.test/record-9",
  });
  input.provenance[0].sourceUrl = "https://example.test/source/record-9";
  const result = await discoverContextualBibliographicCandidates(
    need,
    request({ sources: ["europe_pmc"] }),
    adapters({ europe_pmc: new FakeAdapter("europe_pmc", [input]) }),
  );
  const candidate = result.candidates[0];
  assert.deepEqual(candidate.canonicalIdentifier, { scheme: "doi", value: "10.1234/synthetic" });
  assert.deepEqual(candidate.identifiers, {
    doi: "10.1234/synthetic",
    pmid: "9",
    pmcid: "PMC99",
  });
  assert.deepEqual(candidate.returnedBy, ["europe_pmc"]);
  assert.ok(candidate.locators.includes("https://example.test/source/record-9"));
  assert.equal(candidate.publicationMetadata.journal, "Synthetic Journal");
  assert.equal(candidate.discoveryProvenance.query, request().query);
  assert.deepEqual(candidate.contextualNeed, need);
});

test("represents absent publication metadata without inventing values", async () => {
  const result = await discoverContextualBibliographicCandidates(
    need,
    request(),
    adapters({ pubmed: new FakeAdapter("pubmed", [article("pubmed", "10", { pmid: "10" })]) }),
  );
  assert.deepEqual(result.candidates[0].publicationMetadata, {
    authors: [],
    journal: null,
    publisher: null,
    publishedAt: null,
    language: null,
    publicationTypes: [],
    volume: null,
    issue: null,
    pages: null,
  });
  assert.equal("abstract" in result.candidates[0], false);
});

test("deduplicates connected records by available identifiers and retains source provenance", async () => {
  const pubmed = article("pubmed", "42", { pmid: "42", doi: "10.5555/shared" });
  const crossref = article("crossref", "10.5555/shared", { doi: "10.5555/shared" });
  const result = await discoverContextualBibliographicCandidates(
    need,
    request({ sources: ["crossref", "pubmed"] }),
    adapters({
      pubmed: new FakeAdapter("pubmed", [pubmed]),
      crossref: new FakeAdapter("crossref", [crossref]),
    }),
  );
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.candidates[0].returnedBy, ["crossref", "pubmed"]);
  assert.equal(result.candidates[0].identifiers.pmid, "42");
});

test("consolidation is identical when source and record return orders are reversed", async () => {
  const pubmedRecords = [
    article("pubmed", "42", {
      pmid: "42",
      doi: "10.5555/shared",
      abstract: "short",
    }),
    article("pubmed", "7", { pmid: "7" }),
  ];
  const crossrefRecords = [
    article("crossref", "10.5555/shared", {
      doi: "10.5555/shared",
      abstract: "A deterministic and longer synthetic abstract",
    }),
    article("crossref", "10.5555/independent", { doi: "10.5555/independent" }),
  ];
  const forward = await discoverContextualBibliographicCandidates(
    need,
    request({ sources: ["pubmed", "crossref"] }),
    adapters({
      pubmed: new FakeAdapter("pubmed", pubmedRecords),
      crossref: new FakeAdapter("crossref", crossrefRecords),
    }),
  );
  const reversed = await discoverContextualBibliographicCandidates(
    need,
    request({ sources: ["crossref", "pubmed"] }),
    adapters({
      pubmed: new FakeAdapter("pubmed", [...pubmedRecords].reverse()),
      crossref: new FakeAdapter("crossref", [...crossrefRecords].reverse()),
    }),
  );

  assert.deepEqual(reversed, forward);
});

test("rejects identifier-linked records with conflicting DOI, PMID, or PMCID", async () => {
  const cases: Array<{
    scheme: "doi" | "pmid" | "pmcid";
    first: Partial<ScientificArticle>;
    second: Partial<ScientificArticle>;
    values: string[];
  }> = [
    {
      scheme: "doi",
      first: { pmid: "42", doi: "10.1000/first" },
      second: { pmid: "42", doi: "10.1000/second" },
      values: ["10.1000/first", "10.1000/second"],
    },
    {
      scheme: "pmid",
      first: { doi: "10.1000/shared", pmid: "41" },
      second: { doi: "10.1000/shared", pmid: "42" },
      values: ["41", "42"],
    },
    {
      scheme: "pmcid",
      first: { doi: "10.1000/shared", pmcid: "PMC41" },
      second: { doi: "10.1000/shared", pmcid: "PMC42" },
      values: ["PMC41", "PMC42"],
    },
  ];

  for (const conflict of cases) {
    await assert.rejects(
      discoverContextualBibliographicCandidates(
        need,
        request({ sources: ["pubmed", "crossref"] }),
        adapters({
          pubmed: new FakeAdapter("pubmed", [article("pubmed", "first", conflict.first)]),
          crossref: new FakeAdapter("crossref", [article("crossref", "second", conflict.second)]),
        }),
      ),
      (error) => {
        assert.ok(error instanceof BibliographicIdentityConflictError);
        assert.deepEqual(error.conflicts, [{ scheme: conflict.scheme, values: conflict.values }]);
        return true;
      },
    );
  }
});

test("preserves original provenance and records the returning adapter separately", async () => {
  const returned = article("pubmed", "42", { pmid: "42" });
  returned.provenance[0] = {
    source: "crossref",
    externalId: "original-crossref-record",
    sourceUrl: "https://example.test/original",
    discoveredBy: "europe_pmc",
    isOpenAccess: true,
    license: "synthetic-license",
  };
  const result = await discoverContextualBibliographicCandidates(
    need,
    request(),
    adapters({ pubmed: new FakeAdapter("pubmed", [returned]) }),
  );
  const candidate = result.candidates[0];

  assert.deepEqual(candidate.returnedBy, ["pubmed"]);
  assert.deepEqual(candidate.discoveryProvenance.sourceRecords, returned.provenance);
  assert.deepEqual(candidate.discoveryProvenance.adapterReturns, [
    {
      adapter: "pubmed",
      identifiers: { doi: null, pmid: "42", pmcid: null },
    },
  ]);
});

test("does not deduplicate distinct articles by title", async () => {
  const sameTitle = "The same synthetic title";
  const result = await discoverContextualBibliographicCandidates(
    need,
    request(),
    adapters({
      pubmed: new FakeAdapter("pubmed", [
        article("pubmed", "11", { pmid: "11", title: sameTitle }),
        article("pubmed", "12", { pmid: "12", title: sameTitle }),
      ]),
    }),
  );
  assert.deepEqual(
    result.candidates.map(({ identifiers }) => identifiers.pmid),
    ["11", "12"],
  );
});

test("discards records without DOI, PMID, or PMCID identity", async () => {
  const result = await discoverContextualBibliographicCandidates(
    need,
    request(),
    adapters({ pubmed: new FakeAdapter("pubmed", [article("pubmed", "opaque")]) }),
  );
  assert.equal(result.candidates.length, 0);
  assert.equal(result.discardedWithoutBibliographicIdentity, 1);
});

test("applies a deterministic identity order before the global result limit", async () => {
  const records = ["30", "10", "20"].map((pmid) => article("pubmed", pmid, { pmid }));
  const first = await discoverContextualBibliographicCandidates(
    need,
    request({ limit: 2 }),
    adapters({ pubmed: new FakeAdapter("pubmed", records) }),
  );
  const second = await discoverContextualBibliographicCandidates(
    need,
    request({ limit: 2 }),
    adapters({ pubmed: new FakeAdapter("pubmed", [...records].reverse()) }),
  );
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.candidates.map(({ identifiers }) => identifiers.pmid),
    ["10", "20"],
  );
});

test("reports an adapter failure while retaining successful source results", async () => {
  const result = await discoverContextualBibliographicCandidates(
    need,
    request({ sources: ["pubmed", "crossref"] }),
    adapters({
      pubmed: new FakeAdapter("pubmed", [article("pubmed", "1", { pmid: "1" })]),
      crossref: new FakeAdapter("crossref", new Error("synthetic failure")),
    }),
  );
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.failures, [{ source: "crossref", kind: "adapter_error" }]);
});

test("classifies simulated timeout and rate limiting without making network calls", async () => {
  const timeout = new Error("synthetic timeout");
  timeout.name = "AbortError";
  const result = await discoverContextualBibliographicCandidates(
    need,
    request({ sources: ["pubmed", "europe_pmc"] }),
    adapters({
      pubmed: new FakeAdapter("pubmed", timeout),
      europe_pmc: new FakeAdapter(
        "europe_pmc",
        new ScientificHttpError("synthetic rate limit", 429),
      ),
    }),
  );
  assert.deepEqual(result.failures, [
    { source: "europe_pmc", kind: "rate_limited", httpStatus: 429 },
    { source: "pubmed", kind: "timeout" },
  ]);
});

test("review metadata and candidate status do not create authorization, acquisition, claims, or facts", async () => {
  const result = await discoverContextualBibliographicCandidates(
    need,
    request({
      review: { reviewerId: "declared:reviewer", reviewedAt: "2026-09-28T12:00:00Z" },
    }),
    adapters({ pubmed: new FakeAdapter("pubmed", [article("pubmed", "5", { pmid: "5" })]) }),
  );
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    "ContextualAuthorization",
    "ExternalContextAcquisition",
    "ContextualClaimCandidate",
    "ContextualScientificMaterial",
    "ScientificFact",
    "acquisitionAnchor",
    "authorized",
  ])
    assert.equal(serialized.includes(forbidden), false);
  assert.equal(result.candidates[0].contextualNeed.status, "candidate");
});
