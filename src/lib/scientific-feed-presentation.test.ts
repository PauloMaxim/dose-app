import assert from "node:assert/strict";
import test from "node:test";
import type { RankedFeedItem } from "@/server/scientific/feed";
import { presentScientificFeedItem } from "./scientific-feed-presentation";

const rankedItem = {
  article: {
    id: "real-article-id",
    title: "Original scientific title",
    abstract: "Source abstract, not an AI summary.",
    authors: [
      { given: "Ana", family: "Silva", collectiveName: null, orcid: null },
      { given: null, family: null, collectiveName: "Study Group", orcid: null },
    ],
    journal: "Journal of Evidence",
    publisher: "Publisher",
    publishedAt: "2026-09-01",
    doi: "10.1000/test",
    pmid: "123",
    pmcid: "PMC123",
    language: "eng",
    publicationTypes: ["Randomized Controlled Trial"],
    volume: "1",
    issue: "2",
    pages: "3-4",
    keywords: [],
    meshTerms: [],
    ingestedAt: null,
    updatedAt: null,
    originalUrl: "javascript:alert(1)",
    pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/123/",
    pmcUrl: null,
    doiUrl: "https://doi.org/10.1000/test",
    topics: [],
  },
  classification: {
    studyType: "randomized_trial",
    evidenceLevel: "high",
    ruleVersion: "3b.1",
    matchedTerm: "randomized controlled trial",
  },
  score: 9000,
  scoreTotal: 9000,
  scoreComponents: {
    topicMatch: 4700,
    evidenceLevel: 2500,
    recency: 1550,
    metadataCompleteness: 250,
    savedPreference: 0,
  },
  rankingVersion: "feed-ranking-v1",
  rank: 1,
  feedEligible: true,
  summaryEligible: false,
  matchedTopics: [
    {
      topicId: "heart-failure",
      specialtyId: "cardiology",
      confidence: 0.8,
      method: "deterministic_rules",
      ruleVersion: "1",
      evidence: [],
    },
  ],
  reasons: {
    topicMatch: 4700,
    evidenceLevel: 2500,
    recency: 1550,
    metadataCompleteness: 250,
    savedPreference: 0,
  },
  userState: { saved: false, read: false },
} satisfies RankedFeedItem;

test("presentation preserves scientific metadata, provenance and personalized relevance", () => {
  const presented = presentScientificFeedItem(rankedItem);

  assert.equal(presented.title, rankedItem.article.title);
  assert.equal(presented.abstract, rankedItem.article.abstract);
  assert.deepEqual(presented.authors, ["Ana Silva", "Study Group"]);
  assert.deepEqual(
    {
      journal: presented.journal,
      publishedAt: presented.publishedAt,
      doi: presented.doi,
      pmid: presented.pmid,
      pmcid: presented.pmcid,
      publicationTypes: presented.publicationTypes,
    },
    {
      journal: rankedItem.article.journal,
      publishedAt: rankedItem.article.publishedAt,
      doi: rankedItem.article.doi,
      pmid: rankedItem.article.pmid,
      pmcid: rankedItem.article.pmcid,
      publicationTypes: rankedItem.article.publicationTypes,
    },
  );
  assert.deepEqual(presented.relevance, {
    score: 9000,
    rank: 1,
    topicMatch: 4700,
    savedPreference: 0,
  });
  assert.deepEqual(presented.matchedTopics, [
    {
      topicId: "heart-failure",
      specialtyId: "cardiology",
      confidence: 0.8,
    },
  ]);
  assert.deepEqual(
    presented.sourceLinks.map((link) => link.label),
    ["PubMed", "DOI"],
  );
});

test("presentation does not synthesize editorial or summary fields", () => {
  const presented = presentScientificFeedItem(rankedItem);
  assert.equal("evidenceLevel" in presented, false);
  for (const fabricatedField of [
    "synopsis",
    "practice",
    "tldr",
    "learned",
    "results",
    "limitations",
  ])
    assert.equal(fabricatedField in presented, false);
});
