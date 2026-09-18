import { CrossrefAdapter } from "../src/server/scientific/adapters/crossref.server";
import { EuropePmcAdapter } from "../src/server/scientific/adapters/europe-pmc.server";
import { PubMedAdapter } from "../src/server/scientific/adapters/pubmed.server";
import { deduplicateArticles } from "../src/server/scientific/merge";

const query = "BRCA1 breast cancer";
const adapters = [new PubMedAdapter(), new EuropePmcAdapter(), new CrossrefAdapter()];
const results = [];
for (const adapter of adapters) {
  try {
    const articles = await adapter.discover({ query, limit: 5 });
    results.push(...articles);
    console.log(
      JSON.stringify({
        source: adapter.source,
        status: "PASS",
        count: articles.length,
        withIdentifiers: articles.filter((a) => a.doi || a.pmid || a.pmcid).length,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        source: adapter.source,
        status: "NOT_TESTABLE",
        error: error instanceof Error ? error.message : "request failed",
      }),
    );
  }
}
console.log(
  JSON.stringify({ combined: results.length, deduplicated: deduplicateArticles(results).length }),
);
